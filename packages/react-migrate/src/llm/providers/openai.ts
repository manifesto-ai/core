import OpenAI from 'openai';
import { BaseLLMProvider } from '../provider.js';
import type {
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMProviderConfig,
  FinishReason,
} from '../types.js';
import {
  LLMError,
  RateLimitError,
  AuthenticationError,
  ModelNotFoundError,
} from '../types.js';

/**
 * OpenAI Provider
 */
export class OpenAIProvider extends BaseLLMProvider {
  readonly name = 'openai';
  readonly defaultModel = 'gpt-4o-mini';

  private client: OpenAI;

  constructor(config: LLMProviderConfig) {
    super(config);

    if (!config.apiKey && !process.env['OPENAI_API_KEY']) {
      throw new AuthenticationError('openai');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env['OPENAI_API_KEY'],
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 30000,
      maxRetries: 0, // 우리가 직접 재시도 관리
    });
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const startTime = performance.now();
    const model = this.resolveModel(options);

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        stop: options?.stopSequences,
        response_format: options?.responseFormat === 'json'
          ? { type: 'json_object' }
          : undefined,
      });

      const choice = response.choices[0];
      const content = choice?.message?.content ?? '';

      return {
        content,
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        finishReason: this.mapFinishReason(choice?.finish_reason),
        responseTime: performance.now() - startTime,
      };
    } catch (error) {
      throw this.handleError(error, model);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  private mapFinishReason(reason: string | null | undefined): FinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'error';
    }
  }

  private handleError(error: unknown, model: string): LLMError {
    if (error instanceof OpenAI.APIError) {
      switch (error.status) {
        case 401:
          return new AuthenticationError('openai');
        case 429:
          return new RateLimitError('openai');
        case 404:
          return new ModelNotFoundError('openai', model);
        default:
          return new LLMError(
            error.message,
            `OPENAI_${error.status}`,
            'openai',
            error.status >= 500
          );
      }
    }

    if (error instanceof Error) {
      return new LLMError(error.message, 'UNKNOWN', 'openai', true, error);
    }

    return new LLMError(String(error), 'UNKNOWN', 'openai', true);
  }
}
