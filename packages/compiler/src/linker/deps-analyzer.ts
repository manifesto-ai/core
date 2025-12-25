/**
 * Dependency Analyzer
 *
 * Implements Principle D: Effect deps need separate traversal from Expression deps.
 * - Expression: Use analyzeExpression() from @manifesto-ai/core
 * - Effect: Structural traversal with traverseEffectAST()
 * - Categorizes deps by type: readPaths, writePaths, policyPaths, asyncTriggerPaths
 */

import type {
  SemanticPath,
  Expression,
  Effect,
  ConditionRef,
} from '@manifesto-ai/core';
import { analyzeExpression } from '@manifesto-ai/core';
import type {
  Fragment,
  FragmentId,
  DerivedFragment,
  ActionFragment,
  EffectFragment,
  PolicyFragment,
  ExpressionFragment,
} from '../types/fragment.js';
import type { Issue } from '../types/issue.js';
import type { PatchHint } from '../types/patch.js';
import { createIssueId } from '../types/issue.js';

// ============================================================================
// Types (Principle D: Categorized Dependencies)
// ============================================================================

/**
 * Categorized dependencies (Principle D)
 *
 * Different types of dependencies need different handling:
 * - readPaths: Values read via ['get', path] - used for DAG ordering
 * - writePaths: Values written via SetValue/SetState - potential conflicts
 * - policyPaths: Precondition references - validation only
 * - asyncTriggerPaths: Async operation paths - special handling
 */
export interface CategorizedDeps {
  /** Paths read via ['get', path] in expressions */
  readPaths: SemanticPath[];
  /** Paths written via SetValue/SetState effects */
  writePaths: SemanticPath[];
  /** Paths referenced in preconditions */
  policyPaths: SemanticPath[];
  /** Paths used in async operations */
  asyncTriggerPaths: SemanticPath[];
}

/**
 * Fragment dependency analysis result
 */
export interface FragmentDepsAnalysis {
  /** Fragment ID being analyzed */
  fragmentId: FragmentId;
  /** Dependencies declared in fragment.requires */
  declaredRequires: SemanticPath[];
  /** Dependencies computed from expressions and effects (Principle D) */
  computedDeps: CategorizedDeps;
  /** Dependencies in computedDeps but not in declaredRequires */
  missingDeps: SemanticPath[];
  /** Dependencies in declaredRequires but not actually used */
  unusedDeps: SemanticPath[];
  /** Analysis issues */
  issues: Issue[];
  /** Suggestions for fixing issues */
  patchHints: PatchHint[];
}

/**
 * Dependency graph for fragments
 */
export interface FragmentDependencyGraph {
  /** Map from fragment ID to its dependencies */
  dependencies: Map<FragmentId, Set<FragmentId>>;
  /** Map from fragment ID to fragments that depend on it */
  dependents: Map<FragmentId, Set<FragmentId>>;
  /** Map from provided path to providing fragment ID */
  pathProviders: Map<SemanticPath, FragmentId>;
  /** Map from fragment ID to its categorized deps */
  categorizedDeps: Map<FragmentId, CategorizedDeps>;
}

/**
 * Cycle detection result
 */
export interface CycleDetectionResult {
  /** Whether cycles were detected */
  hasCycles: boolean;
  /** Detected cycles (each cycle is a list of fragment IDs) */
  cycles: FragmentId[][];
  /** Issues for each cycle */
  issues: Issue[];
}

// ============================================================================
// Expression Dependency Analysis
// ============================================================================

/**
 * Analyze dependencies from an Expression
 *
 * Uses analyzeExpression() from @manifesto-ai/core
 *
 * @param expr - Expression to analyze
 * @returns Array of semantic paths
 */
export function analyzeExpressionDeps(expr: Expression): SemanticPath[] {
  const analysis = analyzeExpression(expr);
  return analysis.directDeps;
}

// ============================================================================
// Effect Dependency Analysis (Principle D)
// ============================================================================

/**
 * Create empty categorized deps
 */
function createEmptyCategorizedDeps(): CategorizedDeps {
  return {
    readPaths: [],
    writePaths: [],
    policyPaths: [],
    asyncTriggerPaths: [],
  };
}

/**
 * Merge categorized deps (avoiding duplicates)
 */
function mergeCategorizedDeps(a: CategorizedDeps, b: CategorizedDeps): CategorizedDeps {
  return {
    readPaths: [...new Set([...a.readPaths, ...b.readPaths])],
    writePaths: [...new Set([...a.writePaths, ...b.writePaths])],
    policyPaths: [...new Set([...a.policyPaths, ...b.policyPaths])],
    asyncTriggerPaths: [...new Set([...a.asyncTriggerPaths, ...b.asyncTriggerPaths])],
  };
}

