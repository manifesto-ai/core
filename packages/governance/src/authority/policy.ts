import type {
  ActorAuthorityBinding,
  AuthorityResponse,
  IntentScope,
  PolicyCondition,
  PolicyRule,
  Proposal,
} from "../types.js";
import type { AuthorityHandler } from "./types.js";

export type CustomConditionEvaluator = (
  proposal: Proposal,
  binding: ActorAuthorityBinding
) => boolean;

export class PolicyRulesHandler implements AuthorityHandler {
  private readonly customEvaluators = new Map<string, CustomConditionEvaluator>();

  registerCustomEvaluator(
    name: string,
    evaluator: CustomConditionEvaluator
  ): void {
    this.customEvaluators.set(name, evaluator);
  }

  async evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse> {
    if (binding.policy.mode !== "policy_rules") {
      throw new Error(
        `PolicyRulesHandler received non-policy_rules policy: ${binding.policy.mode}`
      );
    }

    const approvedScope = proposal.intent.scopeProposal ?? null;
    for (const rule of binding.policy.rules) {
      if (this.evaluateCondition(rule.condition, proposal, binding)) {
        return this.applyDecision(rule, approvedScope);
      }
    }

    return this.applyDecision(
      {
        decision: binding.policy.defaultDecision,
        reason: "Default policy decision",
      },
      approvedScope
    );
  }

  private evaluateCondition(
    condition: PolicyCondition,
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): boolean {
    switch (condition.kind) {
      case "intent_type":
        return condition.types.includes(proposal.intent.type);
      case "scope_pattern":
        return this.matchPattern(proposal.intent.type, condition.pattern);
      case "custom": {
        const evaluator = this.customEvaluators.get(condition.evaluator);
        return evaluator ? evaluator(proposal, binding) : false;
      }
    }
  }

  private matchPattern(value: string, pattern: string): boolean {
    const regex = new RegExp(
      `^${pattern.replace(/\*/g, ".*").replace(/\?/g, ".")}$`
    );
    return regex.test(value);
  }

  private applyDecision(
    rule: Pick<PolicyRule, "decision" | "reason">,
    approvedScope: IntentScope | null
  ): AuthorityResponse {
    switch (rule.decision) {
      case "approve":
        return { kind: "approved", approvedScope };
      case "reject":
        return { kind: "rejected", reason: rule.reason ?? "Policy rejection" };
      case "escalate":
        return {
          kind: "rejected",
          reason: rule.reason ?? "Policy requires escalation (not implemented)",
        };
    }
  }
}

export function createPolicyRulesHandler(): PolicyRulesHandler {
  return new PolicyRulesHandler();
}
