/**
 * LLM Provider Interface (SPEC-1.1.1v)
 *
 * Abstracts LLM interactions for the proposer stage.
 * Providers MUST implement this interface.
 */

import { z } from "zod";
import type {
  PatchFragment,
  AmbiguityReport,
  DomainSchema,
  TypeIndex,
  AnchorCandidate,
} from "../domain/index.js";

// =============================================================================
// Propose Request/Response
// =============================================================================

/**
 * Translation example for few-shot prompting
 */
export interface TranslationExample {
  /** Natural language input */
  input: string;
  /** Expected fragments */
  fragments: PatchFragment[];
  /** Context used */
  context?: string;
}

export const TranslationExampleSchema = z.object({
  input: z.string(),
  fragments: z.array(z.any()),
  context: z.string().optional(),
});

/**
 * Request to propose fragments
 */
export interface ProposeRequest {
  /** Normalized natural language input */
  input: string;
  /** Canonical input for caching */
  canonicalInput: string;
  /** World schema */
  schema: DomainSchema;
  /** Type index derived from schema */
  typeIndex: TypeIndex;
  /** Anchor candidates from retrieval */
  anchors: AnchorCandidate[];
  /** Examples from memory */
  examples?: TranslationExample[];
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for generation */
  temperature?: number;
  /** Intent ID for tracing */
  intentId: string;
}

export const ProposeRequestSchema = z.object({
  input: z.string(),
  canonicalInput: z.string(),
  schema: z.any(),
  typeIndex: z.record(z.any()),
  anchors: z.array(z.any()),
  examples: z.array(TranslationExampleSchema).optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  intentId: z.string(),
});

/**
 * Response from propose
 */
export type ProposeResponse =
  | { kind: "fragments"; fragments: PatchFragment[]; confidence: number }
  | { kind: "ambiguity"; report: AmbiguityReport }
  | { kind: "empty"; reason: string };

export const ProposeResponseSchema = z.union([
  z.object({
    kind: z.literal("fragments"),
    fragments: z.array(z.any()),
    confidence: z.number(),
  }),
  z.object({
    kind: z.literal("ambiguity"),
    report: z.any(),
  }),
  z.object({
    kind: z.literal("empty"),
    reason: z.string(),
  }),
]);

// =============================================================================
// Provider Metrics
// =============================================================================

/**
 * Metrics from a provider call
 */
export interface ProviderMetrics {
  /** Model used */
  modelId: string;
  /** Input tokens */
  promptTokens: number;
  /** Output tokens */
  completionTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Latency in ms */
  latencyMs: number;
  /** Whether response was cached */
  cached?: boolean;
}

export const ProviderMetricsSchema = z.object({
  modelId: z.string(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  latencyMs: z.number(),
  cached: z.boolean().optional(),
});

// =============================================================================
// Provider Result
// =============================================================================

/**
 * Result from a provider call
 */
export interface ProviderResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  metrics: ProviderMetrics;
}

// =============================================================================
// Provider Interface
// =============================================================================

/**
 * LLM Provider interface
 *
 * Providers handle:
 * - Prompt construction
 * - API calls
 * - Response parsing
 * - Error handling
 */
export interface LLMProvider {
  /** Provider name */
  readonly name: string;

  /** Default model ID */
  readonly defaultModel: string;

  /**
   * Propose fragments from natural language
   *
   * @param request - Propose request
   * @returns Propose response with metrics
   */
  propose(request: ProposeRequest): Promise<ProviderResult<ProposeResponse>>;

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean;

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] };
}

// =============================================================================
// Provider Configuration
// =============================================================================

/**
 * Base provider configuration
 */
export interface BaseProviderConfig {
  /** API key (or env var name) */
  apiKey?: string;
  /** Model to use */
  model?: string;
  /** Base URL (for proxies) */
  baseUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Maximum retries */
  maxRetries?: number;
}

export const BaseProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
  baseUrl: z.string().optional(),
  timeout: z.number().optional(),
  maxRetries: z.number().optional(),
});

/**
 * OpenAI provider configuration
 */
export interface OpenAIProviderConfig extends BaseProviderConfig {
  organization?: string;
}

export const OpenAIProviderConfigSchema = BaseProviderConfigSchema.extend({
  organization: z.string().optional(),
});

/**
 * Anthropic provider configuration
 */
export interface AnthropicProviderConfig extends BaseProviderConfig {
  anthropicVersion?: string;
}

export const AnthropicProviderConfigSchema = BaseProviderConfigSchema.extend({
  anthropicVersion: z.string().optional(),
});
