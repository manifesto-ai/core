import type { Patch } from "@manifesto-ai/core";
import type { Settled, Fulfilled } from "../types/index.js";
/**
 * Extract errors from Settled results into a patch
 *
 * @example
 * ```ts
 * const results = {
 *   ais: { status: 'fulfilled', value: aisData },
 *   tos: { status: 'rejected', reason: new Error('Timeout') },
 *   weather: { status: 'rejected', reason: new Error('Not found') },
 * };
 *
 * collectErrors(results, 'signals.errors');
 * // → [{
 * //   op: 'set',
 * //   path: 'signals.errors',
 * //   value: {
 * //     tos: { $error: true, code: 'Error', message: 'Timeout', ... },
 * //     weather: { $error: true, code: 'Error', message: 'Not found', ... }
 * //   }
 * // }]
 * ```
 */
export declare function collectErrors<T extends Record<string, Settled<unknown>>>(results: T, path: string): Patch[];
/**
 * Extract fulfilled values from Settled results
 *
 * @example
 * ```ts
 * const results = {
 *   ais: { status: 'fulfilled', value: aisData },
 *   tos: { status: 'rejected', reason: new Error('Timeout') },
 *   weather: { status: 'fulfilled', value: weatherData },
 * };
 *
 * collectFulfilled(results);
 * // → { ais: aisData, weather: weatherData }
 * ```
 */
export declare function collectFulfilled<T extends Record<string, Settled<unknown>>>(results: T): {
    [K in keyof T]?: T[K] extends Fulfilled<infer V> ? V : never;
};
//# sourceMappingURL=collect.d.ts.map