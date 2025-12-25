/**
 * useManifestoBridge - React hook for creating a Manifesto Bridge
 *
 * This hook creates and manages a Bridge instance that connects
 * React state to Manifesto Runtime.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { DomainRuntime, SemanticPath, ValidationResult } from '@manifesto-ai/core';
import { createReactAdapter, type Adapter, type ReactAdapterOptions } from './adapter.js';
import { createReactActuator, type Actuator, type ReactActuatorOptions, parsePath, setNestedValue } from './actuator.js';
import { createBridge, type Bridge, type SyncMode } from './bridge.js';

// ============================================================================
// Hook Options
// ============================================================================

export interface UseManifestoBridgeOptions {
  /** Sync mode: 'push' | 'pull' | 'bidirectional' (default: 'bidirectional') */
  syncMode?: SyncMode;
  /** Enable auto-sync on changes (default: true) */
  autoSync?: boolean;
  /** Debounce delay in ms for push operations (default: 0) */
  debounceMs?: number;
  /** Optional focus handler */
  onFocus?: (path: SemanticPath) => void;
  /** Optional navigation handler */
  onNavigate?: (to: string, mode?: 'push' | 'replace') => void;
  /** Optional API call handler */
  onApiCall?: (request: { method: string; url: string; body?: unknown }) => Promise<unknown>;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * useManifestoBridge - Creates a Bridge connecting React state to Manifesto Runtime
 *
 * This hook manages its own internal state that syncs with the runtime,
 * following the adapter/actuator pattern used by other bridge packages.
 *
 * @param runtime - The Manifesto domain runtime
 * @param options - Bridge configuration options
 * @returns The Bridge instance
 *
 * @example
 * ```tsx
 * function App() {
 *   const bridge = useManifestoBridge(runtime, {
 *     syncMode: 'bidirectional',
 *     autoSync: true,
 *   });
 *
 *   return (
 *     <BridgeProvider bridge={bridge}>
 *       <MyComponent />
 *     </BridgeProvider>
 *   );
 * }
 * ```
 */
export function useManifestoBridge<TData = unknown, TState = unknown>(
  runtime: DomainRuntime<TData, TState>,
  options: UseManifestoBridgeOptions = {}
): Bridge<TData, TState> {
  const {
    syncMode = 'bidirectional',
    autoSync = true,
    debounceMs = 0,
    onFocus,
    onNavigate,
    onApiCall,
  } = options;

  // Internal state that mirrors the runtime
  const [data, setData] = useState<TData>(() => runtime.getSnapshot().data);
  const [state, setState] = useState<TState>(() => runtime.getSnapshot().state);

  // Ref for bridge to avoid recreating on every render
  const bridgeRef = useRef<Bridge<TData, TState> | null>(null);

  // Listeners for adapter subscription
  const listenersRef = useRef<Set<() => void>>(new Set());

  // Notify all adapter listeners
  const notifyListeners = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  // Create stable setData/setState handlers that update nested paths
  const handleSetData = useCallback((path: SemanticPath, value: unknown) => {
    setData((prev) => {
      const next = structuredClone(prev) as Record<string, unknown>;
      const segments = parsePath(path);
      // Skip 'data' prefix
      const pathSegments = segments[0] === 'data' ? segments.slice(1) : segments;
      setNestedValue(next, pathSegments, value);
      return next as TData;
    });
    notifyListeners();
  }, [notifyListeners]);

  const handleSetState = useCallback((path: SemanticPath, value: unknown) => {
    setState((prev) => {
      const next = structuredClone(prev) as Record<string, unknown>;
      const segments = parsePath(path);
      // Skip 'state' prefix
      const pathSegments = segments[0] === 'state' ? segments.slice(1) : segments;
      setNestedValue(next, pathSegments, value);
      return next as TState;
    });
    notifyListeners();
  }, [notifyListeners]);

  // Create adapter (memoized)
  const adapter = useMemo<Adapter<TData, TState>>(() => {
    return createReactAdapter({
      getData: () => data,
      getState: () => state,
      onSubscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
    });
  }, [data, state]);

  // Create actuator (memoized)
  const actuator = useMemo<Actuator<TData, TState>>(() => {
    return createReactActuator({
      setData: handleSetData,
      setState: handleSetState,
      onFocus,
      onNavigate,
      onApiCall,
    });
  }, [handleSetData, handleSetState, onFocus, onNavigate, onApiCall]);

  // Create bridge (memoized, but recreate if config changes)
  const bridge = useMemo(() => {
    // Dispose previous bridge if exists
    if (bridgeRef.current) {
      bridgeRef.current.dispose();
    }

    const newBridge = createBridge({
      runtime,
      adapter,
      actuator,
      syncMode,
      autoSync,
      debounceMs,
    });

    bridgeRef.current = newBridge;
    return newBridge;
  }, [runtime, adapter, actuator, syncMode, autoSync, debounceMs]);

  // Sync internal state with runtime on mount and when runtime changes
  useEffect(() => {
    const snapshot = runtime.getSnapshot();
    setData(snapshot.data);
    setState(snapshot.state);

    // Subscribe to runtime changes to keep internal state in sync
    const unsubscribe = runtime.subscribe(() => {
      const newSnapshot = runtime.getSnapshot();
      setData(newSnapshot.data);
      setState(newSnapshot.state);
    });

    return unsubscribe;
  }, [runtime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bridgeRef.current) {
        bridgeRef.current.dispose();
        bridgeRef.current = null;
      }
    };
  }, []);

  return bridge;
}

// ============================================================================
// Simplified Hook for Direct Runtime Usage
// ============================================================================

/**
 * useSimpleBridge - A simpler hook that directly uses the runtime
 *
 * Use this when you don't need the adapter/actuator pattern and
 * just want to connect React components to the runtime.
 *
 * @param runtime - The Manifesto domain runtime
 * @returns The Bridge instance with direct runtime access
 */
export function useSimpleBridge<TData = unknown, TState = unknown>(
  runtime: DomainRuntime<TData, TState>
): Bridge<TData, TState> {
  return useManifestoBridge(runtime, {
    syncMode: 'bidirectional',
    autoSync: true,
    debounceMs: 0,
  });
}
