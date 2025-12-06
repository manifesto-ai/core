/**
 * AI Client - Vercel AI SDK Wrapper with Result Monad
 *
 * 모든 AI 호출을 Result monad로 감싸서 type-safe한 에러 핸들링 제공
 */

import { generateObject, generateText, type CoreTool, type LanguageModelV1 } from 'ai'
import type { z } from 'zod'
import { ok, err, type Result } from '@manifesto-ai/schema'
import type { AIProvider } from './provider'
import type {
  AIGeneratorError,
  GenerationResult,
  GenerationMetadata,
  TokenUsage,
  FinishReason,
} from '../types'
import {
  providerError,
  rateLimitedError,
  generationFailedError,
  timeoutError,
  isRetryable,
  getRetryDelay,
} from '../types/errors'

// ============================================================================
// Client Types
// ============================================================================

export interface AIClientOptions {
  readonly provider: AIProvider
  readonly defaultTemperature?: number
  readonly maxRetries?: number
  readonly timeout?: number
}

export interface GenerateObjectOptions<T extends z.ZodType> {
  readonly schema: T
  readonly prompt: string
  readonly system?: string
  readonly temperature?: number
  readonly maxTokens?: number
  readonly schemaName?: string
  readonly schemaDescription?: string
}

export interface GenerateTextOptions {
  readonly prompt: string
  readonly system?: string
  readonly temperature?: number
  readonly maxTokens?: number
}

export interface GenerateWithToolsOptions {
  readonly prompt: string
  readonly system?: string
  readonly tools: Record<string, CoreTool>
  readonly maxSteps?: number
  readonly temperature?: number
}

export interface ToolCallResult {
  readonly text: string
  readonly toolCalls: readonly ToolCall[]
  readonly finishReason: FinishReason
}

export interface ToolCall {
  readonly toolName: string
  readonly args: unknown
  readonly result?: unknown
}

// ============================================================================
// AI Client Interface
// ============================================================================

export interface AIClient {
  readonly provider: AIProvider

  /**
   * 구조화된 객체 생성 (Zod 스키마 기반)
   */
  generateObject<T extends z.ZodType>(
    options: GenerateObjectOptions<T>
  ): Promise<Result<GenerationResult<z.infer<T>>, AIGeneratorError>>

  /**
   * 텍스트 생성
   */
  generateText(
    options: GenerateTextOptions
  ): Promise<Result<GenerationResult<string>, AIGeneratorError>>

  /**
   * 도구 사용 가능한 텍스트 생성 (Agent용)
   */
  generateWithTools(
    options: GenerateWithToolsOptions
  ): Promise<Result<GenerationResult<ToolCallResult>, AIGeneratorError>>
}

// ============================================================================
// Client Implementation
// ============================================================================

export const createAIClient = (options: AIClientOptions): AIClient => {
  const { provider, defaultTemperature = 0.3, maxRetries = 3, timeout = 30000 } = options

  const mapError = (error: unknown): AIGeneratorError => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      // Rate limit detection
      if (message.includes('rate limit') || message.includes('429')) {
        const retryMatch = error.message.match(/retry after (\d+)/i)
        const retryAfterMs = retryMatch?.[1] ? parseInt(retryMatch[1], 10) * 1000 : 60000
        return rateLimitedError(provider.type, retryAfterMs)
      }

      // Timeout detection
      if (message.includes('timeout') || message.includes('etimedout')) {
        return timeoutError('AI generation', timeout)
      }

      return providerError(provider.type, error.message, {
        code: (error as NodeJS.ErrnoException).code,
        cause: error,
      })
    }

    return providerError(provider.type, String(error))
  }

  const withRetry = async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<Result<T, AIGeneratorError>> => {
    let lastError: AIGeneratorError | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Operation timeout')), timeout)
          ),
        ])
        return ok(result)
      } catch (error) {
        lastError = mapError(error)

        if (!isRetryable(lastError) || attempt === maxRetries - 1) {
          break
        }

        const delay = getRetryDelay(lastError, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    return err(
      lastError ?? generationFailedError(`${operationName} failed after ${maxRetries} attempts`, false)
    )
  }

  const createMetadata = (
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    startTime: number,
    finishReason?: string
  ): GenerationMetadata => {
    const tokenUsage: TokenUsage = {
      prompt: usage?.promptTokens ?? 0,
      completion: usage?.completionTokens ?? 0,
      total: usage?.totalTokens ?? 0,
    }

    return {
      model: provider.config.model,
      provider: provider.type,
      tokensUsed: tokenUsage,
      latencyMs: Date.now() - startTime,
      cached: false,
      finishReason: (finishReason as FinishReason) ?? 'stop',
    }
  }

  return {
    provider,

    async generateObject<T extends z.ZodType>(opts: GenerateObjectOptions<T>) {
      const startTime = Date.now()
      const model: LanguageModelV1 = provider.getModel()

      const result = await withRetry(async () => {
        const response = await generateObject({
          model,
          schema: opts.schema,
          prompt: opts.prompt,
          system: opts.system,
          temperature: opts.temperature ?? defaultTemperature,
          maxTokens: opts.maxTokens,
          schemaName: opts.schemaName,
          schemaDescription: opts.schemaDescription,
        })
        return response
      }, 'generateObject')

      if (result._tag === 'Err') {
        return result
      }

      return ok({
        value: result.value.object as z.infer<T>,
        metadata: createMetadata(result.value.usage, startTime, result.value.finishReason),
      })
    },

    async generateText(opts: GenerateTextOptions) {
      const startTime = Date.now()
      const model = provider.getModel()

      const result = await withRetry(async () => {
        const response = await generateText({
          model,
          prompt: opts.prompt,
          system: opts.system,
          temperature: opts.temperature ?? defaultTemperature,
          maxTokens: opts.maxTokens,
        })
        return response
      }, 'generateText')

      if (result._tag === 'Err') {
        return result
      }

      return ok({
        value: result.value.text,
        metadata: createMetadata(result.value.usage, startTime, result.value.finishReason),
      })
    },

    async generateWithTools(opts: GenerateWithToolsOptions) {
      const startTime = Date.now()
      const model = provider.getModel()

      const result = await withRetry(async () => {
        const response = await generateText({
          model,
          prompt: opts.prompt,
          system: opts.system,
          tools: opts.tools,
          maxSteps: opts.maxSteps ?? 5,
          temperature: opts.temperature ?? defaultTemperature,
        })
        return response
      }, 'generateWithTools')

      if (result._tag === 'Err') {
        return result
      }

      const toolCalls: ToolCall[] = result.value.toolCalls?.map((tc) => ({
        toolName: tc.toolName,
        args: tc.args,
        // result is populated by tool execution
      })) ?? []

      return ok({
        value: {
          text: result.value.text,
          toolCalls,
          finishReason: (result.value.finishReason as FinishReason) ?? 'stop',
        },
        metadata: createMetadata(result.value.usage, startTime, result.value.finishReason),
      })
    },
  }
}
