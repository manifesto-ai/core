import type { Result } from '@manifesto-ai/core';

/**
 * LLM 메시지 역할
 */
export type LLMMessageRole = 'system' | 'user' | 'assistant';

/**
 * LLM 메시지
 */
export type LLMMessage = {
  role: LLMMessageRole;
  content: string;
};

/**
 * LLM 호출 옵션
 */
export type LLMCallOptions = {
  /** 메시지 목록 */
  messages: LLMMessage[];

  /** 온도 (창의성 제어, 0-2, 기본값: 0.7) */
  temperature?: number;

  /** 최대 출력 토큰 수 */
  maxTokens?: number;

  /** 응답 형식 */
  responseFormat?: 'text' | 'json';

  /** 요청 타임아웃 (ms) */
  timeout?: number;
};

/**
 * LLM 토큰 사용량
 */
export type LLMUsage = {
  /** 프롬프트 토큰 수 */
  promptTokens: number;

  /** 완성 토큰 수 */
  completionTokens: number;

  /** 총 토큰 수 */
  totalTokens: number;
};

/**
 * LLM 응답
 */
export type LLMResponse = {
  /** 응답 내용 */
  content: string;

  /** 토큰 사용량 */
  usage: LLMUsage;

  /** 모델 ID */
  model?: string;

  /** 완료 사유 */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
};

/**
 * LLM 에러 코드
 */
export type LLMErrorCode =
  | 'RATE_LIMIT'
  | 'CONTEXT_LENGTH'
  | 'API_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'AUTHENTICATION_ERROR';

/**
 * LLM 에러
 */
export type LLMError = {
  /** 에러 코드 */
  code: LLMErrorCode;

  /** 에러 메시지 */
  message: string;

  /** 재시도 대기 시간 (ms) */
  retryAfter?: number;

  /** 원본 에러 */
  cause?: unknown;
};

/**
 * LLM 클라이언트 인터페이스
 */
export interface ILLMClient {
  /**
   * LLM 호출
   *
   * @param options - 호출 옵션
   * @returns 응답 또는 에러
   */
  call(options: LLMCallOptions): Promise<Result<LLMResponse, LLMError>>;

  /**
   * 텍스트의 토큰 수 추정
   *
   * @param text - 추정할 텍스트
   * @returns 추정된 토큰 수
   */
  estimateTokens(text: string): number;

  /**
   * 모델 ID 반환
   */
  getModelId(): string;
}

/**
 * JSON 응답을 위한 헬퍼 타입
 */
export type LLMJsonCallOptions<T> = LLMCallOptions & {
  /** JSON 스키마 (응답 파싱용) */
  schema?: {
    parse: (data: unknown) => T;
  };
};

/**
 * 스트리밍 응답을 위한 청크
 */
export type LLMStreamChunk = {
  /** 청크 내용 */
  content: string;

  /** 완료 여부 */
  done: boolean;

  /** 완료 사유 (done=true일 때) */
  finishReason?: 'stop' | 'length' | 'content_filter';
};

/**
 * 스트리밍 LLM 클라이언트 인터페이스 (선택적)
 */
export interface IStreamingLLMClient extends ILLMClient {
  /**
   * 스트리밍 LLM 호출
   *
   * @param options - 호출 옵션
   * @returns 스트리밍 청크 AsyncIterable
   */
  callStream(options: LLMCallOptions): AsyncIterable<LLMStreamChunk>;
}
