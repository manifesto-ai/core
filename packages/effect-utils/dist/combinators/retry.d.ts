import type { AsyncFn, RetryOptions } from "../types/index.js";
/**
 * Wraps a function with retry logic.
 *
 * @example
 * ```ts
 * const resilientFetch = withRetry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   {
 *     maxRetries: 3,
 *     backoff: 'exponential',
 *     baseDelay: 1000,
 *     retryIf: (error) => {
 *       return error.name === 'TypeError' || error.message.includes('network');
 *     },
 *     onRetry: (error, attempt) => {
 *       console.log(`Retry ${attempt}: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export declare function withRetry<T>(fn: AsyncFn<T>, options: RetryOptions): AsyncFn<T>;
//# sourceMappingURL=retry.d.ts.map