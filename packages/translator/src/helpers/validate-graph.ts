/**
 * @fileoverview Graph Validation (SPEC Section 12.2)
 *
 * Validates Intent Graph structure invariants (G-INV-*, R-INV-*).
 *
 * Per SPEC Section 11.11 (V-*):
 * - V-1: validateGraph() MUST NOT throw on validation failure
 * - V-2: validateGraph() MUST return {valid: false, error} for invalid input
 * - V-3: assertValidGraph() MAY throw ValidationException
 *
 * @module helpers/validate-graph
 */

import type { IntentGraph, IntentNode } from "../core/types/intent-graph.js";
import type {
  ValidationResult,
  ValidationWarning,
} from "../core/types/validation.js";
import { invalidResult, validResult } from "../core/types/validation.js";
import { ValidationException } from "../core/types/errors.js";

// =============================================================================
// validateGraph
// =============================================================================

/**
 * Validate Intent Graph structure.
 *
 * Per SPEC Section 12.2:
 * Checks: G-INV-1, G-INV-2, G-INV-3, G-INV-4, R-INV-1, R-INV-2
 *
 * MUST NOT throw on validation failure.
 * Returns {valid: false, error} for invalid graphs.
 *
 * @param graph - The Intent Graph to validate
 * @returns ValidationResult
 */
export function validateGraph(graph: IntentGraph): ValidationResult {
  const nodeMap = new Map<string, IntentNode>();
  const warnings: ValidationWarning[] = [];

  // G-INV-1: Node IDs are unique within graph
  for (const node of graph.nodes) {
    if (nodeMap.has(node.id)) {
      return invalidResult(
        "DUPLICATE_ID",
        `Duplicate node ID: "${node.id}" (G-INV-1)`,
        { nodeId: node.id }
      );
    }
    nodeMap.set(node.id, node);
  }

  // Validate each node
  for (const node of graph.nodes) {
    // R-INV-1: status === "Resolved" => missing is absent or length 0
    if (node.resolution.status === "Resolved") {
      if (node.resolution.missing && node.resolution.missing.length > 0) {
        return invalidResult(
          "INVALID_RESOLUTION",
          `Node "${node.id}" has status "Resolved" but missing roles: [${node.resolution.missing.join(", ")}] (R-INV-1)`,
          { nodeId: node.id }
        );
      }
    }

    // R-INV-2: missing exists and length > 0 => status !== "Resolved"
    // This is the contrapositive of R-INV-1, already checked above

    // G-INV-2: All dependsOn IDs exist in graph
    for (const depId of node.dependsOn) {
      if (!nodeMap.has(depId)) {
        return invalidResult(
          "MISSING_DEPENDENCY",
          `Node "${node.id}" depends on non-existent node "${depId}" (G-INV-2)`,
          { nodeId: node.id }
        );
      }
    }

    // G-INV-4: Non-abstract nodes SHALL NOT depend on abstract nodes (C-ABS-1)
    if (node.resolution.status !== "Abstract") {
      for (const depId of node.dependsOn) {
        const dep = nodeMap.get(depId);
        if (dep && dep.resolution.status === "Abstract") {
          return invalidResult(
            "ABSTRACT_DEPENDENCY",
            `Non-abstract node "${node.id}" depends on abstract node "${depId}" (G-INV-4, C-ABS-1)`,
            { nodeId: node.id }
          );
        }
      }
    }
  }

  // G-INV-3: Graph is a DAG (no cycles)
  const cycleResult = detectCycle(graph.nodes, nodeMap);
  if (cycleResult.hasCycle) {
    return invalidResult(
      "CYCLE_DETECTED",
      `Cycle detected in graph: ${cycleResult.cycle.join(" -> ")} (G-INV-3)`,
      { nodeId: cycleResult.cycle[0] }
    );
  }

  return validResult(warnings.length > 0 ? warnings : undefined);
}

// =============================================================================
// assertValidGraph
// =============================================================================

/**
 * Assert graph is valid.
 *
 * Per SPEC Section 11.11 (V-3):
 * MAY throw ValidationException if validation fails.
 *
 * @param graph - The Intent Graph to validate
 * @throws ValidationException if validation fails
 */
export function assertValidGraph(graph: IntentGraph): void {
  const result = validateGraph(graph);
  if (!result.valid) {
    throw new ValidationException(
      result.error.message,
      result.error.code,
      result.error.nodeId
    );
  }
}

// =============================================================================
// Cycle Detection
// =============================================================================

interface CycleResult {
  hasCycle: boolean;
  cycle: string[];
}

/**
 * Detect cycles using DFS.
 */
function detectCycle(
  nodes: readonly IntentNode[],
  nodeMap: Map<string, IntentNode>
): CycleResult {
  // Track visited nodes: 0 = unvisited, 1 = in current path, 2 = fully processed
  const state = new Map<string, 0 | 1 | 2>();
  for (const node of nodes) {
    state.set(node.id, 0);
  }

  const path: string[] = [];

  function dfs(nodeId: string): boolean {
    const nodeState = state.get(nodeId);

    // If node is in current path, we found a cycle
    if (nodeState === 1) {
      path.push(nodeId);
      return true;
    }

    // If node is fully processed, skip
    if (nodeState === 2) {
      return false;
    }

    // Mark as in current path
    state.set(nodeId, 1);
    path.push(nodeId);

    // Check all dependencies
    const node = nodeMap.get(nodeId);
    if (node) {
      for (const dep of node.dependsOn) {
        if (dfs(dep)) {
          return true;
        }
      }
    }

    // Mark as fully processed and remove from path
    state.set(nodeId, 2);
    path.pop();

    return false;
  }

  // Check each node as potential start of a cycle
  for (const node of nodes) {
    if (state.get(node.id) === 0) {
      if (dfs(node.id)) {
        // Extract just the cycle portion from the path
        const cycleStart = path.findIndex((id) => id === path[path.length - 1]);
        const cycle =
          cycleStart >= 0 && cycleStart < path.length - 1
            ? path.slice(cycleStart)
            : path;
        return { hasCycle: true, cycle };
      }
    }
  }

  return { hasCycle: false, cycle: [] };
}
