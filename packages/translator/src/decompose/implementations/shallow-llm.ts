/**
 * @fileoverview Shallow LLM Decomposition Strategy (ADR-003)
 *
 * LLM-based decomposition for complex inputs requiring
 * semantic understanding to identify intent boundaries.
 *
 * Per ADR-003:
 * - Uses LLM for boundary tagging only (C-LLM-DEC-1)
 * - Output MUST be verifiable against substring spans (C-DEC-5)
 * - Verification failure triggers fallback (C-LLM-DEC-2)
 */

import type {
  DecomposeStrategy,
  DecomposeResult,
  DecomposeContext,
  DecomposeChunk,
  DecomposeWarning,
} from "../types.js";

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
 * Expected LLM response format for span-based decomposition.
 * Per ADR-003 D3-2: Output ONLY span indices.
 */
type SpanResponse = {
  spans: Array<{ start: number; end: number }>;
};

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MAX_CHUNK_CHARS = 500;

/**
 * Prompt per ADR-003 D3-2 specification.
 * Outputs span indices only, no paraphrasing.
 */
const DECOMPOSE_SYSTEM_PROMPT = `You are a text segmentation assistant.
Given an input text, identify logical breakpoints where the text can be split into independent or semi-independent command chunks.

RULES:
1. Output ONLY the span indices [start, end] for each chunk
2. DO NOT paraphrase or summarize - chunks must be exact substrings
3. DO NOT analyze intent or meaning beyond boundary detection
4. Chunks must be contiguous and cover the entire input
5. end index is exclusive (like JavaScript slice)
6. Each chunk should represent a distinct user intent or action
7. Conjunctions like "and", "then", "also" often indicate separate intents

Output format: {"spans": [{"start": 0, "end": 45}, {"start": 46, "end": 120}]}

Examples:

Input: "Create a new project and add three tasks to it"
Output: {"spans": [{"start": 0, "end": 21}, {"start": 22, "end": 46}]}
(Chunks: "Create a new project", "and add three tasks to it")

Input: "Delete the old files, then compress the remaining ones"
Output: {"spans": [{"start": 0, "end": 20}, {"start": 22, "end": 54}]}
(Chunks: "Delete the old files", "then compress the remaining ones")

Input: "Create a project"
Output: {"spans": [{"start": 0, "end": 16}]}
(Single chunk - no splitting needed)`;

// =============================================================================
// ShallowLLMDecompose
// =============================================================================

