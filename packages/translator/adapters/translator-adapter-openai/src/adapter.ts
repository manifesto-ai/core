/**
 * @fileoverview OpenAI adapter for LLMPort.
 */

import type { LLMPort, LLMRequest, LLMResponse } from "@manifesto-ai/translator";
import { LLMError } from "@manifesto-ai/translator";

// =============================================================================
// Types
// =============================================================================

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAIResponse = {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type OpenAIAdapterConfig = {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly timeout?: number;
  readonly defaultTemperature?: number;
};

// =============================================================================
// OpenAIAdapter
// =============================================================================

export class OpenAIAdapter implements LLMPort {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeout: number;
  private readonly defaultTemperature: number;

  constructor(config?: OpenAIAdapterConfig) {
    this.apiKey = config?.apiKey ?? process.env.OPENAI_API_KEY;
    this.baseUrl = config?.baseUrl ?? "https://api.openai.com/v1";
    this.model = config?.model ?? process.env.MANIFESTO_LLM_MODEL ?? "gpt-4o-mini";
    this.timeout = config?.timeout ?? 30000;
    this.defaultTemperature = config?.defaultTemperature ?? 0.1;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new LLMError("OpenAI API key not configured", "AUTH_FAILED", false);
    }

    const messages: OpenAIMessage[] = [];
    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }
    for (const message of request.messages) {
      messages.push({ role: message.role, content: message.content });
    }

    const temperature = request.options?.temperature ?? this.defaultTemperature;
    const maxTokens = request.options?.maxTokens;
    const stop = request.options?.stop;
    const responseFormat = request.options?.responseFormat;
    const timeout = request.options?.timeout ?? this.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          ...(maxTokens !== undefined && { max_tokens: maxTokens }),
          ...(stop && stop.length > 0 && { stop }),
          ...(responseFormat === "json" && { response_format: { type: "json_object" } }),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw mapHttpError(response.status, errorText);
      }

      const data = (await response.json()) as OpenAIResponse;
      const message = data.choices[0]?.message?.content ?? "";
      const finishReason = mapFinishReason(data.choices[0]?.finish_reason);

      return {
        content: message,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
        finishReason,
      };
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new LLMError("OpenAI request timed out", "TIMEOUT", true, error);
      }
      throw new LLMError(
        error instanceof Error ? error.message : String(error),
        "NETWORK_ERROR",
        true,
        error
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// =============================================================================
// Helpers
// =============================================================================

function mapHttpError(status: number, details: string): LLMError {
  if (status === 401 || status === 403) {
    return new LLMError(`OpenAI auth failed: ${details}`, "AUTH_FAILED", false);
  }
  if (status === 429) {
    return new LLMError(`OpenAI rate limited: ${details}`, "RATE_LIMIT", true);
  }
  if (status === 400) {
    return new LLMError(`OpenAI invalid request: ${details}`, "INVALID_REQUEST", false);
  }
  if (status === 408) {
    return new LLMError(`OpenAI timeout: ${details}`, "TIMEOUT", true);
  }
  if (status >= 500) {
    return new LLMError(`OpenAI service error: ${details}`, "SERVICE_ERROR", true);
  }

  return new LLMError(`OpenAI error (${status}): ${details}`, "UNKNOWN", true);
}

function mapFinishReason(reason?: string): "stop" | "length" | "content_filter" | "error" {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content_filter";
    default:
      return "error";
  }
}
