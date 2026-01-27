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
import { VALID_MISSING_ROLES } from "../types/index.js";
import {
  checkCausalIntegrity,
  checkReferentialIdentity,
  checkEntityTypeConsistency,
  checkCompleteness,
  checkStatefulness,
  checkAbstractDependency,
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
 * - Check DUPLICATE_NODE_ID: Node ID uniqueness
 * - Check I1: Acyclicity (CYCLE_DETECTED)
 * - Check I2: Edge integrity (BROKEN_EDGE, SELF_DEPENDENCY)
 * - Check I3: Completeness consistency (COMPLETENESS_VIOLATION)
 * - Check I4: Statefulness (INVALID_STATUS, INVALID_SCORE)
 *
 * @param graph - The Intent Graph to validate
 * @returns Validation result with optional warnings
 */
export function validateStructural(graph: IntentGraph): StructuralValidationResult {
  const warnings: string[] = [];

  // Check for duplicate node IDs (DUPLICATE_NODE_ID)
  const nodeIds = new Set<IntentNodeId>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      return {
        result: {
          valid: false,
          error: "DUPLICATE_NODE_ID",
          nodeId: node.id,
          details: `Duplicate node ID: ${node.id}`,
        },
        warnings,
      };
    }
    nodeIds.add(node.id);
  }

  // Check missing[] role validity (INVALID_ROLE)
  for (const node of graph.nodes) {
    if (node.resolution.missing) {
      for (const role of node.resolution.missing) {
        if (!VALID_MISSING_ROLES.includes(role as any)) {
          return {
            result: {
              valid: false,
              error: "INVALID_ROLE",
              nodeId: node.id,
              details: `Invalid role "${role}" in missing[]. Valid roles: ${VALID_MISSING_ROLES.join(", ")}`,
            },
            warnings,
          };
        }
      }
    }
  }

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

  // I2-S: Entity Type Consistency
  const entityConsistency = checkEntityTypeConsistency(graph);
  if (!entityConsistency.valid) {
    const conflict = entityConsistency.conflicts[0];
    return {
      result: {
        valid: false,
        error: "ENTITY_TYPE_CONFLICT",
        nodeId: conflict.secondNode,
        details: `Entity "${conflict.entityId}" has conflicting types: "${conflict.firstType}" in ${conflict.firstNode}, "${conflict.secondType}" in ${conflict.secondNode}`,
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

  // C-ABS-1: Abstract Dependency Constraint
  const absDepCheck = checkAbstractDependency(graph);
  if (!absDepCheck.valid) {
    return {
      result: {
        valid: false,
        error: absDepCheck.error,
        nodeId: absDepCheck.nodeId,
        details: absDepCheck.details,
      },
      warnings,
    };
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
