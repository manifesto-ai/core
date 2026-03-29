import type {
  ActorAuthorityBinding,
  AuthorityResponse,
  IntentScope,
  Proposal,
} from "../types.js";
import type { AuthorityHandler, HITLPendingState } from "./types.js";

export type HITLNotificationCallback = (
  proposalId: string,
  proposal: Proposal,
  binding: ActorAuthorityBinding
) => void;

export class HITLHandler implements AuthorityHandler {
  private readonly pendingDecisions = new Map<string, HITLPendingState>();
  private readonly notificationCallbacks = new Set<HITLNotificationCallback>();

  onPendingDecision(callback: HITLNotificationCallback): () => void {
    this.notificationCallbacks.add(callback);
    return () => {
      this.notificationCallbacks.delete(callback);
    };
  }

  async evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse> {
    if (binding.policy.mode !== "hitl") {
      throw new Error(`HITLHandler received non-hitl policy: ${binding.policy.mode}`);
    }
    const policy = binding.policy;

    const proposalId = proposal.proposalId;
    if (this.pendingDecisions.has(proposalId)) {
      throw new Error(`Proposal ${proposalId} already has a pending HITL decision`);
    }

    return new Promise((resolve, reject) => {
      const state: HITLPendingState = {
        proposalId,
        proposal,
        resolve,
        reject,
      };

      if (policy.timeout != null) {
        state.timeoutId = setTimeout(() => {
          this.pendingDecisions.delete(proposalId);
          if (policy.onTimeout === "approve") {
            resolve({
              kind: "approved",
              approvedScope: proposal.intent.scopeProposal ?? null,
            });
            return;
          }
          reject(
            new Error(
              `HITL decision timed out after ${policy.timeout}ms for proposal '${proposalId}'`
            )
          );
        }, policy.timeout);
      }

      this.pendingDecisions.set(proposalId, state);
      for (const callback of this.notificationCallbacks) {
        callback(proposalId, proposal, binding);
      }
    });
  }

  submitDecision(
    proposalId: string,
    decision: "approved" | "rejected",
    reasoning?: string,
    approvedScope?: IntentScope | null
  ): void {
    const state = this.pendingDecisions.get(proposalId);
    if (!state) {
      throw new Error(`No pending HITL decision for proposal ${proposalId}`);
    }

    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }
    this.pendingDecisions.delete(proposalId);

    if (decision === "approved") {
      state.resolve({
        kind: "approved",
        approvedScope:
          approvedScope !== undefined
            ? approvedScope
            : state.proposal?.intent.scopeProposal ?? null,
      });
      return;
    }

    state.resolve({
      kind: "rejected",
      reason: reasoning ?? "Human rejected",
    });
  }

  isPending(proposalId: string): boolean {
    return this.pendingDecisions.has(proposalId);
  }

  getPendingIds(): string[] {
    return [...this.pendingDecisions.keys()];
  }

  clearAllPending(): void {
    for (const [proposalId, state] of this.pendingDecisions) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
      state.reject(new Error(`HITL handler cleared pending proposal ${proposalId}`));
    }
    this.pendingDecisions.clear();
  }
}

export function createHITLHandler(): HITLHandler {
  return new HITLHandler();
}
