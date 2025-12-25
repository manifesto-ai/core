/**
 * DAG Validation - Directed Acyclic Graph validation
 *
 * This module validates the dependency graph structure:
 * 1. Detect cycles (cyclic dependencies)
 * 2. Validate dependencies exist
 * 3. Build dependency graph from domain
 *
 * Uses topological sort for cycle detection and validates
 * that all referenced paths are provided.
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { Fragment, FragmentId } from '../types/fragment.js';
import type { LinkResult, DomainDraft } from '../types/session.js';
import type { Issue } from '../types/issue.js';
import {
  buildFragmentDependencyGraph,
  detectCycles as linkerDetectCycles,
  type FragmentDependencyGraph,
  type CycleDetectionResult,
} from '../linker/deps-analyzer.js';
import {
  createMissingDependencyIssue,
  createCyclicDependencyIssue,
} from './issue-mapper.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Dependency information for a path
 */
export interface DependencyInfo {
  /** The path that has dependencies */
  path: SemanticPath;

  /** Paths this path depends on */
  dependsOn: SemanticPath[];

  /** Source fragment ID */
  fragmentId?: FragmentId;
}

/**
 * Simple dependency graph (path -> deps)
 */
export interface DependencyGraph {
  /** Map of path to its dependencies */
  dependencies: Map<SemanticPath, SemanticPath[]>;

  /** Set of all paths in the graph */
  allPaths: Set<SemanticPath>;
}

/**
 * DAG validation result
 */
export interface DagValidationResult {
  /** Whether the DAG is valid (no cycles, no missing deps) */
  isValid: boolean;

  /** Detected cycles */
  cycles: SemanticPath[][];

  /** Missing dependencies (referenced but not provided) */
  missingDependencies: Array<{
    path: SemanticPath;
    missingDep: SemanticPath;
    fragmentId?: FragmentId;
  }>;

  /** All issues found */
  issues: Issue[];

  /** Topologically sorted paths (if no cycles) */
  sortedPaths?: SemanticPath[];
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Build dependency graph from fragments
 *
 * @param fragments - Fragments to analyze
 * @returns Dependency graph
 */
export function buildDependencyGraphFromFragments(fragments: Fragment[]): DependencyGraph {
  const dependencies = new Map<SemanticPath, SemanticPath[]>();
  const allPaths = new Set<SemanticPath>();

  for (const fragment of fragments) {
    // Add provided paths
    for (const provide of fragment.provides) {
      if (!provide.startsWith('action:') && !provide.startsWith('effect:')) {
        allPaths.add(provide as SemanticPath);

        // Set dependencies for this path
        const deps = fragment.requires
          .filter((r) => !r.startsWith('action:') && !r.startsWith('effect:'))
          .map((r) => r as SemanticPath);

        dependencies.set(provide as SemanticPath, deps);
      }
    }

    // Also add required paths to allPaths (for tracking)
    for (const require of fragment.requires) {
      if (!require.startsWith('action:') && !require.startsWith('effect:')) {
        allPaths.add(require as SemanticPath);
      }
    }
  }

  return { dependencies, allPaths };
}

/**
 * Build dependency graph from domain draft
 *
 * @param domain - Domain draft
 * @returns Dependency graph
 */
export function buildDependencyGraphFromDomain(domain: DomainDraft): DependencyGraph {
  const dependencies = new Map<SemanticPath, SemanticPath[]>();
  const allPaths = new Set<SemanticPath>();

  // Add data schema paths (no dependencies)
  for (const path of Object.keys(domain.dataSchema)) {
    const semanticPath = path as SemanticPath;
    allPaths.add(semanticPath);
    dependencies.set(semanticPath, []);
  }

  // Add state schema paths (no dependencies)
  for (const path of Object.keys(domain.stateSchema)) {
    const semanticPath = path as SemanticPath;
    allPaths.add(semanticPath);
    dependencies.set(semanticPath, []);
  }

  // Add source paths (no dependencies)
  for (const path of Object.keys(domain.sources)) {
    const semanticPath = path as SemanticPath;
    allPaths.add(semanticPath);
    dependencies.set(semanticPath, []);
  }

  // Add derived paths with their dependencies
  for (const [path, derived] of Object.entries(domain.derived)) {
    const semanticPath = path as SemanticPath;
    allPaths.add(semanticPath);

    // Extract dependencies from derived definition
    const deps: SemanticPath[] = derived.deps ?? [];
    dependencies.set(semanticPath, deps);

    // Also add deps to allPaths
    for (const dep of deps) {
      allPaths.add(dep);
    }
  }

  return { dependencies, allPaths };
}

/**
 * Build dependency graph from LinkResult
 *
 * @param linkResult - Link result
 * @returns Dependency graph
 */
export function buildDependencyGraph(linkResult: LinkResult): DependencyGraph {
  // Prefer building from fragments for more complete dependency info
  return buildDependencyGraphFromFragments(linkResult.fragments);
}

// ============================================================================
// Cycle Detection
// ============================================================================

/**
 * Detect cycles in a dependency graph using DFS
 *
 * @param graph - Dependency graph
 * @returns Array of cycles found
 */
export function detectCyclesInGraph(graph: DependencyGraph): SemanticPath[][] {
  const cycles: SemanticPath[][] = [];
  const visited = new Set<SemanticPath>();
  const recursionStack = new Set<SemanticPath>();
  const currentPath: SemanticPath[] = [];

  function dfs(node: SemanticPath): boolean {
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);

    const deps = graph.dependencies.get(node) ?? [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (dfs(dep)) {
          return true;
        }
      } else if (recursionStack.has(dep)) {
        // Found a cycle
        const cycleStart = currentPath.indexOf(dep);
        const cycle = [...currentPath.slice(cycleStart), dep];
        cycles.push(cycle);
        return true;
      }
    }

