/**
 * @manifesto-ai/bridge-zustand
 *
 * Zustand integration for Manifesto AI Bridge.
 *
 * @example
 * ```typescript
 * import { create } from 'zustand';
 * import { createRuntime } from '@manifesto-ai/core';
 * import { createBridge } from '@manifesto-ai/bridge';
 * import {
 *   createZustandAdapter,
 *   createZustandActuator,
 * } from '@manifesto-ai/bridge-zustand';
 *
 * interface FormStore {
 *   name: string;
 *   age: number;
 *   setName: (name: string) => void;
 *   setAge: (age: number) => void;
 * }
 *
 * const useStore = create<FormStore>((set) => ({
 *   name: '',
 *   age: 0,
 *   setName: (name) => set({ name }),
 *   setAge: (age) => set({ age }),
 * }));
 *
 * const adapter = createZustandAdapter(useStore, {
 *   dataSelector: (state) => ({ name: state.name, age: state.age }),
 * });
 *
 * const actuator = createZustandActuator(useStore, {
 *   setData: (path, value, store) => {
 *     const field = path.replace('data.', '');
 *     store.setState({ [field]: value });
 *   },
 * });
 *
 * const bridge = createBridge({ runtime, adapter, actuator });
 * ```
 */

import type { StoreApi, UseBoundStore } from 'zustand';
import type { SemanticPath, ValidationResult } from '@manifesto-ai/core';
import type { Adapter, Actuator, ApiRequest } from '@manifesto-ai/bridge';
import { flattenObject } from '@manifesto-ai/bridge';

// =============================================================================
// Types
// =============================================================================

/**
 * Zustand store with any state shape.
 */
export type ZustandStore<TState> = UseBoundStore<StoreApi<TState>> | StoreApi<TState>;

/**
 * Options for creating a Zustand Adapter.
 */
export interface ZustandAdapterOptions<TStore, TData, TState> {
  /**
   * Selector to extract data from store state.
   * Maps Zustand state to Manifesto data namespace.
   */
  dataSelector: (state: TStore) => TData;

  /**
   * Selector to extract state from store state (optional).
   * Maps Zustand state to Manifesto state namespace.
   */
  stateSelector?: (state: TStore) => TState;

  /**
   * Optional validity map for paths.
   */
  validity?: Map<SemanticPath, ValidationResult>;
}

/**
 * Options for creating a Zustand Actuator.
 */
export interface ZustandActuatorOptions<TStore, TData, TState> {
  /**
   * Handler to set data value in store.
   * Called with path, value, and the store for direct state updates.
   */
  setData: (path: SemanticPath, value: unknown, store: StoreApi<TStore>) => void;

  /**
   * Handler to set state value in store (optional).
   */
  setState?: (path: SemanticPath, value: unknown, store: StoreApi<TStore>) => void;

  /**
   * Handler for focus (optional).
   */
  onFocus?: (path: SemanticPath) => void;

  /**
   * Handler for navigation (optional).
   */
  onNavigate?: (to: string, mode?: 'push' | 'replace') => void;

  /**
   * Handler for API calls (optional).
   */
  onApiCall?: (request: ApiRequest) => Promise<unknown>;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get the store API from a Zustand store (handles both bound and unbound stores).
 */
function getStoreApi<TStore>(store: ZustandStore<TStore>): StoreApi<TStore> {
  // UseBoundStore extends StoreApi, so we can use it directly
  return store as StoreApi<TStore>;
}

/**
 * Get a nested value from an object by path segments.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const segments = path.split('.');
  let current = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

// =============================================================================
// Zustand Adapter
// =============================================================================

/**
 * Create an Adapter that reads from a Zustand store.
 *
 * @param store - The Zustand store (from `create()`)
 * @param options - Configuration options
 * @returns Adapter that reads from the store
 *
 * @example
 * ```typescript
 * const adapter = createZustandAdapter(useStore, {
 *   dataSelector: (state) => ({ name: state.name, age: state.age }),
 *   stateSelector: (state) => ({ loading: state.loading }),
 * });
 * ```
 */
export function createZustandAdapter<TStore, TData = unknown, TState = unknown>(
  store: ZustandStore<TStore>,
  options: ZustandAdapterOptions<TStore, TData, TState>
): Adapter<TData, TState> {
  const { dataSelector, stateSelector, validity } = options;
  const api = getStoreApi(store);
  const listeners = new Set<(paths: SemanticPath[]) => void>();

  return {
    getData(path: SemanticPath): unknown {
      const state = api.getState();
      const data = dataSelector(state);

      // Remove "data." prefix
      const fieldPath = path.startsWith('data.') ? path.slice(5) : path;
      return getNestedValue(data, fieldPath);
    },

    getState(path: SemanticPath): unknown {
      if (!stateSelector) return undefined;

      const storeState = api.getState();
      const state = stateSelector(storeState);

      // Remove "state." prefix
      const fieldPath = path.startsWith('state.') ? path.slice(6) : path;
      return getNestedValue(state, fieldPath);
    },

    getValidity(path: SemanticPath): ValidationResult | undefined {
      return validity?.get(path);
    },

    subscribe(listener: (paths: SemanticPath[]) => void): () => void {
      listeners.add(listener);

      // Subscribe to Zustand store changes
      let prevData = dataSelector(api.getState());
      let prevState = stateSelector ? stateSelector(api.getState()) : undefined;

      const unsubscribe = api.subscribe((storeState) => {
        const newData = dataSelector(storeState);
        const newState = stateSelector ? stateSelector(storeState) : undefined;

        // Detect changed paths
        const changedPaths: SemanticPath[] = [];

        // Compare data
        if (newData && typeof newData === 'object' && prevData && typeof prevData === 'object') {
          for (const key of Object.keys(newData as object)) {
            const oldVal = (prevData as Record<string, unknown>)[key];
            const newVal = (newData as Record<string, unknown>)[key];
            if (oldVal !== newVal) {
              changedPaths.push(`data.${key}`);
            }
          }
        }

        // Compare state
        if (
          newState &&
          typeof newState === 'object' &&
          prevState &&
          typeof prevState === 'object'
        ) {
          for (const key of Object.keys(newState as object)) {
            const oldVal = (prevState as Record<string, unknown>)[key];
            const newVal = (newState as Record<string, unknown>)[key];
            if (oldVal !== newVal) {
              changedPaths.push(`state.${key}`);
            }
          }
        }

        prevData = newData;
        prevState = newState;

        if (changedPaths.length > 0) {
          for (const l of listeners) {
            l(changedPaths);
          }
        }
      });

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribe();
        }
      };
    },

