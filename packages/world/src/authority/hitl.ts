/**
 * Human-in-the-Loop (HITL) Authority Handler
 *
 * Requires human approval for proposals.
 * Supports async decision-making with optional timeout.
 *
 * Per Intent & Projection Specification v1.0:
 * - Human can approve with modified scope
 * - Human can approve with no restriction (null)
 * - submitDecision accepts optional approvedScope
 */
import type { Proposal } from "../schema/proposal.js";
import type { ActorAuthorityBinding, HITLPolicy } from "../schema/binding.js";
import type { IntentScope } from "../schema/intent.js";
import {
  approvedResponse,
  rejectedResponse,
  pendingHumanResponse,
  type AuthorityResponse,
} from "../schema/authority.js";
import type { AuthorityHandler, HITLPendingState } from "./types.js";
import { hitlTimeout, createWorldError } from "../errors.js";

/**
 * HITL notification callback
 */
export type HITLNotificationCallback = (
  proposalId: string,
  proposal: Proposal,
  binding: ActorAuthorityBinding
) => void;

/**
 * HITL authority handler
 */
export class HITLHandler implements AuthorityHandler {
  private pendingDecisions: Map<string, HITLPendingState> = new Map();
  private notificationCallback?: HITLNotificationCallback;

  /**
   * Set callback for when HITL decision is needed
   */
  onPendingDecision(callback: HITLNotificationCallback): void {
    this.notificationCallback = callback;
  }

  /**
   * Evaluate a proposal - returns pending and waits for human decision
   */
  async evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse> {
    const policy = binding.policy as HITLPolicy;

    if (policy.mode !== "hitl") {
      throw new Error(
        `HITLHandler received non-hitl policy: ${policy.mode}`
      );
    }

    const proposalId = proposal.proposalId as string;

    // Check if already pending
    if (this.pendingDecisions.has(proposalId)) {
      throw createWorldError(
        "INVALID_ARGUMENT",
        `Proposal ${proposalId} already has a pending HITL decision`
      );
    }

    // Create a promise that will resolve when decision is received
    return new Promise((resolve, reject) => {
      const state: HITLPendingState = {
        proposalId,
        proposal, // Store proposal for accessing scopeProposal later
        resolve,
        reject,
      };

      // Set up timeout if configured
      if (policy.timeout) {
        state.timeoutId = setTimeout(() => {
          this.pendingDecisions.delete(proposalId);

          if (policy.onTimeout === "approve") {
            // Per spec: use scopeProposal as approvedScope on timeout approval
            const approvedScope = proposal.intent.body.scopeProposal ?? null;
            resolve(approvedResponse(approvedScope));
          } else {
            // Default to reject on timeout
            reject(hitlTimeout(proposalId, policy.timeout!));
          }
        }, policy.timeout);
      }

      this.pendingDecisions.set(proposalId, state);

      // Notify that decision is needed
      if (this.notificationCallback) {
        this.notificationCallback(proposalId, proposal, binding);
      }
    });
  }

  /**
   * Submit a decision for a pending proposal
   *
   * @param proposalId - The proposal to decide
   * @param decision - The decision (approved or rejected)
   * @param reasoning - Optional reasoning
   * @param approvedScope - The approved scope (only used if decision is "approved")
   *                        If undefined, uses scopeProposal from the proposal
   *                        If null, means no restriction
   */
  submitDecision(
    proposalId: string,
    decision: "approved" | "rejected",
    reasoning?: string,
    approvedScope?: IntentScope | null
  ): void {
    const state = this.pendingDecisions.get(proposalId);

    if (!state) {
      throw createWorldError(
        "HITL_NOT_PENDING",
        `No pending HITL decision for proposal ${proposalId}`
      );
    }

    // Clear timeout
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }

    // Remove from pending
    this.pendingDecisions.delete(proposalId);

    // Resolve the promise
    if (decision === "approved") {
      // Use provided approvedScope, or default to scopeProposal, or null if none
      const scope = approvedScope !== undefined
        ? approvedScope
        : (state.proposal?.intent.body.scopeProposal ?? null);
      state.resolve(approvedResponse(scope));
    } else {
      state.resolve(rejectedResponse(reasoning || "Human rejected"));
    }
  }

  /**
   * Check if a proposal is pending HITL decision
   */
  isPending(proposalId: string): boolean {
    return this.pendingDecisions.has(proposalId);
  }

  /**
   * Get all pending proposal IDs
   */
  getPendingIds(): string[] {
    return Array.from(this.pendingDecisions.keys());
  }

  /**
   * Cancel a pending decision
   */
  cancelPending(proposalId: string, reason?: string): boolean {
    const state = this.pendingDecisions.get(proposalId);

    if (!state) {
      return false;
    }

    // Clear timeout
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }

    // Remove from pending
    this.pendingDecisions.delete(proposalId);

    // Reject the promise
    state.reject(
      createWorldError(
        "HITL_NOT_PENDING",
        reason || `HITL decision cancelled for proposal ${proposalId}`
      )
    );

    return true;
  }

  /**
   * Clear all pending decisions
   */
  clearAllPending(): void {
    for (const [proposalId, state] of this.pendingDecisions) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
      state.reject(
        createWorldError(
          "HITL_NOT_PENDING",
          `HITL handler cleared all pending decisions`
        )
      );
    }
    this.pendingDecisions.clear();
  }
}

/**
 * Create a HITL handler
 */
export function createHITLHandler(): HITLHandler {
  return new HITLHandler();
}
