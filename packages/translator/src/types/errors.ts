/**
 * @fileoverview Translator Error Types
 *
 * All errors are structured values, never thrown.
 * Aligned with SPEC §13 Error Model.
 */

/**
 * Pipeline stage identifiers
 */
export type PipelineStage =
  | "normalize"
  | "propose"
  | "canonicalize"
  | "feature_check"
  | "resolve"
  | "lower"
  | "validate_action_body"
  | "learn";

/**
 * Error codes as defined in SPEC §13.1
 */
export type TranslatorErrorCode =
  | "NORMALIZE_FAILED"
  | "IR_PROPOSAL_FAILED"
  | "IR_INVALID"
  | "FEATURE_CHECK_FAILED"
  | "RESOLUTION_FAILED"
  | "LOWERING_FAILED"
  | "LEXICON_ERROR"
  | "REQUEST_NOT_FOUND"
  | "INVALID_INPUT"
  | "INVALID_RESOLUTION"
  | "INVALID_SELECTION"
  | "LEARN_TARGET_NOT_FOUND"
  | "LEARN_CONFLICT"
  | "LEARN_FAILED"
  | "REFERENCE_UNRESOLVED"
  | "INTERNAL_ERROR"
  | "ACTION_BODY_INVALID";

/**
 * Structured error type
 */
export type TranslatorError = {
  readonly code: TranslatorErrorCode;
  readonly message: string;
  readonly detail?: unknown;
  readonly stage?: PipelineStage;
  readonly recoverable: boolean;
};

/**
 * Error recoverability mapping per SPEC §13.2
 */
const RECOVERABLE_ERRORS: ReadonlySet<TranslatorErrorCode> = new Set([
  "IR_PROPOSAL_FAILED",
  "FEATURE_CHECK_FAILED",
  "RESOLUTION_FAILED",
  "LOWERING_FAILED",
  "LEARN_TARGET_NOT_FOUND",
  "INVALID_RESOLUTION",
]);

/**
 * Create a structured translator error
 */
export function createError(
  code: TranslatorErrorCode,
  message: string,
  opts?: {
    detail?: unknown;
    stage?: PipelineStage;
    recoverable?: boolean;
  }
): TranslatorError {
  return {
    code,
    message,
    detail: opts?.detail,
    stage: opts?.stage,
    recoverable: opts?.recoverable ?? RECOVERABLE_ERRORS.has(code),
  };
}

/**
 * Type guard for TranslatorError
 */
export function isTranslatorError(value: unknown): value is TranslatorError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    "recoverable" in value
  );
}
