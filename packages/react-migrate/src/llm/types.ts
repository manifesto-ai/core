/**
 * LLM 메시지 역할
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * LLM 메시지
 */
export interface LLMMessage {
  role: MessageRole;
  content: string;
}

/**
 * LLM 완료 옵션
 */
export interface LLMCompletionOptions {
  /** 사용할 모델 (기본값: provider의 defaultModel) */
  model?: string;
  /** 응답 온도 (0.0 ~ 2.0, 기본값: 0.7) */
  temperature?: number;
  /** 최대 토큰 수 */
  maxTokens?: number;
  /** 중단 시퀀스 */
  stopSequences?: string[];
  /** 응답 형식 */
  responseFormat?: 'text' | 'json';
  /** 타임아웃 (ms) */
  timeout?: number;
}

/**
 * 토큰 사용량
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * 완료 종료 이유
 */
export type FinishReason = 'stop' | 'length' | 'content_filter' | 'error';

/**
 * LLM 완료 결과
 */
export interface LLMCompletionResult {
  /** 생성된 내용 */
  content: string;
  /** 사용된 모델 */
  model: string;
  /** 토큰 사용량 */
  usage: TokenUsage;
  /** 종료 이유 */
  finishReason: FinishReason;
  /** 응답 시간 (ms) */
  responseTime?: number;
}

/**
 * 지원하는 LLM Provider 타입
 */
export type LLMProviderType = 'openai' | 'anthropic' | 'ollama' | 'mock';

/**
 * LLM Provider 설정
 */
export interface LLMProviderConfig {
  /** Provider 타입 */
  provider: LLMProviderType;
  /** API 키 (OpenAI, Anthropic) */
  apiKey?: string;
  /** 베이스 URL (Ollama, 커스텀 엔드포인트) */
  baseUrl?: string;
  /** 기본 모델 */
  defaultModel?: string;
  /** 타임아웃 (ms, 기본값: 30000) */
  timeout?: number;
  /** 최대 재시도 횟수 (기본값: 3) */
  maxRetries?: number;
}

/**
 * LLM Provider 인터페이스
 */
export interface LLMProvider {
  /** Provider 이름 */
  readonly name: string;
  /** 기본 모델 */
  readonly defaultModel: string;

  /**
   * 메시지 완료 요청
   */
  complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult>;

  /**
   * 재시도가 포함된 완료 요청
   */
  completeWithRetry(
    messages: LLMMessage[],
    options?: LLMCompletionOptions,
    maxRetries?: number
  ): Promise<LLMCompletionResult>;

  /**
   * 토큰 수 추정
   */
  estimateTokens(text: string): number;

  /**
   * Provider 사용 가능 여부 확인
   */
  isAvailable(): Promise<boolean>;
}

/**
 * LLM 에러
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: string,
    public readonly retryable: boolean = false,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/**
 * Rate limit 에러
 */
export class RateLimitError extends LLMError {
  constructor(
    provider: string,
    public readonly retryAfter?: number
  ) {
    super('Rate limit exceeded', 'RATE_LIMIT', provider, true);
    this.name = 'RateLimitError';
  }
}

/**
 * 인증 에러
 */
export class AuthenticationError extends LLMError {
  constructor(provider: string) {
    super('Authentication failed', 'AUTH_ERROR', provider, false);
    this.name = 'AuthenticationError';
  }
}

/**
 * 모델 에러
 */
export class ModelNotFoundError extends LLMError {
  constructor(provider: string, model: string) {
    super(`Model not found: ${model}`, 'MODEL_NOT_FOUND', provider, false);
    this.name = 'ModelNotFoundError';
  }
}
