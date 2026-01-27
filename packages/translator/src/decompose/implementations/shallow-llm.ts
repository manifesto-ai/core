/**
 * @fileoverview Shallow LLM Decomposition Strategy (ADR-003)
 *
 * LLM-based decomposition for complex inputs requiring
 * semantic understanding to identify intent boundaries.
 */

import type { DecomposeStrategy, DecomposeResult } from "../types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for Shallow LLM Decompose.
 */
export type ShallowLLMConfig = {
  /** API key for the LLM provider */
  readonly apiKey?: string;

  /** Model to use (default: gpt-4o-mini) */
  readonly model?: string;

  /** Base URL for API (default: OpenAI) */
  readonly baseUrl?: string;

  /** Request timeout in milliseconds (default: 30000) */
  readonly timeout?: number;

  /** Temperature for sampling (default: 0.1) */
  readonly temperature?: number;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAIResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    total_tokens: number;
  };
};

/**
 * Expected LLM response format for decomposition.
 */
type DecomposeResponse = {
  segments: string[];
};

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

const DECOMPOSE_SYSTEM_PROMPT = `You are a text decomposition assistant. Your task is to split complex natural language input into separate, independent intent segments.

Rules:
1. Each segment should represent ONE distinct user intent/action
2. Preserve the original wording as much as possible
3. Split at logical boundaries where separate actions are described
4. Conjunctions like "and", "then", "also" often indicate separate intents
5. Maintain grammatical completeness in each segment
6. If the input is already a single intent, return it as-is

Return a JSON object with a "segments" array containing the split text segments.

Examples:

Input: "Create a new project and add three tasks to it"
Output: {"segments": ["Create a new project", "add three tasks to it"]}

Input: "Delete the old files, then compress the remaining ones and upload them"
Output: {"segments": ["Delete the old files", "compress the remaining ones", "upload them"]}

Input: "Create a project"
Output: {"segments": ["Create a project"]}

Input: "I want to update the title to 'New Title' and change the status to completed"
Output: {"segments": ["update the title to 'New Title'", "change the status to completed"]}`;

// =============================================================================
// ShallowLLMDecompose
// =============================================================================

/**
 * LLM-based decomposition for complex inputs.
 *
 * Per ADR-003: "Shallow LLM pass for semantic boundaries"
 *
 * This strategy uses an LLM to identify semantic boundaries
 * in complex text, splitting at intent-level divisions rather
 * than simple sentence boundaries.
 *
 * Suitable for:
 * - Complex sentences containing multiple intents
 * - Text requiring semantic understanding for splitting
 * - Inputs with implicit intent boundaries
 *
 * Requires:
 * - LLM provider configuration (API key)
 */
export class ShallowLLMDecompose implements DecomposeStrategy {
  readonly name = "shallow-llm";

  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly temperature: number;

  constructor(config?: ShallowLLMConfig) {
    this.apiKey = config?.apiKey ?? process.env.OPENAI_API_KEY;
    this.model =
      config?.model ?? process.env.MANIFESTO_LLM_MODEL ?? DEFAULT_MODEL;
    this.baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    this.temperature = config?.temperature ?? DEFAULT_TEMPERATURE;
  }

  async decompose(text: string): Promise<DecomposeResult> {
    // If not configured, fallback to single chunk
    if (!this.isConfigured()) {
      return this.fallbackSingleChunk(text);
    }

    // Empty or very short text - no need to decompose
    if (!text.trim() || text.trim().length < 10) {
      return this.fallbackSingleChunk(text);
    }

    try {
      const segments = await this.callLLM(text);

      // If LLM returns empty or single segment, use original text
      if (segments.length === 0) {
        return this.fallbackSingleChunk(text);
      }

      const chunks = segments.map((segment, i) => ({
        nodes: [],
        meta: {
          sourceText: segment.trim(),
          translatedAt: new Date().toISOString(),
          chunkIndex: i,
        },
      }));

      return {
        chunks,
        meta: {
          strategy: this.name,
          chunkCount: chunks.length,
          decomposedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      // On error, fallback to single chunk
      console.warn(
        `ShallowLLMDecompose failed, falling back to single chunk: ${error}`
      );
      return this.fallbackSingleChunk(text);
    }
  }

  /**
   * Check if the provider is configured.
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Fallback to returning input as a single chunk.
   */
  private fallbackSingleChunk(text: string): DecomposeResult {
    return {
      chunks: text.trim()
        ? [
            {
              nodes: [],
              meta: {
                sourceText: text.trim(),
                translatedAt: new Date().toISOString(),
                chunkIndex: 0,
              },
            },
          ]
        : [],
      meta: {
        strategy: this.name,
        chunkCount: text.trim() ? 1 : 0,
        decomposedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Call LLM to decompose text into segments.
   */
  private async callLLM(text: string): Promise<string[]> {
    const messages: OpenAIMessage[] = [
      { role: "system", content: DECOMPOSE_SYSTEM_PROMPT },
      { role: "user", content: text },
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

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
          temperature: this.temperature,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as OpenAIResponse;
      const content = data.choices[0]?.message?.content ?? "";

      return this.parseResponse(content);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse LLM response to extract segments.
   */
  private parseResponse(content: string): string[] {
    try {
      const parsed = JSON.parse(content) as DecomposeResponse;

      if (Array.isArray(parsed.segments)) {
        return parsed.segments.filter(
          (s) => typeof s === "string" && s.trim().length > 0
        );
      }

      return [];
    } catch {
      // Try to extract from malformed JSON
      const match = content.match(/"segments"\s*:\s*\[([\s\S]*?)\]/);
      if (match) {
        try {
          const segments = JSON.parse(`[${match[1]}]`) as unknown[];
          return segments.filter(
            (s) => typeof s === "string" && (s as string).trim().length > 0
          ) as string[];
        } catch {
          return [];
        }
      }
      return [];
    }
  }
}
