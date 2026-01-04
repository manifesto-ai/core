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
export function race(fns, options) {
    const minSuccesses = options?.minSuccesses ?? 1;
    return async () => {
        if (fns.length === 0) {
            throw new AggregateError([], "No functions provided to race");
        }
        const errors = [];
        return new Promise((resolve, reject) => {
            let successCount = 0;
            let completedCount = 0;
            let resolved = false;
            fns.forEach((fn) => {
                fn()
                    .then((value) => {
                    if (resolved)
                        return;
                    successCount++;
                    if (successCount >= minSuccesses) {
                        resolved = true;
                        resolve(value);
                    }
                })
                    .catch((error) => {
                    if (resolved)
                        return;
                    errors.push(error instanceof Error ? error : new Error(String(error)));
                    completedCount++;
                    // If all have completed with not enough successes
                    if (completedCount === fns.length &&
                        successCount < minSuccesses) {
                        reject(new AggregateError(errors, "All operations failed"));
                    }
                });
            });
        });
    };
}
//# sourceMappingURL=race.js.map