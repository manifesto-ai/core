/**
 * @fileoverview Decompose Layer Types (ADR-003)
 *
 * Types for the optional decompose preprocessing layer that splits
 * complex inputs into manageable chunks before translation.
 */

import type { IntentGraph } from "../types/index.js";

// =============================================================================
// DecomposeResult
// =============================================================================

/**
 * Result of decomposition.
 */
export type DecomposeResult = {
  /** Chunks of Intent Graphs (one per segment) */
  readonly chunks: readonly IntentGraph[];

  /** Metadata about the decomposition */
  readonly meta: {
    /** Strategy used for decomposition */
    readonly strategy: string;

    /** Number of chunks produced */
    readonly chunkCount: number;

    /** ISO timestamp of decomposition */
    readonly decomposedAt: string;
  };
};

// =============================================================================
// DecomposeStrategy
// =============================================================================

/**
 * Strategy interface for decomposition.
 *
 * Per ADR-003: Decomposition strategies are pluggable.
 * Implementations include:
 * - Deterministic: Rule-based sentence splitting
 * - ShallowLLM: LLM-based semantic boundary detection
 */
export interface DecomposeStrategy {
  /** Strategy name (for logging/debugging) */
  readonly name: string;

  /**
   * Decompose input text into chunks.
   *
   * Each chunk is a partial Intent Graph that will be
   * merged after individual translation.
   *
   * @param text - Natural language input to decompose
   * @returns Decomposition result with chunks
   */
  decompose(text: string): Promise<DecomposeResult>;
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
