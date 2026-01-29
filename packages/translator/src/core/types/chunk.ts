/**
 * @fileoverview Chunk Types (SPEC Section 5.1)
 *
 * A Chunk represents a decomposed segment of input text.
 * Chunks are produced by DecomposeStrategy and consumed by TranslateStrategy.
 *
 * @module core/types/chunk
 */

// =============================================================================
// Span
// =============================================================================

/**
 * Position range in original input text.
 *
 * Per SPEC Section 5.1:
 * - start: Start offset (inclusive)
 * - end: End offset (exclusive)
 */
export interface Span {
  /** Start offset (inclusive) */
  readonly start: number;

  /** End offset (exclusive) */
  readonly end: number;
}

// =============================================================================
// Chunk
// =============================================================================

/**
 * A decomposed segment of input text.
 *
 * Per SPEC Section 5.1:
 * - index: Zero-based index in chunk array
 * - text: The actual text content (MUST equal input.slice(span.start, span.end))
 * - span: Position in original input
 * - meta: Optional metadata
 *
 * Invariants (D-INV-*):
 * - D-INV-0: chunk.text === input.slice(span.start, span.end)
 * - D-INV-1: chunks.length >= 1
 * - D-INV-2: chunks[i].index === i
 * - D-INV-2b: chunks[i].span.start <= chunks[i+1].span.start
 * - D-INV-3: 0 <= span.start <= span.end <= input.length
 */
export interface Chunk {
  /** Zero-based index in chunk array */
  readonly index: number;

  /** The actual text content */
  readonly text: string;

  /** Position in original input */
  readonly span: Span;

  /** Optional metadata */
  readonly meta?: Readonly<Record<string, unknown>>;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a Chunk from text and span.
 *
 * Note: This does NOT validate D-INV-0. Use validateChunks for full validation.
 */
export function createChunk(
  index: number,
  text: string,
  span: Span,
  meta?: Readonly<Record<string, unknown>>
): Chunk {
  return { index, text, span, meta };
}

/**
 * Check if two spans overlap.
 * Per OVL-1: Overlap detected when prev.end > curr.start
 */
export function spansOverlap(a: Span, b: Span): boolean {
  // Assuming a comes before b (a.start <= b.start per D-INV-2b)
  return a.end > b.start;
}

/**
 * Detect if chunks array has any overlapping spans.
 * Requires D-INV-2b (sorted by span.start).
 */
export function hasOverlappingChunks(chunks: readonly Chunk[]): boolean {
  for (let i = 0; i < chunks.length - 1; i++) {
    if (spansOverlap(chunks[i].span, chunks[i + 1].span)) {
      return true;
    }
  }
  return false;
}
