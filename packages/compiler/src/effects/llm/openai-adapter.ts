/**
 * @manifesto-ai/compiler v1.1 OpenAI Adapter
 *
 * LLM Adapter implementation using OpenAI API.
 * Per SPEC §10: LLM Actors are untrusted proposers.
 */

import OpenAI from "openai";
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
import { createClassifyPrompt } from "./prompts/classify.js";
import {
  parseJSONResponse,
  extractAmbiguity,
  validatePlanResponse,
  validateFragmentDraftResponse,
} from "./parser.js";
import {
  splitInput,
  inferDependencies,
  type Segment,
  type ClassifiedSegment,
} from "./splitter.js";
import type { FragmentType } from "../../domain/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Adapter Options
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for parallel planning
 */
export interface ParallelPlanOptions {
  /** Maximum number of concurrent API calls (default: 3) */
  maxConcurrency?: number;
  /** Number of segments per batch (default: 3) */
  batchSize?: number;
}

/**
 * Valid fragment types
 */
const VALID_FRAGMENT_TYPES = ["state", "computed", "action", "constraint", "effect", "flow"];

function isValidFragmentType(type: string): boolean {
  return VALID_FRAGMENT_TYPES.includes(type);
}

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
const DEFAULT_OPENAI_CONFIG: Required<LLMAdapterConfig> = {
  model: "gpt-4o-mini",
  maxTokens: 4096,
  temperature: 0.2,  // Lower temperature for structured output
  timeout: 60000,
  systemPromptPrefix: "",
};

// ═══════════════════════════════════════════════════════════════════════════════
// §2 OpenAI Adapter Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * OpenAI adapter for LLM operations
 *
 * Per SPEC §10: LLM Actors are implemented as effect handlers.
 * This adapter implements the v1.1 LLMAdapter interface.
 */
export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  private config: LLMAdapterConfig;

  constructor(options: OpenAIAdapterOptions = {}) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      organization: options.organization,
      timeout: options.timeout ?? DEFAULT_OPENAI_CONFIG.timeout,
    });

    this.config = {
      model: options.model ?? DEFAULT_OPENAI_CONFIG.model,
      max_completion_tokens: options.maxTokens ?? DEFAULT_OPENAI_CONFIG.maxTokens,
      temperature: options.temperature ?? DEFAULT_OPENAI_CONFIG.temperature,
      timeout: options.timeout ?? DEFAULT_OPENAI_CONFIG.timeout,
      systemPromptPrefix: options.systemPromptPrefix ?? DEFAULT_OPENAI_CONFIG.systemPromptPrefix,
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

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_completion_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          { role: "system", content: this.config.systemPromptPrefix + systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { ok: false, error: "Empty response from LLM" };
      }

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
  // §2.2 Plan Parallel (Optimized)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a Plan using parallel classification
   *
   * Optimized version that:
   * 1. Splits input into segments by line breaks
   * 2. Classifies segments in parallel batches
   * 3. Infers dependencies deterministically
   */
  async planParallel(
    request: PlanRequest,
    options: ParallelPlanOptions = {}
  ): Promise<PlanResult> {
    const maxConcurrency = options.maxConcurrency ?? 3;
    const batchSize = options.batchSize ?? 3;

    try {
      // Step 1: Split input into segments
      const { segments, batches } = splitInput(request.sourceInput.content, {
        batchSize,
        minLength: 10,
      });

      if (segments.length === 0) {
        return { ok: false, error: "No segments found in input" };
      }

      if (process.env.DEBUG) {
        console.log(`[PlanParallel] Split into ${segments.length} segments, ${batches.length} batches`);
      }

      // Step 2: Classify batches in parallel
      const classifyResults = await this.classifyBatchesParallel(
        batches,
        maxConcurrency
      );

      // Check for errors
      const errors = classifyResults.filter((r) => r.error);
      if (errors.length > 0) {
        return { ok: false, error: errors.map((e) => e.error).join("; ") };
      }

      // Flatten classifications
      const allClassified: ClassifiedSegment[] = classifyResults.flatMap(
        (r) => r.classified ?? []
      );

      if (allClassified.length === 0) {
        return { ok: false, error: "Classification returned no results" };
      }

      if (process.env.DEBUG) {
        console.log(`[PlanParallel] Classified ${allClassified.length} segments`);
      }

      // Step 3: Infer dependencies
      const chunksWithDeps = inferDependencies(allClassified);

      // Step 4: Build plan
      const plan: RawPlanOutput = {
        strategy: "by-statement",
        chunks: chunksWithDeps.map((chunk, index) => ({
          content: chunk.content,
          expectedType: chunk.expectedType,
          dependencies: chunk.dependencies,
          sourceSpan: segments[index]
            ? { start: segments[index].startOffset, end: segments[index].endOffset }
            : undefined,
        })),
        rationale: `Parallel classification of ${segments.length} statements`,
      };

      return {
        ok: true,
        data: { plan },
      };
    } catch (error) {
      return { ok: false, error: this.formatError(error) };
    }
  }

  /**
   * Classify batches in parallel with concurrency limit
   */
  private async classifyBatchesParallel(
    batches: Segment[][],
    maxConcurrency: number
  ): Promise<Array<{ classified?: ClassifiedSegment[]; error?: string }>> {
    const results: Array<{ classified?: ClassifiedSegment[]; error?: string }> = [];

    // Process batches with concurrency limit
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const chunk = batches.slice(i, i + maxConcurrency);
      const promises = chunk.map((batch) => this.classifyBatch(batch));
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Classify a single batch of segments
   */
  private async classifyBatch(
    segments: Segment[]
  ): Promise<{ classified?: ClassifiedSegment[]; error?: string }> {
    try {
      const { systemPrompt, userPrompt } = createClassifyPrompt({ segments });

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_completion_tokens: 1024, // Smaller for classification
        temperature: 0.1, // Lower for classification
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { error: "Empty response from LLM" };
      }

      // Parse JSON array
      const parseResult = parseJSONResponse<unknown[]>(content);
      if (!parseResult.ok) {
        return { error: parseResult.error };
      }

      // Validate and map to ClassifiedSegment
      const data = parseResult.data as Array<{ index: number; type: string }>;
      const classified: ClassifiedSegment[] = [];

      for (const item of data) {
        const segment = segments.find((s) => s.index === item.index);
        if (segment && isValidFragmentType(item.type)) {
          classified.push({
            content: segment.content,
            type: item.type as FragmentType,
            index: item.index,
          });
        }
      }

      return { classified };
    } catch (error) {
      return { error: this.formatError(error) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §2.3 Generate
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

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_completion_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          { role: "system", content: this.config.systemPromptPrefix + systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { ok: false, error: "Empty response from LLM" };
      }

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
   * Format error for consistent error messages
   */
  private formatError(error: unknown): string {
    if (error instanceof OpenAI.APIError) {
      return `OpenAI API error: ${error.message} (${error.status})`;
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
 * Create an OpenAI adapter with options
 *
 * @param options - Adapter configuration options
 * @returns LLMAdapter instance
 */
export function createOpenAIAdapter(options?: OpenAIAdapterOptions): LLMAdapter {
  return new OpenAIAdapter(options);
}
