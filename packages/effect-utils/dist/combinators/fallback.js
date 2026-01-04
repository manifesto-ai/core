/**
 * Wraps a function with a fallback value on failure.
 *
 * @example
 * ```ts
 * // Static fallback
 * const fetchWithDefault = withFallback(
 *   () => fetch('/api/config').then(r => r.json()),
 *   { theme: 'light', language: 'en' }
 * );
 *
 * // Dynamic fallback
 * const fetchWithCache = withFallback(
 *   () => fetch('/api/data').then(r => r.json()),
 *   (error) => loadFromCache()
 * );
 * ```
 */
export function withFallback(fn, fallback) {
    return async () => {
        try {
            return await fn();
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            if (typeof fallback === "function") {
                return await fallback(err);
            }
            return fallback;
        }
    };
}
//# sourceMappingURL=fallback.js.map