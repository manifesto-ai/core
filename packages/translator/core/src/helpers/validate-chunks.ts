/**
 * @fileoverview Chunk Validation (SPEC Section 12.3)
 *
 * Validates chunk array invariants (D-INV-*).
 *
 * Per SPEC Section 11.11 (V-*):
 * - V-1: validateChunks() MUST NOT throw on validation failure
 * - V-2: validateChunks() MUST return {valid: false, error} for invalid input
 * - V-3: assertValidChunks() MAY throw ValidationException
 *
 * @module helpers/validate-chunks
 */

import type { Chunk } from "../core/types/chunk.js";
import type { ValidationResult } from "../core/types/validation.js";
import { invalidResult, validResult } from "../core/types/validation.js";
import { ValidationException } from "../core/types/errors.js";

// =============================================================================
// validateChunks
// =============================================================================

/**
 * Validate chunk array invariants.
 *
 * Per SPEC Section 12.3:
 * Checks: D-INV-0, D-INV-1, D-INV-2, D-INV-2b, D-INV-3
 *
 * MUST NOT throw on validation failure.
 * Returns {valid: false, error} for invalid chunks.
 *
 * @param chunks - Chunk array to validate
 * @param input - Original input text
 * @returns ValidationResult
 */
export function validateChunks(
  chunks: readonly Chunk[],
  input: string
): ValidationResult {
  // D-INV-1: chunks.length >= 1
  if (chunks.length === 0) {
    return invalidResult(
      "EMPTY_CHUNKS",
      "Chunk array must contain at least one chunk (D-INV-1)"
    );
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // D-INV-2: chunks[i].index === i
    if (chunk.index !== i) {
      return invalidResult(
        "INDEX_MISMATCH",
        `Chunk at position ${i} has index ${chunk.index}, expected ${i} (D-INV-2)`,
        { chunkIndex: i }
      );
    }

    // D-INV-3: 0 <= span.start <= span.end <= input.length
    if (chunk.span.start < 0) {
      return invalidResult(
        "INVALID_SPAN",
        `Chunk ${i} has negative span.start: ${chunk.span.start} (D-INV-3)`,
        { chunkIndex: i }
      );
    }
    if (chunk.span.start > chunk.span.end) {
      return invalidResult(
        "INVALID_SPAN",
        `Chunk ${i} has span.start (${chunk.span.start}) > span.end (${chunk.span.end}) (D-INV-3)`,
        { chunkIndex: i }
      );
    }
    if (chunk.span.end > input.length) {
      return invalidResult(
        "INVALID_SPAN",
        `Chunk ${i} has span.end (${chunk.span.end}) > input.length (${input.length}) (D-INV-3)`,
        { chunkIndex: i }
      );
    }

    // D-INV-0: chunk.text === input.slice(span.start, span.end)
    const expectedText = input.slice(chunk.span.start, chunk.span.end);
    if (chunk.text !== expectedText) {
      return invalidResult(
        "SPAN_MISMATCH",
        `Chunk ${i} text does not match span slice. ` +
          `Expected "${expectedText.slice(0, 50)}${expectedText.length > 50 ? "..." : ""}", ` +
          `got "${chunk.text.slice(0, 50)}${chunk.text.length > 50 ? "..." : ""}" (D-INV-0)`,
        { chunkIndex: i }
      );
    }

    // D-INV-2b: chunks[i].span.start <= chunks[i+1].span.start
    if (i < chunks.length - 1) {
      const nextChunk = chunks[i + 1];
      if (chunk.span.start > nextChunk.span.start) {
        return invalidResult(
          "SPAN_ORDER_VIOLATION",
          `Chunk ${i} span.start (${chunk.span.start}) > chunk ${i + 1} span.start (${nextChunk.span.start}) (D-INV-2b)`,
          { chunkIndex: i }
        );
      }
    }
  }

  return validResult();
}

// =============================================================================
// assertValidChunks
// =============================================================================

/**
 * Assert chunks are valid.
 *
 * Per SPEC Section 11.11 (V-3):
 * MAY throw ValidationException if validation fails.
 *
 * @param chunks - Chunk array to validate
 * @param input - Original input text
 * @throws ValidationException if validation fails
 */
export function assertValidChunks(
  chunks: readonly Chunk[],
  input: string
): void {
  const result = validateChunks(chunks, input);
  if (!result.valid) {
    throw new ValidationException(
      result.error.message,
      result.error.code,
      undefined,
      result.error.chunkIndex
    );
  }
}
