import OpenAI from "openai";
import type {
  LLMAdapter,
  LLMAdapterConfig,
  SegmentResult,
  NormalizeResult,
  ProposeResult,
} from "./adapter.js";
import { DEFAULT_LLM_CONFIG } from "./adapter.js";
import { createSegmentPrompt, createNormalizePrompt, createProposePrompt } from "./prompts/index.js";
import {
  parseJSONResponse,
  extractResolutionRequest,
  validateSegmentsResponse,
  validateIntentsResponse,
  validateDraftResponse,
} from "./parser.js";
import type { CompilerContext, NormalizedIntent, AttemptRecord } from "../../domain/types.js";

/**
 * OpenAI adapter options
 */
export interface OpenAIAdapterOptions extends Partial<LLMAdapterConfig> {
  /**
   * OpenAI API key
   * Falls back to OPENAI_API_KEY environment variable
   */
  apiKey?: string;

  /**
   * OpenAI base URL (for Azure OpenAI or compatible APIs)
   */
  baseURL?: string;

  /**
   * Organization ID (optional)
   */
  organization?: string;
}

/**
 * Default OpenAI configuration
 */
const DEFAULT_OPENAI_CONFIG: Required<Omit<LLMAdapterConfig, "systemPromptPrefix">> & {
  systemPromptPrefix: string;
} = {
  model: "gpt-4o",
  maxTokens: 4096,
  temperature: 0.1,
  timeout: 60000,
  systemPromptPrefix: "",
};

/**
 * OpenAI adapter for LLM operations
 *
 * Implements the LLMAdapter interface for OpenAI GPT models.
 */
export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  private config: Required<LLMAdapterConfig>;

  constructor(options: OpenAIAdapterOptions = {}) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      organization: options.organization,
      timeout: options.timeout ?? DEFAULT_OPENAI_CONFIG.timeout,
    });

    this.config = {
      model: options.model ?? DEFAULT_OPENAI_CONFIG.model,
      maxTokens: options.maxTokens ?? DEFAULT_OPENAI_CONFIG.maxTokens,
      temperature: options.temperature ?? DEFAULT_OPENAI_CONFIG.temperature,
      timeout: options.timeout ?? DEFAULT_OPENAI_CONFIG.timeout,
      systemPromptPrefix: options.systemPromptPrefix ?? DEFAULT_OPENAI_CONFIG.systemPromptPrefix,
    };
  }

  /**
   * Segment natural language text into requirement segments
   */
  async segment(params: { text: string }): Promise<SegmentResult> {
    try {
      const prompt = createSegmentPrompt(params.text);
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: "system",
            content: this.config.systemPromptPrefix + prompt.systemPrompt,
          },
          {
            role: "user",
            content: prompt.userPrompt,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { ok: false, error: "Empty response from LLM" };
      }

      // Check for resolution request
      const resolution = extractResolutionRequest(content);
      if (resolution) {
        return {
          ok: "resolution",
          reason: resolution.reason,
          options: resolution.options,
        };
      }

      // Parse and validate response
      const parsed = parseJSONResponse<{ segments: string[] }>(content);
      if (!parsed.ok) {
        return { ok: false, error: `Failed to parse response: ${parsed.error}` };
      }

      const validated = validateSegmentsResponse(parsed.data);
      if (!validated.ok) {
        return { ok: false, error: `Invalid response: ${validated.error}` };
      }

      return { ok: true, data: validated.data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Normalize segments into structured intents
   */
  async normalize(params: {
    segments: string[];
    schema: unknown;
    context?: CompilerContext;
  }): Promise<NormalizeResult> {
    try {
      const prompt = createNormalizePrompt(params.segments, params.schema, params.context);
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: "system",
            content: this.config.systemPromptPrefix + prompt.systemPrompt,
          },
          {
            role: "user",
            content: prompt.userPrompt,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { ok: false, error: "Empty response from LLM" };
      }

      // Check for resolution request
      const resolution = extractResolutionRequest(content);
      if (resolution) {
        return {
          ok: "resolution",
          reason: resolution.reason,
          options: resolution.options,
        };
      }

      // Parse and validate response
      const parsed = parseJSONResponse<{ intents: NormalizedIntent[] }>(content);
      if (!parsed.ok) {
        return { ok: false, error: `Failed to parse response: ${parsed.error}` };
      }

      const validated = validateIntentsResponse(parsed.data);
      if (!validated.ok) {
        return { ok: false, error: `Invalid response: ${validated.error}` };
      }

      // Cast to NormalizedIntent (validator ensures correctness)
      const intents: NormalizedIntent[] = validated.data.intents.map((i) => ({
        kind: i.kind as "state" | "computed" | "action" | "constraint",
        description: i.description,
        confidence: i.confidence,
      }));

      return { ok: true, data: { intents } };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Propose a DomainDraft from intents
   */
  async propose(params: {
    schema: unknown;
    intents: NormalizedIntent[];
    history: AttemptRecord[];
    context?: CompilerContext;
    resolution?: string;
  }): Promise<ProposeResult> {
    try {
      const prompt = createProposePrompt(
        params.schema,
        params.intents,
        params.history,
        params.context,
        params.resolution
      );
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: "system",
            content: this.config.systemPromptPrefix + prompt.systemPrompt,
          },
          {
            role: "user",
            content: prompt.userPrompt,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { ok: false, error: "Empty response from LLM" };
      }

      // Check for resolution request
      const resolution = extractResolutionRequest(content);
      if (resolution) {
        return {
          ok: "resolution",
          reason: resolution.reason,
          options: resolution.options,
        };
      }

      // Parse and validate response
      const parsed = parseJSONResponse<{ draft: unknown }>(content);
      if (!parsed.ok) {
        return { ok: false, error: `Failed to parse response: ${parsed.error}` };
      }

      const validated = validateDraftResponse(parsed.data);
      if (!validated.ok) {
        return { ok: false, error: `Invalid response: ${validated.error}` };
      }

      return { ok: true, data: validated.data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

/**
 * Create an OpenAI adapter instance
 */
export function createOpenAIAdapter(options: OpenAIAdapterOptions = {}): LLMAdapter {
  return new OpenAIAdapter(options);
}
