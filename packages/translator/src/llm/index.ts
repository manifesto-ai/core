/**
 * @fileoverview LLM Module Exports
 *
 * LLM integration for translate().
 */

// Provider interface and types
export type {
  LLMProvider,
  LLMProviderConfig,
  LLMTranslateRequest,
  LLMTranslateResponse,
  LLMIntentNode,
  LLMMetrics,
  AmbiguityIndicators,
} from "./provider.js";

// OpenAI provider
export { createOpenAIProvider, createStubProvider } from "./openai-provider.js";

// Output parsing
export { parseLLMOutput, validateNodeDependencies } from "./output-schema.js";

// Error recovery
export {
  recoverFromMalformedOutput,
  isRetryableError,
  calculateRetryDelay,
  DEFAULT_RETRY_CONFIG,
  type RecoveryResult,
  type RetryConfig,
} from "./error-recovery.js";

// Prompts
export { buildSystemPrompt, buildUserPrompt } from "./prompts/system-prompt.js";
export {
  getAllExamples,
  formatExamplesForPrompt,
  SIMPLE_EXAMPLES,
  MULTI_INTENT_EXAMPLES,
  AMBIGUOUS_EXAMPLES,
  type TranslationExample,
} from "./prompts/examples.js";
