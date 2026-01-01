/**
 * Options for withTimeout combinator
 */
export type TimeoutOptions = {
  /** Custom error message */
  message?: string;
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
};

/**
 * Options for withRetry combinator
 */
export type RetryOptions = {
  /** Maximum retry attempts (not including initial) */
  maxRetries: number;
  /** Backoff strategy */
  backoff?: "none" | "linear" | "exponential";
  /** Base delay in ms (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number;
  /** Predicate to determine if error is retryable */
  retryIf?: (error: Error, attempt: number) => boolean;
  /** Callback on each retry */
  onRetry?: (error: Error, attempt: number) => void;
};

/**
 * Options for parallel combinator
 */
export type ParallelOptions = {
  /** Stop on first failure (default: false) */
  failFast?: boolean;
};

/**
 * Options for race combinator
 */
export type RaceOptions = {
  /** Minimum successes required (default: 1) */
  minSuccesses?: number;
};

/**
 * Options for sequential combinator
 */
export type SequentialOptions = {
  /** Stop on first failure (default: false) */
  stopOnError?: boolean;
};
