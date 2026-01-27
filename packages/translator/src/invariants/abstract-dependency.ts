/**
 * @fileoverview Abstract Dependency Constraint (C-ABS-1)
 *
 * C-ABS-1: Non-Abstract nodes MUST NOT depend on Abstract nodes.
 *
 * Per SPEC Section 11.5:
 * "If node `a` has resolution.status = "Abstract", then no non-Abstract node
 * may include `a.id` in its dependsOn array."
 *
 * This ensures that when Abstract nodes are excluded from InvocationPlan.steps,
 * no executable step loses its dependency.
 */

import type { IntentGraph, IntentNodeId } from "../types/index.js";

// =============================================================================
// AbstractDependencyCheckResult
// =============================================================================

/**
 * Result of abstract dependency check.
 */
export type AbstractDependencyCheckResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly error: "ABSTRACT_DEPENDENCY";
      readonly nodeId: IntentNodeId;
      readonly details: string;
    };

// =============================================================================
// checkAbstractDependency
// =============================================================================

/**
 * Check the C-ABS-1 constraint.
 *
 * Per SPEC Section 11.5:
 * - Non-Abstract nodes (Resolved or Ambiguous) MUST NOT depend on Abstract nodes
 * - Abstract nodes MAY depend on other Abstract nodes (hierarchy among abstract goals)
 * - Abstract nodes MAY depend on non-Abstract nodes (high-level goal depends on subtasks)
 *
 * @param graph - The Intent Graph to check
 * @returns Result with validity and optional error details
 */
export function checkAbstractDependency(
  graph: IntentGraph
): AbstractDependencyCheckResult {
  // Build set of Abstract node IDs
  const abstractNodeIds = new Set<IntentNodeId>();
  for (const node of graph.nodes) {
    if (node.resolution.status === "Abstract") {
      abstractNodeIds.add(node.id);
    }
  }

  // Check each non-Abstract node
  for (const node of graph.nodes) {
    // Skip Abstract nodes (they can depend on anything)
    if (node.resolution.status === "Abstract") {
      continue;
    }

    // Check dependencies
    for (const depId of node.dependsOn) {
      if (abstractNodeIds.has(depId)) {
        return {
          valid: false,
          error: "ABSTRACT_DEPENDENCY",
          nodeId: node.id,
          details: `Non-Abstract node "${node.id}" (status: ${node.resolution.status}) depends on Abstract node "${depId}"`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Check if graph passes C-ABS-1 constraint.
 *
 * Convenience wrapper that returns a boolean.
 */
export function isAbstractDependencyValid(graph: IntentGraph): boolean {
  return checkAbstractDependency(graph).valid;
}
