/**
 * Effect Schemas for Translator
 *
 * Defines type-safe effect schemas using Zod for:
 * - llm.normalize: Raw NL text → NormalizationResult
 * - translator.fastPath: Canonical → FastPathResult
 * - translator.retrieve: Tokens → RetrievalResult
 * - llm.propose: Candidates → ProposalResult
 */

import { z } from "zod";
import { defineEffectSchema } from "@manifesto-ai/effect-utils";

// =============================================================================
// Shared Zod Schemas
// =============================================================================

/** Token schema */
export const TokenSchema = z.object({
  original: z.string(),
  normalized: z.string(),
  pos: z.string(),
  start: z.number(),
  end: z.number(),
});

/** GlossaryHit schema */
export const GlossaryHitSchema = z.object({
  semanticId: z.string(),
  canonical: z.string(),
  matchedAlias: z.string(),
  language: z.string(),
  confidence: z.number(),
});

/** ProtectedSpan schema */
export const ProtectedSpanSchema = z.object({
  start: z.number(),
  end: z.number(),
  kind: z.enum(["identifier", "number", "literal", "operator"]),
  value: z.string(),
});

/** TypeExpr schema (simplified for validation) */
export const TypeExprSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("primitive"), name: z.string() }),
    z.object({ kind: z.literal("literal"), value: z.union([z.string(), z.number(), z.boolean()]) }),
    z.object({ kind: z.literal("ref"), name: z.string() }),
    z.object({ kind: z.literal("union"), members: z.array(TypeExprSchema) }),
    z.object({ kind: z.literal("array"), element: TypeExprSchema }),
    z.object({
      kind: z.literal("object"),
      properties: z.record(z.object({ type: TypeExprSchema, optional: z.boolean().optional() })),
    }),
    z.object({ kind: z.literal("record"), key: TypeExprSchema, value: TypeExprSchema }),
  ])
);

/** Path reference schema */
export const PathRefSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("name"), name: z.string() }),
    z.object({ kind: z.literal("index"), base: PathRefSchema, index: z.number() }),
    z.object({ kind: z.literal("prop"), base: PathRefSchema, prop: z.string() }),
  ])
);

/** ExprNode schema (simplified for validation) */
export const ExprNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("lit"), value: z.unknown() }),
    z.object({ kind: z.literal("get"), path: PathRefSchema }),
    z.object({ kind: z.literal("call"), fn: z.string(), args: z.array(ExprNodeSchema) }),
    z.object({ kind: z.literal("obj"), entries: z.record(ExprNodeSchema) }),
    z.object({ kind: z.literal("arr"), elements: z.array(ExprNodeSchema) }),
  ])
);

/** FragmentChange schema */
export const FragmentChangeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("patch"),
    path: z.string(),
    op: z.enum(["set", "unset", "merge"]),
    value: ExprNodeSchema.optional(),
  }),
  z.object({
    kind: z.literal("constraint"),
    path: z.string(),
    expr: ExprNodeSchema,
    message: z.string().optional(),
  }),
  z.object({
    kind: z.literal("addField"),
    path: z.string(),
    name: z.string(),
    type: TypeExprSchema,
    defaultValue: ExprNodeSchema.optional(),
  }),
  z.object({
    kind: z.literal("removeField"),
    path: z.string(),
    name: z.string(),
  }),
  z.object({
    kind: z.literal("addComputed"),
    name: z.string(),
    expr: ExprNodeSchema,
    type: TypeExprSchema.optional(),
  }),
  z.object({
    kind: z.literal("addType"),
    name: z.string(),
    type: TypeExprSchema,
  }),
  z.object({
    kind: z.literal("setFieldType"),
    path: z.string(),
    type: TypeExprSchema,
  }),
]);

/** PatchFragment schema */
export const PatchFragmentSchema = z.object({
  id: z.string(),
  description: z.string(),
  changes: z.array(FragmentChangeSchema),
  metadata: z
    .object({
      source: z.string().optional(),
      confidence: z.number().optional(),
      createdAt: z.number().optional(),
    })
    .optional(),
});

