import { BaseLLMProvider } from '../provider.js';
import type {
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMProviderConfig,
} from '../types.js';

/**
 * Mock 응답 정의
 */
export interface MockResponse {
  /** 매칭 패턴 (문자열 또는 정규식) */
  pattern: RegExp | string;
  /** 응답 내용 */
  response: string;
  /** 응답 지연 (ms) */
  delay?: number;
}

/**
 * Mock 호출 기록
 */
export interface MockCallRecord {
  messages: LLMMessage[];
  options?: LLMCompletionOptions;
  timestamp: number;
}

/**
 * Mock Provider (테스트용)
 */
export class MockLLMProvider extends BaseLLMProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-model';

  private responses: MockResponse[] = [];
  private defaultResponse = '{ "result": "mock response" }';
  private callHistory: MockCallRecord[] = [];
  private shouldFail = false;
  private failError?: Error;

  constructor(config: LLMProviderConfig = { provider: 'mock' }) {
    super(config);
  }

  /**
   * Mock 응답 설정
   */
  setResponses(responses: MockResponse[]): void {
    this.responses = responses;
  }

  /**
   * 기본 응답 설정
   */
  setDefaultResponse(response: string): void {
    this.defaultResponse = response;
  }

  /**
   * 실패 모드 설정
   */
  setFailure(shouldFail: boolean, error?: Error): void {
    this.shouldFail = shouldFail;
    this.failError = error;
  }

  /**
   * 호출 기록 조회
   */
  getCallHistory(): MockCallRecord[] {
    return [...this.callHistory];
  }

  /**
   * 호출 기록 초기화
   */
  clearCallHistory(): void {
    this.callHistory = [];
  }

  /**
   * 마지막 호출 조회
   */
  getLastCall(): MockCallRecord | undefined {
    return this.callHistory[this.callHistory.length - 1];
  }

  /**
   * 특정 패턴이 호출되었는지 확인
   */
  wasCalledWith(pattern: RegExp | string): boolean {
    return this.callHistory.some(call => {
      const content = call.messages.map(m => m.content).join('\n');
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      return regex.test(content);
    });
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    // 호출 기록
    this.callHistory.push({
      messages: [...messages],
      options,
      timestamp: Date.now(),
    });

    // 실패 모드
    if (this.shouldFail) {
      throw this.failError ?? new Error('Mock failure');
    }

    // 매칭 응답 찾기
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content ?? '';

    for (const { pattern, response, delay } of this.responses) {
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (regex.test(content)) {
        if (delay) {
          await this.delay(delay);
        }
        return this.createResult(response);
      }
    }

    return this.createResult(this.defaultResponse);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private createResult(content: string): LLMCompletionResult {
    return {
      content,
      model: this.defaultModel,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      finishReason: 'stop',
      responseTime: 10,
    };
  }
}

/**
 * 테스트용 Mock Provider 생성
 */
export function createMockProvider(
  defaultResponse?: string,
  responses?: MockResponse[]
): MockLLMProvider {
  const provider = new MockLLMProvider();

  if (defaultResponse) {
    provider.setDefaultResponse(defaultResponse);
  }

  if (responses) {
    provider.setResponses(responses);
  }

  return provider;
}
