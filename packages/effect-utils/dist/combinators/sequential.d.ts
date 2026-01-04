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
export declare function sequential<T extends AsyncFn<unknown>[]>(fns: T, options?: SequentialOptions): AsyncFn<{
    [K in keyof T]: Settled<Awaited<ReturnType<T[K]>>>;
}>;
//# sourceMappingURL=sequential.d.ts.map