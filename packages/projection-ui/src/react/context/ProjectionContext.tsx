/**
 * Projection Context
 *
 * React context for providing ProjectionManager to component tree.
 */

import { createContext, useContext, type ReactNode, type ReactElement } from 'react';
import type { DomainRuntime, ManifestoDomain } from '@manifesto-ai/core';
import type {
  ProjectionManager,
  CreateProjectionManagerOptions,
} from '../../types.js';
import { useProjectionManager } from '../hooks/useProjectionManager.js';

// =============================================================================
// Context
// =============================================================================

const ProjectionContext = createContext<ProjectionManager | null>(null);

// =============================================================================
// Provider
// =============================================================================

/**
 * Props for ProjectionProvider.
 */
export interface ProjectionProviderProps<TData = unknown, TState = unknown> {
  /** DomainRuntime instance */
  runtime: DomainRuntime<TData, TState>;

  /** Domain definition (for extracting paths/actions) */
  domain?: ManifestoDomain<TData, TState>;

  /** Optional projection configuration */
  options?: Omit<CreateProjectionManagerOptions<TData, TState>, 'runtime'>;

  /** Child components */
  children: ReactNode;
}

/**
 * Provider for ProjectionManager context.
 *
 * @example
 * ```tsx
 * function App() {
 *   const runtime = createRuntime({ domain, initialData });
 *
 *   return (
 *     <ProjectionProvider runtime={runtime} domain={domain}>
 *       <Form />
 *     </ProjectionProvider>
 *   );
 * }
 * ```
 */
export function ProjectionProvider<TData = unknown, TState = unknown>({
  runtime,
  domain,
  options,
  children,
}: ProjectionProviderProps<TData, TState>): ReactElement {
  const manager = useProjectionManager(runtime, { ...options, domain });

  return (
    <ProjectionContext.Provider value={manager}>
      {children}
    </ProjectionContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Use ProjectionManager from context.
 *
 * @returns ProjectionManager instance
 * @throws Error if used outside ProjectionProvider
 *
 * @example
 * ```tsx
 * function SubmitButton() {
 *   const manager = useProjection();
 *   const { isAvailable, execute } = useAction(manager, 'action.submit');
 *
 *   return (
 *     <button disabled={!isAvailable} onClick={execute}>
 *       Submit
 *     </button>
 *   );
 * }
 * ```
 */
export function useProjection<
  TData = unknown,
  TState = unknown
>(): ProjectionManager<TData, TState> {
  const manager = useContext(ProjectionContext);
  if (!manager) {
    throw new Error('useProjection must be used within a ProjectionProvider');
  }
  return manager as ProjectionManager<TData, TState>;
}

// =============================================================================
// Optional Hook
// =============================================================================

/**
 * Use ProjectionManager from context, returning undefined if not available.
 *
 * Use this when the component may be rendered outside a ProjectionProvider.
 *
 * @returns ProjectionManager instance or undefined
 */
export function useProjectionOptional<
  TData = unknown,
  TState = unknown
>(): ProjectionManager<TData, TState> | undefined {
  const manager = useContext(ProjectionContext);
  return manager as ProjectionManager<TData, TState> | undefined;
}
