/**
 * Auto-Approve Authority Handler
 *
 * Automatically approves all proposals without deliberation.
 * Used when Actor is fully trusted (typically for human actors).
 *
 * Per Intent & Projection Specification v1.0:
 * - Auto-approve uses scopeProposal as-is for approvedScope
 * - If no scopeProposal, approvedScope is null (no restriction)
 */
import type { Proposal } from "../schema/proposal.js";
import type { ActorAuthorityBinding } from "../schema/binding.js";
import { approvedResponse, type AuthorityResponse } from "../schema/authority.js";
import type { AuthorityHandler } from "./types.js";

/**
 * Auto-approve authority handler
 */
export class AutoApproveHandler implements AuthorityHandler {
  /**
   * Always returns approved with scopeProposal as approvedScope
   */
  async evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse> {
    // Verify this is an auto-approve policy
    if (binding.policy.mode !== "auto_approve") {
      throw new Error(
        `AutoApproveHandler received non-auto_approve policy: ${binding.policy.mode}`
      );
    }

    // Per spec: auto-approve uses scopeProposal as approvedScope
    // If no scopeProposal, use null (no restriction)
    const approvedScope = proposal.intent.body.scopeProposal ?? null;
    return approvedResponse(approvedScope);
  }
}

/**
 * Create an auto-approve handler
 */
export function createAutoApproveHandler(): AutoApproveHandler {
  return new AutoApproveHandler();
}
