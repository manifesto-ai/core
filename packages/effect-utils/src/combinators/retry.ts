import type { AsyncFn, RetryOptions } from "../types/index.js";
import { RetryError } from "../errors/index.js";

/**
 * Calculate delay based on backoff strategy
 */
function calculateDelay(
  attempt: number,
  options: Required<Pick<RetryOptions, "backoff" | "baseDelay" | "maxDelay">>
): number {
  let delay: number;

  switch (options.backoff) {
    case "none":
      delay = options.baseDelay;
      break;
    case "linear":
      delay = options.baseDelay * attempt;
      break;
    case "exponential":
      delay = options.baseDelay * Math.pow(2, attempt - 1);
      break;
    default:
      delay = options.baseDelay;
  }

  return Math.min(delay, options.maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
export function withRetry<T>(fn: AsyncFn<T>, options: RetryOptions): AsyncFn<T> {
  const opts = {
    backoff: options.backoff ?? "none",
    baseDelay: options.baseDelay ?? 1000,
    maxDelay: options.maxDelay ?? 30000,
    retryIf: options.retryIf ?? (() => true),
    onRetry: options.onRetry,
  };

  return async () => {
    let lastError: Error = new Error("No attempts made");
    let attemptCount = 0;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      attemptCount++;
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we've exhausted retries
        if (attempt >= options.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!opts.retryIf(lastError, attempt + 1)) {
          break;
        }

        // Calculate delay and wait
        const delay = calculateDelay(attempt + 1, opts);

        // Call onRetry callback before waiting
        opts.onRetry?.(lastError, attempt + 1);

        await sleep(delay);
      }
    }

    throw new RetryError(attemptCount, lastError);
  };
}
