/**
 * @fileoverview OpenAI Provider Implementation
 *
 * LLM provider using OpenAI's API for translation.
 */

import type {
  LLMProvider,
  LLMProviderConfig,
  LLMTranslateRequest,
  LLMTranslateResponse,
  LLMIntentNode,
} from "./provider.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompts/system-prompt.js";
import { recoverFromMalformedOutput, isRetryableError, calculateRetryDelay, DEFAULT_RETRY_CONFIG } from "./error-recovery.js";
import { SIMPLE_EXAMPLES, formatExamplesForPrompt } from "./prompts/examples.js";

// =============================================================================
// Types
// =============================================================================

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAIResponse = {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
};

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_TEMPERATURE = 0.1;

// =============================================================================
// OpenAI Provider
// =============================================================================

/**
 * Create an OpenAI provider.
 */
export function createOpenAIProvider(config?: LLMProviderConfig): LLMProvider {
  const apiKey = config?.apiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = config?.baseUrl ?? "https://api.openai.com/v1";
  const model = config?.model ?? process.env.MANIFESTO_LLM_MODEL ?? DEFAULT_MODEL;
  const timeout = config?.timeout ?? DEFAULT_TIMEOUT;
  const defaultTemperature = config?.defaultTemperature ?? DEFAULT_TEMPERATURE;

  return {
    name: "openai",

    isConfigured(): boolean {
      return Boolean(apiKey);
    },

    async translate(request: LLMTranslateRequest): Promise<LLMTranslateResponse> {
      if (!apiKey) {
        throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.");
      }

      const startTime = Date.now();

      // Build messages
      const systemPrompt = buildSystemPrompt(request);
      const userPrompt = buildUserPrompt(request.input);
      const examples = formatExamplesForPrompt(SIMPLE_EXAMPLES.slice(0, 2));

      const messages: OpenAIMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here are some examples:\n\n${examples}` },
        { role: "assistant", content: "I understand. I will parse natural language into IntentIR JSON format." },
        { role: "user", content: userPrompt },
      ];

      // Make request with retry
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= DEFAULT_RETRY_CONFIG.maxRetries; attempt++) {
        if (attempt > 0) {
          const delay = calculateRetryDelay(attempt - 1, DEFAULT_RETRY_CONFIG);
          await sleep(delay);
        }

        try {
          const response = await makeOpenAIRequest({
            apiKey,
            baseUrl,
            model,
            messages,
            temperature: request.temperature ?? defaultTemperature,
            timeout,
          });

          const latencyMs = Date.now() - startTime;
          const rawContent = response.choices[0]?.message?.content ?? "";

          // Parse and recover from potential issues
          const recovered = recoverFromMalformedOutput(rawContent, request.input);

          return {
            nodes: recovered.nodes,
            rawResponse: rawContent,
            metrics: {
              latencyMs,
              totalTokens: response.usage?.total_tokens,
              inputTokens: response.usage?.prompt_tokens,
              outputTokens: response.usage?.completion_tokens,
              model: response.model,
            },
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (!isRetryableError(error) || attempt === DEFAULT_RETRY_CONFIG.maxRetries) {
            throw lastError;
          }
        }
      }

      throw lastError ?? new Error("Unknown error during translation");
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

async function makeOpenAIRequest(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: OpenAIMessage[];
  temperature: number;
  timeout: number;
}): Promise<OpenAIResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);

  try {
    const response = await fetch(`${options.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    return (await response.json()) as OpenAIResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Stub Provider (for testing without API)
// =============================================================================

/**
 * Create a stub provider that returns empty results.
 *
 * Useful for testing and development without API access.
 */
export function createStubProvider(): LLMProvider {
  return {
    name: "stub",

    isConfigured(): boolean {
      return true;
    },

    async translate(request: LLMTranslateRequest): Promise<LLMTranslateResponse> {
      return {
        nodes: [],
        rawResponse: '{"nodes": []}',
        metrics: {
          latencyMs: 0,
          model: "stub",
        },
      };
    },
  };
}
