/**
 * DAG Validation
 *
 * Pure functions for detecting cycles in derived dependency graphs.
 * Uses DFS-based cycle detection algorithm.
 */

/**
 * Node in the dependency graph
 */
export interface DependencyNode {
  /** The semantic path of this derived */
  path: string;
  /** Paths this derived depends on */
  deps: string[];
}

/**
 * Dependency graph representation
 */
export type DependencyGraph = Record<string, DependencyNode>;

/**
 * Result of cycle detection
 */
export interface CycleDetectionResult {
  /** Whether any cycles were found */
  hasCycle: boolean;
  /** List of cycles found (each cycle is an array of paths) */
  cycles: string[][];
}

/**
 * Node states for DFS traversal
 */
enum NodeState {
  Unvisited = 0,
  Visiting = 1,
  Visited = 2,
}

/**
 * Detect cycles in a dependency graph using DFS
 *
 * @param graph - The dependency graph to check
 * @returns Cycle detection result with all cycles found
 */
export function detectCycles(graph: DependencyGraph): CycleDetectionResult {
  const nodes = Object.keys(graph);
  const state: Record<string, NodeState> = {};
  const cycles: string[][] = [];

  // Initialize all nodes as unvisited
  for (const node of nodes) {
    state[node] = NodeState.Unvisited;
  }

  /**
   * DFS to find cycle starting from a node
   * Returns the cycle path if found, null otherwise
   */
  function dfs(node: string, path: string[]): string[] | null {
    // Node not in graph (e.g., data.* dependency) - no cycle
    if (!(node in graph)) {
      return null;
    }

    // Found a cycle - return the path from the start of the cycle
    if (state[node] === NodeState.Visiting) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        return [...path.slice(cycleStart), node];
      }
      return [node];
    }

    // Already fully processed - no cycle through this node
    if (state[node] === NodeState.Visited) {
      return null;
    }

    // Mark as currently visiting
    state[node] = NodeState.Visiting;

    // Explore dependencies
    const deps = graph[node]?.deps || [];
    for (const dep of deps) {
      // Only check dependencies on derived paths
      if (!dep.startsWith("derived.")) {
        continue;
      }

      const cycle = dfs(dep, [...path, node]);
      if (cycle) {
        return cycle;
      }
    }

    // Mark as fully visited
    state[node] = NodeState.Visited;
    return null;
  }

  // Run DFS from each unvisited node
  for (const node of nodes) {
    if (state[node] === NodeState.Unvisited) {
      const cycle = dfs(node, []);
      if (cycle && cycle.length > 0) {
        cycles.push(cycle);

        // Reset states for nodes in the cycle to find other cycles
        // But keep nodes NOT in the cycle as visited
        for (const n of nodes) {
          if (cycle.includes(n)) {
            state[n] = NodeState.Visited; // Mark cycle nodes as visited to avoid re-detection
          }
        }
      }
    }
  }

  return {
    hasCycle: cycles.length > 0,
    cycles,
  };
}
