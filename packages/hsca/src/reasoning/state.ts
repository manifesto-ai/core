/**
 * Reasoning State Management
 *
 * HSCA 추론 상태 관리를 위한 타입과 헬퍼 함수
 */

import type { CurrentQuery, RetrievedNode, ReasoningStep, Conclusion } from './types.js';

// ═══════════════════════════════════════════════════════
// ReasoningState: HSCA 추론 상태
// ═══════════════════════════════════════════════════════

/**
 * HSCA 추론의 전체 상태
 *
 * Manifesto state.* 패턴을 따름
 */
export type ReasoningState = {
  /** 현재 질의 */
  currentQuery: CurrentQuery;

  /** 검색된 컨텍스트 노드들 */
  retrievedContext: RetrievedNode[];

  /**
   * ★ 핵심: 추론 경로
   *
   * Explainable Ignorance의 근거 - 모든 추론 시도가 여기에 기록됨
   */
  reasoningPath: ReasoningStep[];

  /** 최종 결론 (결론 도출 전에는 null) */
  conclusion: Conclusion | null;
};

// ═══════════════════════════════════════════════════════
// 초기 상태
// ═══════════════════════════════════════════════════════

/**
 * 초기 추론 상태
 */
export const INITIAL_REASONING_STATE: ReasoningState = {
  currentQuery: {
    raw: '',
    parsed: null,
    status: 'pending',
  },
  retrievedContext: [],
  reasoningPath: [],
  conclusion: null,
};

// ═══════════════════════════════════════════════════════
// 상태 생성/초기화 함수
// ═══════════════════════════════════════════════════════

/**
 * 새로운 추론 상태 생성
 *
 * @param query - 질의 문자열
 * @returns 초기화된 추론 상태
 *
 * @example
 * ```typescript
 * const state = createReasoningState("2024년 3분기 매출은?");
 * // state.currentQuery.raw === "2024년 3분기 매출은?"
 * // state.currentQuery.status === 'pending'
 * ```
 */
export function createReasoningState(query: string): ReasoningState {
  return {
    ...INITIAL_REASONING_STATE,
    currentQuery: {
      raw: query,
      parsed: null,
      status: 'pending',
    },
  };
}

/**
 * 추론 상태 초기화 (질의는 유지, 나머지 초기화)
 *
 * @param state - 현재 상태
 * @returns 초기화된 상태
 */
export function resetReasoningState(state: ReasoningState): ReasoningState {
  return {
    ...INITIAL_REASONING_STATE,
    currentQuery: {
      raw: state.currentQuery.raw,
      parsed: null,
      status: 'pending',
    },
  };
}

// ═══════════════════════════════════════════════════════
// 상태 변경 헬퍼 함수
// ═══════════════════════════════════════════════════════

/**
 * 추론 단계 추가
 *
 * 불변성을 유지하면서 reasoningPath에 새 단계 추가
 *
 * @param state - 현재 상태
 * @param step - 추가할 추론 단계
 * @returns 새로운 상태
 *
 * @example
 * ```typescript
 * let state = createReasoningState("매출은?");
 * state = addReasoningStep(state, {
 *   step: 1,
 *   type: 'retrieve',
 *   target: 'finance.revenue',
 *   relevance: 0.12,
 *   result: 'no_match',
 *   evidence: []
 * });
 * ```
 */
export function addReasoningStep(state: ReasoningState, step: ReasoningStep): ReasoningState {
  return {
    ...state,
    reasoningPath: [...state.reasoningPath, step],
  };
}

/**
 * 검색된 컨텍스트 설정
 *
 * @param state - 현재 상태
 * @param nodes - 검색된 노드들
 * @returns 새로운 상태
 */
export function setRetrievedContext(state: ReasoningState, nodes: RetrievedNode[]): ReasoningState {
  return {
    ...state,
    retrievedContext: nodes,
  };
}

/**
 * 검색된 컨텍스트에 노드 추가
 *
 * @param state - 현재 상태
 * @param nodes - 추가할 노드들
 * @returns 새로운 상태
 */
export function addRetrievedNodes(state: ReasoningState, nodes: RetrievedNode[]): ReasoningState {
  return {
    ...state,
    retrievedContext: [...state.retrievedContext, ...nodes],
  };
}

/**
 * 질의 상태 변경
 *
 * @param state - 현재 상태
 * @param status - 새로운 상태
 * @returns 새로운 상태
 */
export function setQueryStatus(
  state: ReasoningState,
  status: CurrentQuery['status']
): ReasoningState {
  return {
    ...state,
    currentQuery: {
      ...state.currentQuery,
      status,
    },
  };
}

/**
 * 분석된 질의 설정
 *
 * @param state - 현재 상태
 * @param parsed - 분석된 질의
 * @returns 새로운 상태
 */
export function setParsedQuery(
  state: ReasoningState,
  parsed: CurrentQuery['parsed']
): ReasoningState {
  return {
    ...state,
    currentQuery: {
      ...state.currentQuery,
      parsed,
    },
  };
}

/**
 * 결론 설정
 *
 * @param state - 현재 상태
 * @param conclusion - 결론
 * @returns 새로운 상태
 */
export function setConclusion(state: ReasoningState, conclusion: Conclusion): ReasoningState {
  return {
    ...state,
    conclusion,
  };
}

// ═══════════════════════════════════════════════════════
// 상태 조회 헬퍼 함수
// ═══════════════════════════════════════════════════════

/**
 * 추론 시도 횟수 반환
 *
 * retrieve, expand 타입의 단계만 카운트
 */
export function getAttemptCount(state: ReasoningState): number {
  return state.reasoningPath.filter((step) => step.type === 'retrieve' || step.type === 'expand')
    .length;
}

/**
 * 최고 관련성 점수 반환
 */
export function getMaxRelevance(state: ReasoningState): number {
  if (state.reasoningPath.length === 0) {
    return 0;
  }

  const attempts = state.reasoningPath.filter(
    (step) => step.type === 'retrieve' || step.type === 'expand'
  );

  if (attempts.length === 0) {
    return 0;
  }

  return Math.max(...attempts.map((step) => step.relevance));
}

/**
 * 검색된 고유 타겟 경로들 반환
 */
export function getSearchedTargets(state: ReasoningState): string[] {
  const targets = state.reasoningPath
    .filter((step) => step.type === 'retrieve' || step.type === 'expand')
    .map((step) => step.target);

  return [...new Set(targets)];
}
