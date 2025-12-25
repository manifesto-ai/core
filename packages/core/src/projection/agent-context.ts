/**
 * AgentContext Projection
 *
 * Transform DomainRuntime state into AgentContext for AI agents
 */

import type { SemanticPath, ManifestoDomain } from '../domain/types.js';
import type { DomainRuntime } from '../runtime/runtime.js';
import type { DomainSnapshot } from '../runtime/snapshot.js';
import type {
  AgentContext,
  ProjectedSnapshot,
  AgentActionInfo,
  UnavailableAction,
  BlockedReason,
  FieldInfo,
  AgentContextMetadata,
} from './types.js';

/**
 * Project a DomainSnapshot into a simplified ProjectedSnapshot
 */
export function projectSnapshot<TData, TState>(
  snapshot: DomainSnapshot<TData, TState>
): ProjectedSnapshot {
  const data: Record<string, unknown> = {};
  const state: Record<string, unknown> = {};
  const derived: Record<string, unknown> = {};
  const async: Record<string, unknown> = {};

  // Helper to flatten nested object to dot notation
  function flattenObject(
    obj: unknown,
    prefix: string,
    target: Record<string, unknown>
  ): void {
    if (obj === null || obj === undefined) return;
    if (typeof obj !== 'object') {
      target[prefix] = obj;
      return;
    }
    if (Array.isArray(obj)) {
      target[prefix] = obj;
      return;
    }

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        flattenObject(value, newKey, target);
      } else {
        target[newKey] = value;
      }
    }
  }

  flattenObject(snapshot.data, '', data);
  flattenObject(snapshot.state, '', state);

  return { data, state, derived, async };
}

/**
 * Options for projecting agent context
 */
export type ProjectAgentContextOptions = {
  /** Include field policies (default: true) */
  includeFieldPolicies?: boolean;
  /** Include field info (default: true) */
  includeFields?: boolean;
  /** Estimate token count (default: false) */
  estimateTokens?: boolean;
};

/**
 * Project a DomainRuntime into an AgentContext
 *
 * This is the main function for creating an AI-readable view of the domain state.
 *
 * @param runtime - The domain runtime
 * @param domain - The domain definition
 * @param options - Projection options
 * @returns AgentContext for AI consumption
 *
 * @example
 * ```typescript
 * const context = projectAgentContext(runtime, domain);
 * // Send to LLM:
 * // - context.availableActions shows what the agent can do
 * // - context.snapshot shows current state
 * // - context.unavailableActions explains what's blocked and why
 * ```
 */
export function projectAgentContext<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  options: ProjectAgentContextOptions = {}
): AgentContext {
  const {
    includeFieldPolicies = true,
    includeFields = true,
    estimateTokens = false,
  } = options;

  const snapshot = runtime.getSnapshot();

  // Project snapshot
  const projectedSnapshot = projectSnapshot(snapshot);

  // Add derived values
  for (const path of Object.keys(domain.paths.derived)) {
    const value = runtime.get(path);
    const key = path.replace('derived.', '');
    projectedSnapshot.derived[key] = value;
  }

  // Add async values
  for (const path of Object.keys(domain.paths.async)) {
    const asyncDef = domain.paths.async[path];
    if (asyncDef) {
      projectedSnapshot.async[asyncDef.resultPath.replace('async.', '')] = runtime.get(asyncDef.resultPath);
      projectedSnapshot.async[asyncDef.loadingPath.replace('async.', '')] = runtime.get(asyncDef.loadingPath);
      projectedSnapshot.async[asyncDef.errorPath.replace('async.', '')] = runtime.get(asyncDef.errorPath);
    }
  }

  // Collect actions
  const availableActions: AgentActionInfo[] = [];
  const unavailableActions: UnavailableAction[] = [];

  for (const [actionId, actionDef] of Object.entries(domain.actions)) {
    const preconditions = runtime.getPreconditions(actionId);
    const isAvailable = preconditions.every((p) => p.satisfied);
    const impactPaths = runtime.getImpact(actionDef.deps[0] ?? ('' as SemanticPath));

    if (isAvailable) {
      availableActions.push({
        actionId,
        semantic: actionDef.semantic,
        deps: actionDef.deps,
        preconditions,
        estimatedImpact: impactPaths,
      });
    } else {
      const blockedReasons: BlockedReason[] = preconditions
        .filter((p) => !p.satisfied)
        .map((p) => ({
          type: 'precondition_failed' as const,
          path: p.path,
          expected: p.expect,
          actual: p.actual,
          reason: p.reason,
        }));

      unavailableActions.push({
        actionId,
        semantic: actionDef.semantic,
        blockedReasons,
      });
    }
  }

  // Collect field policies
  const fieldPolicies: Record<SemanticPath, ReturnType<typeof runtime.getFieldPolicy>> = {};
  const fields: FieldInfo[] = [];

  if (includeFieldPolicies || includeFields) {
    for (const path of Object.keys(domain.paths.sources) as SemanticPath[]) {
      const policy = runtime.getFieldPolicy(path);
      if (includeFieldPolicies) {
        fieldPolicies[path] = policy;
      }
      if (includeFields) {
        fields.push({
          path,
          value: runtime.get(path),
          semantic: runtime.getSemantic(path),
          policy,
        });
      }
    }
  }

  // Count paths
  const pathCount =
    Object.keys(domain.paths.sources).length +
    Object.keys(domain.paths.derived).length +
    Object.keys(domain.paths.async).length * 3; // async has 3 subpaths each

  // Build metadata
  const metadata: AgentContextMetadata = {
    projectedAt: Date.now(),
    pathCount,
    snapshotVersion: snapshot.version,
  };

  if (estimateTokens) {
    // Rough estimation: ~4 chars per token
    const jsonStr = JSON.stringify({ projectedSnapshot, availableActions, unavailableActions });
    metadata.estimatedTokens = Math.ceil(jsonStr.length / 4);
  }

  return {
    snapshot: projectedSnapshot,
    availableActions,
    unavailableActions,
    fieldPolicies,
    fields,
    metadata,
  };
}
