/**
 * useValues - Subscribe to multiple path values
 */

import { useSyncExternalStore, useCallback, useRef, useMemo } from 'react';
import type { SemanticPath } from '@manifesto-ai/core';
import { useRuntime } from '../context.js';
import type { UseValuesResult } from '../types.js';

/**
 * useValues - Subscribe to multiple path values
 *
 * @param paths - Array of semantic paths to watch
 * @returns Object with values by path and the paths array
 *
 * @example
 * ```tsx
 * function UserInfo() {
 *   const { values } = useValues(['data.user.name', 'data.user.email']);
 *   return (
 *     <div>
 *       <div>{values['data.user.name'] as string}</div>
 *       <div>{values['data.user.email'] as string}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useValues(paths: SemanticPath[]): UseValuesResult {
  const runtime = useRuntime();

  // Memoize paths array to prevent unnecessary re-subscriptions
  const stablePaths = useMemo(() => paths, [paths.join(',')]);

  // Store to track current values
  const valuesRef = useRef<Record<SemanticPath, unknown>>({});

  // Initialize values
  useMemo(() => {
    const initial: Record<SemanticPath, unknown> = {};
    for (const path of stablePaths) {
      initial[path] = runtime.get(path);
    }
    valuesRef.current = initial;
  }, [runtime, stablePaths]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubscribes: Array<() => void> = [];

      for (const path of stablePaths) {
        const unsubscribe = runtime.subscribePath(path, (newValue) => {
          valuesRef.current = { ...valuesRef.current, [path]: newValue };
          onStoreChange();
        });
        unsubscribes.push(unsubscribe);
      }

      return () => {
        for (const unsub of unsubscribes) {
          unsub();
        }
      };
    },
    [runtime, stablePaths]
  );

  const getSnapshot = useCallback(() => {
    const result: Record<SemanticPath, unknown> = {};
    for (const path of stablePaths) {
      result[path] = runtime.get(path);
    }
    return result;
  }, [runtime, stablePaths]);

  // Use a version counter to trigger re-renders
  const versionRef = useRef(0);
  const subscribeWithVersion = useCallback(
    (onStoreChange: () => void) => {
      return subscribe(() => {
        versionRef.current++;
        onStoreChange();
      });
    },
    [subscribe]
  );

  const getSnapshotVersion = useCallback(() => versionRef.current, []);

  useSyncExternalStore(subscribeWithVersion, getSnapshotVersion, getSnapshotVersion);

  return { values: getSnapshot(), paths: stablePaths };
}
