/**
 * Field Projection
 *
 * Converts domain FieldPolicy to UI-ready field states.
 * Domain decides "what" (relevant, editable, required).
 * UI decides "how" (visible vs hidden, enabled vs disabled).
 */

import type { SemanticPath, ResolvedFieldPolicy } from '@manifesto-ai/core';
import type {
  UIFieldState,
  UIFieldStateMap,
  FieldProjectionConfig,
} from '../types.js';

// =============================================================================
// Default Resolvers
// =============================================================================

/**
 * Default visibility resolver: field is visible if relevant.
 */
export function defaultVisibilityResolver(policy: ResolvedFieldPolicy): boolean {
  return policy.relevant;
}

/**
 * Default enabled resolver: field is enabled if relevant AND editable.
 */
export function defaultEnabledResolver(policy: ResolvedFieldPolicy): boolean {
  return policy.relevant && policy.editable;
}

// =============================================================================
// Projection Functions
// =============================================================================

/**
 * Project a single ResolvedFieldPolicy to UIFieldState.
 *
 * @param path - Semantic path to the field
 * @param policy - Resolved field policy from runtime
 * @param config - Optional projection configuration
 * @returns UIFieldState for the field
 */
export function projectFieldPolicy(
  path: SemanticPath,
  policy: ResolvedFieldPolicy,
  config?: FieldProjectionConfig
): UIFieldState {
  const visibilityResolver =
    config?.visibilityResolver ?? defaultVisibilityResolver;
  const enabledResolver = config?.enabledResolver ?? defaultEnabledResolver;

  const visible = visibilityResolver(policy);
  const enabled = enabledResolver(policy);

  return {
    path,
    visible,
    enabled,
    required: policy.required,
    disabledReason: enabled ? undefined : policy.editableReason,
    hiddenReason: visible ? undefined : policy.relevantReason,
    requiredReason: policy.required ? policy.requiredReason : undefined,
    updatedAt: Date.now(),
  };
}

/**
 * Project multiple field policies.
 *
 * @param policies - Map of path to resolved policy
 * @param config - Optional projection configuration
 * @returns Map of path to UIFieldState
 */
export function projectFieldPolicies(
  policies: Map<SemanticPath, ResolvedFieldPolicy>,
  config?: FieldProjectionConfig
): UIFieldStateMap {
  const result: UIFieldStateMap = new Map();

  for (const [path, policy] of policies) {
    result.set(path, projectFieldPolicy(path, policy, config));
  }

  return result;
}

/**
 * Create a diff of changed paths between two field state maps.
 *
 * @param previous - Previous field state map
 * @param current - Current field state map
 * @returns Array of paths that changed
 */
export function createFieldProjectionDiff(
  previous: UIFieldStateMap,
  current: UIFieldStateMap
): SemanticPath[] {
  const changed: SemanticPath[] = [];

  // Check for changes and additions
  for (const [path, state] of current) {
    const prev = previous.get(path);
    if (!prev || !isFieldStateEqual(prev, state)) {
      changed.push(path);
    }
  }

  // Check for removals
  for (const path of previous.keys()) {
    if (!current.has(path)) {
      changed.push(path);
    }
  }

  return changed;
}

/**
 * Check if two field states are equal (ignoring updatedAt).
 */
export function isFieldStateEqual(a: UIFieldState, b: UIFieldState): boolean {
  return (
    a.path === b.path &&
    a.visible === b.visible &&
    a.enabled === b.enabled &&
    a.required === b.required &&
    a.disabledReason === b.disabledReason &&
    a.hiddenReason === b.hiddenReason &&
    a.requiredReason === b.requiredReason
  );
}

/**
 * Merge two field state maps.
 * Later map values override earlier ones.
 */
export function mergeFieldStates(
  ...maps: UIFieldStateMap[]
): UIFieldStateMap {
  const result: UIFieldStateMap = new Map();

  for (const map of maps) {
    for (const [path, state] of map) {
      result.set(path, state);
    }
  }

  return result;
}

/**
 * Filter field states by visibility.
 */
export function filterVisibleFields(states: UIFieldStateMap): UIFieldStateMap {
  const result: UIFieldStateMap = new Map();

  for (const [path, state] of states) {
    if (state.visible) {
      result.set(path, state);
    }
  }

  return result;
}

/**
 * Filter field states by enabled status.
 */
export function filterEnabledFields(states: UIFieldStateMap): UIFieldStateMap {
  const result: UIFieldStateMap = new Map();

  for (const [path, state] of states) {
    if (state.enabled) {
      result.set(path, state);
    }
  }

  return result;
}

/**
 * Get all required fields from states.
 */
export function getRequiredFields(states: UIFieldStateMap): UIFieldStateMap {
  const result: UIFieldStateMap = new Map();

  for (const [path, state] of states) {
    if (state.required) {
      result.set(path, state);
    }
  }

  return result;
}
