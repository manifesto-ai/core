/**
 * @fileoverview Deterministic Decomposition Strategy (ADR-003)
 *
 * Rule-based decomposition using sentence boundaries.
 * No LLM required - purely deterministic splitting.
 *
 * Per ADR-003 D3-1:
 * - Splits by punctuation boundaries + length budget (no language keywords)
 * - Fallback when LLM is unavailable or cost-constrained
 */

import type {
  DecomposeStrategy,
  DecomposeResult,
  DecomposeContext,
  DecomposeChunk,
} from "../types.js";

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_CHUNK_CHARS = 500;

// =============================================================================
// DeterministicDecompose
// =============================================================================

/**
 * Deterministic decomposition using sentence boundary detection.
 *
 * Per ADR-003 D3-1: "Deterministic splitter for simple cases"
 *
 * This strategy splits text at sentence boundaries (., !, ?, etc.)
 * and produces one chunk per sentence, respecting maxChunkChars budget.
 *
 * Language-independent per C-LANG-1:
 * - Uses punctuation-based splitting (no language keywords)
 * - Handles common sentence endings: . ! ? 。 ！ ？
 *
 * Suitable for:
 * - Multi-sentence inputs with clear separation
 * - Inputs where each sentence represents a distinct intent
 * - Fallback when LLM decomposition fails
 *
 * Not suitable for:
 * - Complex sentences with multiple intents
 * - Inputs requiring semantic understanding for splitting
 */
export class DeterministicDecompose implements DecomposeStrategy {
  readonly name = "deterministic";

  async decompose(
    input: string,
    ctx?: DecomposeContext
  ): Promise<DecomposeResult> {
    // Empty input
    if (!input.trim()) {
      return { chunks: [] };
    }

    // Split by sentence boundaries
    const rawChunks = this.splitIntoSentences(input);

    // Only apply budget-based balancing if maxChunkChars is explicitly set
    // Default behavior is to preserve sentence boundaries
    let finalChunks = rawChunks;

    if (ctx?.maxChunkChars !== undefined) {
      finalChunks = this.balanceChunks(rawChunks, ctx.maxChunkChars, input);
    }

    // Apply maxChunks limit if specified
    if (ctx?.maxChunks !== undefined) {
      finalChunks = this.applyMaxChunksLimit(finalChunks, ctx.maxChunks, input);
    }

    return { chunks: finalChunks };
  }

