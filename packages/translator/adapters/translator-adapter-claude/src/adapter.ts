/**
 * @fileoverview Claude adapter for LLMPort.
 */

import type { LLMPort, LLMRequest, LLMResponse } from "@manifesto-ai/translator";
import { LLMError } from "@manifesto-ai/translator";

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

export type ClaudeAdapterConfig = {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly timeout?: number;
  readonly maxRetries?: number;
  readonly defaultTemperature?: number;
  readonly maxTokens?: number;
};

const DEFAULT_MODEL = "claude-3-5-sonnet-latest";

export class ClaudeAdapter implements LLMPort {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string | undefined;
  private readonly model: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly defaultTemperature: number;
  private readonly maxTokens: number;

  constructor(config?: ClaudeAdapterConfig) {
    this.apiKey = config?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.baseUrl = config?.baseUrl;
    this.model = config?.model ?? process.env.MANIFESTO_LLM_MODEL ?? DEFAULT_MODEL;
    this.timeout = config?.timeout ?? 30000;
    this.maxRetries = config?.maxRetries ?? 2;
    this.defaultTemperature = config?.defaultTemperature ?? 0.1;
    this.maxTokens = config?.maxTokens ?? 2048;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new LLMError("Anthropic API key not configured", "AUTH_FAILED", false);
    }

    const client = await this.getClient();
    const messages: AnthropicMessage[] = request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const temperature = request.options?.temperature ?? this.defaultTemperature;
    const maxTokens = request.options?.maxTokens ?? this.maxTokens;

    try {
      const response = (await client.messages.create({
        model: this.model,
        system: request.system,
        messages,
        temperature,
        max_tokens: maxTokens,
      })) as AnthropicResponse;

      const contentBlocks = response.content ?? [];
      const text = contentBlocks
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("")
        .trim();

      return {
        content: text,
        usage: response.usage
          ? {
              promptTokens: response.usage.input_tokens ?? 0,
              completionTokens: response.usage.output_tokens ?? 0,
              totalTokens:
                (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
            }
          : undefined,
        finishReason: mapStopReason(response.stop_reason),
      };
    } catch (error) {
      throw toLLMError(error);
    }
  }

  private async getClient(): Promise<any> {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      return new Anthropic({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
        timeout: this.timeout,
        maxRetries: this.maxRetries,
      });
    } catch (error) {
      throw new LLMError(
        error instanceof Error ? error.message : String(error),
        "SERVICE_ERROR",
        true,
        error
      );
    }
  }
}

function mapStopReason(reason?: string | null): "stop" | "length" | "content_filter" | "error" {
  switch (reason) {
    case "end_turn":
    case "stop":
      return "stop";
    case "max_tokens":
      return "length";
    case "content_filter":
      return "content_filter";
    default:
      return "error";
  }
}

function toLLMError(error: unknown): LLMError {
  if (error instanceof LLMError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.toLowerCase().includes("rate")) {
    return new LLMError(message, "RATE_LIMIT", true, error);
  }

  if (message.toLowerCase().includes("timeout")) {
    return new LLMError(message, "TIMEOUT", true, error);
  }

  if (message.toLowerCase().includes("auth")) {
    return new LLMError(message, "AUTH_FAILED", false, error);
  }

  return new LLMError(message, "SERVICE_ERROR", true, error);
}
