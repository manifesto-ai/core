import { z } from "zod";
import { SemanticPath } from "./common.js";
import { ExprNodeSchema } from "./expr.js";

/**
 * ComputedFieldSpec - Definition of a single computed field
 */
export const ComputedFieldSpec = z.object({
  /**
   * Paths this computed value depends on.
   * Must accurately reflect all paths referenced in expr.
   */
  deps: z.array(SemanticPath),

  /**
   * Expression to compute the value.
   * Must be pure and total (always produce a value, never throw).
   */
  expr: ExprNodeSchema,

  /**
   * Human-readable description
   */
  description: z.string().optional(),
});
export type ComputedFieldSpec = z.infer<typeof ComputedFieldSpec>;

/**
 * ComputedSpec - Collection of computed field definitions
 * Computed values form a Directed Acyclic Graph (DAG).
 */
export const ComputedSpec = z.object({
  /**
   * Computed field definitions keyed by their semantic path.
   * Paths typically start with "computed." prefix.
   */
  fields: z.record(SemanticPath, ComputedFieldSpec),
});
export type ComputedSpec = z.infer<typeof ComputedSpec>;
