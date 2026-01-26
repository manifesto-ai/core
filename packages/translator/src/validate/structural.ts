/**
 * @fileoverview Structural Validation (SPEC Section 9.2)
 *
 * Structural validation is performed automatically by translate().
 * It does NOT require Lexicon and checks:
 * - I1: Acyclicity
 * - I2: Edge integrity (structural)
 * - I3: Completeness consistency (structural)
 * - I4: Statefulness
 */

import type { IntentGraph, ValidationResult, IntentNodeId } from "../types/index.js";
import {
  checkCausalIntegrity,
  checkReferentialIdentity,
  checkCompleteness,
  checkStatefulness,
} from "../invariants/index.js";

// =============================================================================
// StructuralValidationResult
// =============================================================================

/**
 * Extended validation result with warnings.
 */
export type StructuralValidationResult = {
  readonly result: ValidationResult;
  readonly warnings: readonly string[];
};

// =============================================================================
// validateStructural
// =============================================================================

/**
 * Perform structural validation on an Intent Graph.
 *
 * This is called automatically by translate() before returning.
 * All checks are performed without Lexicon.
 *
 * Per SPEC Section 9.2:
 * - Check I1: Acyclicity (CYCLE_DETECTED)
 * - Check I2: Edge integrity (BROKEN_EDGE, INVALID_REFERENCE)
 * - Check I3: Completeness consistency (COMPLETENESS_VIOLATION)
 * - Check I4: Statefulness (INVALID_STATUS, INVALID_SCORE)
 *
 * @param graph - The Intent Graph to validate
 * @returns Validation result with optional warnings
 */
export function validateStructural(graph: IntentGraph): StructuralValidationResult {
  const warnings: string[] = [];

  // I1: Causal Integrity (Acyclicity)
  const cycleResult = checkCausalIntegrity(graph);
  if (cycleResult.hasCycle) {
    return {
      result: {
        valid: false,
        error: "CYCLE_DETECTED",
        details: `Cycle detected: ${cycleResult.cycle.join(" -> ")}`,
      },
      warnings,
    };
  }

  // I2: Referential Identity (Edge integrity)
  const refResult = checkReferentialIdentity(graph);
  if (!refResult.valid) {
    return {
      result: {
        valid: false,
        error: refResult.error,
        nodeId: refResult.nodeId,
        details: refResult.details,
      },
      warnings,
    };
  }

  // I3: Completeness consistency
  const completenessResult = checkCompleteness(graph);
  if (!completenessResult.valid) {
    return {
      result: {
        valid: false,
        error: completenessResult.error,
        nodeId: completenessResult.nodeId,
        details: completenessResult.details,
      },
      warnings,
    };
  }

  // I4: Intent Statefulness
  const statefullnessCheck = checkStatefulness(graph);
  if (!statefullnessCheck.result.valid) {
    return {
      result: {
        valid: false,
        error: statefullnessCheck.result.error,
        nodeId: statefullnessCheck.result.nodeId,
        details: statefullnessCheck.result.details,
      },
      warnings,
    };
  }

  // Collect warnings from statefulness check
  for (const warning of statefullnessCheck.warnings) {
    warnings.push(warning.message);
  }

  return {
    result: { valid: true },
    warnings,
  };
}

/**
 * Check if graph is structurally valid.
 *
 * Convenience wrapper that returns a boolean.
 */
export function isStructurallyValid(graph: IntentGraph): boolean {
  return validateStructural(graph).result.valid;
}
