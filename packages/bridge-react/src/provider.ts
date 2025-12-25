/**
 * BridgeProvider - React Context for Manifesto Bridge
 *
 * Provides Bridge context to child components, following
 * the pattern used by other bridge packages.
 */

import {
  createContext,
  useContext,
  createElement,
  type ReactNode,
} from 'react';
import type { DomainRuntime, ManifestoDomain } from '@manifesto-ai/core';
import type { Bridge } from './bridge.js';

// ============================================================================
// Context Types
// ============================================================================

export interface BridgeContextValue<TData = unknown, TState = unknown> {
  bridge: Bridge<TData, TState>;
  runtime: DomainRuntime<TData, TState>;
  domain: ManifestoDomain<TData, TState>;
}

// ============================================================================
// Contexts
// ============================================================================

const BridgeContext = createContext<BridgeContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

export interface BridgeProviderProps<TData = unknown, TState = unknown> {
  /** The Bridge instance */
  bridge: Bridge<TData, TState>;
  /** The domain definition */
  domain: ManifestoDomain<TData, TState>;
  /** Children */
  children: ReactNode;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * BridgeProvider - Provides Bridge context to children
 *
 * @example
 * ```tsx
 * function App() {
 *   const bridge = useManifestoBridge(runtime);
 *
 *   return (
 *     <BridgeProvider bridge={bridge} domain={domain}>
 *       <MyComponent />
 *     </BridgeProvider>
 *   );
 * }
 * ```
 */
export function BridgeProvider<TData = unknown, TState = unknown>({
  bridge,
  domain,
  children,
}: BridgeProviderProps<TData, TState>): ReactNode {
  // Dev mode mismatch detection
  if (process.env.NODE_ENV !== 'production') {
    const runtimeDomainId = bridge.runtime.getDomainId();
    if (runtimeDomainId !== domain.id) {
      console.warn(
        `[manifesto] BridgeProvider domain/runtime mismatch detected!\n` +
          `  - bridge.runtime.getDomainId(): "${runtimeDomainId}"\n` +
          `  - domain.id: "${domain.id}"\n` +
          `This may cause unexpected behavior.`
      );
    }
  }

  const value: BridgeContextValue<TData, TState> = {
    bridge,
    runtime: bridge.runtime,
    domain,
  };

  return createElement(
    BridgeContext.Provider,
    { value: value as BridgeContextValue },
    children
  );
}

// ============================================================================
// Context Hooks
// ============================================================================

/**
 * useBridgeContext - Access the Bridge context
 *
 * @throws Error if used outside BridgeProvider
 */
export function useBridgeContext<
  TData = unknown,
  TState = unknown,
>(): BridgeContextValue<TData, TState> {
  const context = useContext(BridgeContext);
  if (!context) {
    throw new Error('useBridgeContext must be used within a BridgeProvider');
  }
  return context as BridgeContextValue<TData, TState>;
}

/**
 * useBridge - Convenience hook to get the Bridge directly
 */
export function useBridge<TData = unknown, TState = unknown>(): Bridge<TData, TState> {
  return useBridgeContext<TData, TState>().bridge;
}

/**
 * useBridgeRuntime - Get the runtime from Bridge context
 */
export function useBridgeRuntime<TData = unknown, TState = unknown>(): DomainRuntime<TData, TState> {
  return useBridgeContext<TData, TState>().runtime;
}

/**
 * useBridgeDomain - Get the domain from Bridge context
 */
export function useBridgeDomain<TData = unknown, TState = unknown>(): ManifestoDomain<TData, TState> {
  return useBridgeContext<TData, TState>().domain;
}
