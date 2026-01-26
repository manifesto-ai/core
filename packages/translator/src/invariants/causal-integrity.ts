/**
 * @fileoverview Causal Integrity Invariant (I1)
 *
 * I1: Graph is acyclic; topological sort is possible.
 *
 * Per SPEC Section 8.2:
 * INVARIANT: For all nodes n in graph G:
 *   - The transitive closure of dependsOn contains no cycles
 *   - topologicalSort(G) terminates successfully
 */

import type { IntentGraph, IntentNodeId, IntentNode } from "../types/index.js";

// =============================================================================
// CycleCheckResult
// =============================================================================

/**
 * Result of cycle detection.
 */
export type CycleCheckResult =
  | { readonly hasCycle: false }
  | { readonly hasCycle: true; readonly cycle: readonly IntentNodeId[] };

// =============================================================================
// checkCausalIntegrity
// =============================================================================

/**
 * Check for cycles in the Intent Graph using DFS.
 *
 * This implements the I1 (Causal Integrity) invariant check.
 *
 * @param graph - The Intent Graph to check
 * @returns Result indicating whether a cycle exists and the cycle path if found
 */
export function checkCausalIntegrity(graph: IntentGraph): CycleCheckResult {
  const nodeMap = new Map<IntentNodeId, IntentNode>();
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
  }

  // Track visited nodes: 0 = unvisited, 1 = in current path, 2 = fully processed
  const state = new Map<IntentNodeId, 0 | 1 | 2>();
  for (const node of graph.nodes) {
    state.set(node.id, 0);
  }

  // Path for tracking current DFS path
  const path: IntentNodeId[] = [];

  /**
   * DFS helper that returns true if cycle is detected.
   */
  function dfs(nodeId: IntentNodeId): boolean {
    const nodeState = state.get(nodeId);

    // If node is in current path, we found a cycle
    if (nodeState === 1) {
      // Find start of cycle in path
      const cycleStart = path.indexOf(nodeId);
      // Include the current node to complete the cycle
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
  for (const node of graph.nodes) {
    if (state.get(node.id) === 0) {
      if (dfs(node.id)) {
        // Extract just the cycle portion from the path
        const cycleStart = path.indexOf(path[path.length - 1]);
        const cycle =
          cycleStart >= 0
            ? path.slice(cycleStart)
            : path;
        return { hasCycle: true, cycle };
      }
    }
  }

  return { hasCycle: false };
}

/**
 * Check if graph has any cycles.
 *
 * Convenience wrapper that returns a boolean.
 */
export function hasCycle(graph: IntentGraph): boolean {
  return checkCausalIntegrity(graph).hasCycle;
}
