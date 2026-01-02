import type { AsyncFn } from "../types/index.js";

/**
 * Fallback value type - can be static value, sync function, or async function
 */
type FallbackValue<T> =
  | T
  | ((error: Error) => T)
  | ((error: Error) => Promise<T>);

/**
 * Wraps a function with a fallback value on failure.
 *
 * @example
 * ```ts
 * // Static fallback
 * const fetchWithDefault = withFallback(
 *   () => fetch('/api/config').then(r => r.json()),
 *   { theme: 'light', language: 'en' }
 * );
 *
 * // Dynamic fallback
 * const fetchWithCache = withFallback(
 *   () => fetch('/api/data').then(r => r.json()),
 *   (error) => loadFromCache()
 * );
 * ```
 */
export function withFallback<T>(
  fn: AsyncFn<T>,
  fallback: FallbackValue<T>
): AsyncFn<T> {
  return async () => {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (typeof fallback === "function") {
        return await (fallback as (error: Error) => T | Promise<T>)(err);
      }

      return fallback;
    }
  };
}