/**
 * Traverse Effect AST and collect dependencies (Principle D)
 *
 * This is the key function for Effect traversal. It recursively visits
 * all Effect nodes and extracts:
 * - readPaths: from expressions in value/condition fields
 * - writePaths: from SetValue/SetState target paths
 * - asyncTriggerPaths: from ApiCall operations
 *
 * @param effect - Effect to traverse
 * @returns Categorized dependencies
 */
export function traverseEffectAST(effect: Effect): CategorizedDeps {
  const collector = createEmptyCategorizedDeps();

  function collectFromExpression(expr: Expression): void {
    const paths = analyzeExpressionDeps(expr);
    for (const path of paths) {
      if (!collector.readPaths.includes(path)) {
        collector.readPaths.push(path);
      }
    }
  }

  function traverse(e: Effect): void {
    switch (e._tag) {
      case 'SetValue':
        // Write target
        collector.writePaths.push(e.path);
        // Read from value expression
        collectFromExpression(e.value);
        break;

      case 'SetState':
        // Write target
        collector.writePaths.push(e.path);
        // Read from value expression
        collectFromExpression(e.value);
        break;

      case 'ApiCall':
        // ApiCall reads from body expressions
        if (e.body) {
          for (const value of Object.values(e.body)) {
            collectFromExpression(value);
          }
        }
        // ApiCall reads from query expressions
        if (e.query) {
          for (const value of Object.values(e.query)) {
            collectFromExpression(value);
          }
        }
        // Endpoint can be expression
        if (Array.isArray(e.endpoint)) {
          collectFromExpression(e.endpoint as Expression);
        }
        // Mark as async trigger (will write to async.* paths)
        collector.asyncTriggerPaths.push(`async.apiCall` as SemanticPath);
        break;

      case 'Navigate':
        // Navigate 'to' can be expression
        if (Array.isArray(e.to)) {
          collectFromExpression(e.to as Expression);
        }
        break;

      case 'Delay':
        // No dependencies
        break;

      case 'Sequence':
        // Recursively traverse all effects
        for (const childEffect of e.effects) {
          traverse(childEffect);
        }
        break;

      case 'Parallel':
        // Recursively traverse all effects
        for (const childEffect of e.effects) {
          traverse(childEffect);
        }
        break;

      case 'Conditional':
        // Read from condition expression
        collectFromExpression(e.condition);
        // Traverse then branch
        traverse(e.then);
        // Traverse else branch if present
        if (e.else) {
          traverse(e.else);
        }
        break;

      case 'Catch':
        // Traverse try branch
        traverse(e.try);
        // Traverse catch branch
        traverse(e.catch);
        // Traverse finally branch if present
        if (e.finally) {
          traverse(e.finally);
        }
        break;

      case 'EmitEvent':
        // EmitEvent has no path dependencies (payload is static)
        break;
    }
  }

  traverse(effect);
  return collector;
}

/**
 * Analyze Effect dependencies (Principle D)
 *
 * This is the public API for Effect dependency analysis.
 *
 * @param effect - Effect to analyze
 * @returns CategorizedDeps
 */
export function analyzeEffectDeps(effect: Effect): CategorizedDeps {
  return traverseEffectAST(effect);
}

// ============================================================================
// Fragment Dependency Analysis
// ============================================================================

/**
 * Analyze dependencies for a fragment
 *
 * @param fragment - Fragment to analyze
 * @param allProvides - Set of all provided paths (for validation)
 * @returns FragmentDepsAnalysis
 */
