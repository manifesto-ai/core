/**
 * Action Projection
 *
 * Converts domain Preconditions to UI-ready action states.
 * Aggregates precondition results into availability and reasons.
 */

import type { PreconditionStatus } from '@manifesto-ai/core';
import type {
  UIActionState,
  UIActionStateMap,
  UIPreconditionState,
  ActionProjectionConfig,
} from '../types.js';

// =============================================================================
// Projection Functions
// =============================================================================

/**
 * Project precondition statuses to UI action state.
 *
 * @param actionId - Action identifier
 * @param preconditions - Precondition statuses from runtime
 * @param config - Optional projection configuration
 * @returns UIActionState for the action
 */
export function projectActionState(
  actionId: string,
  preconditions: PreconditionStatus[],
  config?: ActionProjectionConfig
): UIActionState {
  const unsatisfied = preconditions.filter((p) => !p.satisfied);
  const available = unsatisfied.length === 0;

  const unavailableReasons = unsatisfied.map((p) => {
    if (p.reason) return p.reason;
    return `${p.path} must be ${p.expect}`;
  });

  const uiPreconditions: UIPreconditionState[] =
    config?.includePreconditions !== false
      ? preconditions.map(toPreconditionState)
      : [];

  return {
    actionId,
    available,
    executing: false,
    unavailableReasons,
    preconditions: uiPreconditions,
    updatedAt: Date.now(),
  };
}

/**
 * Convert PreconditionStatus to UIPreconditionState.
 */
function toPreconditionState(status: PreconditionStatus): UIPreconditionState {
  return {
    path: status.path,
    satisfied: status.satisfied,
    reason: status.reason,
  };
}

/**
 * Project multiple actions.
 *
 * @param actions - Map of actionId to precondition statuses
 * @param config - Optional projection configuration
 * @returns Map of actionId to UIActionState
 */
export function projectActionStates(
  actions: Map<string, PreconditionStatus[]>,
  config?: ActionProjectionConfig
): UIActionStateMap {
  const result: UIActionStateMap = new Map();

  for (const [actionId, preconditions] of actions) {
    result.set(actionId, projectActionState(actionId, preconditions, config));
  }

  return result;
}

/**
 * Create a diff of changed action IDs between two action state maps.
 *
 * @param previous - Previous action state map
 * @param current - Current action state map
 * @returns Array of action IDs that changed
 */
export function createActionProjectionDiff(
  previous: UIActionStateMap,
  current: UIActionStateMap
): string[] {
  const changed: string[] = [];

  // Check for changes and additions
  for (const [actionId, state] of current) {
    const prev = previous.get(actionId);
    if (!prev || !isActionStateEqual(prev, state)) {
      changed.push(actionId);
    }
  }

  // Check for removals
  for (const actionId of previous.keys()) {
    if (!current.has(actionId)) {
      changed.push(actionId);
    }
  }

  return changed;
}

/**
 * Check if two action states are equal (ignoring updatedAt and executing).
 * Executing is managed separately by setActionExecuting.
 */
export function isActionStateEqual(a: UIActionState, b: UIActionState): boolean {
  if (a.actionId !== b.actionId) return false;
  if (a.available !== b.available) return false;
  if (a.unavailableReasons.length !== b.unavailableReasons.length) return false;

  for (let i = 0; i < a.unavailableReasons.length; i++) {
    if (a.unavailableReasons[i] !== b.unavailableReasons[i]) return false;
  }

  if (a.preconditions.length !== b.preconditions.length) return false;

  for (let i = 0; i < a.preconditions.length; i++) {
    const ap = a.preconditions[i];
    const bp = b.preconditions[i];
    if (!ap || !bp) return false;
    if (
      ap.path !== bp.path ||
      ap.satisfied !== bp.satisfied ||
      ap.reason !== bp.reason
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Get all available actions from states.
 */
export function getAvailableActions(states: UIActionStateMap): UIActionStateMap {
  const result: UIActionStateMap = new Map();

  for (const [actionId, state] of states) {
    if (state.available) {
      result.set(actionId, state);
    }
  }

  return result;
}

/**
 * Get all unavailable actions with reasons.
 */
export function getUnavailableActions(
  states: UIActionStateMap
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const [actionId, state] of states) {
    if (!state.available) {
      result.set(actionId, state.unavailableReasons);
    }
  }

  return result;
}

/**
 * Get all executing actions.
 */
export function getExecutingActions(states: UIActionStateMap): string[] {
  const result: string[] = [];

  for (const [actionId, state] of states) {
    if (state.executing) {
      result.push(actionId);
    }
  }

  return result;
}

/**
 * Clone action state with executing flag updated.
 */
export function setExecuting(
  state: UIActionState,
  executing: boolean
): UIActionState {
  return {
    ...state,
    executing,
    updatedAt: Date.now(),
  };
}
