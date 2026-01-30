/**
 * @fileoverview DecomposeStrategy Interface (SPEC Section 6.1)
 *
 * Decomposes input text into processable chunks.
 *
 * Per SPEC Section 6.1:
 * - Returns Promise to support LLM-based or I/O-based decomposers
 * - Sync implementations should return Promise.resolve(chunks)
 *
 * @module core/interfaces/decomposer
 */

import type { Chunk } from "../types/chunk.js";

// =============================================================================
// DecomposeOptions
// =============================================================================

/**
 * Options for decomposition.
 *
 * Per SPEC Section 6.1
 */
export interface DecomposeOptions {
  /** Maximum chunk size (tokens or characters) */
  maxChunkSize?: number;

  /** Overlap size for context preservation */
  overlapSize?: number;

  /** Language hint for better sentence detection */
  language?: string;
}

// =============================================================================
// DecomposeStrategy
// =============================================================================

/**
 * Decomposes input text into processable chunks.
 *
 * Per SPEC Section 6.1:
 * - decompose() returns Promise<Chunk[]> satisfying D-INV-* invariants
 * - Sync implementations should return Promise.resolve(chunks)
 *
 * Built-in implementations:
 * - SlidingWindowDecomposer: Fixed-size windows with optional overlap
 * - SentenceBasedDecomposer: Sentence boundary detection
 *
 * Invariants (D-INV-*):
 * - D-INV-0: chunk.text === input.slice(span.start, span.end)
 * - D-INV-1: chunks.length >= 1
 * - D-INV-2: chunks[i].index === i
 * - D-INV-2b: chunks[i].span.start <= chunks[i+1].span.start
 * - D-INV-3: 0 <= span.start <= span.end <= input.length
 */
export interface DecomposeStrategy {
  /**
   * Strategy name for debugging and logging.
   */
  readonly name: string;

  /**
   * Decompose text into chunks.
   *
   * Note: Returns Promise to support LLM-based or I/O-based decomposers.
   * Sync implementations should return Promise.resolve(chunks).
   *
   * @param text - Input text to decompose
   * @param options - Decomposition options
   * @returns Promise of chunk array satisfying D-INV-* invariants
   */
  decompose(text: string, options?: DecomposeOptions): Promise<Chunk[]>;
}
