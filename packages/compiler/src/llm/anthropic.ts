/**
 * Anthropic LLM Adapter
 *
 * LLMAdapter implementation using Anthropic's Claude API.
 *
 * AGENT_README Invariants:
 * - #2: LLM은 비신뢰 제안자 (FragmentDraft만 생성)
 * - #4: 모든 출력에 출처 (promptHash for provenance)
 */

import type { LLMAdapter, LLMContext } from '../types/session.js';
import type { FragmentDraft } from '../types/fragment-draft.js';
import {
  hashPrompt,
  RateLimiter,
  withRetry,
  parseJSONArray,
  timeout,
  RetryableError,
} from './utils.js';
import {
  buildSystemPrompt,
  buildUserPrompt,
  validateDraftStructure,
  normalizeDraft,
} from './prompts.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Anthropic adapter configuration
 */
export interface AnthropicAdapterConfig {
  /** API key for authentication */
  apiKey: string;
  /** Model to use (default: claude-sonnet-4-20250514) */
  model?: string;
  /** Base URL for API (default: https://api.anthropic.com) */
  baseUrl?: string;
  /** Maximum tokens to generate (default: 4096) */
  maxTokens?: number;
  /** Temperature (default: 0.3) */
  temperature?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Rate limit (requests per minute, default: 50) */
  rateLimit?: number;
  /** Request timeout in ms (default: 60000) */
  timeout?: number;
  /** Maximum confidence the adapter will report (default: 0.9) */
  maxConfidence?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Omit<AnthropicAdapterConfig, 'apiKey'>> = {
  model: 'claude-sonnet-4-20250514',
  baseUrl: 'https://api.anthropic.com',
  maxTokens: 4096,
  temperature: 0.3,
  maxRetries: 3,
  rateLimit: 50,
  timeout: 60000,
  maxConfidence: 0.9,
};

// ============================================================================
// Anthropic API Types
// ============================================================================

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicError {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

// ============================================================================
// Anthropic Adapter
// ============================================================================

/**
 * Create an Anthropic LLM adapter
 *
 * @param config - Adapter configuration
 * @returns LLMAdapter instance
 *
 * @example
 * ```typescript
 * const adapter = createAnthropicAdapter({
 *   apiKey: process.env.ANTHROPIC_API_KEY!,
 *   model: 'claude-sonnet-4-20250514',
 * });
 *
 * const compiler = createCompiler({
 *   coreVersion: '0.3.0',
 *   llmAdapter: adapter,
 * });
 * ```
 */
export function createAnthropicAdapter(config: AnthropicAdapterConfig): LLMAdapter {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const rateLimiter = new RateLimiter({ requestsPerMinute: opts.rateLimit });

  const adapter: LLMAdapter = {
    modelId: opts.model,
    maxConfidence: opts.maxConfidence,

    async generateDrafts(input: string, context: LLMContext): Promise<FragmentDraft[]> {
      // Build prompts
      const systemPrompt = buildSystemPrompt(context);
      const userPrompt = buildUserPrompt(input, context);
      const promptHash = hashPrompt(userPrompt, context as Record<string, unknown>);

      // Rate limit
      await rateLimiter.acquire();

      // Make API call with retry
      const response = await withRetry(
        async () => {
          const result = await callAnthropicAPI(
            {
              model: opts.model,
              max_tokens: opts.maxTokens,
              temperature: opts.temperature,
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }],
            },
            opts.apiKey,
            opts.baseUrl,
            opts.timeout
          );
          return result;
        },
        { maxRetries: opts.maxRetries }
      );

      // Extract text from response
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Parse response
      const parseResult = parseJSONArray<Partial<FragmentDraft>>(text);

      if (!parseResult.success || !parseResult.data) {
        throw new Error(`Failed to parse LLM response: ${parseResult.error}`);
      }

      // Validate and normalize drafts
      const drafts: FragmentDraft[] = [];

      for (const rawDraft of parseResult.data) {
        if (!validateDraftStructure(rawDraft)) {
          continue; // Skip invalid drafts
        }

        const draft = normalizeDraft(rawDraft, opts.model, promptHash);

        // Cap confidence at maxConfidence
        if (draft.confidence > opts.maxConfidence) {
          draft.confidence = opts.maxConfidence;
        }

        drafts.push(draft);
      }

      return drafts;
    },
  };

  return adapter;
}

// ============================================================================
// API Call
// ============================================================================

interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  temperature?: number;
  system?: string;
  messages: AnthropicMessage[];
}

async function callAnthropicAPI(
  body: AnthropicRequestBody,
  apiKey: string,
  baseUrl: string,
  timeoutMs: number
): Promise<AnthropicResponse> {
  const url = `${baseUrl}/v1/messages`;

  const requestPromise = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const response = await timeout(requestPromise, timeoutMs);

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `Anthropic API error: ${response.status}`;

    try {
      const errorJson = JSON.parse(errorBody) as AnthropicError;
      if (errorJson.error) {
        errorMessage = `Anthropic API error: ${errorJson.error.type} - ${errorJson.error.message}`;
      }
    } catch {
      errorMessage = `Anthropic API error: ${response.status} - ${errorBody}`;
    }

    // Check if retryable
    const isRetryable =
      response.status === 429 || // Rate limit
      response.status === 500 || // Server error
      response.status === 502 || // Bad gateway
      response.status === 503 || // Service unavailable
      response.status === 504; // Gateway timeout

    throw new RetryableError(errorMessage, String(response.status), isRetryable);
  }

  const data = (await response.json()) as AnthropicResponse;
  return data;
}

