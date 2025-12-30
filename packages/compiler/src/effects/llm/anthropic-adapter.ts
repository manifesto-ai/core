import Anthropic from "@anthropic-ai/sdk";
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
 * Anthropic adapter options
 */
export interface AnthropicAdapterOptions extends Partial<LLMAdapterConfig> {
  /**
   * Anthropic API key
   * Falls back to ANTHROPIC_API_KEY environment variable
   */
  apiKey?: string;
}

/**
 * Anthropic Claude adapter for LLM operations
 *
 * Per FDR-C011: LLM interactions are effect handlers, not direct calls.
 * This adapter implements the LLMAdapter interface for use with effect handlers.
 */
export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  private config: Required<LLMAdapterConfig>;

  constructor(options: AnthropicAdapterOptions = {}) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      timeout: options.timeout ?? DEFAULT_LLM_CONFIG.timeout,
    });

    this.config = {
      model: options.model ?? DEFAULT_LLM_CONFIG.model,
      maxTokens: options.maxTokens ?? DEFAULT_LLM_CONFIG.maxTokens,
      temperature: options.temperature ?? DEFAULT_LLM_CONFIG.temperature,
      timeout: options.timeout ?? DEFAULT_LLM_CONFIG.timeout,
      systemPromptPrefix: options.systemPromptPrefix ?? DEFAULT_LLM_CONFIG.systemPromptPrefix,
    };
  }

  /**
   * Segment natural language text into requirement segments
   */
  async segment(params: { text: string }): Promise<SegmentResult> {
    try {
      const { systemPrompt, userPrompt } = createSegmentPrompt(params.text);

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPromptPrefix + systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = this.extractTextContent(response);

      // Check for resolution request (unlikely for segmentation, but possible)
      const resolution = extractResolutionRequest(content);
      if (resolution) {
        return {
          ok: "resolution",
          reason: resolution.reason,
          options: resolution.options,
        };
      }

      const parseResult = parseJSONResponse<unknown>(content);
      if (!parseResult.ok) {
        return { ok: false, error: parseResult.error };
      }

      const validateResult = validateSegmentsResponse(parseResult.data);
      if (!validateResult.ok) {
        return { ok: false, error: validateResult.error };
      }

      return { ok: true, data: { segments: validateResult.data.segments } };
    } catch (error) {
      return { ok: false, error: this.formatError(error) };
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
      const { systemPrompt, userPrompt } = createNormalizePrompt(
        params.segments,
        params.schema,
        params.context
      );

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPromptPrefix + systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = this.extractTextContent(response);

      // Check for resolution request
      const resolution = extractResolutionRequest(content);
      if (resolution) {
        return {
          ok: "resolution",
          reason: resolution.reason,
          options: resolution.options,
        };
      }

      const parseResult = parseJSONResponse<unknown>(content);
      if (!parseResult.ok) {
        return { ok: false, error: parseResult.error };
      }

      const validateResult = validateIntentsResponse(parseResult.data);
      if (!validateResult.ok) {
        return { ok: false, error: validateResult.error };
      }

      // Cast to NormalizedIntent
      const intents: NormalizedIntent[] = validateResult.data.intents.map((i) => ({
        kind: i.kind as "state" | "computed" | "action" | "constraint",
        description: i.description,
        confidence: i.confidence,
      }));

      return { ok: true, data: { intents } };
    } catch (error) {
      return { ok: false, error: this.formatError(error) };
    }
  }

  /**
   * Propose a DomainDraft from intents
   *
   * Per FDR-C002: LLM output is an untrusted proposal.
   */
  async propose(params: {
    schema: unknown;
    intents: NormalizedIntent[];
    history: AttemptRecord[];
    context?: CompilerContext;
    resolution?: string;
  }): Promise<ProposeResult> {
    try {
      const { systemPrompt, userPrompt } = createProposePrompt(
        params.schema,
        params.intents,
        params.history,
        params.context,
        params.resolution
      );

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPromptPrefix + systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = this.extractTextContent(response);

      // Check for resolution request
      const resolution = extractResolutionRequest(content);
      if (resolution) {
        return {
          ok: "resolution",
          reason: resolution.reason,
          options: resolution.options,
        };
      }

      const parseResult = parseJSONResponse<unknown>(content);
      if (!parseResult.ok) {
        return { ok: false, error: parseResult.error };
      }

      const validateResult = validateDraftResponse(parseResult.data);
      if (!validateResult.ok) {
        return { ok: false, error: validateResult.error };
      }

      return { ok: true, data: { draft: validateResult.data.draft } };
    } catch (error) {
      return { ok: false, error: this.formatError(error) };
    }
  }

  /**
   * Extract text content from Anthropic response
   */
  private extractTextContent(response: Anthropic.Message): string {
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in response");
    }
    return textBlock.text;
  }

  /**
   * Format error for consistent error messages
   */
  private formatError(error: unknown): string {
    if (error instanceof Anthropic.APIError) {
      return `Anthropic API error: ${error.message} (${error.status})`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

/**
 * Create an Anthropic adapter with options
 *
 * @param options - Adapter configuration options
 * @returns LLMAdapter instance
 */
export function createAnthropicAdapter(options?: AnthropicAdapterOptions): LLMAdapter {
  return new AnthropicAdapter(options);
}
