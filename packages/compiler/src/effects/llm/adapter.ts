/**
 * @manifesto-ai/compiler v1.1 LLM Adapter
 *
 * Per SPEC §10: LLM Actors are untrusted proposers.
 * This adapter defines the interface between Compiler and LLM providers.
 */

import type {
  SourceInput,
  Plan,
  PlanStrategy,
  Chunk,
  FragmentDraft,
  FragmentType,
  Fragment,
  Issue,
} from "../../domain/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 LLM Result Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LLM Result - tri-state result for LLM operations
 *
 * Per SPEC §10.2: LLM can succeed, fail, or request resolution.
 * NOTE: In v1.1, resolution is primarily triggered by Linker, not LLM.
 * However, LLM can still indicate ambiguity for the Planner/Generator phase.
 */
export type LLMResult<T> =
  | { ok: true; data: T }
  | { ok: "ambiguous"; reason: string; alternatives: T[] }
  | { ok: false; error: string };

// ═══════════════════════════════════════════════════════════════════════════════
// §2 Plan Request/Result
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Plan request - input for the PlannerActor
 *
 * Per SPEC §10.3: PlannerActor analyzes input and produces a Plan.
 */
export interface PlanRequest {
  /**
   * Source input to analyze
   */
  sourceInput: SourceInput;

  /**
   * Optional hints for planning strategy
   */
  hints?: {
    /**
     * Preferred chunking strategy
     */
    preferredStrategy?: PlanStrategy;

    /**
     * Maximum number of chunks
     */
    maxChunks?: number;
  };
}

/**
 * Raw chunk from LLM (before ID assignment)
 */
export interface RawChunkOutput {
  content: string;
  expectedType: FragmentType;
  dependencies: Array<{
    kind: "requires";
    targetChunkId: string;
    reason?: string;
  }>;
  sourceSpan?: { start: number; end: number };
}

/**
 * Raw plan from LLM (before ID assignment)
 */
export interface RawPlanOutput {
  strategy: PlanStrategy;
  chunks: RawChunkOutput[];
  rationale?: string;
}

/**
 * Plan result - output from the PlannerActor
 */
export type PlanResult = LLMResult<{
  /**
   * Generated plan (without IDs - IDs added by handlers)
   */
  plan: RawPlanOutput;
}>;

// ═══════════════════════════════════════════════════════════════════════════════
// §3 Generate Request/Result
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate request - input for the GeneratorActor
 *
 * Per SPEC §10.4: GeneratorActor produces FragmentDraft from Chunk.
 */
export interface GenerateRequest {
  /**
   * Chunk to generate FragmentDraft from
   */
  chunk: Chunk;

  /**
   * Full plan for context
   */
  plan: Plan;

  /**
   * Existing verified fragments (for dependency context)
   */
  existingFragments: Fragment[];

  /**
   * Retry context if this is a retry attempt
   */
  retryContext?: {
    /**
     * Previous draft that failed
     */
    previousDraft: FragmentDraft;

    /**
     * Issues that caused the failure
     */
    issues: Issue[];

    /**
     * Attempt number (0-indexed)
     */
    attemptNumber: number;
  };
}

/**
 * Raw fragment interpretation from LLM
 */
export interface RawInterpretationOutput {
  raw: unknown;
  description?: string;
}

/**
 * Raw fragment draft from LLM (before ID assignment)
 */
export interface RawDraftOutput {
  type: FragmentType;
  interpretation: RawInterpretationOutput;
  confidence?: number;
  alternatives?: RawInterpretationOutput[];
}

/**
 * Generate result - output from the GeneratorActor
 */
export type GenerateResult = LLMResult<{
  /**
   * Generated fragment draft (without IDs - IDs added by handlers)
   */
  draft: RawDraftOutput;
}>;

// ═══════════════════════════════════════════════════════════════════════════════
// §4 LLM Adapter Interface
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LLM Adapter interface - abstracts over different LLM providers
 *
 * Per SPEC §10: LLM Actors (PlannerActor, GeneratorActor) are implemented
 * as effect handlers using this adapter interface.
 *
 * v1.1 Changes:
 * - Removed: segment(), normalize(), propose() (v1.0)
 * - Added: plan(), generate() (v1.1)
 */
export interface LLMAdapter {
  /**
   * Generate a Plan from SourceInput
   *
   * Per SPEC §10.3: PlannerActor responsibility.
   * Analyzes input, determines chunking strategy, and produces Plan.
   *
   * @param request - Plan request with source input and hints
   * @returns Plan result or error
   */
  plan(request: PlanRequest): Promise<PlanResult>;

  /**
   * Generate a FragmentDraft from a Chunk
   *
   * Per SPEC §10.4: GeneratorActor responsibility.
   * Produces FragmentDraft with interpretation, requires/provides hints.
   *
   * @param request - Generate request with chunk and context
   * @returns FragmentDraft result or error
   */
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 LLM Adapter Configuration
// ═══════════════════════════════════════════════════════════════════════════════

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

  [key: string]: unknown;
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