/** AnchorCandidate schema */
export const AnchorCandidateSchema = z.object({
  path: z.string(),
  score: z.number(),
  matchType: z.enum(["exact", "alias", "fuzzy", "semantic"]),
  typeHint: TypeExprSchema.nullable().optional(),
});

/** ResolutionOption schema */
export const ResolutionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  fragment: PatchFragmentSchema,
  confidence: z.number(),
});

/** AmbiguityReport schema */
export const AmbiguityReportSchema = z.object({
  kind: z.enum(["anchor", "intent", "value", "conflict"]),
  question: z.string(),
  options: z.array(ResolutionOptionSchema),
  fallbackBehavior: z.enum(["guess", "discard"]),
  expiresAt: z.number().nullable(),
});

// =============================================================================
// Effect Output Schemas
// =============================================================================

/** NormalizationResult schema */
export const NormalizationResultSchema = z.object({
  canonical: z.string(),
  language: z.string(),
  tokens: z.array(TokenSchema),
  glossaryHits: z.array(GlossaryHitSchema),
  protected: z.array(ProtectedSpanSchema),
});

/** FastPathResult schema */
export const FastPathResultSchema = z.object({
  matched: z.boolean(),
  pattern: z.string().nullable(),
  fragment: PatchFragmentSchema.nullable(),
  confidence: z.number(),
});

/** RetrievalResult schema */
export const RetrievalResultSchema = z.object({
  tier: z.number(),
  candidates: z.array(AnchorCandidateSchema),
  queryTerms: z.array(z.string()),
});

/** ProposalResult schema */
export const ProposalResultSchema = z.object({
  fragment: PatchFragmentSchema.nullable(),
  ambiguity: AmbiguityReportSchema.nullable(),
  confidence: z.number(),
  reasoning: z.string().nullable(),
});

// =============================================================================
// Effect Schemas
// =============================================================================

/**
 * llm.normalize effect schema
 * Normalizes raw NL text to canonical English with tokenization
 */
export const normalizeSchema = defineEffectSchema({
  type: "llm.normalize",
  input: z.object({
    text: z.string().min(1),
    languageHint: z.string().nullable().optional(),
  }),
  output: NormalizationResultSchema,
  outputPath: "data.normalization",
  description: "Normalizes raw NL text to canonical English with tokenization",
});

/**
 * translator.fastPath effect schema
 * Attempts fast-path pattern matching without LLM
 */
export const fastPathSchema = defineEffectSchema({
  type: "translator.fastPath",
  input: z.object({
    canonical: z.string(),
    tokens: z.array(TokenSchema),
    glossaryHits: z.array(GlossaryHitSchema),
    schemaId: z.string(),
  }),
  output: FastPathResultSchema,
  outputPath: "data.fastPath",
  description: "Attempts fast-path pattern matching without LLM",
});

/**
 * translator.retrieve effect schema
 * Retrieves anchor candidates using BM25 search
 */
export const retrieveSchema = defineEffectSchema({
  type: "translator.retrieve",
  input: z.object({
    terms: z.array(TokenSchema),
    glossaryHits: z.array(GlossaryHitSchema),
    schemaId: z.string(),
    maxCandidates: z.number().default(5),
  }),
  output: RetrievalResultSchema,
  outputPath: "data.retrieval",
  description: "Retrieves anchor candidates using BM25 search",
});

/**
 * llm.propose effect schema
 * Proposes PatchFragment from candidates using LLM
 */
export const proposeSchema = defineEffectSchema({
  type: "llm.propose",
  input: z.object({
    canonical: z.string(),
    tokens: z.array(TokenSchema),
    candidates: z.array(AnchorCandidateSchema),
    schemaId: z.string(),
    timeoutMs: z.number().default(300000),
    fallbackBehavior: z.enum(["guess", "discard"]).default("guess"),
  }),
  output: ProposalResultSchema,
  outputPath: "data.proposal",
  description: "Proposes PatchFragment from candidates using LLM",
});

// Export all schemas
export const schemas = {
  normalize: normalizeSchema,
  fastPath: fastPathSchema,
  retrieve: retrieveSchema,
  propose: proposeSchema,
} as const;
