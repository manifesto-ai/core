/**
 * @fileoverview Resolved IntentIR Types (SPEC Section 12.3)
 *
 * ResolvedIntentIR is the form after discourse reference resolution.
 * Used for strictKey computation.
 */

import { z } from "zod";
import {
  ArtifactRefTermSchema,
  ExprTermSchema,
  PathRefTermSchema,
  ValueTermSchema,
  QuantitySpecSchema,
  ExtSchema,
  type ArtifactRefTerm,
  type ExprTerm,
  type PathRefTerm,
  type ValueTerm,
} from "./term.js";
import { IntentIRSchema } from "./intent-ir.js";

// =============================================================================
// ResolvedEntityRef
// =============================================================================

/**
 * Resolved entity reference.
 * After resolution, only "id" kind is allowed.
 */
export const ResolvedEntityRefSchema = z.object({
  kind: z.literal("id"),
  id: z.string(),
}).strict();

export type ResolvedEntityRef = z.infer<typeof ResolvedEntityRefSchema>;

// =============================================================================
// ResolvedEntityRefTerm
// =============================================================================

/**
 * Resolved entity reference term.
 *
 * - ref is OPTIONAL (collection scope preserved)
 * - If ref exists, it MUST be { kind: "id", id: string }
 */
export const ResolvedEntityRefTermSchema = z.object({
  kind: z.literal("entity"),
  entityType: z.string().min(1),
  /**
   * Resolved reference.
   * Absence means collection scope (preserved from original).
   */
  ref: ResolvedEntityRefSchema.optional(),
  /** Quantification on the DP (e.g., "three tasks"). */
  quant: QuantitySpecSchema.optional(),
  /** Ordering key for collection ordering. */
  orderBy: PathRefTermSchema.optional(),
  /** Order direction. */
  orderDir: z.enum(["ASC", "DESC"]).optional(),
  /** Term-level extension carrier. OPTIONAL. */
  ext: ExtSchema.optional(),
})
  .strict()
  .superRefine((data, ctx) => {
    if (data.orderDir && !data.orderBy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "orderDir requires orderBy",
        path: ["orderDir"],
      });
    }

    if (data.orderBy) {
      const invalidPrefix =
        /^(state|env|computed|target|theme|source|dest|instrument|beneficiary)\./;
      if (invalidPrefix.test(data.orderBy.path)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "orderBy.path must be a relative entity field path",
          path: ["orderBy", "path"],
        });
      }
    }
  });

export type ResolvedEntityRefTerm = z.infer<typeof ResolvedEntityRefTermSchema>;

// =============================================================================
// ResolvedListTerm
// =============================================================================

export const ResolvedNonListTermSchema = z.discriminatedUnion("kind", [
  ResolvedEntityRefTermSchema,
  PathRefTermSchema,
  ArtifactRefTermSchema,
  ValueTermSchema,
  ExprTermSchema,
]);

export const ResolvedListTermSchema = z.object({
  kind: z.literal("list"),
  items: z.array(ResolvedNonListTermSchema),
  ordered: z.boolean().optional(),
  ext: ExtSchema.optional(),
}).strict();

export type ResolvedNonListTerm = z.infer<typeof ResolvedNonListTermSchema>;
export type ResolvedListTerm = z.infer<typeof ResolvedListTermSchema>;

// =============================================================================
// ResolvedTerm
// =============================================================================

/**
 * ResolvedTerm: EntityRefTerm is replaced with ResolvedEntityRefTerm.
 * All other term types remain unchanged.
 */
export const ResolvedTermSchema = z.discriminatedUnion("kind", [
  ResolvedEntityRefTermSchema,
  PathRefTermSchema,
  ArtifactRefTermSchema,
  ValueTermSchema,
  ExprTermSchema,
  ResolvedListTermSchema,
]);

export type ResolvedTerm = z.infer<typeof ResolvedTermSchema>;

// =============================================================================
// ResolvedArgs
// =============================================================================

/**
 * Resolved args with ResolvedTerm instead of Term.
 */
export const ResolvedArgsSchema = z
  .object({
    TARGET: ResolvedTermSchema,
    THEME: ResolvedTermSchema,
    SOURCE: ResolvedTermSchema,
    DEST: ResolvedTermSchema,
    INSTRUMENT: ResolvedTermSchema,
    BENEFICIARY: ResolvedTermSchema,
  })
  .partial()
  .strict();

export type ResolvedArgs = z.infer<typeof ResolvedArgsSchema>;

// =============================================================================
// ResolvedIntentIR
// =============================================================================

/**
 * ResolvedIntentIR: Symbolic refs (this/that/last) resolved to "id".
 * Collection scope (ref absent) is preserved as-is.
 *
 * CRITICAL: strictKey MUST be computed from ResolvedIntentIR, not IntentIR.
 */
export const ResolvedIntentIRSchema = IntentIRSchema.extend({
  args: ResolvedArgsSchema,
}).strict();

export type ResolvedIntentIR = z.infer<typeof ResolvedIntentIRSchema>;
