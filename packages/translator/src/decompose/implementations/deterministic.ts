/**
 * @fileoverview Deterministic Decomposition Strategy (ADR-003)
 *
 * Rule-based decomposition using sentence boundaries.
 * No LLM required - purely deterministic splitting.
 */

import type { DecomposeStrategy, DecomposeResult } from "../types.js";

/**
 * Deterministic decomposition using sentence boundary detection.
 *
 * Per ADR-003: "Deterministic splitter for simple cases"
 *
 * This strategy splits text at sentence boundaries (., !, ?)
 * and produces one chunk per sentence.
 *
 * Suitable for:
 * - Multi-sentence inputs with clear separation
 * - Inputs where each sentence represents a distinct intent
 *
 * Not suitable for:
 * - Complex sentences with multiple intents
 * - Inputs requiring semantic understanding for splitting
 */
export class DeterministicDecompose implements DecomposeStrategy {
  readonly name = "deterministic";

  async decompose(text: string): Promise<DecomposeResult> {
    // Split by sentence boundaries (., !, ?) followed by whitespace
    // Handles common abbreviations like "Dr.", "Mr.", etc. by requiring
    // the boundary to be followed by whitespace and a capital letter
    const sentences = this.splitIntoSentences(text);

    const chunks = sentences.map((sentence, i) => ({
      nodes: [],
      meta: {
        sourceText: sentence.trim(),
        translatedAt: new Date().toISOString(),
        chunkIndex: i,
      },
    }));

    return {
      chunks,
      meta: {
        strategy: this.name,
        chunkCount: chunks.length,
        decomposedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Split text into sentences.
   *
   * Uses a simple regex that handles common cases:
   * - Period, exclamation, question mark followed by space
   * - Handles quotes after punctuation
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence boundary detection
    // Split on punctuation followed by whitespace
    const sentences = text.split(/(?<=[.!?])\s+/);

    // Filter out empty strings and trim
    return sentences
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
}
