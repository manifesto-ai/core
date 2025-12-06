/**
 * Core - AI Client and Provider exports
 */

export {
  createProvider,
  registerProvider,
  registerOpenAIProvider,
  registerAnthropicProvider,
  OPENAI_PRESETS,
  ANTHROPIC_PRESETS,
  type AIProvider,
  type AIProviderConfig,
  type AIProviderType,
  type ProviderFactory,
} from './provider'

export {
  createAIClient,
  type AIClient,
  type AIClientOptions,
  type GenerateObjectOptions,
  type GenerateTextOptions,
  type GenerateWithToolsOptions,
  type ToolCallResult,
  type ToolCall,
} from './client'

export * from './schemas'