  /**
   * Split text into sentences with span tracking.
   *
   * Per C-LANG-1: Uses punctuation-based splitting (language-independent).
   * Per C-DEC-1: Each chunk.text is a contiguous substring of input.
   */
  private splitIntoSentences(input: string): DecomposeChunk[] {
    const chunks: DecomposeChunk[] = [];

    // Pattern: sentence-ending punctuation followed by whitespace
    // Includes: . ! ? 。 ！ ？ (common across languages)
    const pattern = /(?<=[.!?。！？])\s+/g;

    let lastIndex = 0;
    let chunkIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(input)) !== null) {
      // Span includes everything from lastIndex to just before the whitespace
      const spanEnd = match.index + 1; // Include the punctuation
      const text = input.slice(lastIndex, spanEnd);

      if (text.trim()) {
        chunks.push({
          id: `chunk_${chunkIndex++}`,
          text: text.trim(),
          span: [lastIndex, spanEnd] as const,
        });
      }

      // Skip the whitespace for next chunk start
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text as final chunk
    if (lastIndex < input.length) {
      const remaining = input.slice(lastIndex);
      if (remaining.trim()) {
        chunks.push({
          id: `chunk_${chunkIndex}`,
          text: remaining.trim(),
          span: [lastIndex, input.length] as const,
        });
      }
    }

    // If no sentence boundaries found, return entire input as single chunk
    if (chunks.length === 0 && input.trim()) {
      const trimmed = input.trim();
      const start = input.indexOf(trimmed);
      chunks.push({
        id: "chunk_0",
        text: trimmed,
        span: [start, start + trimmed.length] as const,
      });
    }

    return chunks;
  }

  /**
   * Balance chunks to respect maxChars budget.
   *
   * - Merges small consecutive chunks if combined length < maxChars
   * - Splits oversized chunks at clause boundaries (; : ,) if possible
   */
  private balanceChunks(
    chunks: DecomposeChunk[],
    maxChars: number,
    input: string
  ): DecomposeChunk[] {
    if (chunks.length === 0) return chunks;

    const balanced: DecomposeChunk[] = [];
    let currentChunk: DecomposeChunk | null = null;

    for (const chunk of chunks) {
      // If chunk is oversized, try to split it
      if (chunk.text.length > maxChars) {
        // Flush current accumulated chunk first
        if (currentChunk) {
          balanced.push(currentChunk);
          currentChunk = null;
        }

        // Split oversized chunk at clause boundaries
        const splitChunks = this.splitOversizedChunk(chunk, maxChars, input);
        balanced.push(...splitChunks);
        continue;
      }

      // Try to merge with current accumulated chunk
      if (currentChunk) {
        const combinedLength = currentChunk.text.length + 1 + chunk.text.length;
        if (combinedLength <= maxChars) {
          // Merge chunks
          currentChunk = {
            id: currentChunk.id,
            text: `${currentChunk.text} ${chunk.text}`,
            span: [currentChunk.span![0], chunk.span![1]] as const,
          };
        } else {
          // Can't merge, flush current and start new
          balanced.push(currentChunk);
          currentChunk = chunk;
        }
      } else {
        currentChunk = chunk;
      }
    }

    // Flush final chunk
    if (currentChunk) {
      balanced.push(currentChunk);
    }

    // Reassign IDs after balancing
    return balanced.map((chunk, i) => ({
      ...chunk,
      id: `chunk_${i}`,
    }));
  }

  /**
   * Split an oversized chunk at clause boundaries.
   */
  private splitOversizedChunk(
    chunk: DecomposeChunk,
    maxChars: number,
    input: string
  ): DecomposeChunk[] {
    const result: DecomposeChunk[] = [];
    const text = chunk.text;
    const baseOffset = chunk.span![0];

    // Try to split at clause boundaries: ; : , (in that order of preference)
    const clausePattern = /(?<=[;:,])\s+/g;

    let lastIndex = 0;
    let currentText = "";
    let currentStart = 0;
    let match: RegExpExecArray | null;

    while ((match = clausePattern.exec(text)) !== null) {
      const segment = text.slice(lastIndex, match.index + 1);

      if (currentText.length + segment.length <= maxChars) {
        currentText += segment;
      } else {
        // Flush current
        if (currentText.trim()) {
          result.push({
            id: `split_${result.length}`,
            text: currentText.trim(),
            span: [baseOffset + currentStart, baseOffset + lastIndex] as const,
          });
        }
        currentStart = lastIndex;
        currentText = segment;
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining
    const remaining = text.slice(lastIndex);
    if (currentText || remaining) {
      const finalText = currentText + remaining;
      if (finalText.trim()) {
        result.push({
          id: `split_${result.length}`,
          text: finalText.trim(),
          span: [baseOffset + currentStart, chunk.span![1]] as const,
        });
      }
    }

    // If no splits were made, just return original (can't split further)
    if (result.length === 0) {
      return [chunk];
    }

    return result;
  }

  /**
   * Apply maxChunks limit by merging excess chunks.
   */
  private applyMaxChunksLimit(
    chunks: DecomposeChunk[],
    maxChunks: number | undefined,
    input: string
  ): DecomposeChunk[] {
    if (!maxChunks || chunks.length <= maxChunks) {
      return chunks;
    }

    // Merge chunks to fit within limit
    const result: DecomposeChunk[] = [];
    const chunksPerBucket = Math.ceil(chunks.length / maxChunks);

    for (let i = 0; i < chunks.length; i += chunksPerBucket) {
      const bucket = chunks.slice(i, i + chunksPerBucket);
      if (bucket.length === 1) {
        result.push({
          ...bucket[0],
          id: `chunk_${result.length}`,
        });
      } else {
        // Merge bucket into single chunk
        const merged: DecomposeChunk = {
          id: `chunk_${result.length}`,
          text: bucket.map((c) => c.text).join(" "),
          span: [bucket[0].span![0], bucket[bucket.length - 1].span![1]] as const,
        };
        result.push(merged);
      }
    }

    return result;
  }
}
