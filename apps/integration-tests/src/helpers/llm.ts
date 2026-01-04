/**
 * LLM Test Utilities
 *
 * Helpers for conditionally running LLM-dependent tests.
 */

import { describe } from "vitest";

/**
 * OpenAI API key from environment.
 */
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Anthropic API key from environment.
 */
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Whether OpenAI API is available.
 */
export const hasOpenAI = !!OPENAI_API_KEY;

/**
 * Whether Anthropic API is available.
 */
export const hasAnthropic = !!ANTHROPIC_API_KEY;

/**
 * Whether any LLM API is available.
 */
export const hasAnyLLM = hasOpenAI || hasAnthropic;

/**
 * Describe block that skips if no LLM API key is available.
 */
export const describeWithLLM = hasAnyLLM ? describe : describe.skip;

/**
 * Describe block that skips if no OpenAI API key is available.
 */
export const describeWithOpenAI = hasOpenAI ? describe : describe.skip;

/**
 * Describe block that skips if no Anthropic API key is available.
 */
export const describeWithAnthropic = hasAnthropic ? describe : describe.skip;

/**
 * Skip test if no API key is available.
 *
 * @param provider - LLM provider to check
 * @returns True if test should be skipped
 *
 * @example
 * it("should translate NL to patches", async () => {
 *   if (skipIfNoApiKey("openai")) return;
 *   // ... test code
 * });
 */
export function skipIfNoApiKey(
  provider: "openai" | "anthropic" | "any" = "any"
): boolean {
  const hasKey =
    provider === "openai"
      ? hasOpenAI
      : provider === "anthropic"
        ? hasAnthropic
        : hasAnyLLM;

  if (!hasKey) {
    console.log(`Skipping test: No ${provider} API key found`);
    return true;
  }
  return false;
}

/**
 * Get LLM provider info for test logging.
 */
export function getLLMProviderInfo(): string {
  const providers: string[] = [];
  if (hasOpenAI) providers.push("OpenAI");
  if (hasAnthropic) providers.push("Anthropic");

  if (providers.length === 0) {
    return "No LLM providers available";
  }
  return `Available LLM providers: ${providers.join(", ")}`;
}
