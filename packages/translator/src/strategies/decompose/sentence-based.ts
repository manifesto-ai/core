/**
 * @fileoverview SentenceBasedDecomposer (SPEC Section 6.1)
 *
 * Sentence boundary detection for decomposition.
 *
 * Per D-INV-*:
 * - D-INV-0: chunk.text === input.slice(span.start, span.end)
 * - D-INV-1: chunks.length >= 1
 * - D-INV-2: chunks[i].index === i
 * - D-INV-2b: chunks sorted by span.start
 * - D-INV-3: 0 <= span.start <= span.end <= input.length
 *
 * @module strategies/decompose/sentence-based
 */

import type { Chunk, Span } from "../../core/types/chunk.js";
import type {
  DecomposeStrategy,
  DecomposeOptions,
} from "../../core/interfaces/decomposer.js";

// =============================================================================
// SentenceBasedDecomposer
// =============================================================================

/**
 * Sentence boundary detection for decomposition.
 *
 * Per SPEC Section 6.1:
 * - Uses punctuation-based sentence detection
 * - Groups sentences to meet chunk size targets
 * - Non-overlapping by default (OVL-3)
 */
export class SentenceBasedDecomposer implements DecomposeStrategy {
  readonly name = "SentenceBasedDecomposer";

  private readonly defaultMaxChunkSize: number;
  private readonly sentenceEndPattern: RegExp;

  /**
   * Create a SentenceBasedDecomposer.
   *
   * @param maxChunkSize - Target maximum chunk size in characters
   */
  constructor(maxChunkSize: number = 4000) {
    if (maxChunkSize <= 0) {
      throw new Error("Max chunk size must be positive");
    }
    this.defaultMaxChunkSize = maxChunkSize;
    // Match sentence-ending punctuation followed by whitespace or end
    this.sentenceEndPattern = /[.!?]+(?:\s+|$)/g;
  }

  /**
   * Decompose text into sentence-based chunks.
   */
  async decompose(
    text: string,
    options?: DecomposeOptions
  ): Promise<Chunk[]> {
    const maxChunkSize = options?.maxChunkSize ?? this.defaultMaxChunkSize;

    // D-INV-1: Empty text still produces at least 1 chunk
    if (text.length === 0) {
      return [
        {
          index: 0,
          text: "",
          span: { start: 0, end: 0 },
        },
      ];
    }

    // Find sentence boundaries
    const boundaries = this.findSentenceBoundaries(text);

    // If no boundaries found, return whole text as single chunk
    if (boundaries.length === 0) {
      return [
        {
          index: 0,
          text,
          span: { start: 0, end: text.length },
        },
      ];
    }

    // Group sentences into chunks
    const chunks: Chunk[] = [];
    let chunkStart = 0;
    let index = 0;

    for (const boundary of boundaries) {
      const potentialEnd = boundary;
      const potentialSize = potentialEnd - chunkStart;

      // If adding this sentence exceeds max size, create chunk before it
      if (potentialSize > maxChunkSize && chunkStart < boundary) {
        // Find the last boundary before this one
        const prevBoundaryIdx = boundaries.indexOf(boundary) - 1;
        if (prevBoundaryIdx >= 0) {
          const prevBoundary = boundaries[prevBoundaryIdx];
          if (prevBoundary > chunkStart) {
            // Create chunk up to previous boundary
            const span: Span = { start: chunkStart, end: prevBoundary };
            chunks.push({
              index,
              text: text.slice(span.start, span.end),
              span,
            });
            index++;
            chunkStart = prevBoundary;
          }
        }
      }
    }

    // Create final chunk with remaining text
    if (chunkStart < text.length) {
      const span: Span = { start: chunkStart, end: text.length };
      chunks.push({
        index,
        text: text.slice(span.start, span.end),
        span,
      });
    }

    // D-INV-1: Ensure at least one chunk
    if (chunks.length === 0) {
      return [
        {
          index: 0,
          text,
          span: { start: 0, end: text.length },
        },
      ];
    }

    return chunks;
  }

  /**
   * Find sentence boundaries in text.
   * Returns array of end positions (after punctuation and whitespace).
   */
  private findSentenceBoundaries(text: string): number[] {
    const boundaries: number[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    this.sentenceEndPattern.lastIndex = 0;

    while ((match = this.sentenceEndPattern.exec(text)) !== null) {
      // Boundary is at the end of the match (after punctuation + whitespace)
      boundaries.push(match.index + match[0].length);
    }

    return boundaries;
  }
}
