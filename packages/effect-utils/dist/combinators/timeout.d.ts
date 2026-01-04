import type { AsyncFn, TimeoutOptions } from "../types/index.js";
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
export declare function withTimeout<T>(fn: AsyncFn<T>, ms: number, options?: TimeoutOptions): AsyncFn<T>;
//# sourceMappingURL=timeout.d.ts.map