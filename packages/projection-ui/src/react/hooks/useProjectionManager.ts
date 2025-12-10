/**
 * useProjectionManager Hook
 *
 * React hook for creating and managing a ProjectionManager lifecycle.
 */

import { useMemo, useEffect, useRef } from 'react';
import type { DomainRuntime, ManifestoDomain } from '@manifesto-ai/core';
import type {
  ProjectionManager,
  CreateProjectionManagerOptions,
} from '../../types.js';
import { createProjectionManager } from '../../core/projection-manager.js';

/**
 * Create and manage a ProjectionManager lifecycle.
 *
 * @param runtime - DomainRuntime instance
 * @param options - Optional configuration
 * @returns ProjectionManager instance
 *
 * @example
 * ```tsx
 * function App() {
 *   const runtime = useMemo(() => createRuntime({ domain, initialData }), []);
 *   const manager = useProjectionManager(runtime, {
 *     domain,
 *     fields: { paths: ['data.name', 'data.email'] },
 *     actions: { actionIds: ['action.submit'] },
 *   });
 *
 *   return <Form manager={manager} />;
 * }
 * ```
 */
export function useProjectionManager<TData = unknown, TState = unknown>(
  runtime: DomainRuntime<TData, TState>,
  options?: Omit<CreateProjectionManagerOptions<TData, TState>, 'runtime'> & {
    domain?: ManifestoDomain<TData, TState>;
  }
): ProjectionManager<TData, TState> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const manager = useMemo(
    () =>
      createProjectionManager({
        runtime,
        ...optionsRef.current,
      }),
    [runtime]
  );

  const managerRef = useRef(manager);
  managerRef.current = manager;

  useEffect(() => {
    return () => {
      managerRef.current.dispose();
    };
  }, [manager]);

  return manager;
}

/**
 * Create a ProjectionManager with explicit dependency tracking.
 *
 * Use this when you need the manager to recreate when options change.
 *
 * @param runtime - DomainRuntime instance
 * @param domain - Domain definition
 * @param deps - Dependencies that trigger manager recreation
 * @returns ProjectionManager instance
 */
export function useProjectionManagerWithDeps<TData = unknown, TState = unknown>(
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  options?: Omit<CreateProjectionManagerOptions<TData, TState>, 'runtime'>,
  deps: React.DependencyList = []
): ProjectionManager<TData, TState> {
  const manager = useMemo(
    () =>
      createProjectionManager({
        runtime,
        domain,
        ...options,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runtime, domain, ...deps]
  );

  useEffect(() => {
    return () => {
      manager.dispose();
    };
  }, [manager]);

  return manager;
}
