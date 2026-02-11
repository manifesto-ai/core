/**
 * ExecutionKey Policies
 *
 * Built-in policies for deriving ExecutionKey from Proposal.
 *
 * @see SPEC v2.0.0 §10.2
 * @module
 */

import type { ExecutionKeyPolicy, Proposal } from "@manifesto-ai/shared";

/**
 * Default policy: Unique key per proposal (maximum parallelism).
 *
 * Each proposal gets its own mailbox, allowing full parallel execution.
 *
 * @see SPEC v2.0.0 §10.2
 */
export const defaultPolicy: ExecutionKeyPolicy = (p: Proposal) =>
  `proposal:${p.proposalId}`;

/**
 * Actor-serial policy: One key per actor (serialize per actor).
 *
 * All proposals from the same actor share a mailbox,
 * ensuring sequential execution per actor.
 *
 * @see SPEC v2.0.0 §10.2
 */
export const actorSerialPolicy: ExecutionKeyPolicy = (p: Proposal) =>
  `actor:${p.actorId}`;

/**
 * Base-serial policy: One key per base world (serialize per branch).
 *
 * All proposals targeting the same base world share a mailbox,
 * preventing version conflicts within a branch.
 *
 * @see SPEC v2.0.0 §10.2
 */
export const baseSerialPolicy: ExecutionKeyPolicy = (p: Proposal) =>
  `base:${p.baseWorld}`;

/**
 * Global-serial policy: Single key (full serialization).
 *
 * All proposals share a single mailbox, ensuring strict
 * sequential execution across the entire application.
 *
 * @see SPEC v2.0.0 §10.2
 */
export const globalSerialPolicy: ExecutionKeyPolicy = () => "global";

/**
 * Branch-serial policy: One key per branch.
 *
 * Similar to base-serial but uses explicit branchId.
 */
export const branchSerialPolicy: ExecutionKeyPolicy = (p: Proposal) =>
  `branch:${p.branchId ?? "main"}`;

/**
 * Intent-type policy: One key per intent type.
 *
 * Serializes by action type, useful for rate-limiting
 * specific operations.
 */
export const intentTypePolicy: ExecutionKeyPolicy = (p: Proposal) =>
  `intent:${p.intentType}`;

/**
 * All built-in ExecutionKey policies.
 */
export const builtInPolicies = {
  default: defaultPolicy,
  actorSerial: actorSerialPolicy,
  baseSerial: baseSerialPolicy,
  globalSerial: globalSerialPolicy,
  branchSerial: branchSerialPolicy,
  intentType: intentTypePolicy,
} as const;

/**
 * Get a built-in policy by name.
 */
export function getBuiltInPolicy(
  name: keyof typeof builtInPolicies
): ExecutionKeyPolicy {
  return builtInPolicies[name];
}
