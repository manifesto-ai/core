import type { Effect } from './types.js';
import type { EvaluationContext } from '../expression/types.js';
import type { SemanticPath } from '../domain/types.js';

/**
 * Result type: Explicitly represents success or failure.
 *
 * This is a discriminated union type that forces explicit error handling.
 * Use `ok()` to create a success, `err()` to create a failure.
 *
 * @typeParam T - The success value type
 * @typeParam E - The error type (defaults to EffectError)
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return err('Division by zero');
 *   return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (isOk(result)) {
 *   console.log(result.value); // 5
 * }
 * ```
 */
export type Result<T, E = EffectError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Error type for effect execution failures.
 *
 * Contains the failed effect, cause, and optional context for debugging.
 */
export type EffectError = {
  _tag: 'EffectError';
  /** The effect that failed */
  effect: Effect;
  /** The underlying error cause */
  cause: Error;
  /** Evaluation context at the time of failure */
  context?: EvaluationContext;
  /** Error code if available */
  code?: string;
};

/**
 * Error type for EffectHandler execution failures.
 *
 * Thrown when handler methods (setValue, setState, etc.) fail.
 * Used when a handler encounters an error during effect execution.
 */
export type HandlerError = {
  _tag: 'HandlerError';
  /** Target semantic path */
  path: SemanticPath;
  /** The underlying error cause */
  cause: Error;
  /** Error code if available */
  code?: string;
};

/**
 * Error type for DAG propagation failures.
 *
 * Contains errors that occurred during value propagation in runtime.set().
 */
export type PropagationError = {
  _tag: 'PropagationError';
  /** List of errors that occurred during propagation */
  errors: Array<{
    path: SemanticPath;
    error: string;
  }>;
};

// =============================================================================
// Result Constructors
// =============================================================================

/**
 * Creates a successful Result.
 *
 * @param value - The success value
 * @returns A Result containing the success value
 *
 * @example
 * ```typescript
 * const result = ok(42);
 * // { ok: true, value: 42 }
 * ```
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Creates a failed Result.
 *
 * @param error - The error value
 * @returns A Result containing the error
 *
 * @example
 * ```typescript
 * const result = err('Something went wrong');
 * // { ok: false, error: 'Something went wrong' }
 * ```
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Creates an EffectError instance.
 *
 * @param effect - The effect that failed
 * @param cause - The underlying error
 * @param options - Optional context and error code
 * @returns An EffectError instance
 */
export function effectError(
  effect: Effect,
  cause: Error,
  options?: { context?: EvaluationContext; code?: string }
): EffectError {
  return {
    _tag: 'EffectError',
    effect,
    cause,
    context: options?.context,
    code: options?.code,
  };
}

/**
 * Creates a HandlerError instance.
 *
 * @param path - The semantic path where the error occurred
 * @param cause - The underlying error
 * @param code - Optional error code
 * @returns A HandlerError instance
 */
export function handlerError(
  path: SemanticPath,
  cause: Error,
  code?: string
): HandlerError {
  return {
    _tag: 'HandlerError',
    path,
    cause,
    code,
  };
}

/**
 * Creates a PropagationError instance.
 *
 * @param errors - List of path/error pairs that occurred during propagation
 * @returns A PropagationError instance
 */
export function propagationError(
  errors: Array<{ path: SemanticPath; error: string }>
): PropagationError {
  return {
    _tag: 'PropagationError',
    errors,
  };
}

// =============================================================================
// Result Utilities
// =============================================================================

/**
 * Type guard: checks if Result is a success.
 *
 * @param result - The result to check
 * @returns True if the result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Type guard: checks if Result is a failure.
 *
 * @param result - The result to check
 * @returns True if the result is a failure
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/**
 * Extracts the value from a Result, throwing on failure.
 *
 * @param result - The result to unwrap
 * @returns The success value
 * @throws The error if result is a failure
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Extracts the value from a Result, returning a default on failure.
 *
 * @param result - The result to unwrap
 * @param defaultValue - Value to return if result is a failure
 * @returns The success value or the default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Extracts the error from a Result, returning undefined on success.
 *
 * @param result - The result to unwrap
 * @returns The error or undefined if successful
 */
export function unwrapErr<T, E>(result: Result<T, E>): E | undefined {
  if (!result.ok) {
    return result.error;
  }
  return undefined;
}

// =============================================================================
// Result Transformations (Monadic Operations)
// =============================================================================

/**
 * Transforms the success value of a Result.
 *
 * @param result - The result to map
 * @param fn - Function to apply to the success value
 * @returns A new Result with the transformed value
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Transforms the error value of a Result.
 *
 * @param result - The result to map
 * @param fn - Function to apply to the error value
 * @returns A new Result with the transformed error
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (!result.ok) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Chains Result operations (bind/chain/flatMap).
 *
 * @param result - The result to chain from
 * @param fn - Function that returns a new Result
 * @returns The result of the chained operation
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Flattens a nested Result.
 *
 * @param result - The nested result to flatten
 * @returns A single-level Result
 */
export function flatten<T, E>(result: Result<Result<T, E>, E>): Result<T, E> {
  if (result.ok) {
    return result.value;
  }
  return result;
}

// =============================================================================
// Result Combinators
// =============================================================================

/**
 * Combines multiple Results into one (all must succeed).
 *
 * @param results - Array of Results to combine
 * @returns A Result containing an array of values, or the first error
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Returns the first successful Result.
 *
 * @param results - Array of Results to try
 * @returns The first success, or all errors if all fail
 */
