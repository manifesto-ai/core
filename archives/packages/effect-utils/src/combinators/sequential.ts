import type { AsyncFn, Settled, SequentialOptions } from "../types/index.js";

/**
 * Executes functions in order, optionally stopping on failure.
 *
 * @example
 * ```ts
 * const pipeline = sequential([
 *   () => validateInput(data),
 *   () => transformData(data),
 *   () => saveToDatabase(data),
 * ], { stopOnError: true });
 *
 * const results = await pipeline();
 * ```
 */
export function sequential<T extends AsyncFn<unknown>[]>(
  fns: T,
  options?: SequentialOptions
): AsyncFn<{ [K in keyof T]: Settled<Awaited<ReturnType<T[K]>>> }> {
  return async () => {
    const results: Settled<unknown>[] = [];

    for (const fn of fns) {
      try {
        const value = await fn();
        results.push({ status: "fulfilled", value });
      } catch (error) {
        const reason =
          error instanceof Error ? error : new Error(String(error));
        results.push({ status: "rejected", reason });

        if (options?.stopOnError) {
          break;
        }
      }
    }

    return results as { [K in keyof T]: Settled<Awaited<ReturnType<T[K]>>> };
  };
}
