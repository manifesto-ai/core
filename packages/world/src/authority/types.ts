/**
 * Authority Types
 *
 * Defines interfaces for authority handlers.
 */
import type { Proposal } from "../schema/proposal.js";
import type { ActorAuthorityBinding } from "../schema/binding.js";
import type { AuthorityResponse } from "../schema/authority.js";

/**
 * Authority handler interface
 *
 * Authority MUST:
 * - Evaluate every routed Proposal
 * - Return a decision: approved, rejected, or pending
 *
 * Authority MUST NOT:
 * - Execute effects
 * - Apply patches directly
 * - Modify Snapshots
 * - Skip Proposals
 */
export interface AuthorityHandler {
  /**
   * Evaluate a proposal
   *
   * @param proposal - The proposal to evaluate
   * @param binding - The actor-authority binding
   * @returns Authority response (approved, rejected, or pending)
   */
  evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse>;
}

/**
 * HITL decision callback
 */
export interface HITLDecisionCallback {
  (
    proposalId: string,
    decision: "approved" | "rejected",
    reasoning?: string
  ): void;
}

/**
 * HITL pending state
 */
export interface HITLPendingState {
  proposalId: string;
  /** The proposal being evaluated (for accessing scopeProposal) */
  proposal?: Proposal;
  resolve: (response: AuthorityResponse) => void;
  reject: (error: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
}
