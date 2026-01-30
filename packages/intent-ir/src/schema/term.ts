/**
 * @fileoverview Term Types Schema (SPEC Section 8)
 *
 * Terms represent argument values in the semantic structure.
 * Terms form a discriminated union with `kind` as discriminator (AD-INT-004).
 */

import { z } from "zod";

// =============================================================================
// Shared ext
// =============================================================================

export const ExtSchema = z.record(z.string(), z.unknown());
export type Ext = z.infer<typeof ExtSchema>;

// =============================================================================
// EntityRef
// =============================================================================

/**
 * Reference kind for entity references.
 */
export const EntityRefKindSchema = z.enum(["this", "that", "last", "id"]);

export type EntityRefKind = z.infer<typeof EntityRefKindSchema>;

/**
 * Entity reference specification.
 *
 * | ref.kind | Description |
 * |----------|-------------|
 * | this     | Currently focused entity |
 * | that     | Previously mentioned entity |
 * | last     | Most recent of type |
 * | id       | Explicit identifier |
 */
export const EntityRefSchema = z
  .object({
    kind: EntityRefKindSchema,
    /** Explicit identifier. REQUIRED when kind="id". */
    id: z.string().optional(),
  })
  .strict()
  .refine((data) => data.kind !== "id" || data.id !== undefined, {
    message: "id is required when kind is 'id'",
  });

export type EntityRef = z.infer<typeof EntityRefSchema>;

// =============================================================================
// QuantitySpec
// =============================================================================

export const QuantityComparatorSchema = z.enum(["eq", "gte", "lte"]);
export type QuantityComparator = z.infer<typeof QuantityComparatorSchema>;

export const QuantitySpecSchema = z
  .object({
    kind: z.literal("quantity"),
    /** MUST be a non-negative integer. */
    value: z.number().int().nonnegative(),
    /** OPTIONAL. Default: "eq". */
    comparator: QuantityComparatorSchema.optional(),
    /** OPTIONAL unit label (advisory). */
    unit: z.string().optional(),
    /** Term-level extension carrier. OPTIONAL. */
    ext: ExtSchema.optional(),
  })
  .strict();

export type QuantitySpec = z.infer<typeof QuantitySpecSchema>;

/**
 * Reference to a domain entity.
 *
 * @example
 * { kind: "entity", entityType: "Order", ref: { kind: "last" } }
 * { kind: "entity", entityType: "User" } // collection scope
 */
export const EntityRefTermSchema = z.object({
  kind: z.literal("entity"),
  /** Entity type name. MUST exist in Lexicon. */
  entityType: z.string().min(1),
  /**
   * Reference specification.
   * OPTIONAL: absence means collection/default scope (e.g., "all users").
   */
  ref: EntityRefSchema.optional(),

  /**
   * Quantification on the DP (e.g., "three tasks", "at least 5 users").
   * OPTIONAL. Intended for collection scope.
   */
  quant: QuantitySpecSchema.optional(),

  /**
   * Optional ordering key used when quantity implies a choice ("top 3", "first 5"),
   * or when an explicit "by ..." phrase is present.
   *
   * NORMATIVE: This represents meaning-level ordering intent, not an execution plan.
   */
  orderBy: z
    .object({
      kind: z.literal("path"),
      path: z.string().min(1),
      ext: ExtSchema.optional(),
    })
    .optional(),

  /** Order direction. OPTIONAL. Default: "ASC". */
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

export type EntityRefTerm = z.infer<typeof EntityRefTermSchema>;

// =============================================================================
// PathRef
// =============================================================================

/**
 * Reference to a semantic path in the domain.
 *
 * Path patterns may contain wildcards for dynamic segments.
 *
 * @example
 * { kind: "path", path: "state.user.email" }
 */
export const PathRefTermSchema = z.object({
  kind: z.literal("path"),
  /**
   * Canonical path pattern.
   * MAY contain wildcards (*) for dynamic segments.
   */
  path: z.string().min(1),
  /** Term-level extension carrier. OPTIONAL. */
  ext: ExtSchema.optional(),
}).strict();

export type PathRefTerm = z.infer<typeof PathRefTermSchema>;

// =============================================================================
// ArtifactRef
// =============================================================================

/**
 * Artifact type classification.
 */
export const ArtifactTypeSchema = z.enum([
  "text",
  "math",
  "code",
  "data",
  "plan",
  "mixed",
]);

export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

/**
 * Artifact reference specification.
 */
export const ArtifactRefSchema = z.object({
  kind: z.enum(["inline", "id"]),
  id: z.string().optional(),
}).strict();

export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;

/**
 * Reference to a document, formula, code, or data artifact.
 *
 * @example
 * { kind: "artifact", artifactType: "code", ref: { kind: "inline" }, content: "..." }
 * { kind: "artifact", artifactType: "math", ref: { kind: "id", id: "eq-1" } }
 */
export const ArtifactRefTermSchema = z
  .object({
    kind: z.literal("artifact"),
    artifactType: ArtifactTypeSchema,
    ref: ArtifactRefSchema,
    /** Inline content. REQUIRED when ref.kind="inline". */
    content: z.string().optional(),
    /** Term-level extension carrier. OPTIONAL. */
    ext: ExtSchema.optional(),
  })
  .strict()
  .refine((data) => data.ref.kind !== "inline" || data.content !== undefined, {
    message: "content is required when ref.kind is 'inline'",
  })
  .refine((data) => data.ref.kind !== "id" || data.ref.id !== undefined, {
    message: "id is required when ref.kind is 'id'",
  });

export type ArtifactRefTerm = z.infer<typeof ArtifactRefTermSchema>;

// =============================================================================
// ValueTerm
// =============================================================================

/**
 * Value type classification.
 */
export const ValueTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "enum",
  "id",
]);

