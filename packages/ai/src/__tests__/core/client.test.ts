/**
 * AI Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createAIClient, type AIClient } from '../../core/client'
import type { AIProvider } from '../../core/provider'

// ============================================================================
// Mock Setup
// ============================================================================

const mockGenerateObject = vi.fn()
const mockGenerateText = vi.fn()

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}))

const createMockProvider = (): AIProvider => ({
  config: {
    type: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
  },
  type: 'openai',
  getModel: vi.fn().mockReturnValue({ modelId: 'gpt-4o-mini' }),
})

// ============================================================================
// Tests
// ============================================================================

describe('AIClient', () => {
  let client: AIClient
  let provider: AIProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = createMockProvider()
    client = createAIClient({
      provider,
      maxRetries: 3,
      timeout: 5000,
    })
  })

  describe('generateObject', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number(),
    })

    it('should return Ok with generated object on success', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { name: 'Test', age: 25 },
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: 'stop',
      })

      const result = await client.generateObject({
        schema: testSchema,
        prompt: 'Generate a person',
      })

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.value).toEqual({ name: 'Test', age: 25 })
        expect(result.value.metadata.model).toBe('gpt-4o-mini')
        expect(result.value.metadata.tokensUsed.total).toBe(30)
      }
    })

    it('should return Err with PROVIDER_ERROR on API error', async () => {
      mockGenerateObject.mockRejectedValueOnce(new Error('API error'))

      const result = await client.generateObject({
        schema: testSchema,
        prompt: 'Generate a person',
      })

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('PROVIDER_ERROR')
        if (result.error._type === 'PROVIDER_ERROR') {
          expect(result.error.message).toContain('API error')
        }
      }
    })

    it('should return Err with RATE_LIMITED on rate limit error', async () => {
      // Rate limit errors are retryable, so we need to reject all retries
      mockGenerateObject.mockRejectedValue(new Error('Rate limit exceeded'))

      // Create a client with only 1 retry to avoid timeout
      const noRetryClient = createAIClient({
        provider,
        maxRetries: 1,
        timeout: 5000,
      })

      const result = await noRetryClient.generateObject({
        schema: testSchema,
        prompt: 'Generate a person',
      })

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('RATE_LIMITED')
      }
    })

    it('should retry on transient errors', async () => {
      mockGenerateObject
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          object: { name: 'Test', age: 25 },
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          finishReason: 'stop',
        })

      const result = await client.generateObject({
        schema: testSchema,
        prompt: 'Generate a person',
      })

      expect(result._tag).toBe('Ok')
      expect(mockGenerateObject).toHaveBeenCalledTimes(3)
    })

    it('should pass temperature and other options', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { name: 'Test', age: 25 },
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: 'stop',
      })

      await client.generateObject({
        schema: testSchema,
        prompt: 'Generate a person',
        system: 'You are a helpful assistant',
        temperature: 0.5,
        maxTokens: 1000,
      })

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant',
          temperature: 0.5,
          maxTokens: 1000,
        })
      )
    })
  })

  describe('generateText', () => {
    it('should return Ok with generated text on success', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Hello, world!',
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        finishReason: 'stop',
      })

      const result = await client.generateText({
        prompt: 'Say hello',
      })

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.value).toBe('Hello, world!')
        expect(result.value.metadata.tokensUsed.total).toBe(8)
      }
    })
  })

  describe('generateWithTools', () => {
    it('should return Ok with tool calls on success', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'I will help you.',
        toolCalls: [
          { toolName: 'search', args: { query: 'test' } },
        ],
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
        finishReason: 'tool_calls',
      })

      const result = await client.generateWithTools({
        prompt: 'Search for something',
        tools: {
          search: {
            description: 'Search tool',
            parameters: z.object({ query: z.string() }),
          } as any,
        },
      })

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.value.text).toBe('I will help you.')
        expect(result.value.value.toolCalls).toHaveLength(1)
        expect(result.value.value.toolCalls[0].toolName).toBe('search')
        expect(result.value.value.finishReason).toBe('tool_calls')
      }
    })
  })
})
