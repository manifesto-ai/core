/**
 * useSnapshot - Subscribe to the entire domain snapshot
 *
 * Uses useSyncExternalStore for optimal React 18 integration
 */

import { useSyncExternalStore, useCallback } from 'react';
import type { DomainSnapshot } from '@manifesto-ai/core';
import { useRuntime } from '../context.js';

/**
 * useSnapshot - Subscribe to the entire domain snapshot
 *
 * @returns Current snapshot
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const snapshot = useSnapshot();
 *   return <div>{JSON.stringify(snapshot.data)}</div>;
 * }
 * ```
 */
export function useSnapshot<TData = unknown, TState = unknown>(): DomainSnapshot<TData, TState> {
  const runtime = useRuntime<TData, TState>();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return runtime.subscribe(() => {
        onStoreChange();
      });
    },
    [runtime]
  );

  const getSnapshot = useCallback(() => {
    return runtime.getSnapshot();
  }, [runtime]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
