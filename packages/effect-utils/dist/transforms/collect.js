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
export function collectErrors(results, path) {
    const errors = {};
    for (const [key, result] of Object.entries(results)) {
        if (result.status === "rejected") {
            const reason = result.reason;
            errors[key] = {
                $error: true,
                code: reason.name,
                message: reason.message,
                stack: reason.stack,
                timestamp: Date.now(),
            };
        }
    }
    if (Object.keys(errors).length === 0) {
        return [];
    }
    return [{ op: "set", path, value: errors }];
}
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
export function collectFulfilled(results) {
    const fulfilled = {};
    for (const [key, result] of Object.entries(results)) {
        if (result.status === "fulfilled") {
            fulfilled[key] = result.value;
        }
    }
    return fulfilled;
}
//# sourceMappingURL=collect.js.map