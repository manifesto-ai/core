/**
 * useActionProjection Hook
 *
 * React hooks for subscribing to action projection state.
 */

import { useSyncExternalStore, useCallback } from 'react';
import type { ProjectionManager, UIActionState } from '../../types.js';

/**
 * Subscribe to a single action's UI state.
 *
 * @param manager - ProjectionManager instance
 * @param actionId - Action identifier
 * @returns UIActionState or undefined if not found
 *
 * @example
 * ```tsx
 * function SubmitButton({ manager }: { manager: ProjectionManager }) {
 *   const state = useActionProjection(manager, 'action.submit');
 *
 *   return (
 *     <button
 *       disabled={!state?.available || state?.executing}
 *       title={state?.unavailableReasons.join(', ')}
 *     >
 *       {state?.executing ? 'Submitting...' : 'Submit'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useActionProjection(
  manager: ProjectionManager,
  actionId: string
): UIActionState | undefined {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return manager.subscribeActions((_, changedIds) => {
        if (changedIds.includes(actionId)) {
          onStoreChange();
        }
      });
    },
    [manager, actionId]
  );

  const getSnapshot = useCallback(() => {
    return manager.getActionState(actionId);
  }, [manager, actionId]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hook that returns action state with execution helper.
 *
 * @param manager - ProjectionManager instance
 * @param actionId - Action identifier
 * @returns Object with state, execute function, and convenience booleans
 *
 * @example
 * ```tsx
 * function SubmitButton({ manager }: { manager: ProjectionManager }) {
 *   const { isAvailable, isExecuting, execute, state } = useAction(manager, 'action.submit');
 *
 *   return (
 *     <button
 *       disabled={!isAvailable || isExecuting}
 *       onClick={execute}
 *       title={state?.unavailableReasons.join(', ')}
 *     >
 *       {isExecuting ? 'Submitting...' : 'Submit'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useAction(
  manager: ProjectionManager,
  actionId: string
): {
  state: UIActionState | undefined;
  execute: (input?: unknown) => Promise<void>;
  isAvailable: boolean;
  isExecuting: boolean;
} {
  const state = useActionProjection(manager, actionId);

  const execute = useCallback(
    async (input?: unknown) => {
      manager.setActionExecuting(actionId, true);
      try {
        await manager.runtime.execute(actionId, input);
      } finally {
        manager.setActionExecuting(actionId, false);
      }
    },
    [manager, actionId]
  );

  return {
    state,
    execute,
    isAvailable: state?.available ?? false,
    isExecuting: state?.executing ?? false,
  };
}

/**
 * Subscribe to multiple actions' UI states.
 *
 * @param manager - ProjectionManager instance
 * @param actionIds - Array of action identifiers
 * @returns Map of actionId to UIActionState
 */
export function useActionProjections(
  manager: ProjectionManager,
  actionIds: string[]
): Map<string, UIActionState> {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return manager.subscribeActions((_, changedIds) => {
        if (changedIds.some((id) => actionIds.includes(id))) {
          onStoreChange();
        }
      });
    },
    [manager, actionIds]
  );

  const getSnapshot = useCallback(() => {
    const result = new Map<string, UIActionState>();
    for (const actionId of actionIds) {
      const state = manager.getActionState(actionId);
      if (state) {
        result.set(actionId, state);
      }
    }
    return result;
  }, [manager, actionIds]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Get all action states.
 *
 * @param manager - ProjectionManager instance
 * @returns Map of all action states
 */
export function useAllActionProjections(
  manager: ProjectionManager
): Map<string, UIActionState> {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return manager.subscribeActions(() => {
        onStoreChange();
      });
    },
    [manager]
  );

  const getSnapshot = useCallback(() => {
    return manager.getActionStates();
  }, [manager]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