    captureData(): Record<SemanticPath, unknown> {
      const state = api.getState();
      const data = dataSelector(state);
      return flattenObject(data, 'data');
    },

    captureState(): Record<SemanticPath, unknown> {
      if (!stateSelector) return {};

      const storeState = api.getState();
      const state = stateSelector(storeState);
      return flattenObject(state, 'state');
    },
  };
}

// =============================================================================
// Zustand Actuator
// =============================================================================

/**
 * Create an Actuator that writes to a Zustand store.
 *
 * @param store - The Zustand store (from `create()`)
 * @param options - Configuration options
 * @returns Actuator that writes to the store
 *
 * @example
 * ```typescript
 * const actuator = createZustandActuator(useStore, {
 *   setData: (path, value, store) => {
 *     const field = path.replace('data.', '');
 *     store.setState({ [field]: value });
 *   },
 * });
 * ```
 */
export function createZustandActuator<TStore, TData = unknown, TState = unknown>(
  store: ZustandStore<TStore>,
  options: ZustandActuatorOptions<TStore, TData, TState>
): Actuator<TData, TState> {
  const { setData, setState, onFocus, onNavigate, onApiCall } = options;
  const api = getStoreApi(store);

  return {
    setData(path: SemanticPath, value: unknown): void {
      setData(path, value, api);
    },

    setState(path: SemanticPath, value: unknown): void {
      if (setState) {
        setState(path, value, api);
      }
    },

    setManyData(updates: Record<SemanticPath, unknown>): void {
      for (const [path, value] of Object.entries(updates)) {
        setData(path, value, api);
      }
    },

    setManyState(updates: Record<SemanticPath, unknown>): void {
      if (setState) {
        for (const [path, value] of Object.entries(updates)) {
          setState(path, value, api);
        }
      }
    },

    focus(path: SemanticPath): void {
      onFocus?.(path);
    },

    navigate(to: string, mode?: 'push' | 'replace'): void {
      onNavigate?.(to, mode);
    },

    apiCall(request: ApiRequest): Promise<unknown> {
      if (onApiCall) {
        return onApiCall(request);
      }
      return Promise.reject(new Error('API call handler not configured'));
    },
  };
}

// =============================================================================
// Convenience: Create Both Adapter and Actuator
// =============================================================================

/**
 * Options for creating a complete Zustand Bridge setup.
 */
export interface ZustandBridgeSetupOptions<TStore, TData, TState> {
  /**
   * Selector to extract data from store state.
   */
  dataSelector: (state: TStore) => TData;

  /**
   * Selector to extract state from store state (optional).
   */
  stateSelector?: (state: TStore) => TState;

  /**
   * Handler to set data value in store.
   */
  setData: (path: SemanticPath, value: unknown, store: StoreApi<TStore>) => void;

  /**
   * Handler to set state value in store (optional).
   */
  setState?: (path: SemanticPath, value: unknown, store: StoreApi<TStore>) => void;

  /**
   * Handler for focus (optional).
   */
  onFocus?: (path: SemanticPath) => void;

  /**
   * Handler for navigation (optional).
   */
  onNavigate?: (to: string, mode?: 'push' | 'replace') => void;

  /**
   * Handler for API calls (optional).
   */
  onApiCall?: (request: ApiRequest) => Promise<unknown>;
}

/**
 * Result of createZustandBridgeSetup.
 */
export interface ZustandBridgeSetup<TData, TState> {
  adapter: Adapter<TData, TState>;
  actuator: Actuator<TData, TState>;
}

/**
 * Create a complete Zustand Bridge setup with adapter and actuator.
 *
 * @param store - The Zustand store
 * @param options - Configuration options
 * @returns Object containing adapter and actuator
 */
export function createZustandBridgeSetup<TStore, TData, TState>(
  store: ZustandStore<TStore>,
  options: ZustandBridgeSetupOptions<TStore, TData, TState>
): ZustandBridgeSetup<TData, TState> {
  const adapter = createZustandAdapter(store, {
    dataSelector: options.dataSelector,
    stateSelector: options.stateSelector,
  });

  const actuator = createZustandActuator(store, {
    setData: options.setData,
    setState: options.setState,
    onFocus: options.onFocus,
    onNavigate: options.onNavigate,
    onApiCall: options.onApiCall,
  });

  return { adapter, actuator };
}

// =============================================================================
// Re-exports
// =============================================================================

export type { Adapter, Actuator, Bridge, Command, BridgeError } from '@manifesto-ai/bridge';
export { createBridge, setValue, setMany, executeAction } from '@manifesto-ai/bridge';
