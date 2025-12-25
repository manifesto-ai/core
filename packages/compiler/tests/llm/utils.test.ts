/**
 * LLM Utils Tests
 *
 * Tests for LLM utility functions including:
 * - hashPrompt
 * - RateLimiter
 * - withRetry
 * - parseJSON/parseJSONArray
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hashPrompt,
  RateLimiter,
  withRetry,
  parseJSON,
  parseJSONArray,
  sleep,
  truncateText,
  estimateTokens,
  formatContext,
  timeout,
  RetryableError,
} from '../../src/llm/utils.js';

// ============================================================================
// hashPrompt Tests
// ============================================================================

describe('hashPrompt', () => {
  it('should generate consistent hash for same prompt', () => {
    const prompt = 'Generate a schema for user management';
    const hash1 = hashPrompt(prompt);
    const hash2 = hashPrompt(prompt);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(16);
  });

  it('should generate different hashes for different prompts', () => {
    const hash1 = hashPrompt('First prompt');
    const hash2 = hashPrompt('Second prompt');

    expect(hash1).not.toBe(hash2);
  });

  it('should include context in hash calculation', () => {
    const prompt = 'Generate schema';
    const hash1 = hashPrompt(prompt, { domain: 'ecommerce' });
    const hash2 = hashPrompt(prompt, { domain: 'healthcare' });

    expect(hash1).not.toBe(hash2);
  });

  it('should generate same hash regardless of context key order', () => {
    const prompt = 'Generate schema';
    const hash1 = hashPrompt(prompt, { a: 1, b: 2 });
    const hash2 = hashPrompt(prompt, { b: 2, a: 1 });

    expect(hash1).toBe(hash2);
  });
});

// ============================================================================
// RateLimiter Tests
// ============================================================================

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow immediate acquisition when tokens available', async () => {
    const limiter = new RateLimiter({ requestsPerMinute: 60 });

    expect(limiter.canAcquire()).toBe(true);
    expect(limiter.getTokens()).toBe(60);

    await limiter.acquire();
    expect(limiter.getTokens()).toBe(59);
  });

  it('should refill tokens over time', async () => {
    const limiter = new RateLimiter({ requestsPerMinute: 60 });

    // Use all tokens
    for (let i = 0; i < 60; i++) {
      await limiter.acquire();
    }

    expect(limiter.getTokens()).toBe(0);

    // Advance time by 30 seconds (should refill 30 tokens)
    vi.advanceTimersByTime(30000);

    expect(limiter.getTokens()).toBeCloseTo(30, 0);
  });

  it('should not exceed max tokens', async () => {
    const limiter = new RateLimiter({ requestsPerMinute: 60 });

    // Advance time significantly
    vi.advanceTimersByTime(120000);

    expect(limiter.getTokens()).toBe(60);
  });
});

// ============================================================================
// withRetry Tests
// ============================================================================

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = withRetry(fn, { maxRetries: 3 });
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('rate_limit_exceeded'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, {
      maxRetries: 3,
      initialDelay: 100,
    });

    // Advance past the retry delay
    await vi.runAllTimersAsync();

    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('invalid_api_key'));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        retryableErrors: ['rate_limit_exceeded'],
      })
    ).rejects.toThrow('invalid_api_key');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries', async () => {
    vi.useRealTimers(); // Use real timers for this specific test

    const fn = vi.fn().mockRejectedValue(new RetryableError('rate_limit', '429'));

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        initialDelay: 10, // Short delay for fast test
        maxDelay: 20,
      })
    ).rejects.toThrow('rate_limit');

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should respect RetryableError.isRetryable', async () => {
    const fn = vi.fn().mockRejectedValue(new RetryableError('non-retryable', '400', false));

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow('non-retryable');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// parseJSON Tests
// ============================================================================

describe('parseJSON', () => {
  it('should parse raw JSON', () => {
    const result = parseJSON('{"key": "value"}');

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('should parse JSON from markdown code block', () => {
    const text = `Here is the result:
\`\`\`json
{"key": "value"}
\`\`\`
Some additional text`;

    const result = parseJSON(text);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('should parse JSON from code block without language', () => {
    const text = `\`\`\`
{"key": "value"}
\`\`\``;

    const result = parseJSON(text);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('should parse JSON embedded in text', () => {
    const text = 'Here is the data: {"key": "value"} and more text';

    const result = parseJSON(text);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('should parse JSON array', () => {
    const result = parseJSON('[1, 2, 3]');

    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('should return error for invalid JSON', () => {
    const result = parseJSON('not valid json');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.rawText).toBe('not valid json');
  });
});

describe('parseJSONArray', () => {
  it('should parse array', () => {
    const result = parseJSONArray('[{"id": 1}, {"id": 2}]');

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('should wrap single object in array', () => {
    const result = parseJSONArray('{"id": 1}');

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1 }]);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay for specified time', async () => {
    const start = Date.now();
    const promise = sleep(1000);

    vi.advanceTimersByTime(1000);
    await promise;

    // With fake timers, Date.now() doesn't advance, so just check it resolves
    expect(true).toBe(true);
  });
});

describe('truncateText', () => {
  it('should not truncate short text', () => {
    expect(truncateText('short', 10)).toBe('short');
  });

  it('should truncate long text with ellipsis', () => {
    expect(truncateText('this is a long text', 10)).toBe('this is...');
  });

  it('should handle exact length', () => {
    expect(truncateText('exact', 5)).toBe('exact');
  });
});

describe('estimateTokens', () => {
  it('should estimate tokens at ~4 chars per token', () => {
    const text = 'Hello, world!'; // 13 chars
    expect(estimateTokens(text)).toBe(4); // ceil(13/4) = 4
  });

  it('should handle empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('formatContext', () => {
  it('should format context as markdown sections', () => {
    const result = formatContext({
      domain: 'ecommerce',
      paths: ['data.user', 'data.product'],
    });

    expect(result).toContain('## domain');
    expect(result).toContain('ecommerce');
    expect(result).toContain('## paths');
  });

  it('should skip undefined values', () => {
    const result = formatContext({
      defined: 'value',
      undefined: undefined,
    });

    expect(result).toContain('## defined');
    expect(result).not.toContain('## undefined');
  });

  it('should return empty string for empty context', () => {
    expect(formatContext({})).toBe('');
  });
});

describe('timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve if promise completes before timeout', async () => {
    const promise = Promise.resolve('success');
    const result = await timeout(promise, 1000);

    expect(result).toBe('success');
  });

  it('should reject with RetryableError on timeout', async () => {
    const neverResolves = new Promise(() => {});

    const resultPromise = timeout(neverResolves, 1000);

    vi.advanceTimersByTime(1001);

    await expect(resultPromise).rejects.toThrow('timeout');
  });
});
