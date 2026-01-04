import type { AsyncFn, RaceOptions } from "../types/index.js";
/**
 * Executes multiple functions concurrently, returning first success.
 *
 * @example
 * ```ts
 * const fetchFromFastest = race([
 *   () => fetch('https://api1.example.com/data').then(r => r.json()),
 *   () => fetch('https://api2.example.com/data').then(r => r.json()),
 *   () => fetch('https://api3.example.com/data').then(r => r.json()),
 * ]);
 *
 * const data = await fetchFromFastest();
 * ```
 */
export declare function race<T>(fns: AsyncFn<T>[], options?: RaceOptions): AsyncFn<T>;
//# sourceMappingURL=race.d.ts.map