/**
 * OpenAI LLM Adapter
 *
 * LLMAdapter implementation using OpenAI's API.
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
 * OpenAI adapter configuration
 */
export interface OpenAIAdapterConfig {
  /** API key for authentication */
  apiKey: string;
  /** Model to use (default: gpt-4o) */
  model?: string;
  /** Base URL for API (default: https://api.openai.com) */
  baseUrl?: string;
  /** Organization ID (optional) */
  organization?: string;
  /** Maximum tokens to generate (default: 4096) */
  maxTokens?: number;
  /** Temperature (default: 0.3) */
  temperature?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Rate limit (requests per minute, default: 60) */
  rateLimit?: number;
  /** Request timeout in ms (default: 60000) */
  timeout?: number;
  /** Maximum confidence the adapter will report (default: 0.85) */
  maxConfidence?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Omit<OpenAIAdapterConfig, 'apiKey' | 'organization'>> = {
  model: 'gpt-4o',
  baseUrl: 'https://api.openai.com',
  maxTokens: 4096,
  temperature: 0.3,
  maxRetries: 3,
  rateLimit: 60,
  timeout: 60000,
  maxConfidence: 0.85, // Lower than Anthropic due to model characteristics
};

// ============================================================================
// OpenAI API Types
// ============================================================================

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: string | null;
}

interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIError {
  error: {
    message: string;
    type: string;
    param: string | null;
    code: string | null;
  };
}

// ============================================================================
// OpenAI Adapter
// ============================================================================

/**
 * Create an OpenAI LLM adapter
 *
 * @param config - Adapter configuration
 * @returns LLMAdapter instance
 *
 * @example
 * ```typescript
 * const adapter = createOpenAIAdapter({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: 'gpt-4o',
 * });
 *
 * const compiler = createCompiler({
 *   coreVersion: '0.3.0',
 *   llmAdapter: adapter,
 * });
 * ```
 */
export function createOpenAIAdapter(config: OpenAIAdapterConfig): LLMAdapter {
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
          const result = await callOpenAIAPI(
            {
              model: opts.model,
              max_tokens: opts.maxTokens,
              temperature: opts.temperature,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            },
            opts.apiKey,
            opts.baseUrl,
            opts.timeout,
            opts.organization
          );
          return result;
        },
        { maxRetries: opts.maxRetries }
      );

      // Extract text from response
      if (!response.choices || response.choices.length === 0) {
        throw new Error('No response from OpenAI API');
      }

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new Error('Empty response content from OpenAI API');
      }

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

interface OpenAIRequestBody {
  model: string;
  max_tokens: number;
  temperature?: number;
  messages: OpenAIMessage[];
  response_format?: { type: 'json_object' };
}

async function callOpenAIAPI(
  body: OpenAIRequestBody,
  apiKey: string,
  baseUrl: string,
  timeoutMs: number,
  organization?: string
): Promise<OpenAIResponse> {
  const url = `${baseUrl}/v1/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (organization) {
    headers['OpenAI-Organization'] = organization;
  }

  const requestPromise = fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const response = await timeout(requestPromise, timeoutMs);

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `OpenAI API error: ${response.status}`;

    try {
      const errorJson = JSON.parse(errorBody) as OpenAIError;
      if (errorJson.error) {
        errorMessage = `OpenAI API error: ${errorJson.error.type} - ${errorJson.error.message}`;
      }
    } catch {
      errorMessage = `OpenAI API error: ${response.status} - ${errorBody}`;
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

  const data = (await response.json()) as OpenAIResponse;
  return data;
}