export function any<T, E>(results: Result<T, E>[]): Result<T, E[]> {
  const errors: E[] = [];
  for (const result of results) {
    if (result.ok) {
      return result;
    }
    errors.push(result.error);
  }
  return err(errors);
}

/**
 * Converts a Promise to a Result.
 *
 * @param promise - The promise to convert
 * @param mapError - Optional function to transform errors
 * @returns A Result containing the resolved value or error
 */
export async function fromPromise<T>(
  promise: Promise<T>,
  mapError?: (e: unknown) => Error
): Promise<Result<T, Error>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (e) {
    const error = mapError ? mapError(e) : e instanceof Error ? e : new Error(String(e));
    return err(error);
  }
}

/**
 * Wraps a throwing function in a Result.
 *
 * @param fn - The function to execute
 * @param mapError - Optional function to transform errors
 * @returns A Result containing the return value or error
 */
export function tryCatch<T>(fn: () => T, mapError?: (e: unknown) => Error): Result<T, Error> {
  try {
    return ok(fn());
  } catch (e) {
    const error = mapError ? mapError(e) : e instanceof Error ? e : new Error(String(e));
    return err(error);
  }
}

/**
 * Converts an async throwing function to Result pattern.
 *
 * Useful for migrating EffectHandler.apiCall from throw-based to Result-based.
 * Wraps existing throw-based async functions to return Result<T, HandlerError>.
 *
 * @example
 * ```typescript
 * // 기존 throw 기반 핸들러를 Result 패턴으로 변환
 * apiCall: (req) => resultFrom(async () => {
 *   const response = await fetch(req.endpoint, { ... });
 *   if (!response.ok) throw new Error(response.statusText);
 *   return response.json();
 * })
 * ```
 */
export async function resultFrom<T>(
  fn: () => Promise<T>
): Promise<Result<T, HandlerError>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (e) {
    return err(
      handlerError(
        'apiCall' as SemanticPath,
        e instanceof Error ? e : new Error(String(e)),
        'API_CALL_THROWN'
      )
    );
  }
}

// =============================================================================
// HTTP Fetch Helpers
// =============================================================================

/**
 * HTTP error information included with fetch errors.
 */
export type HttpErrorInfo = {
  status: number;
  statusText: string;
  url: string;
  body?: unknown;
};

/**
 * Converts a fetch Response to JSON with automatic HTTP error handling.
 *
 * Automatically converts HTTP 4xx/5xx responses to HandlerError.
 * Also handles timeout and abort signals appropriately.
 *
 * @example
 * ```typescript
 * // EffectHandler에서 사용
 * apiCall: async (req) => {
 *   return resultFromFetch(
 *     fetch(req.endpoint, {
 *       method: req.method,
 *       body: JSON.stringify(req.body),
 *       headers: { 'Content-Type': 'application/json', ...req.headers },
 *       signal: req.timeout ? AbortSignal.timeout(req.timeout) : undefined,
 *     })
 *   );
 * }
 * ```
 */
export async function resultFromFetch<T = unknown>(
  fetchPromise: Promise<Response>,
  options?: {
    /** How to parse the response body (default: 'json') */
    parseAs?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'none';
    /** Whether to include error body in HTTP errors (default: true) */
    includeErrorBody?: boolean;
  }
): Promise<Result<T, HandlerError>> {
  const { parseAs = 'json', includeErrorBody = true } = options ?? {};

  try {
    const response = await fetchPromise;

    if (!response.ok) {
      // Handle HTTP 4xx/5xx errors
      let errorBody: unknown;
      if (includeErrorBody) {
        try {
          errorBody = await response.json();
        } catch {
          try {
            errorBody = await response.text();
          } catch {
            // Ignore body read failures
          }
        }
      }

      const httpInfo: HttpErrorInfo = {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        body: errorBody,
      };

      const errorCode = response.status >= 500 ? 'HTTP_SERVER_ERROR' : 'HTTP_CLIENT_ERROR';
      const error = new Error(
        `HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${JSON.stringify(errorBody)}` : ''}`
      );
      // Attach HTTP info to error object
      (error as Error & { httpInfo?: HttpErrorInfo }).httpInfo = httpInfo;

      return err(handlerError('apiCall' as SemanticPath, error, errorCode));
    }

    // Parse successful response
    let value: T;
    switch (parseAs) {
      case 'json':
        value = await response.json() as T;
        break;
      case 'text':
        value = await response.text() as unknown as T;
        break;
      case 'blob':
        value = await response.blob() as unknown as T;
        break;
      case 'arrayBuffer':
        value = await response.arrayBuffer() as unknown as T;
        break;
      case 'none':
        value = undefined as T;
        break;
    }

    return ok(value);
  } catch (e) {
    // Handle network errors, timeout, abort, etc.
    const error = e instanceof Error ? e : new Error(String(e));
    let code = 'API_CALL_FAILED';

    if (error.name === 'AbortError') {
      code = 'API_CALL_ABORTED';
    } else if (error.name === 'TimeoutError') {
      code = 'API_CALL_TIMEOUT';
    } else if (error.message?.includes('timeout')) {
      code = 'API_CALL_TIMEOUT';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      code = 'NETWORK_ERROR';
    }

    return err(handlerError('apiCall' as SemanticPath, error, code));
  }
}
