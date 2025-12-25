/**
 * useValue - Subscribe to a single path value
 */

import { useSyncExternalStore, useCallback, useRef } from 'react';
import type { SemanticPath } from '@manifesto-ai/core';
import { useRuntime } from '../context.js';
import type { UseValueResult } from '../types.js';

/**
 * useValue - Subscribe to a single path value
 *
 * @param path - Semantic path to watch
 * @returns Current value and path
 *
 * @example
 * ```tsx
 * function UserName() {
 *   const { value: name } = useValue<string>('data.user.name');
 *   return <div>{name}</div>;
 * }
 * ```
 */
export function useValue<T = unknown>(path: SemanticPath): UseValueResult<T> {
  const runtime = useRuntime();
  const valueRef = useRef<T>(runtime.get<T>(path));

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return runtime.subscribePath(path, (newValue) => {
        valueRef.current = newValue as T;
        onStoreChange();
      });
    },
    [runtime, path]
  );

  const getSnapshot = useCallback(() => {
    return runtime.get<T>(path);
  }, [runtime, path]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { value, path };
}
