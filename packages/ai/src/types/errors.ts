/**
 * AI Generator Error Types - Discriminated Union
 *
 * 모든 에러는 _type 태그로 구분하여 exhaustive pattern matching 가능
 */

// ============================================================================
// Error Types (Discriminated Union)
// ============================================================================

export type AIGeneratorError =
  | ProviderError
  | SchemaValidationError
  | GenerationFailedError
  | RateLimitedError
  | InvalidInputError
  | TimeoutError

export interface ProviderError {
  readonly _type: 'PROVIDER_ERROR'
  readonly provider: string
  readonly message: string
  readonly code?: string
  readonly cause?: unknown
}

export interface SchemaValidationError {
  readonly _type: 'SCHEMA_VALIDATION_ERROR'
  readonly path: readonly (string | number)[]
  readonly message: string
  readonly received?: unknown
}

export interface GenerationFailedError {
  readonly _type: 'GENERATION_FAILED'
  readonly reason: string
  readonly retryable: boolean
  readonly attempts?: number
}

export interface RateLimitedError {
  readonly _type: 'RATE_LIMITED'
  readonly retryAfterMs: number
  readonly provider: string
}

export interface InvalidInputError {
  readonly _type: 'INVALID_INPUT'
  readonly field: string
  readonly message: string
  readonly expected?: string
}

export interface TimeoutError {
  readonly _type: 'TIMEOUT'
  readonly timeoutMs: number
  readonly operation: string
}

// ============================================================================
// Type Guards
// ============================================================================

export const isProviderError = (e: AIGeneratorError): e is ProviderError => e._type === 'PROVIDER_ERROR'

export const isSchemaValidationError = (e: AIGeneratorError): e is SchemaValidationError =>
  e._type === 'SCHEMA_VALIDATION_ERROR'

export const isGenerationFailedError = (e: AIGeneratorError): e is GenerationFailedError =>
  e._type === 'GENERATION_FAILED'

export const isRateLimitedError = (e: AIGeneratorError): e is RateLimitedError => e._type === 'RATE_LIMITED'

export const isInvalidInputError = (e: AIGeneratorError): e is InvalidInputError => e._type === 'INVALID_INPUT'

export const isTimeoutError = (e: AIGeneratorError): e is TimeoutError => e._type === 'TIMEOUT'

// ============================================================================
// Utilities
// ============================================================================

export const isRetryable = (e: AIGeneratorError): boolean => {
  switch (e._type) {
    case 'RATE_LIMITED':
      return true
    case 'GENERATION_FAILED':
      return e.retryable
    case 'TIMEOUT':
      return true
    case 'PROVIDER_ERROR':
      return e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT'
    default:
      return false
  }
}

export const getRetryDelay = (e: AIGeneratorError, attempt: number): number => {
  if (e._type === 'RATE_LIMITED') {
    return e.retryAfterMs
  }
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
  return Math.min(1000 * Math.pow(2, attempt), 16000)
}

// ============================================================================
// Error Constructors
// ============================================================================

export const providerError = (
  provider: string,
  message: string,
  options?: { code?: string; cause?: unknown }
): ProviderError => ({
  _type: 'PROVIDER_ERROR',
  provider,
  message,
  code: options?.code,
  cause: options?.cause,
})

export const schemaValidationError = (
  path: readonly (string | number)[],
  message: string,
  received?: unknown
): SchemaValidationError => ({
  _type: 'SCHEMA_VALIDATION_ERROR',
  path,
  message,
  received,
})

export const generationFailedError = (
  reason: string,
  retryable: boolean,
  attempts?: number
): GenerationFailedError => ({
  _type: 'GENERATION_FAILED',
  reason,
  retryable,
  attempts,
})

export const rateLimitedError = (provider: string, retryAfterMs: number): RateLimitedError => ({
  _type: 'RATE_LIMITED',
  provider,
  retryAfterMs,
})

export const invalidInputError = (field: string, message: string, expected?: string): InvalidInputError => ({
  _type: 'INVALID_INPUT',
  field,
  message,
  expected,
})

export const timeoutError = (operation: string, timeoutMs: number): TimeoutError => ({
  _type: 'TIMEOUT',
  operation,
  timeoutMs,
})
