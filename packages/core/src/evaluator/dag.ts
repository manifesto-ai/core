import type { ComputedSpec } from "../schema/computed.js";
import type { SemanticPath } from "../schema/common.js";
import type { Result } from "../schema/common.js";
import type { ValidationError } from "../schema/result.js";
import { ok, err } from "../schema/common.js";

/**
 * Dependency graph for computed values
 */
export type DependencyGraph = {
  readonly nodes: readonly SemanticPath[];
  readonly edges: ReadonlyMap<SemanticPath, readonly SemanticPath[]>;
};

/**
 * Build a dependency graph from ComputedSpec
 */
export function buildDependencyGraph(computed: ComputedSpec): DependencyGraph {
  const nodes = Object.keys(computed.fields);
  const edges = new Map<SemanticPath, SemanticPath[]>();

  for (const [path, spec] of Object.entries(computed.fields)) {
    // Filter deps to only include other computed fields
    const computedDeps = spec.deps.filter((dep) => dep in computed.fields);
    edges.set(path, computedDeps);
  }

  return { nodes, edges };
}

/**
 * Topological sort using Kahn's algorithm
 * Returns sorted order or error if cycles detected
 */
export function topologicalSort(graph: DependencyGraph): Result<SemanticPath[], ValidationError> {
  const inDegree = new Map<SemanticPath, number>();
  const adjacency = new Map<SemanticPath, SemanticPath[]>();

  // Initialize in-degree and adjacency list
  for (const node of graph.nodes) {
    inDegree.set(node, 0);
    adjacency.set(node, []);
  }

  // Build reverse edges (who depends on whom)
  for (const [node, deps] of graph.edges) {
    for (const dep of deps) {
      if (adjacency.has(dep)) {
        adjacency.get(dep)!.push(node);
      }
      inDegree.set(node, (inDegree.get(node) ?? 0) + 1);
    }
  }

  // Find all nodes with no dependencies
  const queue: SemanticPath[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  const sorted: SemanticPath[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    // Reduce in-degree of dependent nodes
    for (const dependent of adjacency.get(node) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  // If not all nodes are sorted, there's a cycle
  if (sorted.length !== graph.nodes.length) {
    const remaining = graph.nodes.filter((n) => !sorted.includes(n));
    return err({
      code: "V-002",
      message: `Cyclic dependency detected in computed fields: ${remaining.join(", ")}`,
      path: remaining[0],
    });
  }

  return ok(sorted);
}

/**
 * Detect cycles in the dependency graph
 * Returns array of cycle paths or null if no cycles
 */
export function detectCycles(graph: DependencyGraph): SemanticPath[][] | null {
  const visited = new Set<SemanticPath>();
  const recursionStack = new Set<SemanticPath>();
  const cycles: SemanticPath[][] = [];

  function dfs(node: SemanticPath, path: SemanticPath[]): boolean {
    visited.add(node);
    recursionStack.add(node);

    const deps = graph.edges.get(node) ?? [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (dfs(dep, [...path, dep])) {
          return true;
        }
      } else if (recursionStack.has(dep)) {
        // Found a cycle
        const cycleStart = path.indexOf(dep);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), dep]);
        } else {
          cycles.push([...path, dep]);
        }
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const node of graph.nodes) {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  }

  return cycles.length > 0 ? cycles : null;
}

/**
 * Get all dependencies (transitive) for a given node
 */
export function getTransitiveDeps(
  graph: DependencyGraph,
  node: SemanticPath
): Set<SemanticPath> {
  const deps = new Set<SemanticPath>();
  const queue = [...(graph.edges.get(node) ?? [])];

  while (queue.length > 0) {
    const dep = queue.shift()!;
    if (!deps.has(dep)) {
      deps.add(dep);
      queue.push(...(graph.edges.get(dep) ?? []));
    }
  }

  return deps;
}
