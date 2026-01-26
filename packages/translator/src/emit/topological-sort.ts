/**
 * @fileoverview Topological Sort (SPEC Section 11.5)
 *
 * Kahn's algorithm for DAG ordering.
 *
 * Per SPEC Section 11.5:
 * - INVARIANT: steps[i] depends on steps[j] implies i > j
 * - Tie-break: lexicographic ordering by nodeId for reproducibility
 */

import type { IntentGraph, IntentNode, IntentNodeId } from "../types/index.js";

// =============================================================================
// TopologicalSortResult
// =============================================================================

/**
 * Result of topological sort.
 */
export type TopologicalSortResult =
  | { readonly ok: true; readonly sorted: readonly IntentNode[] }
  | { readonly ok: false; readonly error: "CYCLE_DETECTED" };

// =============================================================================
// topologicalSort
// =============================================================================

/**
 * Perform topological sort on Intent Graph using Kahn's algorithm.
 *
 * This returns nodes in execution order: dependencies before dependents.
 * Uses lexicographic ordering by nodeId for tie-breaking.
 *
 * @param graph - The Intent Graph to sort
 * @returns Sorted nodes or error if cycle detected
 */
export function topologicalSort(graph: IntentGraph): TopologicalSortResult {
  // Build adjacency list and in-degree count
  const inDegree = new Map<IntentNodeId, number>();
  const dependents = new Map<IntentNodeId, IntentNodeId[]>();
  const nodeMap = new Map<IntentNodeId, IntentNode>();

  // Initialize
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    dependents.set(node.id, []);
  }

  // Build graph structure
  for (const node of graph.nodes) {
    for (const dep of node.dependsOn) {
      // node depends on dep, so dep -> node edge
      // Increment in-degree of node
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      // Add node to dependents of dep
      const depList = dependents.get(dep) ?? [];
      depList.push(node.id);
      dependents.set(dep, depList);
    }
  }

  // Find all nodes with in-degree 0 (no dependencies)
  const queue: IntentNodeId[] = [];
  for (const node of graph.nodes) {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  }

  // Sort queue lexicographically for deterministic ordering
  queue.sort();

  const sorted: IntentNode[] = [];

  while (queue.length > 0) {
    // Take the lexicographically smallest node (already sorted)
    const nodeId = queue.shift()!;
    const node = nodeMap.get(nodeId)!;
    sorted.push(node);

    // For each dependent, reduce in-degree
    const deps = dependents.get(nodeId) ?? [];
    const newlyAvailable: IntentNodeId[] = [];

    for (const depId of deps) {
      const newDegree = (inDegree.get(depId) ?? 1) - 1;
      inDegree.set(depId, newDegree);

      if (newDegree === 0) {
        newlyAvailable.push(depId);
      }
    }

    // Sort newly available nodes lexicographically and add to queue
    newlyAvailable.sort();
    for (const id of newlyAvailable) {
      // Insert in sorted position
      let insertIdx = queue.length;
      for (let i = 0; i < queue.length; i++) {
        if (id < queue[i]) {
          insertIdx = i;
          break;
        }
      }
      queue.splice(insertIdx, 0, id);
    }
  }

  // Check if all nodes were processed (no cycle)
  if (sorted.length !== graph.nodes.length) {
    return { ok: false, error: "CYCLE_DETECTED" };
  }

  return { ok: true, sorted };
}
