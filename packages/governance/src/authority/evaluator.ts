import type {
  ActorAuthorityBinding,
  AuthorityKind,
  AuthorityResponse,
  IntentScope,
  Proposal,
} from "../types.js";
import type { AuthorityHandler } from "./types.js";
import { AutoApproveHandler, createAutoApproveHandler } from "./auto.js";
import { HITLHandler, createHITLHandler } from "./hitl.js";
import { PolicyRulesHandler, createPolicyRulesHandler } from "./policy.js";
import { TribunalHandler, createTribunalHandler } from "./tribunal.js";

const POLICY_MODE_TO_KIND: Record<string, AuthorityKind> = {
  auto_approve: "auto",
  hitl: "human",
  policy_rules: "policy",
  tribunal: "tribunal",
};

export class AuthorityEvaluator {
  private readonly handlers = new Map<string, AuthorityHandler>();
  private readonly autoHandler: AutoApproveHandler;
  private readonly policyHandler: PolicyRulesHandler;
  private readonly hitlHandler: HITLHandler;
  private readonly tribunalHandler: TribunalHandler;

  constructor() {
    this.autoHandler = createAutoApproveHandler();
    this.policyHandler = createPolicyRulesHandler();
    this.hitlHandler = createHITLHandler();
    this.tribunalHandler = createTribunalHandler();

    this.handlers.set("auto_approve", this.autoHandler);
    this.handlers.set("hitl", this.hitlHandler);
    this.handlers.set("policy_rules", this.policyHandler);
    this.handlers.set("tribunal", this.tribunalHandler);
  }

  async evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse> {
    const handler = this.handlers.get(binding.policy.mode);
    if (!handler) {
      throw new Error(`Unknown policy mode: ${binding.policy.mode}`);
    }
    return handler.evaluate(proposal, binding);
  }

  registerHandler(policyMode: string, handler: AuthorityHandler): void {
    this.handlers.set(policyMode, handler);
  }

  getAutoHandler(): AutoApproveHandler {
    return this.autoHandler;
  }

  getPolicyHandler(): PolicyRulesHandler {
    return this.policyHandler;
  }

  getHITLHandler(): HITLHandler {
    return this.hitlHandler;
  }

  getTribunalHandler(): TribunalHandler {
    return this.tribunalHandler;
  }

  getAuthorityKind(policyMode: string): AuthorityKind | null {
    return POLICY_MODE_TO_KIND[policyMode] ?? null;
  }

  submitHITLDecision(
    proposalId: string,
    decision: "approved" | "rejected",
    reasoning?: string,
    approvedScope?: IntentScope | null
  ): void {
    this.hitlHandler.submitDecision(proposalId, decision, reasoning, approvedScope);
  }

  submitTribunalVote(
    proposalId: string,
    voter: {
      actorId: string;
      kind: "human" | "agent" | "system";
      name?: string;
    },
    decision: "approve" | "reject" | "abstain",
    reasoning?: string
  ): void {
    this.tribunalHandler.submitVote(proposalId, voter, decision, reasoning);
  }

  hasPendingHITL(): boolean {
    return this.hitlHandler.getPendingIds().length > 0;
  }

  hasPendingTribunal(): boolean {
    return this.tribunalHandler.getPendingIds().length > 0;
  }

  getPendingHITLIds(): string[] {
    return this.hitlHandler.getPendingIds();
  }

  getPendingTribunalIds(): string[] {
    return this.tribunalHandler.getPendingIds();
  }

  clearAllPending(): void {
    this.hitlHandler.clearAllPending();
    this.tribunalHandler.clearAllPending();
  }
}

export function createAuthorityEvaluator(): AuthorityEvaluator {
  return new AuthorityEvaluator();
}
