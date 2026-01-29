/**
 * @fileoverview Error Types (SPEC Section 13)
 *
 * Translator-specific error types and codes.
 *
 * Per SPEC Section 11.11 (V-*):
 * - V-1: validate* MUST NOT throw on validation failure
 * - V-2: validate* MUST return {valid: false, error} for invalid input
 * - V-3: assert* MAY throw ValidationException
 *
 * @module core/types/errors
 */

import type { ValidationErrorCode } from "./validation.js";

// =============================================================================
// PipelinePhase
// =============================================================================

/**
 * Pipeline execution phases.
 *
 * Per SPEC Section 8.1
 */
export type PipelinePhase =
  | "beforeDecompose"
  | "afterDecompose"
  | "beforeTranslateChunk"
  | "afterTranslateChunk"
  | "beforeMerge"
  | "afterMerge"
  | "afterStructuralValidate"
  | "afterLexiconValidate";

// =============================================================================
// LLMErrorCode
// =============================================================================

/**
 * LLM adapter error codes.
 *
 * Per SPEC Section 9.2
 */
export type LLMErrorCode =
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "AUTH_FAILED"
  | "INVALID_REQUEST"
  | "SERVICE_ERROR"
  | "CONTENT_FILTER"
  | "NETWORK_ERROR"
  | "UNKNOWN";

// =============================================================================
// TranslatorError
// =============================================================================

/**
 * Base error for translator operations.
 *
 * Per SPEC Section 13.1
 *
 * Supports both new signature (message, code) and legacy signature (message, {code}).
 */
export class TranslatorError extends Error {
  readonly code: string;
  readonly nodeId?: string;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(
    message: string,
    codeOrOptions: string | { code: string; nodeId?: string; details?: Record<string, unknown>; cause?: unknown },
    cause?: unknown
  ) {
    super(message);
    this.name = "TranslatorError";

    if (typeof codeOrOptions === "string") {
      // New API: (message, code, cause?)
      this.code = codeOrOptions;
      this.cause = cause;
    } else {
      // Legacy API: (message, {code, nodeId?, details?})
      this.code = codeOrOptions.code;
      this.nodeId = codeOrOptions.nodeId;
      this.details = codeOrOptions.details;
      this.cause = codeOrOptions.cause;
    }
  }
}

// =============================================================================
// PipelineError
// =============================================================================

/**
 * Pipeline execution error.
 *
 * Per SPEC Section 13.1:
 * Includes phase information for debugging.
 */
export class PipelineError extends TranslatorError {
  readonly phase: PipelinePhase;
  readonly chunkIndex?: number;

  constructor(
    message: string,
    code: string,
    phase: PipelinePhase,
    chunkIndex?: number,
    cause?: unknown
  ) {
    super(message, code, cause);
    this.name = "PipelineError";
    this.phase = phase;
    this.chunkIndex = chunkIndex;
  }
}

// =============================================================================
// ValidationException
// =============================================================================

/**
 * Validation exception (thrown by assertValidGraph/assertValidChunks).
 *
 * Per SPEC Section 13.1:
 * Note: This is distinct from ValidationErrorInfo (data type in validation.ts).
 * validate* functions MUST NOT throw; use assert* for throwing behavior.
 */
export class ValidationException extends TranslatorError {
  readonly errorCode: ValidationErrorCode;
  readonly nodeId?: string;
  readonly chunkIndex?: number;

  constructor(
    message: string,
    errorCode: ValidationErrorCode,
    nodeId?: string,
    chunkIndex?: number,
    cause?: unknown
  ) {
    super(message, errorCode, cause);
    this.name = "ValidationException";
    this.errorCode = errorCode;
    this.nodeId = nodeId;
    this.chunkIndex = chunkIndex;
  }
}

// =============================================================================
// LLMError
// =============================================================================

/**
 * LLM adapter error.
 *
 * Per SPEC Section 9.2
 */
export class LLMError extends Error {
  readonly code: LLMErrorCode;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    message: string,
    code: LLMErrorCode,
    retryable: boolean,
    cause?: unknown
  ) {
    super(message);
    this.name = "LLMError";
    this.code = code;
    this.retryable = retryable;
    this.cause = cause;
  }
}

// =============================================================================
// OverlapSafetyError
// =============================================================================

/**
 * Overlap safety error.
 *
 * Per OVL-2: Thrown when overlap is detected but deduplicate=false.
 */
export class OverlapSafetyError extends TranslatorError {
  constructor(message: string) {
    super(message, "OVERLAP_SAFETY_VIOLATION");
    this.name = "OverlapSafetyError";
  }
}

// =============================================================================
// InspectorGraphReturnError
// =============================================================================

/**
 * Inspector plugin returned a graph error.
 *
 * Per PLG-14: If plugin.kind === "inspector" and afterMerge returns IntentGraph,
 * Pipeline SHALL throw error.
 */
export class InspectorGraphReturnError extends TranslatorError {
  readonly pluginName: string;

  constructor(pluginName: string) {
    super(
      `Inspector plugin "${pluginName}" returned IntentGraph from afterMerge. ` +
        `Inspectors MUST NOT return graphs. Use kind="transformer" instead.`,
      "INSPECTOR_GRAPH_RETURN"
    );
    this.name = "InspectorGraphReturnError";
    this.pluginName = pluginName;
  }
}
