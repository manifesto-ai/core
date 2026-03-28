import type {
  ActorAuthorityBinding,
  ActorRef,
  AuthorityResponse,
  Proposal,
  Vote,
} from "../types.js";
import type { AuthorityHandler } from "./types.js";

export type TribunalNotificationCallback = (
  proposalId: string,
  proposal: Proposal,
  members: readonly ActorRef[]
) => void;

interface TribunalPendingState {
  proposalId: string;
  proposal: Proposal;
  binding: Extract<ActorAuthorityBinding, { policy: { mode: "tribunal" } }> | ActorAuthorityBinding;
  votes: Map<string, Vote>;
  resolve: (response: AuthorityResponse) => void;
  reject: (error: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
}

export class TribunalHandler implements AuthorityHandler {
  private readonly pendingTribunals = new Map<string, TribunalPendingState>();
  private notificationCallback?: TribunalNotificationCallback;

  onPendingTribunal(callback: TribunalNotificationCallback): void {
    this.notificationCallback = callback;
  }

  async evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse> {
    if (binding.policy.mode !== "tribunal") {
      throw new Error(
        `TribunalHandler received non-tribunal policy: ${binding.policy.mode}`
      );
    }
    const policy = binding.policy;

    const proposalId = proposal.proposalId;
    if (this.pendingTribunals.has(proposalId)) {
      throw new Error(`Proposal ${proposalId} already has a pending tribunal`);
    }

    return new Promise((resolve, reject) => {
      const state: TribunalPendingState = {
        proposalId,
        proposal,
        binding,
        votes: new Map(),
        resolve,
        reject,
      };

      if (policy.timeout != null) {
        state.timeoutId = setTimeout(() => {
          this.pendingTribunals.delete(proposalId);
          if (policy.onTimeout === "approve") {
            resolve({
              kind: "approved",
              approvedScope: proposal.intent.scopeProposal ?? null,
            });
            return;
          }
          reject(
            new Error(
              `Tribunal decision timed out after ${policy.timeout}ms for proposal '${proposalId}'`
            )
          );
        }, policy.timeout);
      }

      this.pendingTribunals.set(proposalId, state);
      this.notificationCallback?.(
        proposalId,
        proposal,
        policy.members
      );
    });
  }

  submitVote(
    proposalId: string,
    voter: ActorRef,
    decision: "approve" | "reject" | "abstain",
    reasoning?: string
  ): void {
    const state = this.pendingTribunals.get(proposalId);
    if (!state) {
      throw new Error(`No pending tribunal for proposal ${proposalId}`);
    }

    if (state.votes.has(voter.actorId)) {
      throw new Error(`Actor ${voter.actorId} already voted on proposal ${proposalId}`);
    }

    const member = state.binding.policy.mode === "tribunal"
      ? state.binding.policy.members.some(({ actorId }) => actorId === voter.actorId)
      : false;
    if (!member) {
      throw new Error(`Actor ${voter.actorId} is not a tribunal member for proposal ${proposalId}`);
    }

    state.votes.set(voter.actorId, {
      voter,
      decision,
      reasoning,
      votedAt: Date.now(),
    });
    this.checkQuorum(state);
  }

  isPending(proposalId: string): boolean {
    return this.pendingTribunals.has(proposalId);
  }

  getVotes(proposalId: string): Vote[] {
    const state = this.pendingTribunals.get(proposalId);
    return state ? [...state.votes.values()] : [];
  }

  getPendingIds(): string[] {
    return [...this.pendingTribunals.keys()];
  }

  clearAllPending(): void {
    for (const [proposalId, state] of this.pendingTribunals) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
      state.reject(new Error(`Tribunal handler cleared pending proposal ${proposalId}`));
    }
    this.pendingTribunals.clear();
  }

  private checkQuorum(state: TribunalPendingState): void {
    const policy = state.binding.policy;
    if (policy.mode !== "tribunal") {
      return;
    }

    const memberCount = policy.members.length;
    let approveCount = 0;
    let rejectCount = 0;
    for (const vote of state.votes.values()) {
      if (vote.decision === "approve") {
        approveCount++;
      } else if (vote.decision === "reject") {
        rejectCount++;
      }
    }

    let isComplete = false;
    let isApproved = false;
    switch (policy.quorum.kind) {
      case "unanimous":
        if (approveCount === memberCount) {
          isComplete = true;
          isApproved = true;
        } else if (rejectCount > 0 || state.votes.size === memberCount) {
          isComplete = true;
        }
        break;
      case "majority": {
        const majorityNeeded = Math.floor(memberCount / 2) + 1;
        if (approveCount >= majorityNeeded) {
          isComplete = true;
          isApproved = true;
        } else if (rejectCount >= majorityNeeded) {
          isComplete = true;
        } else if (state.votes.size === memberCount) {
          isComplete = true;
          isApproved = approveCount > rejectCount;
        }
        break;
      }
      case "threshold":
        if (approveCount >= policy.quorum.count) {
          isComplete = true;
          isApproved = true;
        } else if (rejectCount > memberCount - policy.quorum.count) {
          isComplete = true;
        } else if (state.votes.size === memberCount) {
          isComplete = true;
          isApproved = approveCount >= policy.quorum.count;
        }
        break;
    }

    if (!isComplete) {
      return;
    }

    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }
    this.pendingTribunals.delete(state.proposalId);

    if (isApproved) {
      state.resolve({
        kind: "approved",
        approvedScope: state.proposal.intent.scopeProposal ?? null,
      });
      return;
    }

    state.resolve({
      kind: "rejected",
      reason: `Tribunal rejected (${approveCount}/${memberCount} approved)`,
    });
  }
}

export function createTribunalHandler(): TribunalHandler {
  return new TribunalHandler();
}
