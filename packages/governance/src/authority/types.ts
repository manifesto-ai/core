import type { ActorAuthorityBinding, AuthorityResponse, Proposal } from "../types.js";

export interface AuthorityHandler {
  evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse>;
}

export interface HITLDecisionCallback {
  (
    proposalId: string,
    decision: "approved" | "rejected",
    reasoning?: string
  ): void;
}

export interface HITLPendingState {
  proposalId: string;
  proposal?: Proposal;
  resolve: (response: AuthorityResponse) => void;
  reject: (error: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
}
