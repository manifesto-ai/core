/**
 * Tribunal Authority Handler
 *
 * Multi-agent review for constitutional decisions.
 * Collects votes from multiple actors and applies quorum rules.
 *
 * Per Intent & Projection Specification v1.0:
 * - Tribunal uses scopeProposal as approvedScope when approving
 * - If no scopeProposal, approvedScope is null (no restriction)
 */
import type { Proposal } from "../schema/proposal.js";
import type { ActorAuthorityBinding, TribunalPolicy, QuorumRule } from "../schema/binding.js";
import type { ActorRef } from "../schema/actor.js";
import type { Vote } from "../schema/decision.js";
import {
  approvedResponse,
  rejectedResponse,
  pendingTribunalResponse,
  type AuthorityResponse,
} from "../schema/authority.js";
import type { AuthorityHandler } from "./types.js";
import { createWorldError, hitlTimeout } from "../errors.js";

/**
 * Tribunal notification callback
 */
export type TribunalNotificationCallback = (
  proposalId: string,
  proposal: Proposal,
  members: ActorRef[]
) => void;

/**
 * Pending tribunal state
 */
interface TribunalPendingState {
  proposalId: string;
  proposal: Proposal;
  policy: TribunalPolicy;
  votes: Map<string, Vote>;
  resolve: (response: AuthorityResponse) => void;
  reject: (error: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * Tribunal authority handler
 */
export class TribunalHandler implements AuthorityHandler {
  private pendingTribunals: Map<string, TribunalPendingState> = new Map();
  private notificationCallback?: TribunalNotificationCallback;

  /**
   * Set callback for when tribunal decision is needed
   */
  onPendingTribunal(callback: TribunalNotificationCallback): void {
    this.notificationCallback = callback;
  }

  /**
   * Evaluate a proposal - creates tribunal and waits for votes
   */
  async evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse> {
    const policy = binding.policy as TribunalPolicy;

    if (policy.mode !== "tribunal") {
      throw new Error(
        `TribunalHandler received non-tribunal policy: ${policy.mode}`
      );
    }

    const proposalId = proposal.proposalId as string;

    // Check if already pending
    if (this.pendingTribunals.has(proposalId)) {
      throw createWorldError(
        "INVALID_ARGUMENT",
        `Proposal ${proposalId} already has a pending tribunal`
      );
    }

    return new Promise((resolve, reject) => {
      const state: TribunalPendingState = {
        proposalId,
        proposal,
        policy,
        votes: new Map(),
        resolve,
        reject,
      };

      // Set up timeout if configured
      if (policy.timeout) {
        state.timeoutId = setTimeout(() => {
          this.pendingTribunals.delete(proposalId);

          if (policy.onTimeout === "approve") {
            // Per spec: use scopeProposal as approvedScope on timeout approval
            const approvedScope = proposal.intent.body.scopeProposal ?? null;
            resolve(approvedResponse(approvedScope));
          } else {
            reject(hitlTimeout(proposalId, policy.timeout!));
          }
        }, policy.timeout);
      }

      this.pendingTribunals.set(proposalId, state);

      // Notify that tribunal is needed
      if (this.notificationCallback) {
        this.notificationCallback(proposalId, proposal, policy.members);
      }
    });
  }

  /**
   * Submit a vote from a tribunal member
   *
   * @param proposalId - The proposal being voted on
   * @param voter - The voting actor
   * @param decision - The vote (approve, reject, or abstain)
   * @param reasoning - Optional reasoning
   */
  submitVote(
    proposalId: string,
    voter: ActorRef,
    decision: "approve" | "reject" | "abstain",
    reasoning?: string
  ): void {
    const state = this.pendingTribunals.get(proposalId);

    if (!state) {
      throw createWorldError(
        "PROPOSAL_NOT_FOUND",
        `No pending tribunal for proposal ${proposalId}`
      );
    }

    // Check if voter is a member
    const isMember = state.policy.members.some(
      (m) => m.actorId === voter.actorId
    );
    if (!isMember) {
      throw createWorldError(
        "INVALID_ARGUMENT",
        `Actor ${voter.actorId} is not a tribunal member for proposal ${proposalId}`
      );
    }

    // Check if already voted
    if (state.votes.has(voter.actorId)) {
      throw createWorldError(
        "INVALID_ARGUMENT",
        `Actor ${voter.actorId} has already voted on proposal ${proposalId}`
      );
    }

    // Record vote
    const vote: Vote = {
      voter,
      decision,
      reasoning,
      votedAt: Date.now(),
    };
    state.votes.set(voter.actorId, vote);

    // Check if quorum is reached
    this.checkQuorum(state);
  }

  /**
   * Check if quorum has been reached and resolve if so
   */
  private checkQuorum(state: TribunalPendingState): void {
    const { policy, votes, resolve } = state;
    const memberCount = policy.members.length;
    const voteCount = votes.size;

    // Count approve/reject votes (abstain doesn't count)
    let approveCount = 0;
    let rejectCount = 0;

    for (const vote of votes.values()) {
      if (vote.decision === "approve") approveCount++;
      else if (vote.decision === "reject") rejectCount++;
    }

    let isComplete = false;
    let isApproved = false;

    switch (policy.quorum.kind) {
      case "unanimous":
        // Need all members to vote approve
        if (approveCount === memberCount) {
          isComplete = true;
          isApproved = true;
        } else if (rejectCount > 0 || voteCount === memberCount) {
          // Any reject or all voted without unanimous approve
          isComplete = true;
          isApproved = false;
        }
        break;

      case "majority":
        const majorityNeeded = Math.floor(memberCount / 2) + 1;
        if (approveCount >= majorityNeeded) {
          isComplete = true;
          isApproved = true;
        } else if (rejectCount >= majorityNeeded) {
          isComplete = true;
          isApproved = false;
        } else if (voteCount === memberCount) {
          // All voted, check result
          isComplete = true;
          isApproved = approveCount > rejectCount;
        }
        break;

      case "threshold":
        const threshold = policy.quorum.count;
        if (approveCount >= threshold) {
          isComplete = true;
          isApproved = true;
        } else if (rejectCount > memberCount - threshold) {
          // Impossible to reach threshold
          isComplete = true;
          isApproved = false;
        } else if (voteCount === memberCount) {
          // All voted
          isComplete = true;
          isApproved = approveCount >= threshold;
        }
        break;
    }

    if (isComplete) {
      // Clear timeout
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }

      // Remove from pending
      this.pendingTribunals.delete(state.proposalId);

      // Resolve
      if (isApproved) {
        // Per spec: use scopeProposal as approvedScope
        const approvedScope = state.proposal.intent.body.scopeProposal ?? null;
        resolve(approvedResponse(approvedScope));
      } else {
        resolve(rejectedResponse(`Tribunal rejected (${approveCount}/${memberCount} approved)`));
      }
    }
  }

  /**
   * Check if a proposal has a pending tribunal
   */
  isPending(proposalId: string): boolean {
    return this.pendingTribunals.has(proposalId);
  }

  /**
   * Get votes for a pending tribunal
   */
  getVotes(proposalId: string): Vote[] {
    const state = this.pendingTribunals.get(proposalId);
    if (!state) return [];
    return Array.from(state.votes.values());
  }

  /**
   * Get all pending tribunal proposal IDs
   */
  getPendingIds(): string[] {
    return Array.from(this.pendingTribunals.keys());
  }

  /**
   * Cancel a pending tribunal
   */
  cancelPending(proposalId: string, reason?: string): boolean {
    const state = this.pendingTribunals.get(proposalId);

    if (!state) {
      return false;
    }

    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }

    this.pendingTribunals.delete(proposalId);

    state.reject(
      createWorldError(
        "INVALID_ARGUMENT",
        reason || `Tribunal cancelled for proposal ${proposalId}`
      )
    );

    return true;
  }

  /**
   * Clear all pending tribunals
   */
  clearAllPending(): void {
    for (const [_, state] of this.pendingTribunals) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
      state.reject(
        createWorldError(
          "INVALID_ARGUMENT",
          "Tribunal handler cleared all pending tribunals"
        )
      );
    }
    this.pendingTribunals.clear();
  }
}

/**
 * Create a tribunal handler
 */
export function createTribunalHandler(): TribunalHandler {
  return new TribunalHandler();
}
