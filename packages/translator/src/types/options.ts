/**
 * @fileoverview API Options Types (SPEC Section 10)
 *
 * Options and context types for public API functions.
 */

import type { IntentIR, Lexicon, ResolvedIntentIR } from "@manifesto-ai/intent-ir";
import type { IntentGraph } from "./graph.js";
import type { LLMProvider } from "../llm/provider.js";

// =============================================================================
// SnapshotLike
// =============================================================================

/**
 * Structural type for snapshot compatibility.
 *
 * Translator does not depend on Core at runtime,
 * but accepts structurally compatible snapshots.
 *
 * Per SPEC Section 7.6
 */
export type SnapshotLike = {
  readonly data: Record<string, unknown>;
  readonly computed?: Record<string, unknown>;
};

// =============================================================================
// Resolver (Translator-specific)
// =============================================================================

/**
 * Resolver interface for discourse reference resolution.
 *
 * This is the Translator-specific interface. The intent-ir Resolver
 * is used for lowering, but Translator may use a different resolver
 * that supports deferred resolution.
 *
 * Per SPEC Section 10.4:
 * - Resolver MAY be stateful, maintaining execution context internally
 * - Returns either ResolvedIntentIR or deferred marker
 */
export interface TranslatorResolver {
  /**
   * Resolves discourse references in an IntentIR.
   *
   * @param ir - The IntentIR to resolve
   * @returns Resolved IR or deferred marker
   */
  resolveReferences(
    ir: IntentIR
  ): ResolvedIntentIR | { readonly deferred: true; readonly reason: string };
}

// =============================================================================
// TranslateOptions
// =============================================================================

/**
 * LLM configuration options.
 */
export type LLMOptions = {
  /** LLM provider instance */
  readonly provider?: LLMProvider;

  /** Model override */
  readonly model?: string;

  /** Temperature (0-1, default: 0.1) */
  readonly temperature?: number;

  /** Timeout in milliseconds */
  readonly timeout?: number;
};

// =============================================================================
// DecomposeOptions (ADR-003)
// =============================================================================

/**
 * Decompose strategy type.
 *
 * - "none": No decomposition (default for short inputs)
 * - "auto": Automatically choose strategy based on input length
 * - "shallow-llm": Use LLM for semantic boundary detection
 * - "deterministic": Use rule-based sentence splitting
 */
export type DecomposeStrategy = "none" | "auto" | "shallow-llm" | "deterministic";

/**
 * Decomposition options for complex inputs.
 *
 * Per ADR-003: Optional preprocessing layer for splitting
 * complex inputs into manageable chunks before translation.
 */
export type DecomposeOptions = {
  /**
   * Decomposition strategy.
   *
   * - "none": No decomposition (default)
   * - "auto": Automatically choose based on input length/complexity
   * - "shallow-llm": LLM-based semantic boundary detection
   * - "deterministic": Rule-based sentence splitting
   */
  readonly strategy?: DecomposeStrategy;

  /**
   * Minimum input length to trigger auto decomposition.
   * Default: 200 characters
   */
  readonly autoThreshold?: number;

  /**
   * Soft budget for chunk size in characters.
   * Per ADR-003 DecomposeContext.maxChunkChars
   */
  readonly maxChunkChars?: number;

  /**
   * Soft budget for number of chunks.
   * Per ADR-003 DecomposeContext.maxChunks
   */
  readonly maxChunks?: number;

  /**
   * Language hint for decomposition.
   * Per ADR-003 C-LANG-1: MUST NOT be required.
   */
  readonly language?: string;

  /**
   * API key for LLM decomposition (uses OPENAI_API_KEY if not provided).
   */
  readonly apiKey?: string;

  /**
   * Model for decomposition (default: gpt-4o-mini).
   */
  readonly model?: string;
};

/**
 * Translation mode.
 *
 * Per SPEC Section 10.1:
 * - "llm": Uses LLM for translation (requires provider config)
 * - "deterministic": Heuristic-only, no LLM (may produce empty/minimal graph)
 */
export type TranslateMode = "llm" | "deterministic";

/**
 * Options for translate() function.
 *
 * Per SPEC Section 10.1
 */
export type TranslateOptions = {
  /** Language hint (ISO 639-1) */
  readonly language?: string;

  /** Domain context for disambiguation */
  readonly domainHint?: string;

  /** Lexicon for integrated validation */
  readonly validateWith?: Lexicon;

  /** Maximum nodes to generate */
  readonly maxNodes?: number;

  /**
   * Translation mode (default: "llm").
   *
   * - "llm": Uses LLM for translation (requires provider config).
   *          Throws CONFIGURATION_ERROR if LLM not configured.
   * - "deterministic": Heuristic-only, no LLM required.
   *                    May produce empty/minimal graph for complex inputs.
   */
  readonly mode?: TranslateMode;

  /** LLM configuration (optional) */
  readonly llm?: LLMOptions;

  /**
   * Decomposition options (ADR-003).
   *
   * When enabled, complex inputs are split into chunks,
   * translated separately, and merged back together.
   */
  readonly decompose?: DecomposeOptions;
};

// =============================================================================
// TranslateWarning
// =============================================================================

/**
 * Non-fatal warning during translation.
 */
export type TranslateWarning = {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
};

// =============================================================================
// TranslateResult
// =============================================================================

/**
 * Result of translate() function.
 *
 * Per SPEC Section 10.1
 */
export type TranslateResult = {
  /** The generated Intent Graph */
  readonly graph: IntentGraph;

  /** Non-fatal warnings during translation */
  readonly warnings: readonly TranslateWarning[];
};

// =============================================================================
// EmitContext
// =============================================================================

/**
 * Context for emitForManifesto() function.
 *
 * Per SPEC Section 10.3
 */
export type EmitContext = {
  /** Lexicon for lowering (REQUIRED) */
  readonly lexicon: Lexicon;

  /** Resolver for discourse references (REQUIRED) */
  readonly resolver: TranslatorResolver;

  /** Current snapshot for entity resolution */
  readonly snapshot?: SnapshotLike;

  /** Schema hash for intentKey calculation */
  readonly schemaHash: string;
};

// =============================================================================
// ValidationContext
// =============================================================================

/**
 * Context for validate() function.
 *
 * Per SPEC Section 10.2
 */
export type ValidationContext = {
  /** Lexicon for validation */
  readonly lexicon: Lexicon;

  /**
   * Strict missing check mode (default: true).
   *
   * When true (strict mode):
   * - R1 violations (Resolved with missing) are errors
   *
   * When false (lenient mode):
   * - R1 violations are warnings instead of errors
   * - Useful for incremental resolution workflows
   */
  readonly strictMissingCheck?: boolean;
};
