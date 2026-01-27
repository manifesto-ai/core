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
 * Per SPEC Section 10.5 (Single Source of Truth)
 */
export type TranslatorErrorCode =
  // === Structural Validation (translate) ===
  | "CYCLE_DETECTED" // I1: Graph contains cycle
  | "DUPLICATE_NODE_ID" // Node ID appears more than once
  | "SELF_DEPENDENCY" // Node depends on itself
  | "INVALID_STATUS" // I4: Invalid resolution.status
  | "INVALID_SCORE" // I4: ambiguityScore out of [0,1]
  | "R1_VIOLATION" // I3-S: Resolved but missing non-empty
  | "INVALID_ROLE" // missing[] contains invalid role name
  | "BROKEN_EDGE" // dependsOn references non-existent node
  | "ENTITY_TYPE_CONFLICT" // I2-S: Same entity ID with different entityTypes
  | "ABSTRACT_DEPENDENCY" // C-ABS-1: Non-Abstract node depends on Abstract node

  // === Lexicon-Verified Validation (validate) ===
  | "EVENT_NOT_FOUND" // Lexicon lookup failed for lemma
  | "CLASS_MISMATCH" // IR class vs Lexicon eventClass mismatch
  | "TYPE_MISMATCH" // Selectional restriction violated
  | "COMPLETENESS_VIOLATION" // I3-L: Required role missing on Resolved node
  | "MISSING_MISMATCH" // I3-L: missing[] doesn't match Lexicon (strict mode)

  // === Emit/Lowering ===
  | "EMIT_FAILED" // emitForManifesto internal error
  | "RESOLVER_ERROR" // Resolver failed during lowering

  // === Configuration ===
  | "CONFIGURATION_ERROR" // Required provider/config missing (e.g., LLM)

  // === Decomposition (ADR-003) ===
  | "DECOMPOSITION_FAILED" // All chunk translations failed

  // === Catch-all ===
  | "INTERNAL_ERROR" // Unexpected error

  // === Deprecated (kept for backward compatibility) ===
  | "INVALID_REFERENCE" // Use SELF_DEPENDENCY or BROKEN_EDGE
  | "RESOLVED_WITH_MISSING" // Use R1_VIOLATION
  | "MISSING_WITHOUT_STATUS"; // Subsumed by R1_VIOLATION

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
// ValidationWarning
// =============================================================================

/**
 * Warning from validation (non-fatal issue).
 */
export type ValidationWarning = {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: IntentNodeId;
};

// =============================================================================
// ValidationResult
// =============================================================================

/**
 * Result of validation.
 *
 * Per SPEC Section 10.2
 */
export type ValidationResult =
  | { readonly valid: true; readonly warnings?: readonly ValidationWarning[] }
  | {
      readonly valid: false;
      readonly error: TranslatorErrorCode;
      readonly nodeId?: IntentNodeId;
      readonly details?: string;
      readonly warnings?: readonly ValidationWarning[];
    };
