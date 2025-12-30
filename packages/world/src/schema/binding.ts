/**
 * Binding Schema
 *
 * Defines Actor-Authority bindings and policy types.
 *
 * Binding Rules (MUST):
 * - B-1: Every registered Actor MUST have exactly one Binding
 * - B-2: Bindings MUST be established before Actor can submit Proposals
 * - B-3: Binding changes MUST only affect future Proposals
 * - B-4: Proposals from unbound Actors MUST be rejected at submission
 * - B-5: Multiple Actors MAY share the same Authority
 */
import { z } from "zod";
import { ActorRef } from "./actor.js";
import { AuthorityRef } from "./authority.js";

// ============================================================================
// Policy Types
// ============================================================================

/**
 * Auto-Approve Policy
 * Used when Actor is fully trusted (typically for human actors).
 */
export const AutoApprovePolicy = z.object({
  mode: z.literal("auto_approve"),
  reason: z.string().optional(),
});
export type AutoApprovePolicy = z.infer<typeof AutoApprovePolicy>;

/**
 * Human-in-the-Loop Policy
 * Used when Actor needs human supervision.
 */
export const HITLPolicy = z.object({
  mode: z.literal("hitl"),
  /** Which human to ask */
  delegate: ActorRef,
  /** Optional timeout in ms */
  timeout: z.number().optional(),
  /** What to do on timeout */
  onTimeout: z.enum(["approve", "reject"]).optional(),
});
export type HITLPolicy = z.infer<typeof HITLPolicy>;

/**
 * Policy condition for rule-based decisions
 */
export const PolicyCondition = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("intent_type"),
    types: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("scope_pattern"),
    pattern: z.string(),
  }),
  z.object({
    kind: z.literal("custom"),
    evaluator: z.string(),
  }),
]);
export type PolicyCondition = z.infer<typeof PolicyCondition>;

/**
 * Policy rule for deterministic decisions
 */
export const PolicyRule = z.object({
  condition: PolicyCondition,
  decision: z.enum(["approve", "reject", "escalate"]),
  reason: z.string().optional(),
});
export type PolicyRule = z.infer<typeof PolicyRule>;

/**
 * Policy Rules Policy
 * Used for deterministic rule-based decisions.
 */
export const PolicyRulesPolicy = z.object({
  mode: z.literal("policy_rules"),
  rules: z.array(PolicyRule),
  defaultDecision: z.enum(["approve", "reject", "escalate"]),
  escalateTo: AuthorityRef.optional(),
});
export type PolicyRulesPolicy = z.infer<typeof PolicyRulesPolicy>;

/**
 * Quorum rule for tribunal decisions
 */
export const QuorumRule = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unanimous") }),
  z.object({ kind: z.literal("majority") }),
  z.object({ kind: z.literal("threshold"), count: z.number() }),
]);
export type QuorumRule = z.infer<typeof QuorumRule>;

/**
 * Tribunal Policy
 * Used for constitutional review by multiple agents.
 */
export const TribunalPolicy = z.object({
  mode: z.literal("tribunal"),
  members: z.array(ActorRef),
  quorum: QuorumRule,
  timeout: z.number().optional(),
  onTimeout: z.enum(["approve", "reject"]).optional(),
});
export type TribunalPolicy = z.infer<typeof TribunalPolicy>;

/**
 * All policy types
 */
export const AuthorityPolicy = z.discriminatedUnion("mode", [
  AutoApprovePolicy,
  HITLPolicy,
  PolicyRulesPolicy,
  TribunalPolicy,
]);
export type AuthorityPolicy = z.infer<typeof AuthorityPolicy>;

// ============================================================================
// Actor-Authority Binding
// ============================================================================

/**
 * Actor-Authority Binding
 *
 * Each Actor has exactly one Binding. Multiple Actors MAY share the same Authority.
 */
export const ActorAuthorityBinding = z.object({
  /** The actor being bound */
  actor: ActorRef,

  /** The authority that will judge this actor's proposals */
  authority: AuthorityRef,

  /** The policy used for judgment */
  policy: AuthorityPolicy,
});
export type ActorAuthorityBinding = z.infer<typeof ActorAuthorityBinding>;

// ============================================================================
// Default Bindings (RECOMMENDED)
// ============================================================================

/**
 * Default policy for human actors - auto-approve
 */
export function createDefaultHumanPolicy(): AutoApprovePolicy {
  return {
    mode: "auto_approve",
    reason: "Human actors are self-responsible",
  };
}

/**
 * Default policy for agent actors - HITL with owner as delegate
 */
export function createDefaultAgentPolicy(owner: ActorRef): HITLPolicy {
  return {
    mode: "hitl",
    delegate: owner,
    timeout: 3600000, // 1 hour
    onTimeout: "reject",
  };
}

/**
 * Default policy for system actors - policy rules with auto-approve
 */
export function createDefaultSystemPolicy(): PolicyRulesPolicy {
  return {
    mode: "policy_rules",
    rules: [],
    defaultDecision: "approve",
  };
}