export function analyzeFragmentDeps(
  fragment: Fragment,
  allProvides: Set<string>
): FragmentDepsAnalysis {
  const issues: Issue[] = [];
  const patchHints: PatchHint[] = [];
  const computedDeps = createEmptyCategorizedDeps();
  const declaredRequires = [...fragment.requires] as SemanticPath[];

  // Analyze based on fragment type
  switch (fragment.kind) {
    case 'DerivedFragment': {
      const derived = fragment as DerivedFragment;
      // Expression deps
      const exprDeps = analyzeExpressionDeps(derived.expr);
      computedDeps.readPaths.push(...exprDeps);
      break;
    }

    case 'ExpressionFragment': {
      const exprFrag = fragment as ExpressionFragment;
      // Expression deps
      const exprDeps = analyzeExpressionDeps(exprFrag.expr);
      computedDeps.readPaths.push(...exprDeps);
      break;
    }

    case 'EffectFragment': {
      const effectFrag = fragment as EffectFragment;
      // Effect deps (Principle D: separate traversal)
      const effectDeps = analyzeEffectDeps(effectFrag.effect);
      Object.assign(computedDeps, mergeCategorizedDeps(computedDeps, effectDeps));
      break;
    }

    case 'ActionFragment': {
      const actionFrag = fragment as ActionFragment;
      // Precondition deps
      if (actionFrag.preconditions) {
        for (const precond of actionFrag.preconditions) {
          computedDeps.policyPaths.push(precond.path);
          computedDeps.readPaths.push(precond.path);
        }
      }
      // Inline effect deps
      if (actionFrag.effect) {
        const effectDeps = analyzeEffectDeps(actionFrag.effect);
        Object.assign(computedDeps, mergeCategorizedDeps(computedDeps, effectDeps));
      }
      break;
    }

    case 'PolicyFragment': {
      const policyFrag = fragment as PolicyFragment;
      // Precondition deps
      if (policyFrag.preconditions) {
        for (const precond of policyFrag.preconditions) {
          computedDeps.policyPaths.push(precond.path);
          computedDeps.readPaths.push(precond.path);
        }
      }
      // Field policy deps
      if (policyFrag.fieldPolicy) {
        const fp = policyFrag.fieldPolicy;
        if (fp.relevantWhen) {
          for (const cond of fp.relevantWhen) {
            computedDeps.policyPaths.push(cond.path);
            computedDeps.readPaths.push(cond.path);
          }
        }
        if (fp.editableWhen) {
          for (const cond of fp.editableWhen) {
            computedDeps.policyPaths.push(cond.path);
            computedDeps.readPaths.push(cond.path);
          }
        }
        if (fp.requiredWhen) {
          for (const cond of fp.requiredWhen) {
            computedDeps.policyPaths.push(cond.path);
            computedDeps.readPaths.push(cond.path);
          }
        }
      }
      break;
    }

    case 'SchemaFragment':
    case 'SourceFragment':
    case 'StatementFragment':
      // These typically don't have expression/effect deps
      break;
  }

  // Calculate missing and unused deps
  const allComputedPaths = new Set([
    ...computedDeps.readPaths,
    ...computedDeps.policyPaths,
  ]);
  const declaredSet = new Set(declaredRequires);

  const missingDeps = [...allComputedPaths].filter(
    (path) => !declaredSet.has(path)
  ) as SemanticPath[];

  const unusedDeps = declaredRequires.filter(
    (path) => !allComputedPaths.has(path)
  );

  // Create issues for missing deps
  for (const missing of missingDeps) {
    // Only report if the path is not in allProvides (it's truly missing)
    if (!allProvides.has(missing)) {
      issues.push({
        id: createIssueId(),
        code: 'MISSING_DEPENDENCY',
        severity: 'error',
        message: `Fragment "${fragment.id}" uses path "${missing}" but it is not provided by any fragment`,
        path: missing,
        relatedFragments: [fragment.id],
      });
    }
  }

  // Create info for unused deps (not an error, just FYI)
  for (const unused of unusedDeps) {
    issues.push({
      id: createIssueId(),
      code: 'UNUSED_PATH',
      severity: 'info',
      message: `Fragment "${fragment.id}" declares dependency on "${unused}" but does not use it`,
      path: unused,
      relatedFragments: [fragment.id],
    });
  }

  return {
    fragmentId: fragment.id,
    declaredRequires,
    computedDeps,
    missingDeps,
    unusedDeps,
    issues,
    patchHints,
  };
}

// ============================================================================
// Dependency Graph Building
// ============================================================================

/**
 * Build dependency graph from fragments
 *
 * @param fragments - Fragments to build graph from
 * @returns FragmentDependencyGraph
 */
export function buildFragmentDependencyGraph(
  fragments: Fragment[]
): FragmentDependencyGraph {
  const dependencies = new Map<FragmentId, Set<FragmentId>>();
  const dependents = new Map<FragmentId, Set<FragmentId>>();
  const pathProviders = new Map<SemanticPath, FragmentId>();
  const categorizedDeps = new Map<FragmentId, CategorizedDeps>();

  // First pass: collect all provides
  for (const fragment of fragments) {
    for (const provide of fragment.provides) {
      // Skip action: prefixed provides (not paths)
      if (!provide.startsWith('action:') && !provide.startsWith('effect:')) {
        pathProviders.set(provide as SemanticPath, fragment.id);
      }
    }
  }

  // Second pass: build dependency edges
  for (const fragment of fragments) {
    dependencies.set(fragment.id, new Set());
    if (!dependents.has(fragment.id)) {
      dependents.set(fragment.id, new Set());
    }

    // Analyze deps for this fragment
    const allProvides = new Set(pathProviders.keys());
    const analysis = analyzeFragmentDeps(fragment, allProvides as Set<string>);
    categorizedDeps.set(fragment.id, analysis.computedDeps);

    // Create edges for read dependencies
    const allReadDeps = [
      ...analysis.computedDeps.readPaths,
      ...analysis.computedDeps.policyPaths,
    ];

    for (const dep of allReadDeps) {
      const providerId = pathProviders.get(dep);
      if (providerId && providerId !== fragment.id) {
        dependencies.get(fragment.id)!.add(providerId);

        if (!dependents.has(providerId)) {
          dependents.set(providerId, new Set());
        }
        dependents.get(providerId)!.add(fragment.id);
      }
    }
  }

  return {
    dependencies,
    dependents,
    pathProviders,
    categorizedDeps,
  };
}