export type ValueType = z.infer<typeof ValueTypeSchema>;

/**
 * Literal value with semantic shape.
 *
 * Shape stores semantic features/buckets, NOT raw values, for canonicalization (FDR-INT-005).
 *
 * @example
 * { kind: "value", valueType: "number", shape: { range: "1-100", sign: "positive" }, raw: 42 }
 * { kind: "value", valueType: "enum", shape: { domain: "status", value: "active" } }
 */
export const ValueTermSchema = z.object({
  kind: z.literal("value"),
  valueType: ValueTypeSchema,
  /**
   * Semantic shape for canonicalization.
   * Contains features/buckets, NOT raw value.
   */
  shape: z.record(z.string(), z.unknown()),
  /**
   * Raw value. OPTIONAL.
   * Present when exact value is needed for execution.
   */
  raw: z.unknown().optional(),
  /** Term-level extension carrier. OPTIONAL. */
  ext: ExtSchema.optional(),
}).strict();

export type ValueTerm = z.infer<typeof ValueTermSchema>;

// =============================================================================
// ExprTerm
// =============================================================================

/**
 * Expression type classification.
 */
export const ExprTypeSchema = z.enum(["latex", "ast", "code"]);

export type ExprType = z.infer<typeof ExprTypeSchema>;

/**
 * Mathematical, logical, or code expression.
 *
 * Cross-field constraint:
 * - exprType "latex" | "code" -> expr must be string
 * - exprType "ast" -> expr must be object
 *
 * @example
 * { kind: "expr", exprType: "latex", expr: "\\int_0^1 x^2 dx" }
 * { kind: "expr", exprType: "ast", expr: { op: "add", left: 1, right: 2 } }
 */
export const ExprTermSchema = z
  .object({
    kind: z.literal("expr"),
    exprType: ExprTypeSchema,
    /**
     * Expression content.
     * String for latex/code, structured object for ast.
     */
    expr: z.union([z.string(), z.record(z.string(), z.unknown())]),
    /** Term-level extension carrier. OPTIONAL. */
    ext: ExtSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.exprType === "ast" && typeof data.expr !== "object") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expr must be object when exprType is 'ast'",
        path: ["expr"],
      });
    }
    if (
      (data.exprType === "latex" || data.exprType === "code") &&
      typeof data.expr !== "string"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expr must be string when exprType is 'latex' or 'code'",
        path: ["expr"],
      });
    }
  });

export type ExprTerm = z.infer<typeof ExprTermSchema>;

// =============================================================================
// Term (Discriminated Union)
// =============================================================================

/**
 * Term represents argument values in the semantic structure.
 *
 * Per AD-INT-004, Term is a closed discriminated union with `kind` as discriminator.
 */
// v0.2: list term disallows nested lists
export const NonListTermSchema = z.discriminatedUnion("kind", [
  EntityRefTermSchema,
  PathRefTermSchema,
  ArtifactRefTermSchema,
  ValueTermSchema,
  ExprTermSchema,
]);

export const ListTermSchema = z.object({
  kind: z.literal("list"),
  items: z.array(NonListTermSchema),
  ordered: z.boolean().optional(),
  /** Term-level extension carrier. OPTIONAL. */
  ext: ExtSchema.optional(),
}).strict();

export const TermSchema = z.discriminatedUnion("kind", [
  EntityRefTermSchema,
  PathRefTermSchema,
  ArtifactRefTermSchema,
  ValueTermSchema,
  ExprTermSchema,
  ListTermSchema,
]);

export type NonListTerm = z.infer<typeof NonListTermSchema>;
export type ListTerm = z.infer<typeof ListTermSchema>;
export type Term = z.infer<typeof TermSchema>;
