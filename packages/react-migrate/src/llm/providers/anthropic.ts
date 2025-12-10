import Anthropic from '@anthropic-ai/sdk';
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
 * Anthropic Provider
 */
export class AnthropicProvider extends BaseLLMProvider {
  readonly name = 'anthropic';
  readonly defaultModel = 'claude-3-5-haiku-latest';

  private client: Anthropic;

  constructor(config: LLMProviderConfig) {
    super(config);

    if (!config.apiKey && !process.env['ANTHROPIC_API_KEY']) {
      throw new AuthenticationError('anthropic');
    }

    this.client = new Anthropic({
      apiKey: config.apiKey ?? process.env['ANTHROPIC_API_KEY'],
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

    // Anthropic은 system 메시지를 별도로 처리
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: options?.maxTokens ?? 4096,
        system: systemMessage?.content,
        messages: otherMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.7,
        stop_sequences: options?.stopSequences,
      });

      // 응답 내용 추출
      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      return {
        content,
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: this.mapFinishReason(response.stop_reason),
        responseTime: performance.now() - startTime,
      };
    } catch (error) {
      throw this.handleError(error, model);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // 간단한 요청으로 확인
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch (error) {
      // 인증 에러가 아니면 사용 가능
      if (error instanceof Anthropic.APIError && error.status === 401) {
        return false;
      }
      return true;
    }
  }

  private mapFinishReason(reason: string | null): FinishReason {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return 'error';
    }
  }

  private handleError(error: unknown, model: string): LLMError {
    if (error instanceof Anthropic.APIError) {
      const status = error.status ?? 0;
      switch (status) {
        case 401:
          return new AuthenticationError('anthropic');
        case 429:
          return new RateLimitError('anthropic');
        case 404:
          return new ModelNotFoundError('anthropic', model);
        default:
          return new LLMError(
            error.message,
            `ANTHROPIC_${status}`,
            'anthropic',
            status >= 500
          );
      }
    }

    if (error instanceof Error) {
      return new LLMError(error.message, 'UNKNOWN', 'anthropic', true, error);
    }

    return new LLMError(String(error), 'UNKNOWN', 'anthropic', true);
  }
}
