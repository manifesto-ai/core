/**
 * @fileoverview Error Types (SPEC Section 13)
 *
 * Translator-specific error types and codes.
 */

import type { IntentNodeId } from "./node.js";

// =============================================================================
// TranslatorErrorCode
// =============================================================================

/**
 * Error codes for Translator errors.
 *
 * Per SPEC Section 13.1
 */
export type TranslatorErrorCode =
  | "CYCLE_DETECTED"
  | "INVALID_STATUS"
  | "INVALID_SCORE"
  | "BROKEN_EDGE"
  | "INVALID_REFERENCE"
  | "RESOLVED_WITH_MISSING"
  | "MISSING_WITHOUT_STATUS"
  | "EVENT_NOT_FOUND"
  | "CLASS_MISMATCH"
  | "COMPLETENESS_VIOLATION"
  | "MISSING_MISMATCH"
  | "TYPE_MISMATCH"
  | "EMIT_FAILED"
  | "RESOLVER_ERROR";

// =============================================================================
// TranslatorError
// =============================================================================

/**
 * Translator-specific error.
 *
 * Per SPEC Section 13.1:
 * - Uses user-action perspective
 * - References specific nodes when applicable
 * - Does not expose internal terminology
 */
export class TranslatorError extends Error {
  readonly code: TranslatorErrorCode;
  readonly nodeId?: IntentNodeId;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      code: TranslatorErrorCode;
      nodeId?: IntentNodeId;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "TranslatorError";
    this.code = options.code;
    this.nodeId = options.nodeId;
    this.details = options.details;
  }
}

// =============================================================================
// ValidationResult
// =============================================================================

/**
 * Result of validation.
 *
 * Per SPEC Section 10.2
 */
export type ValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly error: TranslatorErrorCode;
      readonly nodeId?: IntentNodeId;
      readonly details?: string;
    };
