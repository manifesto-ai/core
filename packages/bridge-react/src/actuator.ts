/**
 * React Actuator for Manifesto Bridge
 *
 * Creates an actuator that writes to React state setters
 * following the Manifesto Bridge pattern.
 */

import type { SemanticPath } from '@manifesto-ai/core';

/**
 * API Request type for external calls
 */
export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * Actuator interface (matches @manifesto-ai/bridge)
 */
export interface Actuator<TData = unknown, TState = unknown> {
  setData(path: SemanticPath, value: unknown): void;
  setState(path: SemanticPath, value: unknown): void;
  setManyData?(updates: Record<SemanticPath, unknown>): void;
  setManyState?(updates: Record<SemanticPath, unknown>): void;
  focus?(path: SemanticPath): void;
  navigate?(to: string, mode?: 'push' | 'replace'): void;
  apiCall?(request: ApiRequest): Promise<unknown>;
}

/**
 * React actuator options
 */
export interface ReactActuatorOptions<TData, TState> {
  /** Function to update data */
  setData: (path: SemanticPath, value: unknown) => void;
  /** Function to update state */
  setState?: (path: SemanticPath, value: unknown) => void;
  /** Optional handler for focus events */
  onFocus?: (path: SemanticPath) => void;
  /** Optional handler for navigation */
  onNavigate?: (to: string, mode?: 'push' | 'replace') => void;
  /** Optional handler for API calls */
  onApiCall?: (request: ApiRequest) => Promise<unknown>;
}

/**
 * Parse a semantic path into segments
 */
function parsePath(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((s) => s.length > 0);
}

/**
 * Set nested value in object by path segments
 * Creates intermediate objects/arrays as needed
 */
function setNestedValue(
  obj: unknown,
  segments: string[],
  value: unknown
): void {
  if (!obj || typeof obj !== 'object') return;
  if (segments.length === 0) return;

  let current = obj as Record<string, unknown>;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;
    const nextSegment = segments[i + 1]!;
    const isNextArray = /^\d+$/.test(nextSegment);

    if (current[segment] === undefined || current[segment] === null) {
      current[segment] = isNextArray ? [] : {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  const lastSegment = segments[segments.length - 1]!;
  current[lastSegment] = value;
}

/**
 * Creates a React actuator for Manifesto Bridge
 *
 * @example
 * ```tsx
 * const [data, setData] = useState({ user: { name: '' } });
 *
 * const actuator = createReactActuator({
 *   setData: (path, value) => {
 *     setData(prev => {
 *       const next = { ...prev };
 *       // Update nested path
 *       return next;
 *     });
 *   },
 * });
 * ```
 */
export function createReactActuator<TData = unknown, TState = unknown>(
  options: ReactActuatorOptions<TData, TState>
): Actuator<TData, TState> {
  const { setData, setState, onFocus, onNavigate, onApiCall } = options;

  return {
    setData(path: SemanticPath, value: unknown): void {
      setData(path, value);
    },

    setState(path: SemanticPath, value: unknown): void {
      if (setState) {
        setState(path, value);
      }
    },

    setManyData(updates: Record<SemanticPath, unknown>): void {
      for (const [path, value] of Object.entries(updates)) {
        setData(path, value);
      }
    },

    setManyState(updates: Record<SemanticPath, unknown>): void {
      if (setState) {
        for (const [path, value] of Object.entries(updates)) {
          setState(path, value);
        }
      }
    },

    focus(path: SemanticPath): void {
      if (onFocus) {
        onFocus(path);
      }
    },

    navigate(to: string, mode?: 'push' | 'replace'): void {
      if (onNavigate) {
        onNavigate(to, mode);
      }
    },

    async apiCall(request: ApiRequest): Promise<unknown> {
      if (onApiCall) {
        return onApiCall(request);
      }
      throw new Error('API call handler not configured');
    },
  };
}

// Export utility functions for use in actuator implementations
export { parsePath, setNestedValue };
