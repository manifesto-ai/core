/**
 * Policy Rules Authority Handler
 *
 * Evaluates proposals against deterministic rules.
 * Used for rule-based decisions without human involvement.
 *
 * Per Intent & Projection Specification v1.0:
 * - Policy rules use scopeProposal as approvedScope when approving
 * - If no scopeProposal, approvedScope is null (no restriction)
 */
import type { Proposal } from "../schema/proposal.js";
import type { ActorAuthorityBinding, PolicyRulesPolicy, PolicyRule, PolicyCondition } from "../schema/binding.js";
import type { IntentScope } from "../schema/intent.js";
import {
  approvedResponse,
  rejectedResponse,
  type AuthorityResponse,
} from "../schema/authority.js";
import type { AuthorityHandler } from "./types.js";

/**
 * Custom condition evaluator function type
 */
export type CustomConditionEvaluator = (
  proposal: Proposal,
  binding: ActorAuthorityBinding
) => boolean;

/**
 * Policy rules authority handler
 */
export class PolicyRulesHandler implements AuthorityHandler {
  private customEvaluators: Map<string, CustomConditionEvaluator> = new Map();

  /**
   * Register a custom condition evaluator
   *
   * @param name - Evaluator name (referenced in PolicyCondition)
   * @param evaluator - The evaluator function
   */
  registerCustomEvaluator(
    name: string,
    evaluator: CustomConditionEvaluator
  ): void {
    this.customEvaluators.set(name, evaluator);
  }

  /**
   * Evaluate a proposal against policy rules
   */
  async evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse> {
    const policy = binding.policy as PolicyRulesPolicy;

    if (policy.mode !== "policy_rules") {
      throw new Error(
        `PolicyRulesHandler received non-policy_rules policy: ${policy.mode}`
      );
    }

    // Get scopeProposal for use in approved responses
    const approvedScope = proposal.intent.body.scopeProposal ?? null;

    // Check each rule in order
    for (const rule of policy.rules) {
      if (this.evaluateCondition(rule.condition, proposal, binding)) {
        return this.applyDecision(rule.decision, rule.reason, approvedScope);
      }
    }

    // No rule matched, use default decision
    return this.applyDecision(policy.defaultDecision, "Default policy decision", approvedScope);
  }

  /**
   * Evaluate a single condition
   *
   * Note: With IntentInstance, intent type is at intent.body.type
   */
  private evaluateCondition(
    condition: PolicyCondition,
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): boolean {
    switch (condition.kind) {
      case "intent_type":
        // Per IntentInstance spec: type is in intent.body.type
        return condition.types.includes(proposal.intent.body.type);

      case "scope_pattern":
        // Check if intent type matches pattern (simple glob-like matching)
        return this.matchPattern(proposal.intent.body.type, condition.pattern);

      case "custom":
        const evaluator = this.customEvaluators.get(condition.evaluator);
        if (!evaluator) {
          console.warn(`Unknown custom evaluator: ${condition.evaluator}`);
          return false;
        }
        return evaluator(proposal, binding);

      default:
        return false;
    }
  }

  /**
   * Simple pattern matching (supports * as wildcard)
   */
  private matchPattern(value: string, pattern: string): boolean {
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    return regex.test(value);
  }

  /**
   * Apply a decision
   */
  private applyDecision(
    decision: "approve" | "reject" | "escalate",
    reason?: string,
    approvedScope?: IntentScope | null
  ): AuthorityResponse {
    switch (decision) {
      case "approve":
        return approvedResponse(approvedScope ?? null);
      case "reject":
        return rejectedResponse(reason || "Policy rejection");
      case "escalate":
        // For now, escalate means reject with explanation
        // In a full implementation, this would delegate to another authority
        return rejectedResponse(
          reason || "Policy requires escalation (not implemented)"
        );
    }
  }
}

/**
 * Create a policy rules handler
 */
export function createPolicyRulesHandler(): PolicyRulesHandler {
  return new PolicyRulesHandler();
}
