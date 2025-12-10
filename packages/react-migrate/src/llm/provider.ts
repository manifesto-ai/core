import type {
  LLMProvider,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMProviderConfig,
} from './types.js';
import { LLMError } from './types.js';

/**
 * LLM Provider 기본 추상 클래스
 */
export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: string;
  abstract readonly defaultModel: string;

  protected config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  /**
   * 메시지 완료 요청 (하위 클래스에서 구현)
   */
  abstract complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult>;

  /**
   * 재시도가 포함된 완료 요청
   */
  async completeWithRetry(
    messages: LLMMessage[],
    options?: LLMCompletionOptions,
    maxRetries?: number
  ): Promise<LLMCompletionResult> {
    const retries = maxRetries ?? this.config.maxRetries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await this.complete(messages, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 재시도 불가능한 에러는 즉시 throw
        if (error instanceof LLMError && !error.retryable) {
          throw error;
        }

        // 마지막 시도가 아니면 대기
        if (attempt < retries - 1) {
          const delay = this.calculateBackoff(attempt);
          await this.delay(delay);
        }
      }
    }

    throw lastError ?? new Error('Max retries exceeded');
  }

  /**
   * 토큰 수 추정 (대략적인 추정치)
   */
  estimateTokens(text: string): number {
    // 대략적인 추정: 평균 4 문자 = 1 토큰
    // 한글의 경우 약 2 문자 = 1 토큰
    const englishChars = text.replace(/[^\x00-\x7F]/g, '').length;
    const nonEnglishChars = text.length - englishChars;

    return Math.ceil(englishChars / 4) + Math.ceil(nonEnglishChars / 2);
  }

  /**
   * Provider 사용 가능 여부 확인 (하위 클래스에서 구현)
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * 지수 백오프 계산
   */
  protected calculateBackoff(attempt: number): number {
    // 1초, 2초, 4초, 8초... (최대 30초)
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // 지터 추가 (0-25%)
    const jitter = delay * Math.random() * 0.25;
    return delay + jitter;
  }

  /**
   * 대기
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 모델 이름 결정
   */
  protected resolveModel(options?: LLMCompletionOptions): string {
    return options?.model ?? this.config.defaultModel ?? this.defaultModel;
  }

  /**
   * 타임아웃 결정
   */
  protected resolveTimeout(options?: LLMCompletionOptions): number {
    return options?.timeout ?? this.config.timeout ?? 30000;
  }
}
