import type { AsyncFn, TimeoutOptions } from "../types/index.js";
import { TimeoutError } from "../errors/index.js";

/**
 * Wraps a function with a timeout. Returns TimeoutError if deadline exceeded.
 *
 * @example
 * ```ts
 * const fetchWithTimeout = withTimeout(
 *   () => fetch('/api/data').then(r => r.json()),
 *   5000
 * );
 *
 * try {
 *   const data = await fetchWithTimeout();
 * } catch (e) {
 *   if (e instanceof TimeoutError) {
 *     console.log('Request timed out');
 *   }
 * }
 * ```
 */
export function withTimeout<T>(
  fn: AsyncFn<T>,
  ms: number,
  options?: TimeoutOptions
): AsyncFn<T> {
  return async () => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let abortHandler: (() => void) | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new TimeoutError(ms, options?.message));
      }, ms);
    });

    // Handle AbortSignal if provided
    if (options?.signal) {
      abortHandler = () => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      };
      options.signal.addEventListener("abort", abortHandler, { once: true });
    }

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      if (abortHandler && options?.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
    }
  };
}
