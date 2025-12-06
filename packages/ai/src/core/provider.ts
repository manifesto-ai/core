/**
 * AI Provider Abstraction
 *
 * Vercel AI SDK의 다양한 프로바이더를 추상화하여 일관된 인터페이스 제공
 */

import type { LanguageModelV1 } from 'ai'

// ============================================================================
// Provider Types
// ============================================================================

export type AIProviderType = 'openai' | 'anthropic' | 'google' | 'custom'

export interface AIProviderConfig {
  readonly type: AIProviderType
  readonly model: string
  readonly apiKey?: string
  readonly baseUrl?: string
  readonly temperature?: number
  readonly maxTokens?: number
  readonly headers?: Record<string, string>
}

export interface AIProvider {
  readonly config: AIProviderConfig
  readonly type: AIProviderType
  getModel(): LanguageModelV1
}

// ============================================================================
// Provider Factory
// ============================================================================

export type ProviderFactory = (config: AIProviderConfig) => LanguageModelV1

const providerFactories = new Map<AIProviderType, ProviderFactory>()

/**
 * Provider factory 등록
 * 사용자가 필요한 provider만 lazy-load 할 수 있도록 함
 */
export const registerProvider = (type: AIProviderType, factory: ProviderFactory): void => {
  providerFactories.set(type, factory)
}

/**
 * OpenAI provider factory 등록
 *
 * @example
 * ```typescript
 * import { openai } from '@ai-sdk/openai'
 * registerOpenAIProvider(openai)
 * ```
 */
export const registerOpenAIProvider = (
  openai: (modelId: string) => LanguageModelV1
): void => {
  registerProvider('openai', (config) => {
    return openai(config.model)
  })
}

/**
 * Anthropic provider factory 등록
 *
 * @example
 * ```typescript
 * import { anthropic } from '@ai-sdk/anthropic'
 * registerAnthropicProvider(anthropic)
 * ```
 */
export const registerAnthropicProvider = (
  anthropic: (modelId: string) => LanguageModelV1
): void => {
  registerProvider('anthropic', (config) => {
    return anthropic(config.model)
  })
}

// ============================================================================
// Provider Creation
// ============================================================================

/**
 * AIProvider 인스턴스 생성
 *
 * @example
 * ```typescript
 * import { openai } from '@ai-sdk/openai'
 * registerOpenAIProvider(openai)
 *
 * const provider = createProvider({
 *   type: 'openai',
 *   model: 'gpt-4o-mini',
 *   temperature: 0.3,
 * })
 * ```
 */
export const createProvider = (config: AIProviderConfig): AIProvider => {
  const factory = providerFactories.get(config.type)

  if (!factory) {
    throw new Error(
      `Provider '${config.type}' not registered. ` +
        `Call register${config.type.charAt(0).toUpperCase() + config.type.slice(1)}Provider() first.`
    )
  }

  let cachedModel: LanguageModelV1 | null = null

  return {
    config,
    type: config.type,
    getModel() {
      if (!cachedModel) {
        cachedModel = factory(config)
      }
      return cachedModel
    },
  }
}

// ============================================================================
// Preset Configurations
// ============================================================================

export const OPENAI_PRESETS = {
  'gpt-4o': {
    type: 'openai' as const,
    model: 'gpt-4o',
    temperature: 0.3,
    maxTokens: 4096,
  },
  'gpt-4o-mini': {
    type: 'openai' as const,
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 4096,
  },
  'gpt-4-turbo': {
    type: 'openai' as const,
    model: 'gpt-4-turbo',
    temperature: 0.3,
    maxTokens: 4096,
  },
} satisfies Record<string, AIProviderConfig>

export const ANTHROPIC_PRESETS = {
  'claude-3-5-sonnet': {
    type: 'anthropic' as const,
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.3,
    maxTokens: 4096,
  },
  'claude-3-opus': {
    type: 'anthropic' as const,
    model: 'claude-3-opus-20240229',
    temperature: 0.3,
    maxTokens: 4096,
  },
  'claude-3-haiku': {
    type: 'anthropic' as const,
    model: 'claude-3-haiku-20240307',
    temperature: 0.3,
    maxTokens: 4096,
  },
} satisfies Record<string, AIProviderConfig>