// ============================================================================
// Cycle Detection
// ============================================================================

/**
 * Detect cycles in the dependency graph using DFS
 *
 * @param graph - Fragment dependency graph
 * @returns CycleDetectionResult
 */
export function detectCycles(graph: FragmentDependencyGraph): CycleDetectionResult {
  const cycles: FragmentId[][] = [];
  const visited = new Set<FragmentId>();
  const recStack = new Set<FragmentId>();
  const parent = new Map<FragmentId, FragmentId>();

  function dfs(node: FragmentId, path: FragmentId[]): boolean {
    visited.add(node);
    recStack.add(node);

    const deps = graph.dependencies.get(node) || new Set();
    for (const dep of deps) {
      if (!visited.has(dep)) {
        parent.set(dep, node);
        if (dfs(dep, [...path, dep])) {
          return true;
        }
      } else if (recStack.has(dep)) {
        // Found cycle
        const cycleStart = path.indexOf(dep);
        if (cycleStart >= 0) {
          cycles.push(path.slice(cycleStart));
        } else {
          cycles.push([...path, dep]);
        }
      }
    }

    recStack.delete(node);
    return false;
  }

  // Run DFS from each unvisited node
  for (const nodeId of graph.dependencies.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId, [nodeId]);
    }
  }

  // Create issues for each cycle
  const issues: Issue[] = cycles.map((cycle) => ({
    id: createIssueId(),
    code: 'CYCLIC_DEPENDENCY' as const,
    severity: 'error' as const,
    message: `Cyclic dependency detected: ${cycle.join(' -> ')}`,
    relatedFragments: cycle,
    context: { cycle },
  }));

  return {
    hasCycles: cycles.length > 0,
    cycles,
    issues,
  };
}

// ============================================================================
// Topological Sort
// ============================================================================

/**
 * Topological sort of fragments based on dependencies
 *
 * Returns fragments in dependency order (dependencies before dependents)
 *
 * @param fragments - Fragments to sort
 * @param graph - Dependency graph
 * @returns Sorted fragments (or null if cycle detected)
 */
export function topologicalSortFragments(
  fragments: Fragment[],
  graph: FragmentDependencyGraph
): Fragment[] | null {
  const cycleResult = detectCycles(graph);
  if (cycleResult.hasCycles) {
    return null;
  }

  const sorted: Fragment[] = [];
  const visited = new Set<FragmentId>();
  const fragmentMap = new Map(fragments.map((f) => [f.id, f]));

  function visit(nodeId: FragmentId): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const deps = graph.dependencies.get(nodeId) || new Set();
    for (const dep of deps) {
      visit(dep);
    }

    const fragment = fragmentMap.get(nodeId);
    if (fragment) {
      sorted.push(fragment);
    }
  }

  for (const fragment of fragments) {
    visit(fragment.id);
  }

  return sorted;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all fragments that depend on a given fragment
 */
export function getDependentFragments(
  fragmentId: FragmentId,
  graph: FragmentDependencyGraph
): FragmentId[] {
  return [...(graph.dependents.get(fragmentId) || [])];
}

/**
 * Get all fragments that a given fragment depends on
 */
export function getDependencyFragments(
  fragmentId: FragmentId,
  graph: FragmentDependencyGraph
): FragmentId[] {
  return [...(graph.dependencies.get(fragmentId) || [])];
}

/**
 * Get the fragment that provides a given path
 */
export function getPathProvider(
  path: SemanticPath,
  graph: FragmentDependencyGraph
): FragmentId | undefined {
  return graph.pathProviders.get(path);
}

/**
 * Check if a fragment has any dependencies
 */
export function hasNoDependencies(
  fragmentId: FragmentId,
  graph: FragmentDependencyGraph
): boolean {
  const deps = graph.dependencies.get(fragmentId);
  return !deps || deps.size === 0;
}

/**
 * Get all root fragments (no dependencies)
 */
export function getRootFragments(graph: FragmentDependencyGraph): FragmentId[] {
  return [...graph.dependencies.entries()]
    .filter(([_, deps]) => deps.size === 0)
    .map(([id]) => id);
}

export default {
  analyzeExpressionDeps,
  analyzeEffectDeps,
  traverseEffectAST,
  analyzeFragmentDeps,
  buildFragmentDependencyGraph,
  detectCycles,
  topologicalSortFragments,
  getDependentFragments,
  getDependencyFragments,
  getPathProvider,
  hasNoDependencies,
  getRootFragments,
};
