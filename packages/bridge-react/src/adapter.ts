/**
 * React Adapter for Manifesto Bridge
 *
 * Creates an adapter that reads from React state and provides
 * Manifesto-compatible data access.
 */

import type { SemanticPath, ValidationResult } from '@manifesto-ai/core';

/**
 * Adapter interface (matches @manifesto-ai/bridge)
 */
export interface Adapter<TData = unknown, TState = unknown> {
  getData(path: SemanticPath): unknown;
  getState(path: SemanticPath): unknown;
  getValidity?(path: SemanticPath): ValidationResult | undefined;
  subscribe?(listener: () => void): () => void;
  captureData(): Record<SemanticPath, unknown>;
  captureState(): Record<SemanticPath, unknown>;
}

/**
 * React adapter options
 */
export interface ReactAdapterOptions<TData, TState> {
  /** Function to get current data */
  getData: () => TData;
  /** Function to get current state */
  getState: () => TState;
  /** Optional validity map for validation states */
  validity?: Map<SemanticPath, ValidationResult>;
  /** Optional subscribe function for change notifications */
  onSubscribe?: (listener: () => void) => () => void;
}

/**
 * Get nested value from object by path segments
 */
function getNestedValue(obj: unknown, segments: string[]): unknown {
  let current: unknown = obj;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Parse a semantic path into segments
 * Handles both dot notation (data.user.name) and bracket notation (data.items[0])
 */
function parsePath(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((s) => s.length > 0);
}

/**
 * Get value by semantic path from data or state
 */
function getValueByPath<TData, TState>(
  getData: () => TData,
  getState: () => TState,
  path: SemanticPath
): unknown {
  const segments = parsePath(path);
  if (segments.length === 0) return undefined;

  const namespace = segments[0];
  const restSegments = segments.slice(1);

  if (namespace === 'data') {
    return getNestedValue(getData(), restSegments);
  } else if (namespace === 'state') {
    return getNestedValue(getState(), restSegments);
  }

  return undefined;
}

/**
 * Flatten object to path-value pairs
 */
function flattenObject(
  obj: unknown,
  prefix: string = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (obj === null || obj === undefined) {
    return result;
  }

  if (Array.isArray(obj)) {
    // Don't flatten arrays, store them as-is
    result[prefix] = obj;
  } else if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, newPrefix));
      } else {
        result[newPrefix] = value;
      }
    }
  } else {
    result[prefix] = obj;
  }

  return result;
}

/**
 * Creates a React adapter for Manifesto Bridge
 *
 * @example
 * ```tsx
 * const [data, setData] = useState({ user: { name: '' } });
 * const [state, setState] = useState({ loading: false });
 *
 * const adapter = createReactAdapter({
 *   getData: () => data,
 *   getState: () => state,
 * });
 * ```
 */
export function createReactAdapter<TData = unknown, TState = unknown>(
  options: ReactAdapterOptions<TData, TState>
): Adapter<TData, TState> {
  const { getData, getState, validity, onSubscribe } = options;

  return {
    getData(path: SemanticPath): unknown {
      return getValueByPath(getData, getState, path);
    },

    getState(path: SemanticPath): unknown {
      return getValueByPath(getData, getState, path);
    },

    getValidity(path: SemanticPath): ValidationResult | undefined {
      return validity?.get(path);
    },

    subscribe(listener: () => void): () => void {
      if (onSubscribe) {
        return onSubscribe(listener);
      }
      // No-op if no subscription mechanism provided
      return () => {};
    },

    captureData(): Record<SemanticPath, unknown> {
      const data = getData();
      return flattenObject(data, 'data');
    },

    captureState(): Record<SemanticPath, unknown> {
      const state = getState();
      return flattenObject(state, 'state');
    },
  };
}