/**
 * LLM-based decomposition for complex inputs.
 *
 * Per ADR-003 D3-2: "Shallow LLM pass for semantic boundaries"
 *
 * This strategy uses an LLM to identify semantic boundaries
 * in complex text, outputting span indices that are verified
 * against the original input to ensure substring constraint (C-DEC-1).
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

  async decompose(
    input: string,
    ctx?: DecomposeContext
  ): Promise<DecomposeResult> {
    const warnings: DecomposeWarning[] = [];

    // If not configured, fallback to deterministic single chunk
    if (!this.isConfigured()) {
      warnings.push({
        code: "LLM_NOT_CONFIGURED",
        message: "LLM not configured, falling back to single chunk",
      });
      return this.fallbackSingleChunk(input, warnings);
    }

    // Empty or very short text - no need to decompose
    if (!input.trim() || input.trim().length < 10) {
      return this.fallbackSingleChunk(input, warnings);
    }

    try {
      const spans = await this.callLLM(input);

      // Verify spans and create chunks (C-DEC-5)
      const verificationResult = this.verifyAndCreateChunks(input, spans, ctx);

      if (verificationResult.failed) {
        // Per C-LLM-DEC-2: fallback on verification failure
        warnings.push({
          code: "SPAN_VERIFICATION_FAILED",
          message: verificationResult.reason,
        });
        return this.fallbackDeterministic(input, ctx, warnings);
      }

      return {
        chunks: verificationResult.chunks,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      // Per C-LLM-DEC-2: fallback on LLM error
      warnings.push({
        code: "LLM_CALL_FAILED",
        message: error instanceof Error ? error.message : String(error),
      });
      return this.fallbackDeterministic(input, ctx, warnings);
    }
  }

  /**
   * Check if the provider is configured.
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Verify spans and create chunks per C-DEC-5.
   *
   * Per ADR-003 C-DEC-5:
   * - LLM strategies MUST include span and verify input.slice(start, end) === chunk.text
   * - Verification failure MUST trigger fallback or error
   */
  private verifyAndCreateChunks(
    input: string,
    spans: Array<{ start: number; end: number }>,
    _ctx?: DecomposeContext
  ):
    | { failed: false; chunks: DecomposeChunk[] }
    | { failed: true; reason: string } {
    // Check basic validity
    if (!Array.isArray(spans) || spans.length === 0) {
      return { failed: true, reason: "LLM returned empty or invalid spans" };
    }

    // Sort spans by start position (C-DEC-2: preserve order)
    const sortedSpans = [...spans].sort((a, b) => a.start - b.start);

    const chunks: DecomposeChunk[] = [];

    for (let i = 0; i < sortedSpans.length; i++) {
      const span = sortedSpans[i];

      // Validate span bounds
      if (
        typeof span.start !== "number" ||
        typeof span.end !== "number" ||
        span.start < 0 ||
        span.end > input.length ||
        span.start >= span.end
      ) {
        return {
          failed: true,
          reason: `Invalid span bounds: [${span.start}, ${span.end}] for input length ${input.length}`,
        };
      }

      // Extract text using span (C-DEC-1: contiguous substring)
      const text = input.slice(span.start, span.end);

      // Verify substring is non-empty after trimming
      if (!text.trim()) {
        return {
          failed: true,
          reason: `Empty chunk at span [${span.start}, ${span.end}]`,
        };
      }

      chunks.push({
        id: `chunk_${i}`,
        text: text,
        span: [span.start, span.end] as const,
      });
    }

    // Verify coverage (C-DEC-3: should form non-overlapping cover)
    // Note: We allow gaps (whitespace) but warn about significant gaps
    const coverage = this.checkCoverage(input, sortedSpans);
    if (coverage.gapChars > 10) {
      // Small gaps are OK (whitespace between chunks)
      // Large gaps indicate potential loss of content
      console.warn(
        `Decompose: ${coverage.gapChars} characters not covered by chunks`
      );
    }

    return { failed: false, chunks };
  }

  /**
   * Check coverage of spans over input.
   */
  private checkCoverage(
    input: string,
    spans: Array<{ start: number; end: number }>
  ): { gapChars: number; hasOverlap: boolean } {
    let gapChars = 0;
    let hasOverlap = false;
    let lastEnd = 0;

    for (const span of spans) {
      if (span.start < lastEnd) {
        hasOverlap = true;
      } else if (span.start > lastEnd) {
        // Gap between previous end and current start
        const gap = input.slice(lastEnd, span.start);
        // Only count non-whitespace as gap
        gapChars += gap.replace(/\s/g, "").length;
      }
      lastEnd = Math.max(lastEnd, span.end);
    }

    // Check trailing gap
    if (lastEnd < input.length) {
      const gap = input.slice(lastEnd);
      gapChars += gap.replace(/\s/g, "").length;
    }

    return { gapChars, hasOverlap };
  }

  /**
   * Fallback to returning input as a single chunk.
   */
  private fallbackSingleChunk(
    input: string,
    warnings: DecomposeWarning[]
  ): DecomposeResult {
    const trimmed = input.trim();
    if (!trimmed) {
      return {
        chunks: [],
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // Find the actual span of trimmed text in original
    const start = input.indexOf(trimmed);
    const end = start + trimmed.length;

    return {
      chunks: [
        {
          id: "chunk_0",
          text: trimmed,
          span: [start, end] as const,
        },
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Fallback to deterministic splitting per C-LLM-DEC-2.
   */
  private fallbackDeterministic(
    input: string,
    ctx?: DecomposeContext,
    warnings: DecomposeWarning[] = []
  ): DecomposeResult {
    warnings.push({
      code: "FALLBACK_DETERMINISTIC",
      message: "Using deterministic splitting as fallback",
    });

    const maxChars = ctx?.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS;
    const chunks = this.splitByPunctuation(input, maxChars);

    return {
      chunks,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Deterministic splitting by punctuation.
   * Used as fallback when LLM fails.
   */
  private splitByPunctuation(
    input: string,
    maxChars: number
  ): DecomposeChunk[] {
    const chunks: DecomposeChunk[] = [];

    // Split by sentence boundaries
    const boundaries = /(?<=[.!?。！？])\s+/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let chunkIndex = 0;

    while ((match = boundaries.exec(input)) !== null) {
      const end = match.index + match[0].length;
      const segment = input.slice(lastIndex, match.index + 1); // Include punctuation

      if (segment.trim()) {
        chunks.push({
          id: `chunk_${chunkIndex++}`,
          text: segment.trim(),
          span: [lastIndex, match.index + 1] as const,
        });
      }

      lastIndex = end;
    }

    // Add remaining text
    if (lastIndex < input.length) {
      const remaining = input.slice(lastIndex);
      if (remaining.trim()) {
        chunks.push({
          id: `chunk_${chunkIndex}`,
          text: remaining.trim(),
          span: [lastIndex, input.length] as const,
        });
      }
    }

    // If no boundaries found, return single chunk
    if (chunks.length === 0 && input.trim()) {
      const trimmed = input.trim();
      const start = input.indexOf(trimmed);
      chunks.push({
        id: "chunk_0",
        text: trimmed,
        span: [start, start + trimmed.length] as const,
      });
    }

    // Merge chunks that are too small, split chunks that are too large
    return this.balanceChunks(chunks, maxChars, input);
  }

  /**
   * Balance chunks to respect maxChars budget.
   */
  private balanceChunks(
    chunks: DecomposeChunk[],
    maxChars: number,
    originalInput: string
  ): DecomposeChunk[] {
    // For now, just return as-is
    // TODO: Implement merging/splitting for budget compliance
    return chunks;
  }

  /**
   * Call LLM to get span indices for decomposition.
   */
  private async callLLM(
    input: string
  ): Promise<Array<{ start: number; end: number }>> {
    const messages: OpenAIMessage[] = [
      { role: "system", content: DECOMPOSE_SYSTEM_PROMPT },
      { role: "user", content: input },
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

      return this.parseSpanResponse(content);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse LLM response to extract span indices.
   */
  private parseSpanResponse(
    content: string
  ): Array<{ start: number; end: number }> {
    try {
      const parsed = JSON.parse(content) as SpanResponse;

      if (Array.isArray(parsed.spans)) {
        return parsed.spans.filter(
          (s) =>
            typeof s === "object" &&
            s !== null &&
            typeof s.start === "number" &&
            typeof s.end === "number"
        );
      }

      return [];
    } catch {
      // Try to extract spans from malformed JSON
      const match = content.match(/"spans"\s*:\s*\[([\s\S]*?)\]/);
      if (match) {
        try {
          const spans = JSON.parse(`[${match[1]}]`) as unknown[];
          return spans.filter(
            (s): s is { start: number; end: number } =>
              typeof s === "object" &&
              s !== null &&
              "start" in s &&
              "end" in s &&
              typeof (s as Record<string, unknown>).start === "number" &&
              typeof (s as Record<string, unknown>).end === "number"
          );
        } catch {
          return [];
        }
      }
      return [];
    }
  }
}
