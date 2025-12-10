/**
 * useFieldProjection Hook
 *
 * React hook for subscribing to field projection state.
 */

import { useSyncExternalStore, useCallback } from 'react';
import type { SemanticPath } from '@manifesto-ai/core';
import type { ProjectionManager, UIFieldState } from '../../types.js';

/**
 * Subscribe to a single field's UI state.
 *
 * @param manager - ProjectionManager instance
 * @param path - Semantic path to the field
 * @returns UIFieldState or undefined if not found
 *
 * @example
 * ```tsx
 * function NameField({ manager }: { manager: ProjectionManager }) {
 *   const state = useFieldProjection(manager, 'data.name');
 *
 *   if (!state?.visible) return null;
 *
 *   return (
 *     <input
 *       disabled={!state.enabled}
 *       required={state.required}
 *       title={state.disabledReason}
 *     />
 *   );
 * }
 * ```
 */
export function useFieldProjection(
  manager: ProjectionManager,
  path: SemanticPath
): UIFieldState | undefined {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return manager.subscribeFields((_, changedPaths) => {
        if (changedPaths.includes(path)) {
          onStoreChange();
        }
      });
    },
    [manager, path]
  );

  const getSnapshot = useCallback(() => {
    return manager.getFieldState(path);
  }, [manager, path]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribe to multiple fields' UI states.
 *
 * @param manager - ProjectionManager instance
 * @param paths - Array of semantic paths
 * @returns Map of path to UIFieldState
 *
 * @example
 * ```tsx
 * function FormFields({ manager }: { manager: ProjectionManager }) {
 *   const states = useFieldProjections(manager, ['data.name', 'data.email']);
 *
 *   return (
 *     <>
 *       {Array.from(states.entries()).map(([path, state]) => (
 *         state.visible && <Field key={path} state={state} />
 *       ))}
 *     </>
 *   );
 * }
 * ```
 */
export function useFieldProjections(
  manager: ProjectionManager,
  paths: SemanticPath[]
): Map<SemanticPath, UIFieldState> {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return manager.subscribeFields((_, changedPaths) => {
        if (changedPaths.some((p) => paths.includes(p))) {
          onStoreChange();
        }
      });
    },
    [manager, paths]
  );

  const getSnapshot = useCallback(() => {
    const result = new Map<SemanticPath, UIFieldState>();
    for (const path of paths) {
      const state = manager.getFieldState(path);
      if (state) {
        result.set(path, state);
      }
    }
    return result;
  }, [manager, paths]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Get all field states.
 *
 * @param manager - ProjectionManager instance
 * @returns Map of all field states
 */
export function useAllFieldProjections(
  manager: ProjectionManager
): Map<SemanticPath, UIFieldState> {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return manager.subscribeFields(() => {
        onStoreChange();
      });
    },
    [manager]
  );

  const getSnapshot = useCallback(() => {
    return manager.getFieldStates();
  }, [manager]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
