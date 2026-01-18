/**
 * Translation Trace Types (SPEC-1.1.1v §6.13-6.15)
 *
 * Every translation call MUST emit a trace.
 * Trace MUST be JSON-serializable and safe to store.
 */

import { z } from "zod";
import type { AmbiguityResolution } from "./ambiguity.js";
import { AmbiguityResolutionSchema } from "./ambiguity.js";
import type { ActorRef, IntentId, WorldId } from "./types.js";
import { ActorRef as ActorRefSchema } from "./types.js";

// =============================================================================
// Stage Traces (§6.14)
// =============================================================================

/** Chunking stage trace */
export interface ChunkingTrace {
  sectionCount: number;
  durationMs: number;
}

export const ChunkingTraceSchema = z.object({
  sectionCount: z.number(),
  durationMs: z.number(),
});

/** Normalization stage trace */
export interface NormalizationTrace {
  detectedLanguage: string;
  glossaryHitCount: number;
  protectedTokenCount: number;
  durationMs: number;
}

export const NormalizationTraceSchema = z.object({
  detectedLanguage: z.string(),
  glossaryHitCount: z.number(),
  protectedTokenCount: z.number(),
  durationMs: z.number(),
});

/** Fast path stage trace */
export interface FastPathTrace {
  attempted: boolean;
  matched: boolean;
  candidateCount: number;
  bestConfidence?: number;
  durationMs: number;
}

export const FastPathTraceSchema = z.object({
  attempted: z.boolean(),
  matched: z.boolean(),
  candidateCount: z.number(),
  bestConfidence: z.number().optional(),
  durationMs: z.number(),
});

/** Retrieval stage trace */
export interface RetrievalTrace {
  tier: 0 | 1 | 2;
  candidateCount: number;
  topScore?: number;
  durationMs: number;
}

export const RetrievalTraceSchema = z.object({
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  candidateCount: z.number(),
  topScore: z.number().optional(),
  durationMs: z.number(),
});

/** Memory content summary */
export interface MemoryContentSummary {
  exampleCount: number;
  schemaSnapshotCount: number;
  glossaryTermCount: number;
  resolutionCount: number;
}

export const MemoryContentSummarySchema = z.object({
  exampleCount: z.number(),
  schemaSnapshotCount: z.number(),
  glossaryTermCount: z.number(),
  resolutionCount: z.number(),
});

/** Memory stage trace (canonical definition) */
export interface MemoryStageTrace {
  attempted: boolean;
  atWorldId: WorldId;
  /** From @manifesto-ai/memory v1.2.0 */
  trace?: unknown;
  selectedCount: number;
  averageConfidence?: number;
  contentSummary?: MemoryContentSummary;
  degraded: boolean;
  degradeReason?:
    | "SELECTOR_NOT_CONFIGURED"
    | "SELECTION_EMPTY"
    | "SELECTOR_ERROR";
  errorMessage?: string;
  durationMs: number;
}

export const MemoryStageTraceSchema = z.object({
  attempted: z.boolean(),
  atWorldId: z.string(),
  trace: z.unknown().optional(),
  selectedCount: z.number(),
  averageConfidence: z.number().optional(),
  contentSummary: MemoryContentSummarySchema.optional(),
  degraded: z.boolean(),
  degradeReason: z
    .enum(["SELECTOR_NOT_CONFIGURED", "SELECTION_EMPTY", "SELECTOR_ERROR"])
    .optional(),
  errorMessage: z.string().optional(),
  durationMs: z.number(),
});

/** Proposer stage trace */
export interface ProposerTrace {
  modelId: string;
  promptTokens?: number;
  completionTokens?: number;
  escalated: boolean;
  escalationReason?: string;
  durationMs: number;
}

export const ProposerTraceSchema = z.object({
  modelId: z.string(),
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
  escalated: z.boolean(),
  escalationReason: z.string().optional(),
  durationMs: z.number(),
});

/** Assembly stage trace */
export interface AssemblyTrace {
  fragmentCount: number;
  finalConfidence: number;
  conflictCount: number;
  dedupeCount: number;
  resultKind: "fragment" | "ambiguity" | "error";
  durationMs: number;
}

export const AssemblyTraceSchema = z.object({
  fragmentCount: z.number(),
  finalConfidence: z.number(),
  conflictCount: z.number(),
  dedupeCount: z.number(),
  resultKind: z.enum(["fragment", "ambiguity", "error"]),
  durationMs: z.number(),
});

// =============================================================================
// Escalation Trace (§6.15)
// =============================================================================

/** Escalation trace (canonical definition) */
export interface EscalationTrace {
  reportId: string;
  escalatedAt: string;
  escalatedTo: ActorRef;
  resolvedAt: string;
  resolutionDurationMs: number;
  choiceKind: "option" | "freeform";
  selectedOptionId?: string;
}

export const EscalationTraceSchema = z.object({
  reportId: z.string(),
  escalatedAt: z.string(),
  escalatedTo: ActorRefSchema,
  resolvedAt: z.string(),
  resolutionDurationMs: z.number(),
  choiceKind: z.enum(["option", "freeform"]),
  selectedOptionId: z.string().optional(),
});

// =============================================================================
// All Stage Traces
// =============================================================================

/** All stage traces collected during translation */
export interface StageTraces {
  chunking?: ChunkingTrace;
  normalization?: NormalizationTrace;
  fastPath?: FastPathTrace;
  retrieval?: RetrievalTrace;
  memory?: MemoryStageTrace;
  proposer?: ProposerTrace;
  assembly?: AssemblyTrace;
}

export const StageTracesSchema = z.object({
  chunking: ChunkingTraceSchema.optional(),
  normalization: NormalizationTraceSchema.optional(),
  fastPath: FastPathTraceSchema.optional(),
  retrieval: RetrievalTraceSchema.optional(),
  memory: MemoryStageTraceSchema.optional(),
  proposer: ProposerTraceSchema.optional(),
  assembly: AssemblyTraceSchema.optional(),
});

// =============================================================================
// Translation Trace (§6.13)
// =============================================================================

/** Request summary in trace */
export interface TraceRequest {
  intentId: IntentId;
  atWorldId: WorldId;
  inputLength: number;
  inputPreview?: string;
  inputHash: string;
  language: string;
}

export const TraceRequestSchema = z.object({
  intentId: z.string(),
  atWorldId: z.string(),
  inputLength: z.number(),
  inputPreview: z.string().optional(),
  inputHash: z.string(),
  language: z.string(),
});

/** Timing information */
export interface TraceTiming {
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export const TraceTimingSchema = z.object({
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number(),
});

/**
 * TranslationTrace: Full trace of a translation call
 *
 * Every call MUST emit a trace. Trace MUST be JSON-serializable.
 */
export interface TranslationTrace {
  traceId: string;
  request: TraceRequest;
  stages: StageTraces;
  resultKind: "fragment" | "ambiguity" | "error";
  timing: TraceTiming;
  ambiguityResolution?: AmbiguityResolution;
  escalation?: EscalationTrace;
}

export const TranslationTraceSchema = z.object({
  traceId: z.string(),
  request: TraceRequestSchema,
  stages: StageTracesSchema,
  resultKind: z.enum(["fragment", "ambiguity", "error"]),
  timing: TraceTimingSchema,
  ambiguityResolution: AmbiguityResolutionSchema.optional(),
  escalation: EscalationTraceSchema.optional(),
});
