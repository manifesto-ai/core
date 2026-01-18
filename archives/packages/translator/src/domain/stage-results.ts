/**
 * Stage Result Types (SPEC-1.1.1v §6.5)
 *
 * Intermediate results from each pipeline stage.
 */

import { z } from "zod";
import type { AmbiguityReport } from "./ambiguity.js";
import { AmbiguityReportSchema } from "./ambiguity.js";
import type { MemoryStageTrace } from "./trace.js";
import { MemoryStageTraceSchema } from "./trace.js";
import type { PatchFragment } from "./patch-fragment.js";
import { PatchFragmentSchema } from "./patch-fragment.js";
import type { ResolvedType } from "./type-expr.js";
import { ResolvedTypeSchema } from "./type-expr.js";
import type { SemanticPath } from "./types.js";

// =============================================================================
// Stage 0: Chunking Result
// =============================================================================

/** A section from chunking */
export interface Section {
  sectionId: string;
  startOffset: number;
  endOffset: number;
  text: string;
}

export const SectionSchema = z.object({
  sectionId: z.string(),
  startOffset: z.number(),
  endOffset: z.number(),
  text: z.string(),
});

// =============================================================================
// Stage 1: Normalization Result
// =============================================================================

/** Protected token (preserved during normalization) */
export interface ProtectedToken {
  original: string;
  position: { start: number; end: number };
  kind: "identifier" | "number" | "quoted" | "symbol";
}

export const ProtectedTokenSchema = z.object({
  original: z.string(),
  position: z.object({
    start: z.number(),
    end: z.number(),
  }),
  kind: z.enum(["identifier", "number", "quoted", "symbol"]),
});

/** Glossary hit during normalization */
export interface GlossaryHit {
  semanticId: string;
  canonical: string;
  originalTerm: string;
  confidence: number;
}

export const GlossaryHitSchema = z.object({
  semanticId: z.string(),
  canonical: z.string(),
  originalTerm: z.string(),
  confidence: z.number(),
});

/** Normalization result */
export interface NormalizationResult {
  canonical: string;
  language: string;
  tokens: ProtectedToken[];
  glossaryHits: GlossaryHit[];
}

export const NormalizationResultSchema = z.object({
  canonical: z.string(),
  language: z.string(),
  tokens: z.array(ProtectedTokenSchema),
  glossaryHits: z.array(GlossaryHitSchema),
});

// =============================================================================
// Stage 2: Fast Path Result
// =============================================================================

/** A fast-path candidate */
export interface FastPathCandidate {
  patternId: string;
  fragments: PatchFragment[];
  confidence: number;
  evidence?: string[];
}

export const FastPathCandidateSchema = z.object({
  patternId: z.string(),
  fragments: z.array(PatchFragmentSchema),
  confidence: z.number(),
  evidence: z.array(z.string()).optional(),
});

/** Fast path result */
export interface FastPathResult {
  matched: boolean;
  best: FastPathCandidate | null;
  candidates: FastPathCandidate[];
}

export const FastPathResultSchema = z.object({
  matched: z.boolean(),
  best: FastPathCandidateSchema.nullable(),
  candidates: z.array(FastPathCandidateSchema),
});

// =============================================================================
// Stage 3: Retrieval Result
// =============================================================================

/** An anchor candidate from retrieval */
export interface AnchorCandidate {
  path: SemanticPath;
  score: number;
  matchType: "exact" | "fuzzy" | "semantic";
  evidence: string[];
  resolvedType?: ResolvedType;
}

export const AnchorCandidateSchema = z.object({
  path: z.string(),
  score: z.number(),
  matchType: z.enum(["exact", "fuzzy", "semantic"]),
  evidence: z.array(z.string()),
  resolvedType: ResolvedTypeSchema.optional(),
});

/** Retrieval result */
export interface RetrievalResult {
  tier: 0 | 1 | 2;
  candidates: AnchorCandidate[];
}

export const RetrievalResultSchema = z.object({
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  candidates: z.array(AnchorCandidateSchema),
});

// =============================================================================
// Stage 4: Memory Stage Result
// =============================================================================

