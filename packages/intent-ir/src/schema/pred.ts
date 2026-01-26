/**
 * @fileoverview Predicate (Condition) Schema (SPEC Section 9)
 *
 * Conditions in v0.1 are AND-only per AD-INT-003.
 * OR/NOT are deferred to v0.2+.
 */

import { z } from "zod";
import { TermSchema } from "./term.js";

// =============================================================================
// PredOp (Predicate Operator)
// =============================================================================

/**
 * Comparison operators for predicates.
 *
 * Note: "in" (membership) operator is deferred to v0.2+ (FDR-INT-007).
 */
export const PredOpSchema = z.enum([
  "=",
  "!=",
  "<",
  ">",
  "<=",
  ">=",
  "contains",
  "startsWith",
  "matches",
]);

export type PredOp = z.infer<typeof PredOpSchema>;

// =============================================================================
// LHS (Left-Hand Side)
// =============================================================================

/**
 * LHS Grammar (NORMATIVE):
 *
 * LHS MUST be a scoped path with explicit prefix:
 * | Prefix     | Scope                    |
 * |------------|--------------------------|
 * | target.    | TARGET arg entity        |
 * | theme.     | THEME arg entity         |
 * | source.    | SOURCE arg entity        |
 * | dest.      | DEST arg entity          |
 * | state.     | World state path         |
 * | env.       | Environment variable     |
 * | computed.  | Computed/derived value   |
 */
export const LHSSchema = z
  .string()
  .regex(
    /^(target|theme|source|dest|state|env|computed)\.[A-Za-z0-9_.]+$/,
    "lhs must be scoped path, e.g. target.status"
  );

export type LHS = z.infer<typeof LHSSchema>;

// =============================================================================
// Pred (Predicate)
// =============================================================================

/**
 * Predicate for condition expressions.
 *
 * @example
 * { lhs: "target.status", op: "=", rhs: { kind: "value", valueType: "enum", shape: { value: "active" } } }
 */
export const PredSchema = z.object({
  /**
   * Left-hand side: scoped path.
   * MUST use prefix to indicate scope (target., theme., state., etc.).
   */
  lhs: LHSSchema,

  /**
   * Comparison operator.
   */
  op: PredOpSchema,

  /**
   * Right-hand side: value to compare against.
   */
  rhs: TermSchema,
}).strict();

export type Pred = z.infer<typeof PredSchema>;
