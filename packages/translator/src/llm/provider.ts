/**
 * @fileoverview LLM Provider Interface (SPEC Section 10.5)
 *
 * Defines the interface for LLM providers used by translate().
 */

import type { IntentIR, Role } from "@manifesto-ai/intent-ir";

// =============================================================================
// LLMTranslateRequest
// =============================================================================

/**
 * Request to translate natural language to intents.
 */
export type LLMTranslateRequest = {
  /** The natural language input to translate */
  readonly input: string;

  /** Language hint (ISO 639-1) */
  readonly language?: string;

  /** Domain context for disambiguation */
  readonly domainHint?: string;

  /** Maximum nodes to generate */
  readonly maxNodes?: number;

  /** Temperature for sampling (0-1, default: 0.1) */
  readonly temperature?: number;
};

// =============================================================================
// LLMIntentNode
// =============================================================================

/**
 * Ambiguity indicators from LLM.
 */
export type AmbiguityIndicators = {
  /** Whether the intent has unresolved discourse references */
  readonly hasUnresolvedRef: boolean;

  /** Missing required roles (by LLM's assessment) */
  readonly missingRequiredRoles: readonly Role[];

  /** Whether multiple interpretations are possible */
  readonly multipleInterpretations: boolean;

  /** LLM's confidence in this interpretation (0-1) */
  readonly confidenceScore: number;
};

/**
 * A single intent node from LLM output.
 */
export type LLMIntentNode = {
  /** Temporary ID for cross-referencing within the response */
  readonly tempId: string;

  /** The generated IntentIR */
  readonly ir: IntentIR;

  /** Dependencies by temporary ID */
  readonly dependsOnTempIds: readonly string[];

  /** Ambiguity indicators for scoring */
  readonly ambiguityIndicators: AmbiguityIndicators;
};

// =============================================================================
// LLMMetrics
// =============================================================================

/**
 * Metrics from LLM translation.
 */
export type LLMMetrics = {
  /** Time taken for the LLM request in milliseconds */
  readonly latencyMs: number;

  /** Number of tokens used (input + output) */
  readonly totalTokens?: number;

  /** Input tokens */
  readonly inputTokens?: number;

  /** Output tokens */
  readonly outputTokens?: number;

  /** Model identifier used */
  readonly model?: string;
};

// =============================================================================
// LLMTranslateResponse
// =============================================================================

/**
 * Response from LLM translation.
 */
export type LLMTranslateResponse = {
  /** Generated intent nodes */
  readonly nodes: readonly LLMIntentNode[];

  /** Raw response string (for debugging) */
  readonly rawResponse?: string;

  /** Translation metrics */
  readonly metrics: LLMMetrics;
};

// =============================================================================
// LLMProvider
// =============================================================================

/**
 * Interface for LLM providers.
 *
 * Providers translate natural language input to structured intent nodes.
 */
export interface LLMProvider {
  /** Provider name (e.g., "openai", "anthropic") */
  readonly name: string;

  /**
   * Translate natural language to intent nodes.
   *
   * @param request - Translation request
   * @returns Translation response with nodes and metrics
   */
  translate(request: LLMTranslateRequest): Promise<LLMTranslateResponse>;

  /**
   * Check if the provider is properly configured.
   *
   * @returns true if API key and other required config is present
   */
  isConfigured(): boolean;
}

// =============================================================================
// LLMProviderConfig
// =============================================================================

/**
 * Configuration for LLM provider.
 */
export type LLMProviderConfig = {
  /** API key (can also come from environment) */
  readonly apiKey?: string;

  /** Model to use */
  readonly model?: string;

  /** Base URL override */
  readonly baseUrl?: string;

  /** Request timeout in milliseconds */
  readonly timeout?: number;

  /** Default temperature */
  readonly defaultTemperature?: number;
};
