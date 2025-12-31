/**
 * @manifesto-ai/compiler v1.1 Anthropic Adapter
 *
 * LLM Adapter implementation using Anthropic Claude API.
 * Per SPEC §10: LLM Actors are untrusted proposers.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMAdapter,
  LLMAdapterConfig,
  PlanRequest,
  PlanResult,
  GenerateRequest,
  GenerateResult,
  RawPlanOutput,
  RawDraftOutput,
} from "./adapter.js";
import { DEFAULT_LLM_CONFIG } from "./adapter.js";
import { createPlanPrompt } from "./prompts/plan.js";
import { createGeneratePrompt } from "./prompts/generate.js";
import {
  parseJSONResponse,
  extractAmbiguity,
  validatePlanResponse,
  validateFragmentDraftResponse,
} from "./parser.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Adapter Options
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// §2 Anthropic Adapter Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Anthropic Claude adapter for LLM operations
 *
 * Per SPEC §10: LLM Actors are implemented as effect handlers.
 * This adapter implements the v1.1 LLMAdapter interface.
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

  // ─────────────────────────────────────────────────────────────────────────────
  // §2.1 Plan
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a Plan from SourceInput
   *
   * Per SPEC §10.3: PlannerActor responsibility.
   */
  async plan(request: PlanRequest): Promise<PlanResult> {
    try {
      const { systemPrompt, userPrompt } = createPlanPrompt({
        sourceInput: request.sourceInput,
        hints: request.hints,
      });

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPromptPrefix + systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = this.extractTextContent(response);

      // Parse JSON
      const parseResult = parseJSONResponse<unknown>(content);
      if (!parseResult.ok) {
        return { ok: false, error: parseResult.error };
      }

      // Check for explicit error
      const data = parseResult.data as Record<string, unknown>;
      if (data.error) {
        return { ok: false, error: String(data.error) };
      }

      // Check for ambiguity
      const ambiguity = extractAmbiguity<{ plan: Record<string, unknown> }>(data);
      if (ambiguity) {
        // Validate each alternative
        const validatedAlternatives: Array<{ plan: RawPlanOutput }> = [];
        for (const alt of ambiguity.alternatives) {
          const validateResult = validatePlanResponse(alt);
          if (validateResult.ok) {
            validatedAlternatives.push({ plan: validateResult.data.plan });
          }
        }

        if (validatedAlternatives.length === 0) {
          return { ok: false, error: "All alternatives failed validation" };
        }

        return {
          ok: "ambiguous",
          reason: ambiguity.reason,
          alternatives: validatedAlternatives,
        };
      }

      // Validate plan response
      const validateResult = validatePlanResponse(data);
      if (!validateResult.ok) {
        return { ok: false, error: validateResult.error };
      }

      return {
        ok: true,
        data: { plan: validateResult.data.plan },
      };
    } catch (error) {
      return { ok: false, error: this.formatError(error) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §2.2 Generate
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a FragmentDraft from a Chunk
   *
   * Per SPEC §10.4: GeneratorActor responsibility.
   */
  async generate(request: GenerateRequest): Promise<GenerateResult> {
    try {
      const { systemPrompt, userPrompt } = createGeneratePrompt({
        chunk: request.chunk,
        plan: request.plan,
        existingFragments: request.existingFragments,
        retryContext: request.retryContext,
      });

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPromptPrefix + systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = this.extractTextContent(response);

      // Parse JSON
      const parseResult = parseJSONResponse<unknown>(content);
      if (!parseResult.ok) {
        return { ok: false, error: parseResult.error };
      }

      // Check for explicit error
      const data = parseResult.data as Record<string, unknown>;
      if (data.error) {
        return { ok: false, error: String(data.error) };
      }

      // Check for ambiguity
      const ambiguity = extractAmbiguity<{ draft: Record<string, unknown> }>(data);
      if (ambiguity) {
        // Validate each alternative
        const validatedAlternatives: Array<{ draft: RawDraftOutput }> = [];
        for (const alt of ambiguity.alternatives) {
          const validateResult = validateFragmentDraftResponse(alt);
          if (validateResult.ok) {
            validatedAlternatives.push({ draft: validateResult.data.draft });
          }
        }

        if (validatedAlternatives.length === 0) {
          return { ok: false, error: "All alternatives failed validation" };
        }

        return {
          ok: "ambiguous",
          reason: ambiguity.reason,
          alternatives: validatedAlternatives,
        };
      }

      // Validate fragment draft response
      const validateResult = validateFragmentDraftResponse(data);
      if (!validateResult.ok) {
        return { ok: false, error: validateResult.error };
      }

      return {
        ok: true,
        data: { draft: validateResult.data.draft },
      };
    } catch (error) {
      return { ok: false, error: this.formatError(error) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §2.3 Helpers
  // ─────────────────────────────────────────────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════
// §3 Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create an Anthropic adapter with options
 *
 * @param options - Adapter configuration options
 * @returns LLMAdapter instance
 */
export function createAnthropicAdapter(options?: AnthropicAdapterOptions): LLMAdapter {
  return new AnthropicAdapter(options);
}
