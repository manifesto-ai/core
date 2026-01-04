/**
 * Translation Errors (SPEC-1.1.1v §6.11)
 *
 * Error types and codes for translation failures.
 */

import { z } from "zod";
import type { JsonValue } from "./types.js";
import { JsonValueSchema } from "./types.js";

// =============================================================================
// Translation Stage
// =============================================================================

/** Pipeline stage where error occurred */
export type TranslationStage =
  | "chunking"
  | "normalization"
  | "fastPath"
  | "retrieval"
  | "memory"
  | "proposer"
  | "assembly";

export const TranslationStageSchema = z.enum([
  "chunking",
  "normalization",
  "fastPath",
  "retrieval",
  "memory",
  "proposer",
  "assembly",
]);

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Error codes for translation failures
 */
export type ErrorCode =
  // Context errors
  | "INVALID_INPUT"
  | "INVALID_CONTEXT"
  | "SCHEMA_MISMATCH"
  | "SCHEMA_NOT_FOUND"
  // Stage-specific errors
  | "NORMALIZATION_FAILED"
  | "FAST_PATH_MISS"
  | "TYPE_ERROR"
  | "TYPE_MISMATCH"
  // Retrieval errors
  | "RETRIEVAL_TIMEOUT"
  | "RETRIEVAL_UNAVAILABLE"
  // Memory errors
  | "MEMORY_FAILURE"
  | "MEMORY_UNAVAILABLE"
  | "MEMORY_TIMEOUT"
  // Proposer errors
  | "PROPOSER_FAILURE"
  | "PROPOSER_TIMEOUT"
  // Assembly errors
  | "FRAGMENT_CONFLICT"
  | "INVALID_FRAGMENT"
  | "CONFIDENCE_TOO_LOW"
  | "NO_FRAGMENTS_PRODUCED";

export const ErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "INVALID_CONTEXT",
  "SCHEMA_MISMATCH",
  "SCHEMA_NOT_FOUND",
  "NORMALIZATION_FAILED",
  "FAST_PATH_MISS",
  "TYPE_ERROR",
  "TYPE_MISMATCH",
  "RETRIEVAL_TIMEOUT",
  "RETRIEVAL_UNAVAILABLE",
  "MEMORY_FAILURE",
  "MEMORY_UNAVAILABLE",
  "MEMORY_TIMEOUT",
  "PROPOSER_FAILURE",
  "PROPOSER_TIMEOUT",
  "FRAGMENT_CONFLICT",
  "INVALID_FRAGMENT",
  "CONFIDENCE_TOO_LOW",
  "NO_FRAGMENTS_PRODUCED",
]);

// =============================================================================
// TranslationError
// =============================================================================

/**
 * Translation error with context
 */
export interface TranslationError {
  code: ErrorCode;
  message: string;
  stage?: TranslationStage;
  details?: Record<string, JsonValue>;
  recoverable: boolean;
}

export const TranslationErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  stage: TranslationStageSchema.optional(),
  details: z.record(JsonValueSchema).optional(),
  recoverable: z.boolean(),
});

// =============================================================================
// Error Factory Functions
// =============================================================================

/** Create a translation error */
export function createError(
  code: ErrorCode,
  message: string,
  options?: {
    stage?: TranslationStage;
    details?: Record<string, JsonValue>;
    recoverable?: boolean;
  }
): TranslationError {
  return {
    code,
    message,
    stage: options?.stage,
    details: options?.details,
    recoverable: options?.recoverable ?? false,
  };
}

// Pre-defined error creators for common cases

export function invalidInput(message: string): TranslationError {
  return createError("INVALID_INPUT", message, { recoverable: false });
}

export function invalidContext(message: string): TranslationError {
  return createError("INVALID_CONTEXT", message, { recoverable: false });
}

export function schemaNotFound(schemaHash: string): TranslationError {
  return createError("SCHEMA_NOT_FOUND", `Schema not found: ${schemaHash}`, {
    details: { schemaHash },
    recoverable: false,
  });
}

export function fastPathMiss(details?: Record<string, JsonValue>): TranslationError {
  return createError(
    "FAST_PATH_MISS",
    "Fast path miss: no patterns matched",
    { stage: "fastPath", details, recoverable: true }
  );
}

export function typeError(
  message: string,
  details?: Record<string, JsonValue>
): TranslationError {
  return createError("TYPE_ERROR", message, {
    stage: "assembly",
    details,
    recoverable: false,
  });
}

export function proposerFailure(
  message: string,
  details?: Record<string, JsonValue>
): TranslationError {
  return createError("PROPOSER_FAILURE", message, {
    stage: "proposer",
    details,
    recoverable: true,
  });
}

export function proposerTimeout(): TranslationError {
  return createError("PROPOSER_TIMEOUT", "Proposer timed out", {
    stage: "proposer",
    recoverable: true,
  });
}

export function memoryUnavailable(): TranslationError {
  return createError("MEMORY_UNAVAILABLE", "Memory service unavailable", {
    stage: "memory",
    recoverable: true,
  });
}

export function noFragmentsProduced(): TranslationError {
  return createError(
    "NO_FRAGMENTS_PRODUCED",
    "Proposer produced no fragments",
    { stage: "assembly", recoverable: false }
  );
}

export function fragmentConflict(
  message: string,
  details?: Record<string, JsonValue>
): TranslationError {
  return createError("FRAGMENT_CONFLICT", message, {
    stage: "assembly",
    details,
    recoverable: false,
  });
}

export function confidenceTooLow(
  confidence: number,
  threshold: number
): TranslationError {
  return createError(
    "CONFIDENCE_TOO_LOW",
    `Confidence ${confidence} below threshold ${threshold}`,
    {
      stage: "assembly",
      details: { confidence, threshold },
      recoverable: false,
    }
  );
}
