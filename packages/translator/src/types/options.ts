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

  /** LLM configuration (optional) */
  readonly llm?: LLMOptions;
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
 */
export type ValidationContext = {
  /** Lexicon for validation */
  readonly lexicon: Lexicon;
};
