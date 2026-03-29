import type { ActorAuthorityBinding, AuthorityResponse, Proposal } from "../types.js";
import type { AuthorityHandler } from "./types.js";

export class AutoApproveHandler implements AuthorityHandler {
  async evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse> {
    if (binding.policy.mode !== "auto_approve") {
      throw new Error(
        `AutoApproveHandler received non-auto_approve policy: ${binding.policy.mode}`
      );
    }

    return {
      kind: "approved",
      approvedScope: proposal.intent.scopeProposal ?? null,
    };
  }
}

export function createAutoApproveHandler(): AutoApproveHandler {
  return new AutoApproveHandler();
}
