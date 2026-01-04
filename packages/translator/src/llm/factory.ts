/**
 * LLM Provider Factory
 *
 * Creates LLM providers based on configuration.
 */

import type {
  LLMProvider,
  OpenAIProviderConfig,
  AnthropicProviderConfig,
} from "./provider.js";
import { createOpenAIProvider } from "./openai-provider.js";
import { createAnthropicProvider } from "./anthropic-provider.js";

/**
 * Provider type
 */
export type ProviderType = "openai" | "anthropic";

/**
 * Provider configuration union
 */
export type ProviderConfig =
  | ({ type: "openai" } & OpenAIProviderConfig)
  | ({ type: "anthropic" } & AnthropicProviderConfig);

/**
 * Create LLM provider from configuration
 *
 * @param config - Provider configuration
 * @returns LLM provider instance
 */
export function createLLMProvider(config: ProviderConfig): LLMProvider {
  switch (config.type) {
    case "openai":
      return createOpenAIProvider(config);
    case "anthropic":
      return createAnthropicProvider(config);
    default:
      throw new Error(`Unknown provider type: ${(config as any).type}`);
  }
}

/**
 * Auto-detect best available provider
 *
 * Priority:
 * 1. OpenAI (if OPENAI_API_KEY is set)
 * 2. Anthropic (if ANTHROPIC_API_KEY is set)
 * 3. Throws error if none configured
 */
export function createAutoProvider(): LLMProvider {
  // Try OpenAI first
  if (process.env.OPENAI_API_KEY) {
    return createOpenAIProvider();
  }

  // Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropicProvider();
  }

  throw new Error(
    "No LLM provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable."
  );
}

/**
 * Check which providers are available
 */
export function getAvailableProviders(): ProviderType[] {
  const available: ProviderType[] = [];

  if (process.env.OPENAI_API_KEY) {
    available.push("openai");
  }

  if (process.env.ANTHROPIC_API_KEY) {
    available.push("anthropic");
  }

  return available;
}
