/**
 * TaskFlow Authority Configuration
 *
 * Defines authority bindings and policies for each actor type.
 * Per Manifesto 1.0v spec:
 * - Every Actor must have exactly one Authority binding
 * - Authority evaluates Proposals and issues decisions
 * - Authority MUST NOT execute effects or apply patches
 */

import {
  createAuthorityRef,
  createPolicyRulesHandler,
  type ActorAuthorityBinding,
  type PolicyRulesPolicy,
  type AutoApprovePolicy,
  type ActorRef,
  type AuthorityRef,
} from "@manifesto-ai/world";

import { ActorKinds, ActorIds, defaultActors } from "./actors";

/**
 * Authority IDs
 */
export const AuthorityIds = {
  USER_AUTHORITY: "authority:user",
  AGENT_AUTHORITY: "authority:agent",
  SYSTEM_AUTHORITY: "authority:system",
} as const;

/**
 * Authority references
 */
export const authorities = {
  user: createAuthorityRef(AuthorityIds.USER_AUTHORITY, "auto", "User Authority"),
  agent: createAuthorityRef(AuthorityIds.AGENT_AUTHORITY, "policy", "Agent Authority"),
  system: createAuthorityRef(AuthorityIds.SYSTEM_AUTHORITY, "auto", "System Authority"),
};

/**
 * User policy - auto-approve all actions
 * Humans are self-responsible for their actions.
 */
const userPolicy: AutoApprovePolicy = {
  mode: "auto_approve",
  reason: "Human users are fully trusted",
};

/**
 * Agent policy - approve most actions, reject dangerous ones
 * AI agents can perform most operations but cannot:
 * - Delete tasks (safety measure)
 * - Clear filters (UX protection)
 */
const agentPolicy: PolicyRulesPolicy = {
  mode: "policy_rules",
  rules: [
    // Allow all view and selection actions
    {
      condition: { kind: "intent_type", types: ["selectTask", "changeView"] },
      decision: "approve",
      reason: "Agents can freely navigate and select",
    },
    // Allow task creation
    {
      condition: { kind: "intent_type", types: ["createTask"] },
      decision: "approve",
      reason: "Agents can create tasks",
    },
    // Allow task updates
    {
      condition: { kind: "intent_type", types: ["updateTask"] },
      decision: "approve",
      reason: "Agents can update tasks",
    },
    // Allow task movement (status changes)
    {
      condition: { kind: "intent_type", types: ["moveTask"] },
      decision: "approve",
      reason: "Agents can move tasks between columns",
    },
    // Allow filter operations
    {
      condition: { kind: "intent_type", types: ["setFilter", "refreshFilters"] },
      decision: "approve",
      reason: "Agents can set and refresh filters",
    },
    // Reject delete operations from agents
    {
      condition: { kind: "intent_type", types: ["deleteTask"] },
      decision: "reject",
      reason: "AI agents cannot delete tasks - requires human confirmation",
    },
    // Reject restore operations from agents (trash management)
    {
      condition: { kind: "intent_type", types: ["restoreTask"] },
      decision: "reject",
      reason: "AI agents cannot restore tasks - requires human confirmation",
    },
  ],
  defaultDecision: "reject",
};

/**
 * System policy - auto-approve all system operations
 * System actors are trusted for automated operations.
 */
const systemPolicy: AutoApprovePolicy = {
  mode: "auto_approve",
  reason: "System actors are trusted for automated operations",
};

/**
 * Create binding for a user actor
 */
export function createUserBinding(actor: ActorRef): ActorAuthorityBinding {
  return {
    actor,
    authority: authorities.user,
    policy: userPolicy,
  };
}

/**
 * Create binding for an agent actor
 */
export function createAgentBinding(actor: ActorRef): ActorAuthorityBinding {
  return {
    actor,
    authority: authorities.agent,
    policy: agentPolicy,
  };
}

/**
 * Create binding for a system actor
 */
export function createSystemBinding(actor: ActorRef): ActorAuthorityBinding {
  return {
    actor,
    authority: authorities.system,
    policy: systemPolicy,
  };
}

/**
 * Default bindings for TaskFlow
 */
export const defaultBindings: ActorAuthorityBinding[] = [
  createUserBinding(defaultActors.anonymousUser),
  createSystemBinding(defaultActors.system),
];

/**
 * Create the policy rules handler for agent authority
 */
export function createAgentPolicyHandler() {
  return createPolicyRulesHandler();
}