/** Memory content for proposer */
export interface MemoryContent {
  translationExamples: TranslationExample[];
  schemaHistory: SchemaSnapshot[];
  glossaryTerms: GlossaryTermEntry[];
  resolutionHistory: ResolutionRecord[];
}

/** Translation example from memory */
export interface TranslationExample {
  worldId: string;
  input: string;
  normalizedInput: string;
  fragments: PatchFragment[];
  confidence: number;
  verified: boolean;
}

/** Schema snapshot from history */
export interface SchemaSnapshot {
  worldId: string;
  schema: unknown; // DomainSchema from core
  changedPaths: SemanticPath[];
}

/** Glossary term entry */
export interface GlossaryTermEntry {
  term: string;
  definition: string;
  mappedPath?: SemanticPath;
  sourceWorldId?: string;
  confidence?: number;
}

/** Resolution record from history */
export interface ResolutionRecord {
  worldId: string;
  report: AmbiguityReport;
  resolution: unknown; // AmbiguityResolution
  resultingFragments: PatchFragment[];
}

export const TranslationExampleSchema = z.object({
  worldId: z.string(),
  input: z.string(),
  normalizedInput: z.string(),
  fragments: z.array(PatchFragmentSchema),
  confidence: z.number(),
  verified: z.boolean(),
});

export const SchemaSnapshotSchema = z.object({
  worldId: z.string(),
  schema: z.unknown(),
  changedPaths: z.array(z.string()),
});

export const GlossaryTermEntrySchema = z.object({
  term: z.string(),
  definition: z.string(),
  mappedPath: z.string().optional(),
  sourceWorldId: z.string().optional(),
  confidence: z.number().optional(),
});

export const ResolutionRecordSchema = z.object({
  worldId: z.string(),
  report: AmbiguityReportSchema,
  resolution: z.unknown(),
  resultingFragments: z.array(PatchFragmentSchema),
});

export const MemoryContentSchema = z.object({
  translationExamples: z.array(TranslationExampleSchema),
  schemaHistory: z.array(SchemaSnapshotSchema),
  glossaryTerms: z.array(GlossaryTermEntrySchema),
  resolutionHistory: z.array(ResolutionRecordSchema),
});

/** Memory stage result */
export interface MemoryStageResult {
  content: MemoryContent;
  selectedCount: number;
  averageConfidence?: number;
  degraded: boolean;
  trace?: MemoryStageTrace;
}

export const MemoryStageResultSchema = z.object({
  content: MemoryContentSchema,
  selectedCount: z.number(),
  averageConfidence: z.number().optional(),
  degraded: z.boolean(),
  trace: MemoryStageTraceSchema.optional(),
});

// =============================================================================
// Stage 5: Proposer Result
// =============================================================================

/** Proposer produced fragments */
export interface ProposalResultFragments {
  kind: "fragments";
  fragments: PatchFragment[];
  confidence: number;
  evidence: string[];
}

/** Proposer detected ambiguity */
export interface ProposalResultAmbiguity {
  kind: "ambiguity";
  ambiguity: AmbiguityReport;
  confidence: number;
  evidence: string[];
}

/** Proposer produced nothing */
export interface ProposalResultEmpty {
  kind: "empty";
  confidence: number;
  evidence: string[];
}

/**
 * Proposer result (one-of: exactly one branch)
 *
 * - fragments: Proposer produced >= 1 fragments
 * - ambiguity: Proposer detected ambiguity
 * - empty: Proposer produced nothing (→ error in Stage 6)
 */
export type ProposalResult =
  | ProposalResultFragments
  | ProposalResultAmbiguity
  | ProposalResultEmpty;

export const ProposalResultSchema: z.ZodType<ProposalResult> =
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("fragments"),
      fragments: z.array(PatchFragmentSchema),
      confidence: z.number(),
      evidence: z.array(z.string()),
    }),
    z.object({
      kind: z.literal("ambiguity"),
      ambiguity: AmbiguityReportSchema,
      confidence: z.number(),
      evidence: z.array(z.string()),
    }),
    z.object({
      kind: z.literal("empty"),
      confidence: z.number(),
      evidence: z.array(z.string()),
    }),
  ]);
