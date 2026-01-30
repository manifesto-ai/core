/**
 * @fileoverview Validation Types (SPEC Section 5.4, 12)
 *
 * Validation result types for graph and chunk validation.
 *
 * Per SPEC Section 11.11 (V-*):
 * - V-1: validate* functions MUST NOT throw on validation failure
 * - V-2: validate* functions MUST return {valid: false, error} for invalid input
 * - V-3: assert* functions MAY throw ValidationException
 *
 * @module core/types/validation
 */

// =============================================================================
// ValidationErrorCode
// =============================================================================

/**
 * Validation error codes.
 * Covers both graph validation and chunk validation.
 *
 * Per SPEC Section 5.4
 */
export type ValidationErrorCode =
  // Graph validation codes (G-INV-*)
  | "DUPLICATE_ID" // G-INV-1: Node ID appears more than once
  | "MISSING_DEPENDENCY" // G-INV-2: dependsOn references non-existent node
  | "CYCLE_DETECTED" // G-INV-3: Dependency graph contains cycle
  | "ABSTRACT_DEPENDENCY" // G-INV-4, C-ABS-1: Non-abstract depends on abstract
  | "INVALID_RESOLUTION" // R-INV-1, R-INV-2: Resolution invariant violated
  | "INVALID_IR" // IntentIR schema validation failed (strict mode)
  // Chunk validation codes (D-INV-*)
  | "SPAN_MISMATCH" // D-INV-0: chunk.text !== input.slice(...)
  | "EMPTY_CHUNKS" // D-INV-1: chunks.length === 0
  | "INDEX_MISMATCH" // D-INV-2: chunk.index !== array position
  | "SPAN_ORDER_VIOLATION" // D-INV-2b: Spans not sorted by start
  | "INVALID_SPAN"; // D-INV-3: Span bounds invalid

// =============================================================================
// ValidationErrorInfo
// =============================================================================

/**
 * Validation error information (data type).
 *
 * Per SPEC Section 5.4:
 * Note: This is distinct from the ValidationException class in errors.ts
 */
export interface ValidationErrorInfo {
  readonly code: ValidationErrorCode;
  readonly message: string;
  readonly nodeId?: string;
  readonly chunkIndex?: number;
}

// =============================================================================
// ValidationWarning
// =============================================================================

/**
 * Validation warning (non-fatal issue).
 */
export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
}

// =============================================================================
// ValidationResult
// =============================================================================

/**
 * Result of validation.
 *
 * Per SPEC Section 5.4:
 * - valid: true => validation passed (may have warnings)
 * - valid: false => validation failed with error info
 */
export type ValidationResult =
  | { readonly valid: true; readonly warnings?: readonly ValidationWarning[] }
  | { readonly valid: false; readonly error: ValidationErrorInfo };

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a successful validation result.
 */
export function validResult(
  warnings?: readonly ValidationWarning[]
): ValidationResult {
  return warnings && warnings.length > 0
    ? { valid: true, warnings }
    : { valid: true };
}

/**
 * Create a failed validation result.
 */
export function invalidResult(
  code: ValidationErrorCode,
  message: string,
  options?: { nodeId?: string; chunkIndex?: number }
): ValidationResult {
  const error: ValidationErrorInfo = {
    code,
    message,
    ...(options?.nodeId !== undefined && { nodeId: options.nodeId }),
    ...(options?.chunkIndex !== undefined && { chunkIndex: options.chunkIndex }),
  };
  return { valid: false, error };
}

/**
 * Check if validation result is valid.
 */
export function isValid(
  result: ValidationResult
): result is { valid: true; warnings?: readonly ValidationWarning[] } {
  return result.valid;
}
