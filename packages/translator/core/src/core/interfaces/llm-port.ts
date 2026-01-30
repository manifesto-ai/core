/**
 * @fileoverview LLMPort Interface (SPEC Section 9)
 *
 * LLM provider abstraction.
 * Implements Ports & Adapters pattern for input.
 *
 * Per SPEC Section 9.1:
 * - LLMPort is the input adapter interface
 * - Concrete implementations are in separate adapter packages
 *
 * @module core/interfaces/llm-port
 */

// =============================================================================
// LLMCallOptions
// =============================================================================

/**
 * LLM call options.
 *
 * Per SPEC Section 9.1
 */
export interface LLMCallOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  responseFormat?: "text" | "json";
  timeout?: number;
}

// =============================================================================
// LLMMessage
// =============================================================================

/**
 * LLM message.
 *
 * Per SPEC Section 9.1:
 * Note: "system" is NOT a valid role; use LLMRequest.system instead.
 */
export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

// =============================================================================
// LLMRequest
// =============================================================================

/**
 * LLM request.
 *
 * Per SPEC Section 9.1:
 * - system: System prompt (separate from messages)
 * - messages: Conversation messages
 * - options: LLM call options
 */
export interface LLMRequest {
  /** System prompt (separate from messages) */
  system?: string;

  /** Conversation messages */
  messages: LLMMessage[];

  /** LLM call options */
  options?: LLMCallOptions;
}

// =============================================================================
// LLMUsage
// =============================================================================

/**
 * LLM usage statistics.
 *
 * Per SPEC Section 9.1
 */
export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// =============================================================================
// LLMResponse
// =============================================================================

/**
 * LLM response.
 *
 * Per SPEC Section 9.1
 */
export interface LLMResponse {
  content: string;
  usage?: LLMUsage;
  finishReason: "stop" | "length" | "content_filter" | "error";
}

// =============================================================================
// LLMPort
// =============================================================================

/**
 * LLM provider abstraction.
 * Implements Ports & Adapters pattern for input.
 *
 * Per SPEC Section 9.1:
 * - complete() sends completion request to LLM
 * - Concrete implementations are in adapter packages:
 *   - @manifesto-ai/translator-adapter-openai
 *   - @manifesto-ai/translator-adapter-claude
 *   - @manifesto-ai/translator-adapter-ollama
 */
export interface LLMPort {
  /**
   * Send completion request to LLM.
   *
   * @param request - LLM request
   * @returns LLM response
   * @throws LLMError on failure
   */
  complete(request: LLMRequest): Promise<LLMResponse>;
}
