/**
 * Reasoning Loop Types
 *
 * 추론 루프 타입 및 설정 정의
 * - LoopConfig: 루프 설정
 * - LoopResult: 루프 결과
 * - IReasoningLoop: 루프 인터페이스
 */

import type { Result } from '@manifesto-ai/core';
import type { CompressionTree } from '../sct/index.js';
import type {
  ReasoningState,
  Conclusion,
  ParsedQuery,
} from '../reasoning/index.js';
import type {
  IContextQueryEngine,
  IAsyncContextQueryEngine,
} from '../cqe/index.js';
import type { ILLMClient } from '../llm/index.js';

// ═══════════════════════════════════════════════════════
// Loop Configuration
// ═══════════════════════════════════════════════════════

/**
 * 추론 루프 설정
 */
export type LoopConfig = {
  /** 최대 반복 횟수 (기본 5) */
  maxIterations: number;
  /** 토큰 예산 (기본 4000) */
  tokenBudget: number;
  /** 정보 부재 판정 임계값 (기본 0.3) */
  relevanceThreshold: number;
  /** 확장 필요 임계값 (기본 0.5) */
  expansionThreshold: number;
  /** 정보 부재 판정 최소 시도 횟수 (기본 2) */
  minAttemptsForNotFound: number;
  /** 의미론적 검색 활성화 (기본 false) */
  enableSemanticSearch: boolean;
};

export const DEFAULT_LOOP_CONFIG: LoopConfig = {
  maxIterations: 5,
  tokenBudget: 4000,
  relevanceThreshold: 0.3,
  expansionThreshold: 0.5,
  minAttemptsForNotFound: 2,
  enableSemanticSearch: false,
};

// ═══════════════════════════════════════════════════════
// Loop Result
// ═══════════════════════════════════════════════════════

/**
 * 추론 루프 결과
 */
export type LoopResult = {
  /** 최종 추론 상태 */
  state: ReasoningState;
  /** 최종 결론 */
  conclusion: Conclusion;
  /** 반복 횟수 */
  iterations: number;
  /** 설명 (Explainable Ignorance) */
  explanation: string;
};

// ═══════════════════════════════════════════════════════
// Loop Errors
// ═══════════════════════════════════════════════════════

/**
 * 루프 에러 코드
 */
export type LoopErrorCode =
  | 'MAX_ITERATIONS_EXCEEDED'
  | 'LLM_ERROR'
  | 'CQE_ERROR'
  | 'INVALID_STATE'
  | 'PARSE_ERROR';

/**
 * 루프 에러
 */
export type LoopError = {
  code: LoopErrorCode;
  message: string;
  details?: unknown;
};

// ═══════════════════════════════════════════════════════
// IReasoningLoop Interface
// ═══════════════════════════════════════════════════════

/**
 * 추론 루프 인터페이스
 *
 * 핵심 기능:
 * - run: 질의에 대한 추론 실행
 * - continue: 기존 상태에서 추론 계속
 */
export interface IReasoningLoop {
  /**
   * 질의에 대한 추론 실행
   *
   * @param query - 사용자 질의 (raw string)
   * @param tree - SCT 압축 트리
   * @returns 추론 결과 또는 에러
   */
  run(
    query: string,
    tree: CompressionTree
  ): Promise<Result<LoopResult, LoopError>>;

  /**
   * 현재 상태에서 추론 계속
   *
   * @param state - 기존 추론 상태
   * @param tree - SCT 압축 트리
   * @returns 추론 결과 또는 에러
   */
  continue(
    state: ReasoningState,
    tree: CompressionTree
  ): Promise<Result<LoopResult, LoopError>>;
}

// ═══════════════════════════════════════════════════════
// Dependencies
// ═══════════════════════════════════════════════════════

/**
 * 추론 루프 의존성
 */
export type LoopDependencies = {
  /** LLM 클라이언트 */
  llmClient: ILLMClient;
  /** CQE 엔진 (동기 또는 비동기) */
  cqeEngine: IContextQueryEngine | IAsyncContextQueryEngine;
  /** 설정 (선택) */
  config?: Partial<LoopConfig>;
};

// ═══════════════════════════════════════════════════════
// Action Types (for selector)
// ═══════════════════════════════════════════════════════

/**
 * 선택된 액션 타입
 */
export type SelectedAction =
  | { type: 'analyze' }
  | { type: 'retrieve' }
  | { type: 'expand'; nodeId: string }
  | { type: 'conclude_answer' }
  | { type: 'conclude_not_found' }
  | { type: 'conclude_uncertain' }
  | { type: 'terminal' };
