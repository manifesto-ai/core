/**
 * Impact Analysis
 *
 * Analyze the impact of value changes and action executions
 */

import type { SemanticPath, ManifestoDomain } from '../domain/types.js';
import type { DomainRuntime } from '../runtime/runtime.js';
import type { DependencyGraph } from '../dag/graph.js';
import { buildDependencyGraph, getAllDependents } from '../dag/graph.js';
import type { ImpactAnalysis, ActionImpactAnalysis } from './types.js';

/**
 * Analyze the impact of changing a value at a path
 *
 * @param runtime - Domain runtime
 * @param domain - Domain definition
 * @param path - Path that would be changed
 * @returns Impact analysis including affected paths and actions
 *
 * @example
 * ```typescript
 * const impact = analyzeValueImpact(runtime, domain, 'data.quantity');
 * console.log(impact.directImpact);    // ['derived.subtotal']
 * console.log(impact.transitiveImpact); // ['derived.total', 'derived.canCheckout']
 * console.log(impact.asyncTriggers);    // ['async.priceCheck']
 * ```
 */
export function analyzeValueImpact<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  path: SemanticPath
): ImpactAnalysis {
  const graph = buildDependencyGraph(domain);

  // Get all dependents
  const allDependents = getAllDependents(graph, path);

  // Separate direct and transitive
  const node = graph.nodes.get(path);
  const directDeps = node ? [...(graph.dependents.get(path) ?? [])] : [];
  const transitiveImpact = allDependents.filter((p) => !directDeps.includes(p));

  // Find async triggers
  const asyncTriggers = allDependents.filter((p) => {
    const depNode = graph.nodes.get(p);
    return depNode?.kind === 'async';
  });

  // Find affected actions
  const affectedActions: string[] = [];
  for (const [actionId, actionDef] of Object.entries(domain.actions)) {
    // Check if any precondition depends on affected paths
    const preconditions = actionDef.preconditions ?? [];
    const affectedByPrecondition = preconditions.some((p) =>
      allDependents.includes(p.path) || p.path === path
    );

    // Check if any dependency is affected
    const affectedByDep = actionDef.deps.some((dep) =>
      allDependents.includes(dep) || dep === path
    );

    if (affectedByPrecondition || affectedByDep) {
      affectedActions.push(actionId);
    }
  }

  return {
    changedPath: path,
    directImpact: directDeps,
    transitiveImpact,
    asyncTriggers,
    affectedActions,
  };
}

/**
 * Analyze the impact of executing an action
 *
 * @param runtime - Domain runtime
 * @param domain - Domain definition
 * @param actionId - Action to analyze
 * @returns Impact analysis for the action
 *
 * @example
 * ```typescript
 * const impact = analyzeActionImpact(runtime, domain, 'submitOrder');
 * console.log(impact.directModifications);  // ['data.orderSubmitted']
 * console.log(impact.propagatedChanges);    // ['derived.orderStatus', 'async.orderResult']
 * console.log(impact.riskLevel);            // 'high'
 * ```
 */
export function analyzeActionImpact<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  actionId: string
): ActionImpactAnalysis {
  const action = domain.actions[actionId];
  if (!action) {
    throw new Error(`Action not found: ${actionId}`);
  }

  const graph = buildDependencyGraph(domain);

  // Direct modifications from action deps
  const directModifications = action.deps;

  // Propagated changes
  const propagatedChanges = new Set<SemanticPath>();
  for (const dep of directModifications) {
    const dependents = getAllDependents(graph, dep);
    for (const dependent of dependents) {
      propagatedChanges.add(dependent);
    }
  }

  // Find affected actions (other than this one)
  const affectedActions: string[] = [];
  const allAffected = [...directModifications, ...propagatedChanges];

  for (const [otherActionId, otherAction] of Object.entries(domain.actions)) {
    if (otherActionId === actionId) continue;

    // Check if any precondition is affected
    const preconditions = otherAction.preconditions ?? [];
    const affectedByPrecondition = preconditions.some((p) =>
      allAffected.includes(p.path)
    );

    if (affectedByPrecondition) {
      affectedActions.push(otherActionId);
    }
  }

  // Determine risk level from action semantic
  const riskLevel = action.semantic.risk ?? 'none';

  return {
    actionId,
    directModifications,
    propagatedChanges: [...propagatedChanges],
    affectedActions,
    riskLevel,
  };
}

/**
 * Get a summary of all potential impacts in the domain
 *
 * @param domain - Domain definition
 * @returns Map of paths to their potential impact scope
 */
export function getImpactMap<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): Map<SemanticPath, { dependentCount: number; isHighImpact: boolean }> {
  const graph = buildDependencyGraph(domain);
  const impactMap = new Map<SemanticPath, { dependentCount: number; isHighImpact: boolean }>();

  for (const path of graph.nodes.keys()) {
    const dependents = getAllDependents(graph, path);
    const hasAsyncDependent = dependents.some((p) => {
      const node = graph.nodes.get(p);
      return node?.kind === 'async';
    });

    impactMap.set(path, {
      dependentCount: dependents.length,
      isHighImpact: dependents.length > 5 || hasAsyncDependent,
    });
  }

  return impactMap;
}
