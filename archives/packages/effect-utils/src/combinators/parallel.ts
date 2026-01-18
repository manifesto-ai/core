import type {
  AsyncFn,
  Settled,
  Fulfilled,
  Rejected,
  ParallelOptions,
} from "../types/index.js";

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
export function parallel<T extends Record<string, AsyncFn<unknown>>>(
  fns: T,
  options?: ParallelOptions
): AsyncFn<{ [K in keyof T]: Settled<Awaited<ReturnType<T[K]>>> }> {
  return async () => {
    const entries = Object.entries(fns);

    if (options?.failFast) {
      // Use Promise.all - throws on first failure
      const results = await Promise.all(
        entries.map(async ([key, fn]) => {
          const value = await fn();
          return [key, { status: "fulfilled" as const, value }] as const;
        })
      );
      return Object.fromEntries(results) as {
        [K in keyof T]: Settled<Awaited<ReturnType<T[K]>>>;
      };
    }

    // Use Promise.allSettled semantics
    const promises = entries.map(
      async ([key, fn]): Promise<[string, Settled<unknown>]> => {
        try {
          const value = await fn();
          return [key, { status: "fulfilled", value } as Fulfilled<unknown>];
        } catch (error) {
          const reason =
            error instanceof Error ? error : new Error(String(error));
          return [key, { status: "rejected", reason } as Rejected];
        }
      }
    );

    const results = await Promise.all(promises);
    return Object.fromEntries(results) as {
      [K in keyof T]: Settled<Awaited<ReturnType<T[K]>>>;
    };
  };
}
