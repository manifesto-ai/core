import type {
  CompilerContext,
  NormalizedIntent,
  AttemptRecord,
  ResolutionOption,
} from "../../domain/types.js";

/**
 * LLM Result types - tri-state result for LLM operations
 *
 * Per FDR-C002: LLM is an untrusted proposer.
 * These results represent what the LLM returned, not validated output.
 */
export type LLMResult<T> =
  | { ok: true; data: T }
  | { ok: "resolution"; reason: string; options: ResolutionOption[] }
  | { ok: false; error: string };

/**
 * Segment result
 */
export type SegmentResult = LLMResult<{ segments: string[] }>;

/**
 * Normalize result
 */
export type NormalizeResult = LLMResult<{ intents: NormalizedIntent[] }>;

/**
 * Propose result
 */
export type ProposeResult = LLMResult<{ draft: unknown }>;

/**
 * LLM Adapter interface - abstracts over different LLM providers
 *
 * Per SPEC.md §6: Effect handler contracts define the interface between
 * Compiler and LLM. This adapter interface mirrors those contracts.
 */
export interface LLMAdapter {
  /**
   * Segment natural language text into requirement segments
   *
   * @param params.text - Input text to segment
   * @returns Segmented text or error
   */
  segment(params: { text: string }): Promise<SegmentResult>;

  /**
   * Normalize segments into structured intents
   *
   * @param params.segments - Text segments to normalize
   * @param params.schema - Target schema (for context)
   * @param params.context - Additional context
   * @returns Normalized intents, resolution request, or error
   */
  normalize(params: {
    segments: string[];
    schema: unknown;
    context?: CompilerContext;
  }): Promise<NormalizeResult>;

  /**
   * Propose a DomainDraft from intents
   *
   * Per FDR-C002: Output is a proposal, not a validated schema.
   *
   * @param params.schema - Target schema structure
   * @param params.intents - Normalized intents to implement
   * @param params.history - Previous failed attempts (for retry feedback)
   * @param params.context - Additional context
   * @param params.resolution - Resolution selection (if resuming from resolution)
   * @returns Draft proposal, resolution request, or error
   */
  propose(params: {
    schema: unknown;
    intents: NormalizedIntent[];
    history: AttemptRecord[];
    context?: CompilerContext;
    resolution?: string;
  }): Promise<ProposeResult>;
}

/**
 * LLM Adapter configuration
 */
export interface LLMAdapterConfig {
  /**
   * Model identifier
   * @example 'claude-sonnet-4-20250514'
   */
  model: string;

  /**
   * Maximum tokens for generation
   * @default 4096
   */
  maxTokens?: number;

  /**
   * Temperature for generation (0.0 - 1.0)
   * Lower = more deterministic for structured output
   * @default 0.1
   */
  temperature?: number;

  /**
   * API timeout in milliseconds
   * @default 60000
   */
  timeout?: number;

  /**
   * Custom system prompt prefix (optional)
   * Prepended to all system prompts
   */
  systemPromptPrefix?: string;
}

/**
 * Default LLM configuration
 *
 * Uses low temperature for structured JSON output consistency.
 */
export const DEFAULT_LLM_CONFIG: Required<LLMAdapterConfig> = {
  model: "claude-sonnet-4-20250514",
  maxTokens: 4096,
  temperature: 0.1,
  timeout: 60000,
  systemPromptPrefix: "",
};
