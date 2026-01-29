/**
 * @fileoverview ExecutionPlan Builder (SPEC Section 5.3)
 *
 * Builds ExecutionPlan from IntentGraph using topological sort.
 *
 * Per SPEC Section 11.4 (E-INV-*):
 * - E-INV-1: steps contains no abstract nodes
 * - E-INV-2: dependencyEdges references only nodes in steps
 * - E-INV-3: from is dependency (executes first), to is dependent (executes after)
 *
 * @module helpers/build-execution-plan
 */

import type {
  IntentGraph,
  IntentNode,
  IntentNodeId,
} from "../core/types/intent-graph.js";
import type {
  ExecutionPlan,
  ExecutionStep,
  DependencyEdge,
} from "../core/types/execution-plan.js";

// =============================================================================
// buildExecutionPlan
// =============================================================================

/**
 * Build ExecutionPlan from IntentGraph.
 *
 * Uses Kahn's algorithm for topological sort.
 *
 * Per SPEC Section 5.3:
 * - Excludes abstract nodes from steps
 * - Includes only edges between non-abstract nodes
 * - Topologically sorted for execution order
 *
 * @param graph - The Intent Graph to build plan from
 * @returns ExecutionPlan with steps, edges, and abstract nodes
 * @throws Error if graph contains cycles
 */
export function buildExecutionPlan(graph: IntentGraph): ExecutionPlan {
  // Separate abstract and non-abstract nodes
  const abstractNodes: IntentNodeId[] = [];
  const executableNodes: IntentNode[] = [];

  for (const node of graph.nodes) {
    if (node.resolution.status === "Abstract") {
      abstractNodes.push(node.id);
    } else {
      executableNodes.push(node);
    }
  }

  // Build node map for non-abstract nodes only
  const nodeMap = new Map<IntentNodeId, IntentNode>();
  for (const node of executableNodes) {
    nodeMap.set(node.id, node);
  }

  // Filter dependencies to only reference non-abstract nodes
  const filteredDependencies = new Map<IntentNodeId, IntentNodeId[]>();
  for (const node of executableNodes) {
    const deps = node.dependsOn.filter((depId) => nodeMap.has(depId));
    filteredDependencies.set(node.id, deps as IntentNodeId[]);
  }

  // Topological sort using Kahn's algorithm
  const inDegree = new Map<IntentNodeId, number>();
  const dependents = new Map<IntentNodeId, IntentNodeId[]>();

  // Initialize
  for (const node of executableNodes) {
    inDegree.set(node.id, 0);
    dependents.set(node.id, []);
  }

  // Build graph structure
  for (const node of executableNodes) {
    const deps = filteredDependencies.get(node.id) ?? [];
    inDegree.set(node.id, deps.length);
    for (const depId of deps) {
      const depList = dependents.get(depId);
      if (depList) {
        depList.push(node.id);
      }
    }
  }

  // Find nodes with in-degree 0
  const queue: IntentNodeId[] = [];
  for (const node of executableNodes) {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  }

  // Sort for deterministic ordering
  queue.sort();

  const sortedNodes: IntentNode[] = [];

  while (queue.length > 0) {
    // Take lexicographically smallest node
    const nodeId = queue.shift()!;
    const node = nodeMap.get(nodeId)!;
    sortedNodes.push(node);

    // Reduce in-degree of dependents
    const deps = dependents.get(nodeId) ?? [];
    const newlyAvailable: IntentNodeId[] = [];

    for (const depId of deps) {
      const newDegree = (inDegree.get(depId) ?? 1) - 1;
      inDegree.set(depId, newDegree);

      if (newDegree === 0) {
        newlyAvailable.push(depId);
      }
    }

    // Insert in sorted order
    newlyAvailable.sort();
    for (const id of newlyAvailable) {
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

  // Check for cycles
  if (sortedNodes.length !== executableNodes.length) {
    throw new Error("Cycle detected in Intent Graph. Cannot build ExecutionPlan.");
  }

  // Build steps (E-INV-1: no abstract nodes)
  const steps: ExecutionStep[] = sortedNodes.map((node) => ({
    nodeId: node.id,
    ir: node.ir,
    resolution: node.resolution,
  }));

  // Build dependency edges (E-INV-2, E-INV-3: only within steps, from -> to direction)
  const stepIds = new Set(sortedNodes.map((n) => n.id));
  const dependencyEdges: DependencyEdge[] = [];

  for (const node of sortedNodes) {
    const deps = filteredDependencies.get(node.id) ?? [];
    for (const depId of deps) {
      if (stepIds.has(depId)) {
        // E-INV-3: from is dependency (executes first), to is dependent (executes after)
        dependencyEdges.push({
          from: depId,
          to: node.id,
        });
      }
    }
  }

  return {
    steps,
    dependencyEdges,
    abstractNodes,
  };
}
