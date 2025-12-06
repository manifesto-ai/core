/**
 * Error Types Tests
 */

import { describe, it, expect } from 'vitest'
import {
  type AIGeneratorError,
  isProviderError,
  isSchemaValidationError,
  isRateLimitedError,
  isRetryable,
  getRetryDelay,
  providerError,
  rateLimitedError,
  generationFailedError,
  timeoutError,
} from '../../types/errors'

describe('AIGeneratorError', () => {
  describe('type guards', () => {
    it('isProviderError should correctly identify provider errors', () => {
      const error = providerError('openai', 'API error')
      expect(isProviderError(error)).toBe(true)
      expect(isSchemaValidationError(error)).toBe(false)
    })

    it('isRateLimitedError should correctly identify rate limit errors', () => {
      const error = rateLimitedError('openai', 60000)
      expect(isRateLimitedError(error)).toBe(true)
      expect(isProviderError(error)).toBe(false)
    })
  })

  describe('isRetryable', () => {
    it('should return true for RATE_LIMITED errors', () => {
      const error = rateLimitedError('openai', 60000)
      expect(isRetryable(error)).toBe(true)
    })

    it('should return true for retryable GENERATION_FAILED errors', () => {
      const error = generationFailedError('Temporary failure', true)
      expect(isRetryable(error)).toBe(true)
    })

    it('should return false for non-retryable GENERATION_FAILED errors', () => {
      const error = generationFailedError('Permanent failure', false)
      expect(isRetryable(error)).toBe(false)
    })

    it('should return true for TIMEOUT errors', () => {
      const error = timeoutError('generateObject', 30000)
      expect(isRetryable(error)).toBe(true)
    })

    it('should return true for PROVIDER_ERROR with ECONNRESET code', () => {
      const error = providerError('openai', 'Connection reset', { code: 'ECONNRESET' })
      expect(isRetryable(error)).toBe(true)
    })

    it('should return false for PROVIDER_ERROR without retryable code', () => {
      const error = providerError('openai', 'Invalid API key')
      expect(isRetryable(error)).toBe(false)
    })
  })

  describe('getRetryDelay', () => {
    it('should return retryAfterMs for RATE_LIMITED errors', () => {
      const error = rateLimitedError('openai', 60000)
      expect(getRetryDelay(error, 0)).toBe(60000)
    })

    it('should return exponential backoff for other errors', () => {
      const error = generationFailedError('Failure', true)
      expect(getRetryDelay(error, 0)).toBe(1000) // 1s
      expect(getRetryDelay(error, 1)).toBe(2000) // 2s
      expect(getRetryDelay(error, 2)).toBe(4000) // 4s
      expect(getRetryDelay(error, 3)).toBe(8000) // 8s
      expect(getRetryDelay(error, 4)).toBe(16000) // 16s (max)
      expect(getRetryDelay(error, 10)).toBe(16000) // Still 16s (capped)
    })
  })

  describe('error constructors', () => {
    it('providerError should create correct structure', () => {
      const error = providerError('openai', 'API error', { code: '500' })
      expect(error).toEqual({
        _type: 'PROVIDER_ERROR',
        provider: 'openai',
        message: 'API error',
        code: '500',
        cause: undefined,
      })
    })

    it('rateLimitedError should create correct structure', () => {
      const error = rateLimitedError('openai', 60000)
      expect(error).toEqual({
        _type: 'RATE_LIMITED',
        provider: 'openai',
        retryAfterMs: 60000,
      })
    })

    it('generationFailedError should create correct structure', () => {
      const error = generationFailedError('Failed', true, 3)
      expect(error).toEqual({
        _type: 'GENERATION_FAILED',
        reason: 'Failed',
        retryable: true,
        attempts: 3,
      })
    })

    it('timeoutError should create correct structure', () => {
      const error = timeoutError('generateObject', 30000)
      expect(error).toEqual({
        _type: 'TIMEOUT',
        operation: 'generateObject',
        timeoutMs: 30000,
      })
    })
  })
})
