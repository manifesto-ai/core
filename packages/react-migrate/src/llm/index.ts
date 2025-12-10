// Types
export type {
  MessageRole,
  LLMMessage,
  LLMCompletionOptions,
  TokenUsage,
  FinishReason,
  LLMCompletionResult,
  LLMProviderType,
  LLMProviderConfig,
  LLMProvider,
} from './types.js';

// Errors
export {
  LLMError,
  RateLimitError,
  AuthenticationError,
  ModelNotFoundError,
} from './types.js';

// Base Provider
export { BaseLLMProvider } from './provider.js';

// Providers
export {
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
  MockLLMProvider,
  createMockProvider,
  type MockResponse,
  type MockCallRecord,
} from './providers/index.js';

// Prompts
export * as prompts from './prompts/index.js';

import type { LLMProvider, LLMProviderConfig, LLMProviderType } from './types.js';
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OllamaProvider } from './providers/ollama.js';
import { MockLLMProvider } from './providers/mock.js';

/**
 * Provider 타입에 따라 적절한 Provider 인스턴스 생성
 */
export function createProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'mock':
      return new MockLLMProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * 환경변수에서 Provider 설정 로드
 */
export function loadProviderFromEnv(
  providerType?: LLMProviderType
): LLMProviderConfig {
  const provider = providerType ?? (process.env['LLM_PROVIDER'] as LLMProviderType) ?? 'openai';

  switch (provider) {
    case 'openai':
      return {
        provider: 'openai',
        apiKey: process.env['OPENAI_API_KEY'],
        defaultModel: process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini',
      };
    case 'anthropic':
      return {
        provider: 'anthropic',
        apiKey: process.env['ANTHROPIC_API_KEY'],
        defaultModel: process.env['ANTHROPIC_MODEL'] ?? 'claude-3-5-haiku-latest',
      };
    case 'ollama':
      return {
        provider: 'ollama',
        baseUrl: process.env['OLLAMA_HOST'] ?? 'http://localhost:11434',
        defaultModel: process.env['OLLAMA_MODEL'] ?? 'llama3.2',
      };
    case 'mock':
      return { provider: 'mock' };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * 기본 Provider 생성 (환경변수 기반)
 */
export function createDefaultProvider(): LLMProvider {
  const config = loadProviderFromEnv();
  return createProvider(config);
}
