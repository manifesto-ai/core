/**
 * LLM Module
 *
 * Provides LLM provider abstraction for the proposer stage.
 */

// Provider interface and types
export type {
  LLMProvider,
  ProposeRequest,
  ProposeResponse,
  ProviderResult,
  ProviderMetrics,
  TranslationExample,
  BaseProviderConfig,
  OpenAIProviderConfig,
  AnthropicProviderConfig,
} from "./provider.js";

export {
  ProposeRequestSchema,
  ProposeResponseSchema,
  ProviderMetricsSchema,
  TranslationExampleSchema,
  BaseProviderConfigSchema,
  OpenAIProviderConfigSchema,
  AnthropicProviderConfigSchema,
} from "./provider.js";

// OpenAI provider
export { OpenAIProvider, createOpenAIProvider } from "./openai-provider.js";

// Anthropic provider
export { AnthropicProvider, createAnthropicProvider } from "./anthropic-provider.js";

// Factory
export {
  createLLMProvider,
  createAutoProvider,
  getAvailableProviders,
  type ProviderType,
  type ProviderConfig,
} from "./factory.js";
