/**
 * @fileoverview Ollama adapter for LLMPort.
 */

import type { LLMPort, LLMRequest, LLMResponse } from "@manifesto-ai/translator";
import { LLMError } from "@manifesto-ai/translator";

export type OllamaAdapterConfig = {
  readonly baseUrl?: string;
  readonly model?: string;
  readonly defaultTemperature?: number;
  readonly timeout?: number;
};

const DEFAULT_MODEL = "llama3.1";

export class OllamaAdapter implements LLMPort {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly defaultTemperature: number;
  private readonly timeout: number;

  constructor(config?: OllamaAdapterConfig) {
    this.baseUrl = config?.baseUrl ?? process.env.OLLAMA_HOST ?? "http://localhost:11434";
    this.model = config?.model ?? process.env.MANIFESTO_LLM_MODEL ?? DEFAULT_MODEL;
    this.defaultTemperature = config?.defaultTemperature ?? 0.1;
    this.timeout = config?.timeout ?? 30000;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const prompt = buildPrompt(request);
    const temperature = request.options?.temperature ?? this.defaultTemperature;

    try {
      const response = await callOllama(this.baseUrl, this.model, prompt, temperature, this.timeout);

      return {
        content: response.response ?? "",
        finishReason: "stop",
      };
    } catch (error) {
      throw toLLMError(error);
    }
  }
}

function buildPrompt(request: LLMRequest): string {
  const system = request.system ? `System: ${request.system}\n\n` : "";
  const messages = request.messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  return `${system}${messages}`.trim();
}

type OllamaGenerateResponse = {
  response?: string;
};

async function callOllama(
  baseUrl: string,
  model: string,
  prompt: string,
  temperature: number,
  timeoutMs: number
): Promise<OllamaGenerateResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new LLMError(`Ollama error (${response.status}): ${errorText}`, "SERVICE_ERROR", true);
    }

    return (await response.json()) as OllamaGenerateResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

function toLLMError(error: unknown): LLMError {
  if (error instanceof LLMError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.toLowerCase().includes("timeout")) {
    return new LLMError(message, "TIMEOUT", true, error);
  }

  return new LLMError(message, "SERVICE_ERROR", true, error);
}
