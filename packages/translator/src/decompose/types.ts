/**
 * @fileoverview Decompose Layer Types (ADR-003)
 *
 * Types for the optional decompose preprocessing layer that splits
 * complex inputs into manageable chunks before translation.
 *
 * Per ADR-003 v0.11:
 * - Each chunk MUST be a contiguous substring of the input (C-DEC-1)
 * - Chunks MUST preserve original order (C-DEC-2)
 * - LLM strategies MUST include span and verify substring (C-DEC-5)
 */

import type { IntentGraph } from "../types/index.js";

// =============================================================================
// DecomposeChunk
// =============================================================================

/**
 * A single chunk from decomposition.
 *
 * Per ADR-003 Normative Chunk Constraints:
 * - text MUST be a contiguous substring of input (C-DEC-1)
 * - span is REQUIRED for LLM strategies (C-DEC-5)
 */
export type DecomposeChunk = {
  /** Unique chunk identifier */
  readonly id: string;

  /** MUST be contiguous substring of input (C-DEC-1) */
  readonly text: string;

  /** Offsets in original string [start, end]. REQUIRED for LLM strategies (C-DEC-5) */
  readonly span?: readonly [number, number];

  /** Non-normative hints for downstream processing */
  readonly hint?: Readonly<Record<string, unknown>>;
};

// =============================================================================
// DecomposeWarning
// =============================================================================

/**
 * Warning generated during decomposition.
 */
export type DecomposeWarning = {
  readonly code: string;
  readonly message: string;
};

// =============================================================================
// DecomposeResult
// =============================================================================

/**
 * Result of decomposition.
 *
 * Per ADR-003 D2:
 * - chunks array contains DecomposeChunk items
 * - warnings for non-fatal issues
 */
export type DecomposeResult = {
  /** Decomposed chunks */
  readonly chunks: readonly DecomposeChunk[];

  /** Non-fatal warnings */
  readonly warnings?: readonly DecomposeWarning[];
};

// =============================================================================
// DecomposeContext
// =============================================================================

/**
 * Context for decomposition.
 *
 * Per ADR-003 D2.
 */
export type DecomposeContext = {
  /** Language hint (MUST NOT be required per C-LANG-1) */
  readonly language?: string;

  /** Soft budget for chunk size in characters */
  readonly maxChunkChars?: number;

  /** Soft budget for number of chunks */
  readonly maxChunks?: number;
};

// =============================================================================
// DecomposeStrategy
// =============================================================================

/**
 * Strategy interface for decomposition.
 *
 * Per ADR-003 D2: Decomposition is defined by a strategy interface.
 *
 * Implementations include:
 * - DeterministicDecompose: Rule-based sentence splitting
 * - ShallowLLMDecompose: LLM-based semantic boundary detection
 */
export interface DecomposeStrategy {
  /** Strategy name (for logging/debugging) */
  readonly name: string;

  /**
   * Decompose input text into chunks.
   *
   * Per ADR-003 D2:
   * - Returns chunks where each chunk.text is a contiguous substring of input
   * - LLM strategies MUST include span and verify (C-DEC-5)
   *
   * @param input - Natural language input to decompose
   * @param ctx - Optional decomposition context
   * @returns Decomposition result with chunks
   */
  decompose(input: string, ctx?: DecomposeContext): Promise<DecomposeResult>;
}

// =============================================================================
// MergeOptions
// =============================================================================

/**
 * Options for merging translated chunks.
 */
export type MergeOptions = {
  /**
   * Prefix for node IDs to avoid collisions.
   * Default: "chunk"
   */
  readonly idPrefix?: string;

  /**
   * Whether to add cross-chunk dependencies.
   * When true, the first non-Abstract node of each chunk
   * depends on the last non-Abstract node of the previous chunk.
   * Default: true
   */
  readonly addCrossChunkDeps?: boolean;
};

// =============================================================================
// MergeResult
// =============================================================================

/**
 * Result of merging translated chunks.
 */
export type MergeResult = {
  /** Merged Intent Graph */
  readonly graph: IntentGraph;

  /** Identifiers of merged chunks */
  readonly mergedFrom: readonly string[];
};
