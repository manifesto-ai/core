import type { AsyncFn, Settled, ParallelOptions } from "../types/index.js";
/**
 * Executes multiple functions concurrently, returning all results.
 *
 * @example
 * ```ts
 * const fetchAll = parallel({
 *   users: () => fetch('/api/users').then(r => r.json()),
 *   posts: () => fetch('/api/posts').then(r => r.json()),
 *   config: () => fetch('/api/config').then(r => r.json()),
 * });
 *
 * const results = await fetchAll();
 *
 * if (results.users.status === 'fulfilled') {
 *   console.log('Users:', results.users.value);
 * }
 *
 * if (results.posts.status === 'rejected') {
 *   console.log('Posts failed:', results.posts.reason);
 * }
 * ```
 */
export declare function parallel<T extends Record<string, AsyncFn<unknown>>>(fns: T, options?: ParallelOptions): AsyncFn<{
    [K in keyof T]: Settled<Awaited<ReturnType<T[K]>>>;
}>;
//# sourceMappingURL=parallel.d.ts.map