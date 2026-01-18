/**
 * Pipeline Types
 *
 * Internal types for the 6-stage translation pipeline.
 */

import type {
  TranslationContext,
  TranslationResult,
  Section,
  NormalizationResult,
  FastPathResult,
  RetrievalResult,
  MemoryStageResult,
  ProposalResult,
  TranslationTrace,
  StageTraces,
  AmbiguityResolution,
} from "../domain/index.js";

// =============================================================================
// Pipeline State
// =============================================================================

/**
 * Current stage in the pipeline
 */
export type PipelineStage =
  | "idle"
  | "chunking"
  | "normalization"
  | "fastPath"
  | "retrieval"
  | "memory"
  | "proposer"
  | "assembly"
  | "complete";

/**
 * Pipeline state passed between stages
 */
export interface PipelineState {
  /** Original input text */
  input: string;
  /** Translation context */
  context: TranslationContext;
  /** Current stage */
  currentStage: PipelineStage;
  /** Chunking result */
  sections?: Section[];
  /** Normalization result */
  normalization?: NormalizationResult;
  /** Fast path result */
  fastPath?: FastPathResult;
  /** Retrieval result */
  retrieval?: RetrievalResult;
  /** Memory result */
  memory?: MemoryStageResult;
  /** Proposer result */
  proposal?: ProposalResult;
  /** Stage traces */
  traces: StageTraces;
  /** Start time */
  startedAt: Date;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Fast path only mode */
  fastPathOnly: boolean;
  /** Fast path enabled */
  fastPathEnabled: boolean;
  /** Auto accept threshold */
  autoAcceptThreshold: number;
  /** Reject threshold */
  rejectThreshold: number;
  /** Trace configuration */
  includeInputPreview: boolean;
  maxPreviewLength: number;
}

// =============================================================================
// Stage Handlers
// =============================================================================

/**
 * Stage handler result
 */
export interface StageResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  durationMs: number;
}

/**
 * Stage handler interface
 */
export interface StageHandler<TInput, TOutput> {
  execute(input: TInput, state: PipelineState): Promise<StageResult<TOutput>>;
}

// =============================================================================
// Pipeline Interface
// =============================================================================

/**
 * Translator pipeline interface
 */
export interface TranslatorPipeline {
  /**
   * Run the full translation pipeline
   */
  translate(input: string, context: TranslationContext): Promise<TranslationResult>;

  /**
   * Continue from ambiguity resolution
   */
  resolve(
    resolution: AmbiguityResolution,
    context: TranslationContext
  ): Promise<TranslationResult>;
}

// =============================================================================
// Telemetry
// =============================================================================

/**
 * Pipeline telemetry callbacks
 */
export interface PipelineTelemetry {
  onStageStart?(stage: PipelineStage): void;
  onStageComplete?(stage: PipelineStage, durationMs: number): void;
  onStageError?(stage: PipelineStage, error: Error): void;
  onComplete?(result: TranslationResult): void;
}
