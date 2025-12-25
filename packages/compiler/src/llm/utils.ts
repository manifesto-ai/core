/**
 * LLM Utilities - Helper functions for LLM adapters
 *
 * Provides:
 * - hashPrompt: Generate deterministic hash for prompt provenance
 * - RateLimiter: Token bucket rate limiting
 * - withRetry: Exponential backoff retry wrapper
 * - parseJSON: Safe JSON parsing from LLM output
 *
 * AGENT_README Invariant #4: 모든 출력에 출처 (promptHash for provenance)
 */

import { createHash } from 'crypto';

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * Generate a deterministic hash for a prompt
 *
 * Used for provenance tracking (AGENT_README Invariant #4).
 * Allows reproducing LLM outputs given the same prompt.
 *
 * @param prompt - The prompt text
 * @param context - Optional context included in hash
 * @returns SHA-256 hash string (first 16 chars)
 */
export function hashPrompt(prompt: string, context?: Record<string, unknown>): string {
  const content = context
    ? `${prompt}\n---\n${JSON.stringify(context, Object.keys(context).sort())}`
    : prompt;

  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// ============================================================================
// Rate Limiter
// ============================================================================

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests per minute */
  requestsPerMinute: number;
  /** Maximum tokens per minute (optional) */
  tokensPerMinute?: number;
}

/**
 * Token bucket rate limiter
 *
 * Prevents hitting API rate limits by controlling request flow.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.requestsPerMinute;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = config.requestsPerMinute / 60000; // per ms
  }

  /**
   * Acquire a token for making a request
   *
   * @returns Time to wait in ms (0 if token available)
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time
    const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
    await sleep(waitTime);

    this.refill();
    this.tokens -= 1;
  }

  /**
   * Check if a token is available without consuming it
   */
  canAcquire(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  /**
   * Get current token count
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in ms */
  initialDelay?: number;
  /** Maximum delay in ms */
  maxDelay?: number;
  /** Backoff multiplier */
  multiplier?: number;
  /** Jitter factor (0-1) */
  jitter?: number;
  /** Errors that should trigger retry */
  retryableErrors?: string[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  jitter: 0.1,
  retryableErrors: [
    'rate_limit_exceeded',
    'overloaded',
    'timeout',
    'ECONNRESET',
    'ETIMEDOUT',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
};

/**
 * Error that can be retried
 */
export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly isRetryable: boolean = true
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

/**
 * Execute a function with exponential backoff retry
 *
 * @param fn - Function to execute
 * @param config - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;
  let delay = opts.initialDelay || 1000;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryable(lastError, opts.retryableErrors || [])) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Calculate delay with jitter
      const jitter = opts.jitter || 0;
      const jitterAmount = delay * jitter * (Math.random() * 2 - 1);
      const actualDelay = Math.min(delay + jitterAmount, opts.maxDelay || 30000);

      await sleep(actualDelay);

      // Increase delay for next attempt
      delay = Math.min(delay * (opts.multiplier || 2), opts.maxDelay || 30000);
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Check if an error is retryable
 */
function isRetryable(error: Error, retryableErrors: string[]): boolean {
  if (error instanceof RetryableError) {
    return error.isRetryable;
  }

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  return retryableErrors.some(
    (code) =>
      message.includes(code.toLowerCase()) ||
      name.includes(code.toLowerCase())
  );
}

// ============================================================================
// JSON Parsing
// ============================================================================

/**
 * Result of parsing JSON from LLM output
 */
export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawText?: string;
}

/**
 * Parse JSON from LLM output
 *
 * Handles various output formats:
 * - Raw JSON
 * - JSON in markdown code blocks
 * - JSON with surrounding text
 *
 * @param text - LLM output text
 * @returns Parse result with extracted JSON or error
 */
export function parseJSON<T = unknown>(text: string): ParseResult<T> {
  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      const data = JSON.parse(codeBlockMatch[1].trim()) as T;
      return { success: true, data };
    } catch {
      // Continue to try other methods
    }
  }

  // Try to find JSON array or object
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const data = JSON.parse(jsonMatch[1]) as T;
      return { success: true, data };
    } catch {
      // Continue to try raw text
    }
  }

  // Try parsing raw text as JSON
  try {
    const data = JSON.parse(text.trim()) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
      rawText: text,
    };
  }
}

/**
 * Extract array from LLM output that may contain a single object or array
 */
export function parseJSONArray<T = unknown>(text: string): ParseResult<T[]> {
  const result = parseJSON<T | T[]>(text);

  if (!result.success) {
    return { success: false, error: result.error, rawText: result.rawText };
  }

  // Wrap single object in array
  const data = Array.isArray(result.data) ? result.data : [result.data];
  return { success: true, data: data as T[] };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Estimate token count for a string (rough approximation)
 *
 * Uses ~4 characters per token as a rough estimate.
 * For accurate counts, use the actual tokenizer.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format context for LLM prompt
 */
export function formatContext(context: Record<string, unknown>): string {
  const entries = Object.entries(context).filter(([, v]) => v !== undefined);

  if (entries.length === 0) {
    return '';
  }

  return entries
    .map(([key, value]) => {
      const formatted =
        typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      return `## ${key}\n${formatted}`;
    })
    .join('\n\n');
}

/**
 * Create a timeout promise
 */
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new RetryableError(`Request timeout after ${ms}ms`, 'timeout'));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

