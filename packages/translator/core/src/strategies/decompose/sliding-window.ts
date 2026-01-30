/**
 * @fileoverview SlidingWindowDecomposer (SPEC Section 6.1)
 *
 * Fixed-size windows with optional overlap.
 *
 * Per D-INV-*:
 * - D-INV-0: chunk.text === input.slice(span.start, span.end)
 * - D-INV-1: chunks.length >= 1
 * - D-INV-2: chunks[i].index === i
 * - D-INV-2b: chunks sorted by span.start
 * - D-INV-3: 0 <= span.start <= span.end <= input.length
 *
 * @module strategies/decompose/sliding-window
 */

import type { Chunk, Span } from "../../core/types/chunk.js";
import type {
  DecomposeStrategy,
  DecomposeOptions,
} from "../../core/interfaces/decomposer.js";

// =============================================================================
// SlidingWindowDecomposer
// =============================================================================

/**
 * Fixed-size windows with optional overlap.
 *
 * Per SPEC Section 6.1:
 * - Chunks are fixed-size windows
 * - Overlap creates context preservation (OVL-*)
 * - Default is non-overlap (OVL-3)
 */
export class SlidingWindowDecomposer implements DecomposeStrategy {
  readonly name = "SlidingWindowDecomposer";

  private readonly defaultChunkSize: number;
  private readonly defaultOverlapSize: number;

  /**
   * Create a SlidingWindowDecomposer.
   *
   * @param chunkSize - Default chunk size in characters
   * @param overlapSize - Default overlap size in characters (default: 0)
   */
  constructor(chunkSize: number = 4000, overlapSize: number = 0) {
    if (chunkSize <= 0) {
      throw new Error("Chunk size must be positive");
    }
    if (overlapSize < 0) {
      throw new Error("Overlap size must be non-negative");
    }
    if (overlapSize >= chunkSize) {
      throw new Error("Overlap size must be less than chunk size");
    }
    this.defaultChunkSize = chunkSize;
    this.defaultOverlapSize = overlapSize;
  }

  /**
   * Decompose text into fixed-size chunks.
   */
  async decompose(
    text: string,
    options?: DecomposeOptions
  ): Promise<Chunk[]> {
    const chunkSize = options?.maxChunkSize ?? this.defaultChunkSize;
    const overlapSize = options?.overlapSize ?? this.defaultOverlapSize;

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

    const chunks: Chunk[] = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const span: Span = { start, end };

      // D-INV-0: chunk.text === input.slice(span.start, span.end)
      const chunk: Chunk = {
        index,
        text: text.slice(start, end),
        span,
      };

      chunks.push(chunk);
      index++;

      // Move to next window, accounting for overlap
      const step = chunkSize - overlapSize;
      start = start + step;

      // Prevent infinite loop if step is 0 or negative
      if (step <= 0) {
        break;
      }
    }

    return chunks;
  }
}
