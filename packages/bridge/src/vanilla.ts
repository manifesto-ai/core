/**
 * Vanilla Bridge Implementation
 *
 * A reference implementation that works with plain JavaScript objects.
 * No external dependencies - pure TypeScript.
 */

import type { SemanticPath, ValidationResult } from '@manifesto-ai/core';
import type { Adapter, Actuator, ApiRequest } from './types.js';

// =============================================================================
// Store Type
// =============================================================================

/**
 * Simple store structure for Vanilla Bridge.
 */
export interface VanillaStore<TData = unknown, TState = unknown> {
  data: TData;
  state: TState;
}

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Parse a path string into segments.
 * Handles dot notation and bracket notation.
 *
 * Examples:
 * - "data.name" → ["data", "name"]
 * - "data.items[0]" → ["data", "items", "0"]
 * - "data.user['name']" → ["data", "user", "name"]
 */
export function parsePath(path: string): string[] {
  if (!path) return [];

  const result: string[] = [];
  let current = '';
  let inBracket = false;
  let bracketQuote: string | null = null;

  for (let i = 0; i < path.length; i++) {
    const char = path[i]!;

    if (inBracket) {
      if (bracketQuote) {
        if (char === bracketQuote) {
          bracketQuote = null;
        } else {
          current += char;
        }
      } else if (char === ']') {
        if (current) {
          result.push(current);
          current = '';
        }
        inBracket = false;
      } else if (char === '"' || char === "'") {
        bracketQuote = char;
      } else {
        current += char;
      }
    } else {
      if (char === '.') {
        if (current) {
          result.push(current);
          current = '';
        }
      } else if (char === '[') {
        if (current) {
          result.push(current);
          current = '';
        }
        inBracket = true;
      } else {
        current += char;
      }
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

/**
 * Get a nested value from an object by path segments.
 */
export function getNestedValue(obj: unknown, segments: string[]): unknown {
  let current = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/**
 * Set a nested value in an object by path segments.
 * Creates intermediate objects as needed.
 */
export function setNestedValue(
  obj: unknown,
  segments: string[],
  value: unknown
): void {
  if (segments.length === 0) return;

  let current = obj as Record<string, unknown>;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;
    if (current[segment] === undefined || current[segment] === null) {
      // Create intermediate object or array based on next segment
      const nextSegment = segments[i + 1]!;
      current[segment] = /^\d+$/.test(nextSegment) ? [] : {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  const lastSegment = segments[segments.length - 1]!;
  current[lastSegment] = value;
}

/**
 * Get value from store by semantic path.
 */
export function getValueByPath<TData, TState>(
  store: VanillaStore<TData, TState>,
  path: SemanticPath
): unknown {
  const segments = parsePath(path);
  if (segments.length === 0) return undefined;

  const namespace = segments[0];
  const restSegments = segments.slice(1);

  if (namespace === 'data') {
    return getNestedValue(store.data, restSegments);
  } else if (namespace === 'state') {
    return getNestedValue(store.state, restSegments);
  }

  return undefined;
}

/**
 * Set value in store by semantic path.
 */
export function setValueByPath<TData, TState>(
  store: VanillaStore<TData, TState>,
  path: SemanticPath,
  value: unknown
): void {
  const segments = parsePath(path);
  if (segments.length < 2) return;

  const namespace = segments[0];
  const restSegments = segments.slice(1);

  if (namespace === 'data') {
    setNestedValue(store.data, restSegments, value);
  } else if (namespace === 'state') {
    setNestedValue(store.state, restSegments, value);
  }
}

/**
 * Flatten an object into a record with dot-notation paths.
 */
export function flattenObject(
  obj: unknown,
  prefix: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (obj === null || obj === undefined) {
    return result;
  }

  if (typeof obj !== 'object') {
    result[prefix] = obj;
    return result;
  }

  if (Array.isArray(obj)) {
    // Don't flatten arrays - store as is
    result[prefix] = obj;
    return result;
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullPath = `${prefix}.${key}`;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullPath));
    } else {
      result[fullPath] = value;
    }
  }

  return result;
}

// =============================================================================
// Vanilla Adapter
// =============================================================================

/**
 * Options for creating a Vanilla Adapter.
 */
export interface VanillaAdapterOptions<TData, TState> {
  /**
   * Store to read from.
   */
  store: VanillaStore<TData, TState>;

  /**
   * Optional validity map for paths.
   */
  validity?: Map<SemanticPath, ValidationResult>;
}

/**
 * Create a Vanilla Adapter that reads from a plain JavaScript object.
 */
export function createVanillaAdapter<TData = unknown, TState = unknown>(
  options: VanillaAdapterOptions<TData, TState>
): Adapter<TData, TState> {
  const { store, validity } = options;
  const listeners = new Set<(paths: SemanticPath[]) => void>();

  return {
    getData(path: SemanticPath): unknown {
      return getValueByPath(store, path);
    },

    getState(path: SemanticPath): unknown {
      return getValueByPath(store, path);
    },

    getValidity(path: SemanticPath): ValidationResult | undefined {
      return validity?.get(path);
    },

    subscribe(listener: (paths: SemanticPath[]) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    captureData(): Record<SemanticPath, unknown> {
      return flattenObject(store.data, 'data');
    },

    captureState(): Record<SemanticPath, unknown> {
      return flattenObject(store.state, 'state');
    },
  };
}

/**
 * Notify listeners of changes.
 * Use this when you manually modify the store.
 */
export function notifyAdapterListeners<TData, TState>(
  adapter: Adapter<TData, TState>,
  changedPaths: SemanticPath[]
): void {
  // The adapter from createVanillaAdapter stores listeners internally
  // This is a utility for external triggering
  if (adapter.subscribe) {
    // Get the internal listeners set via closure (not directly accessible)
    // For now, this is a placeholder - real notification happens via subscribe callback
  }
}

// =============================================================================
// Vanilla Actuator
// =============================================================================

/**
 * Options for creating a Vanilla Actuator.
 */
export interface VanillaActuatorOptions<TData, TState> {
  /**
   * Store to write to.
   */
  store: VanillaStore<TData, TState>;

  /**
   * Callback when a value changes (optional).
   */
  onChange?: (path: SemanticPath, value: unknown) => void;

  /**
   * Navigate handler (optional).
   */
  onNavigate?: (to: string, mode?: 'push' | 'replace') => void;

  /**
   * API call handler (optional).
   */
  onApiCall?: (request: ApiRequest) => Promise<unknown>;

  /**
   * Focus handler (optional).
   */
  onFocus?: (path: SemanticPath) => void;
}

/**
 * Create a Vanilla Actuator that writes to a plain JavaScript object.
 */
export function createVanillaActuator<TData = unknown, TState = unknown>(
  options: VanillaActuatorOptions<TData, TState>
): Actuator<TData, TState> {
  const { store, onChange, onNavigate, onApiCall, onFocus } = options;

  return {
    setData(path: SemanticPath, value: unknown): void {
      setValueByPath(store, path, value);
      onChange?.(path, value);
    },

    setState(path: SemanticPath, value: unknown): void {
      setValueByPath(store, path, value);
      onChange?.(path, value);
    },

    setManyData(updates: Record<SemanticPath, unknown>): void {
      for (const [path, value] of Object.entries(updates)) {
        setValueByPath(store, path, value);
        onChange?.(path, value);
      }
    },

    setManyState(updates: Record<SemanticPath, unknown>): void {
      for (const [path, value] of Object.entries(updates)) {
        setValueByPath(store, path, value);
        onChange?.(path, value);
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
 * Options for creating a complete Vanilla Bridge setup.
 */
export interface VanillaBridgeSetupOptions<TData, TState> {
  /**
   * Initial data values.
   */
  initialData: TData;

  /**
   * Initial state values.
   */
  initialState: TState;

  /**
   * Callback when any value changes.
   */
  onChange?: (path: SemanticPath, value: unknown) => void;

  /**
   * Navigate handler.
   */
  onNavigate?: (to: string, mode?: 'push' | 'replace') => void;

  /**
   * API call handler.
   */
  onApiCall?: (request: ApiRequest) => Promise<unknown>;

  /**
   * Focus handler.
   */
  onFocus?: (path: SemanticPath) => void;
}

/**
 * Result of createVanillaBridgeSetup.
 */
export interface VanillaBridgeSetup<TData, TState> {
  store: VanillaStore<TData, TState>;
  adapter: Adapter<TData, TState>;
  actuator: Actuator<TData, TState>;
}

/**
 * Create a complete Vanilla Bridge setup with store, adapter, and actuator.
 */
export function createVanillaBridgeSetup<TData, TState>(
  options: VanillaBridgeSetupOptions<TData, TState>
): VanillaBridgeSetup<TData, TState> {
  const store: VanillaStore<TData, TState> = {
    data: options.initialData,
    state: options.initialState,
  };

  const adapter = createVanillaAdapter({ store });

  const actuator = createVanillaActuator({
    store,
    onChange: options.onChange,
    onNavigate: options.onNavigate,
    onApiCall: options.onApiCall,
    onFocus: options.onFocus,
  });

  return { store, adapter, actuator };
}
