import OpenAI from 'openai';
import { ok, err, type Result } from '@manifesto-ai/core';
import type {
  ILLMClient,
  LLMCallOptions,
  LLMResponse,
  LLMError,
  LLMErrorCode,
} from './types.js';

/**
 * OpenAI 클라이언트 설정
 */
export type OpenAIClientConfig = {
  /** OpenAI API 키 */
  apiKey: string;

  /** 사용할 모델 (기본값: 'gpt-4o-mini') */
  model?: string;

  /** API 베이스 URL (선택적, 프록시 등에 사용) */
  baseUrl?: string;

  /** 기본 타임아웃 (ms, 기본값: 60000) */
  timeout?: number;

  /** 기본 온도 (기본값: 0.7) */
  defaultTemperature?: number;

  /** 기본 최대 토큰 수 (기본값: 4096) */
  defaultMaxTokens?: number;

  /** 조직 ID (선택적) */
  organization?: string;
};

/**
 * OpenAI API 기반 LLM 클라이언트
 *
 * @example
 * ```typescript
 * const client = new OpenAIClient({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: 'gpt-4o-mini',
 * });
 *
 * const result = await client.call({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 *
 * if (result.ok) {
 *   console.log(result.value.content);
 * }
 * ```
 */
export class OpenAIClient implements ILLMClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;
  private readonly defaultTimeout: number;

  constructor(config: OpenAIClientConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      organization: config.organization,
      timeout: config.timeout ?? 60000,
    });

    this.model = config.model ?? 'gpt-4o-mini';
    this.defaultTemperature = config.defaultTemperature ?? 0.7;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 4096;
    this.defaultTimeout = config.timeout ?? 60000;
  }

  /**
   * LLM 호출
   */
  async call(options: LLMCallOptions): Promise<Result<LLMResponse, LLMError>> {
    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: options.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options.temperature ?? this.defaultTemperature,
          max_tokens: options.maxTokens ?? this.defaultMaxTokens,
          response_format:
            options.responseFormat === 'json'
              ? { type: 'json_object' }
              : undefined,
        },
        {
          timeout: options.timeout ?? this.defaultTimeout,
        }
      );

      const choice = response.choices[0];
      if (!choice || !choice.message.content) {
        return err({
          code: 'INVALID_RESPONSE',
          message: 'Empty response from OpenAI',
        });
      }

      return ok({
        content: choice.message.content,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        model: response.model,
        finishReason: this.mapFinishReason(choice.finish_reason),
      });
    } catch (error) {
      return err(this.mapError(error));
    }
  }

  /**
   * 텍스트의 토큰 수 추정
   * 간단한 추정: 영어 4자당 1토큰, 한글 2자당 1토큰
   */
  estimateTokens(text: string): number {
    const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
    const koreanTokens = Math.ceil(koreanChars / 2);
    const otherTokens = Math.ceil((text.length - koreanChars) / 4);
    return koreanTokens + otherTokens;
  }

  /**
   * 모델 ID 반환
   */
  getModelId(): string {
    return this.model;
  }

  /**
   * finish_reason 매핑
   */
  private mapFinishReason(
    reason: string | null
  ): 'stop' | 'length' | 'content_filter' | 'tool_calls' | undefined {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'tool_calls':
        return 'tool_calls';
      default:
        return undefined;
    }
  }

  /**
   * 에러 매핑
   */
  private mapError(error: unknown): LLMError {
    if (error instanceof OpenAI.APIError) {
      const code = this.mapErrorCode(error);
      return {
        code,
        message: error.message,
        retryAfter: this.getRetryAfter(error),
        cause: error,
      };
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return {
          code: 'TIMEOUT',
          message: `Request timed out: ${error.message}`,
          cause: error,
        };
      }

      return {
        code: 'API_ERROR',
        message: error.message,
        cause: error,
      };
    }

    return {
      code: 'API_ERROR',
      message: String(error),
      cause: error,
    };
  }

  /**
   * OpenAI 에러 코드 매핑
   */
  private mapErrorCode(error: InstanceType<typeof OpenAI.APIError>): LLMErrorCode {
    const status = error.status;

    if (status === 401) {
      return 'AUTHENTICATION_ERROR';
    }
    if (status === 429) {
      return 'RATE_LIMIT';
    }
    if (status === 400 && error.message.includes('context_length')) {
      return 'CONTEXT_LENGTH';
    }

    return 'API_ERROR';
  }

  /**
   * Retry-After 헤더 추출
   */
  private getRetryAfter(error: InstanceType<typeof OpenAI.APIError>): number | undefined {
    if (error.status === 429) {
      const headers = error.headers;
      if (headers) {
        const retryAfter = headers['retry-after'];
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds)) {
            return seconds * 1000; // ms로 변환
          }
        }
      }
      // 기본 재시도 대기 시간: 1초
      return 1000;
    }
    return undefined;
  }
}

/**
 * OpenAI 클라이언트 생성 헬퍼
 */
export function createOpenAIClient(config: OpenAIClientConfig): OpenAIClient {
  return new OpenAIClient(config);
}
