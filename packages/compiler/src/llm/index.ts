/**
 * LLM Module - LLM Adapters for Fragment Generation
 *
 * Provides production-ready LLM adapters for the @manifesto-ai/compiler.
 *
 * Available adapters:
 * - Anthropic (Claude)
 * - OpenAI (GPT-4)
 *
 * @example
 * ```typescript
 * import { createAnthropicAdapter, createOpenAIAdapter } from '@manifesto-ai/compiler';
 *
 * // Anthropic adapter
 * const anthropicAdapter = createAnthropicAdapter({
 *   apiKey: process.env.ANTHROPIC_API_KEY!,
 * });
 *
 * // OpenAI adapter
 * const openaiAdapter = createOpenAIAdapter({
 *   apiKey: process.env.OPENAI_API_KEY!,
 * });
 * ```
 *
 * AGENT_README Invariants:
 * - #2: LLM은 비신뢰 제안자 (FragmentDraft만 생성)
 * - #4: 모든 출력에 출처 (promptHash for provenance)
 */

// Adapters
export { createAnthropicAdapter, type AnthropicAdapterConfig } from './anthropic.js';
export { createOpenAIAdapter, type OpenAIAdapterConfig } from './openai.js';

// Utilities
export {
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
  DEFAULT_RETRY_CONFIG,
  type RateLimiterConfig,
  type RetryConfig,
  type ParseResult,
} from './utils.js';

// Prompts
export {
  SYSTEM_PROMPT_CORE,
  SYSTEM_PROMPT_SCHEMA,
  SYSTEM_PROMPT_DERIVED,
  SYSTEM_PROMPT_ACTION,
  buildSystemPrompt,
  buildUserPrompt,
  buildMessages,
  validateDraftStructure,
  normalizeDraft,
} from './prompts.js';

// ============================================================================
// Base Configuration Type
// ============================================================================

/**
 * Base configuration shared by all LLM adapters
 */
export interface BaseLLMConfig {
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Rate limit (requests per minute) */
  rateLimit?: number;
  /** Request timeout in ms */
  timeout?: number;
  /** Maximum confidence the adapter will report */
  maxConfidence?: number;
}