    currentPath.pop();
    recursionStack.delete(node);
    return false;
  }

  // Start DFS from each unvisited node
  for (const node of graph.dependencies.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Detect cycles using the linker's cycle detector
 *
 * @param fragments - Fragments to check
 * @returns Cycle detection result
 */
export function detectCyclesFromFragments(fragments: Fragment[]): CycleDetectionResult {
  const fragGraph = buildFragmentDependencyGraph(fragments);
  return linkerDetectCycles(fragGraph);
}

// ============================================================================
// Dependency Validation
// ============================================================================

/**
 * Validate that all dependencies exist
 *
 * @param deps - Array of dependency info
 * @param allPaths - Set of all provided paths
 * @returns Issues for missing dependencies
 */
export function validateDependencyExists(
  deps: DependencyInfo[],
  allPaths: Set<SemanticPath>
): Issue[] {
  const issues: Issue[] = [];

  for (const dep of deps) {
    for (const required of dep.dependsOn) {
      if (!allPaths.has(required)) {
        issues.push(createMissingDependencyIssue(dep.path, required, dep.fragmentId));
      }
    }
  }

  return issues;
}

/**
 * Validate dependencies in a graph
 *
 * @param graph - Dependency graph
 * @param providedPaths - Set of paths that are provided
 * @returns Array of missing dependency issues
 */
export function validateGraphDependencies(
  graph: DependencyGraph,
  providedPaths?: Set<SemanticPath>
): Issue[] {
  const issues: Issue[] = [];
  const available = providedPaths ?? graph.allPaths;

  for (const [path, deps] of graph.dependencies) {
    for (const dep of deps) {
      if (!available.has(dep)) {
        issues.push(createMissingDependencyIssue(path, dep));
      }
    }
  }

  return issues;
}

/**
 * Get all provided paths from fragments
 */
function getProvidedPaths(fragments: Fragment[]): Set<SemanticPath> {
  const paths = new Set<SemanticPath>();

  for (const fragment of fragments) {
    for (const provide of fragment.provides) {
      if (!provide.startsWith('action:') && !provide.startsWith('effect:')) {
        paths.add(provide as SemanticPath);
      }
    }
  }

  return paths;
}

// ============================================================================
// Topological Sort
// ============================================================================

/**
 * Topologically sort paths in the dependency graph
 *
 * Returns paths in order where dependencies come before dependents.
 * For example, if B depends on A, A will come before B in the result.
 *
 * @param graph - Dependency graph
 * @returns Sorted paths or null if cycles exist
 */
export function topologicalSort(graph: DependencyGraph): SemanticPath[] | null {
  // Count how many dependencies each node has
  const dependencyCount = new Map<SemanticPath, number>();
  // Track which nodes depend on each node (reverse graph)
  const dependents = new Map<SemanticPath, SemanticPath[]>();
  const sorted: SemanticPath[] = [];

  // Initialize all nodes
  for (const path of graph.dependencies.keys()) {
    if (!dependencyCount.has(path)) {
      dependencyCount.set(path, 0);
    }
    if (!dependents.has(path)) {
      dependents.set(path, []);
    }
  }

  // Also include deps that might not be in the keys
  for (const [path, deps] of graph.dependencies) {
    for (const dep of deps) {
      if (!dependencyCount.has(dep)) {
        dependencyCount.set(dep, 0);
      }
      if (!dependents.has(dep)) {
        dependents.set(dep, []);
      }
    }
  }

  // Calculate dependency counts and build reverse graph
  for (const [path, deps] of graph.dependencies) {
    // Set how many dependencies this path has
    dependencyCount.set(path, deps.length);

    // For each dependency, record that this path depends on it
    for (const dep of deps) {
      const depDependents = dependents.get(dep) ?? [];
      depDependents.push(path);
      dependents.set(dep, depDependents);
    }
  }

  // Find nodes with no dependencies (they can be processed first)
  const queue: SemanticPath[] = [];
  for (const [path, count] of dependencyCount) {
    if (count === 0) {
      queue.push(path);
    }
  }

  // Sort queue for determinism
  queue.sort((a, b) => a.localeCompare(b));

  // Process queue using Kahn's algorithm
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    // For each node that depends on this one, decrement their dependency count
    const nodeDependents = dependents.get(node) ?? [];
    for (const dependent of nodeDependents) {
      const newCount = (dependencyCount.get(dependent) ?? 0) - 1;
      dependencyCount.set(dependent, newCount);

      if (newCount === 0) {
        // Insert in sorted order for determinism
        const insertIdx = queue.findIndex((q) => q.localeCompare(dependent) > 0);
        if (insertIdx === -1) {
          queue.push(dependent);
        } else {
          queue.splice(insertIdx, 0, dependent);
        }
      }
    }
  }

  // Check if all nodes were processed (no cycles)
  if (sorted.length !== dependencyCount.size) {
    return null; // Has cycles
  }

  return sorted;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate the DAG structure of a link result
 *
 * @param linkResult - Link result to validate
 * @returns DAG validation result
 */
export function validateDag(linkResult: LinkResult): DagValidationResult {
  const issues: Issue[] = [];
  const cycles: SemanticPath[][] = [];
  const missingDependencies: Array<{
    path: SemanticPath;
    missingDep: SemanticPath;
    fragmentId?: FragmentId;
  }> = [];

  // Build dependency graph
  const graph = buildDependencyGraph(linkResult);
  const providedPaths = getProvidedPaths(linkResult.fragments);

  // Detect cycles
  const detectedCycles = detectCyclesInGraph(graph);
  for (const cycle of detectedCycles) {
    cycles.push(cycle);

    // Find related fragment IDs
    const fragmentIds = linkResult.fragments
      .filter((f) => f.provides.some((p) => cycle.includes(p as SemanticPath)))
      .map((f) => f.id);

    issues.push(createCyclicDependencyIssue(cycle, fragmentIds));
  }

  // Validate dependencies exist
  for (const [path, deps] of graph.dependencies) {
    for (const dep of deps) {
      if (!providedPaths.has(dep)) {
        // Find the fragment that requires this
        const fragment = linkResult.fragments.find((f) =>
          f.provides.includes(path as string)
        );

        missingDependencies.push({
          path,
          missingDep: dep,
          fragmentId: fragment?.id,
        });

        issues.push(createMissingDependencyIssue(path, dep, fragment?.id));
      }
    }
  }

  // Try topological sort
  let sortedPaths: SemanticPath[] | undefined;
  if (cycles.length === 0) {
    const sorted = topologicalSort(graph);
    if (sorted) {
      sortedPaths = sorted;
    }
  }

  const isValid = cycles.length === 0 && missingDependencies.length === 0;

  return {
    isValid,
    cycles,
    missingDependencies,
    issues,
    sortedPaths,
  };
}

/**
 * Validate DAG from fragments directly
 *
 * @param fragments - Fragments to validate
 * @returns DAG validation result
 */
export function validateDagFromFragments(fragments: Fragment[]): DagValidationResult {
  // Create a minimal LinkResult
  const linkResult: LinkResult = {
    fragments,
    conflicts: [],
    issues: [],
    version: 'dag-validation',
  };

  return validateDag(linkResult);
}

/**
 * Validate that a domain has a valid DAG structure
 *
 * @param domain - Domain to validate
 * @returns DAG validation result
 */
export function validateDomainDag(domain: DomainDraft): DagValidationResult {
  const issues: Issue[] = [];
  const cycles: SemanticPath[][] = [];
  const missingDependencies: Array<{
    path: SemanticPath;
    missingDep: SemanticPath;
    fragmentId?: FragmentId;
  }> = [];

  // Build graph from domain
  const graph = buildDependencyGraphFromDomain(domain);

  // Get all provided paths
  const providedPaths = new Set<SemanticPath>();
  for (const path of Object.keys(domain.dataSchema)) {
    providedPaths.add(path as SemanticPath);
  }
  for (const path of Object.keys(domain.stateSchema)) {
    providedPaths.add(path as SemanticPath);
  }
  for (const path of Object.keys(domain.sources)) {
    providedPaths.add(path as SemanticPath);
  }
  for (const path of Object.keys(domain.derived)) {
    providedPaths.add(path as SemanticPath);
  }

  // Detect cycles
  const detectedCycles = detectCyclesInGraph(graph);
  for (const cycle of detectedCycles) {
    cycles.push(cycle);
    issues.push(createCyclicDependencyIssue(cycle));
  }

  // Validate dependencies
  for (const [path, deps] of graph.dependencies) {
    for (const dep of deps) {
      if (!providedPaths.has(dep)) {
        missingDependencies.push({
          path,
          missingDep: dep,
        });
        issues.push(createMissingDependencyIssue(path, dep));
      }
    }
  }

  // Topological sort
  let sortedPaths: SemanticPath[] | undefined;
  if (cycles.length === 0) {
    const sorted = topologicalSort(graph);
    if (sorted) {
      sortedPaths = sorted;
    }
  }

  const isValid = cycles.length === 0 && missingDependencies.length === 0;

  return {
    isValid,
    cycles,
    missingDependencies,
    issues,
    sortedPaths,
  };
}

/**
 * Quick check if there are any cycles
 */
export function hasCycles(linkResult: LinkResult): boolean {
  const graph = buildDependencyGraph(linkResult);
  const cycles = detectCyclesInGraph(graph);
  return cycles.length > 0;
}

/**
 * Quick check if all dependencies exist
 */
export function hasAllDependencies(linkResult: LinkResult): boolean {
  const graph = buildDependencyGraph(linkResult);
  const providedPaths = getProvidedPaths(linkResult.fragments);

  for (const deps of graph.dependencies.values()) {
    for (const dep of deps) {
      if (!providedPaths.has(dep)) {
        return false;
      }
    }
  }

  return true;
}

export default {
  buildDependencyGraphFromFragments,
  buildDependencyGraphFromDomain,
  buildDependencyGraph,
  detectCyclesInGraph,
  detectCyclesFromFragments,
  validateDependencyExists,
  validateGraphDependencies,
  topologicalSort,
  validateDag,
  validateDagFromFragments,
  validateDomainDag,
  hasCycles,
  hasAllDependencies,
};
