/**
 * Derived Values for HSCA Reasoning
 *
 * Manifesto derived.* 패턴을 따르는 파생 값 계산
 *
 * ★ 핵심: isInformationNotFound()
 * - 관련성 < 0.3 && 시도 >= 2회이면 "모른다" 판정
 * - 이 함수가 true를 반환하면 LLM 호출 없이 시스템이 결론
 */

import type { ReasoningState } from './state.js';

// ═══════════════════════════════════════════════════════
// 설정
// ═══════════════════════════════════════════════════════

/**
 * 파생 값 계산 설정
 */
export type DerivedConfig = {
  /** 정보 부재 판정 관련성 임계값 (기본 0.3) */
  relevanceThreshold: number;

  /** 확장 필요 판정 관련성 임계값 (기본 0.5) */
  expansionThreshold: number;

  /** 정보 부재 판정 최소 시도 횟수 (기본 2) */
  minAttemptsForNotFound: number;

  /** 토큰 예산 (기본 4000) */
  tokenBudget: number;
};

/**
 * 기본 파생 값 설정
 */
export const DEFAULT_DERIVED_CONFIG: DerivedConfig = {
  relevanceThreshold: 0.3,
  expansionThreshold: 0.5,
  minAttemptsForNotFound: 2,
  tokenBudget: 4000,
};

// ═══════════════════════════════════════════════════════
// 토큰 관련 파생 값
// ═══════════════════════════════════════════════════════

/**
 * 현재 컨텍스트의 총 토큰 수
 *
 * Manifesto: derived.currentContextTokens
 */
export function getCurrentContextTokens(state: ReasoningState): number {
  return state.retrievedContext.reduce((sum, node) => sum + node.tokenCount, 0);
}

/**
 * 토큰 예산 내 여부 확인
 *
 * Manifesto: derived.withinTokenBudget
 *
 * @param state - 현재 상태
 * @param budget - 토큰 예산 (기본 4000)
 * @returns 예산 내이면 true
 */
export function isWithinTokenBudget(
  state: ReasoningState,
  budget: number = DEFAULT_DERIVED_CONFIG.tokenBudget
): boolean {
  return getCurrentContextTokens(state) <= budget;
}

// ═══════════════════════════════════════════════════════
// 관련성 관련 파생 값
// ═══════════════════════════════════════════════════════

/**
 * 검색된 컨텍스트의 평균 관련성 점수
 *
 * Manifesto: derived.avgRelevance
 *
 * @param state - 현재 상태
 * @returns 평균 관련성 (0-1), 컨텍스트가 없으면 0
 */
export function getAvgRelevance(state: ReasoningState): number {
  if (state.retrievedContext.length === 0) {
    return 0;
  }

  const sum = state.retrievedContext.reduce((acc, node) => acc + node.relevance, 0);
  return sum / state.retrievedContext.length;
}

/**
 * 추론 경로에서의 최고 관련성 점수
 *
 * retrieve, expand 단계에서 기록된 관련성 중 최대값
 */
export function getMaxRelevanceFromPath(state: ReasoningState): number {
  const attempts = state.reasoningPath.filter(
    (step) => step.type === 'retrieve' || step.type === 'expand'
  );

  if (attempts.length === 0) {
    return 0;
  }

  return Math.max(...attempts.map((step) => step.relevance));
}

// ═══════════════════════════════════════════════════════
// ★ 핵심: 정보 부재 판정
// ═══════════════════════════════════════════════════════

/**
 * 검색/확장 시도 횟수
 */
export function getAttemptCount(state: ReasoningState): number {
  return state.reasoningPath.filter((step) => step.type === 'retrieve' || step.type === 'expand')
    .length;
}

/**
 * ★★★ 핵심: 정보 부재 판정 ★★★
 *
 * Manifesto: derived.informationNotFound
 *
 * 이 함수가 true를 반환하면:
 * - LLM 호출 없이 시스템이 "모른다" 결정
 * - concludeNotFound 액션이 활성화됨
 * - reasoningPath가 "왜 모르는지"의 증거가 됨
 *
 * 조건:
 * 1. 평균 관련성 < relevanceThreshold (기본 0.3)
 * 2. 시도 횟수 >= minAttempts (기본 2)
 *
 * @param state - 현재 상태
 * @param relevanceThreshold - 관련성 임계값 (기본 0.3)
 * @param minAttempts - 최소 시도 횟수 (기본 2)
 * @returns 정보 부재이면 true
 *
 * @example
 * ```typescript
 * const state = createReasoningState("2024년 3분기 매출은?");
 *
 * // 첫 번째 시도 후
 * state = addReasoningStep(state, {
 *   step: 1, type: 'retrieve', target: 'finance.revenue',
 *   relevance: 0.12, result: 'no_match', evidence: []
 * });
 * console.log(isInformationNotFound(state)); // false (시도 1회)
 *
 * // 두 번째 시도 후
 * state = addReasoningStep(state, {
 *   step: 2, type: 'expand', target: 'finance.*',
 *   relevance: 0.15, result: 'no_relevant_children', evidence: []
 * });
 * console.log(isInformationNotFound(state)); // true (시도 2회, 관련성 < 0.3)
 * ```
 */
export function isInformationNotFound(
  state: ReasoningState,
  relevanceThreshold: number = DEFAULT_DERIVED_CONFIG.relevanceThreshold,
  minAttempts: number = DEFAULT_DERIVED_CONFIG.minAttemptsForNotFound
): boolean {
  const attempts = getAttemptCount(state);
  const maxRelevance = getMaxRelevanceFromPath(state);

  // 두 조건 모두 만족해야 함
  return maxRelevance < relevanceThreshold && attempts >= minAttempts;
}

/**
 * 정보 부재 판정 (설정 객체 사용)
 *
 * @param state - 현재 상태
 * @param config - 설정
 * @returns 정보 부재이면 true
 */
export function isInformationNotFoundWithConfig(
  state: ReasoningState,
  config: Partial<DerivedConfig> = {}
): boolean {
  const mergedConfig = { ...DEFAULT_DERIVED_CONFIG, ...config };
  return isInformationNotFound(
    state,
    mergedConfig.relevanceThreshold,
    mergedConfig.minAttemptsForNotFound
  );
}

// ═══════════════════════════════════════════════════════
// 확장 필요 여부 판정
// ═══════════════════════════════════════════════════════

/**
 * 컨텍스트 확장 필요 여부 판정
 *
 * Manifesto: derived.needsExpansion
 *
 * 조건:
 * 1. 평균 관련성 < expansionThreshold (기본 0.5)
 * 2. 정보 부재가 아님
 * 3. 토큰 예산 내
 *
 * @param state - 현재 상태
 * @param config - 설정
 * @returns 확장 필요하면 true
 */
export function needsExpansion(
  state: ReasoningState,
  config: Partial<DerivedConfig> = {}
): boolean {
  const mergedConfig = { ...DEFAULT_DERIVED_CONFIG, ...config };

  const avgRelevance = getAvgRelevance(state);
  const withinBudget = isWithinTokenBudget(state, mergedConfig.tokenBudget);
  const notFound = isInformationNotFoundWithConfig(state, mergedConfig);

  return avgRelevance < mergedConfig.expansionThreshold && !notFound && withinBudget;
}

// ═══════════════════════════════════════════════════════
// 답변 가능 여부 판정
// ═══════════════════════════════════════════════════════

/**
 * 답변 가능 여부 판정
 *
 * 조건:
 * 1. 평균 관련성 >= expansionThreshold (기본 0.5)
 * 2. 정보 부재가 아님
 *
 * @param state - 현재 상태
 * @param config - 설정
 * @returns 답변 가능하면 true
 */
export function canAnswer(state: ReasoningState, config: Partial<DerivedConfig> = {}): boolean {
  const mergedConfig = { ...DEFAULT_DERIVED_CONFIG, ...config };

  const avgRelevance = getAvgRelevance(state);
  const notFound = isInformationNotFoundWithConfig(state, mergedConfig);

  return avgRelevance >= mergedConfig.expansionThreshold && !notFound;
}

// ═══════════════════════════════════════════════════════
// 모든 파생 값 계산
// ═══════════════════════════════════════════════════════

/**
 * 모든 파생 값을 한 번에 계산
 *
 * @param state - 현재 상태
 * @param config - 설정
 * @returns 모든 파생 값
 */
export type DerivedValues = {
  currentContextTokens: number;
  withinTokenBudget: boolean;
  avgRelevance: number;
  maxRelevanceFromPath: number;
  attemptCount: number;
  informationNotFound: boolean;
  needsExpansion: boolean;
  canAnswer: boolean;
};

export function computeDerivedValues(
  state: ReasoningState,
  config: Partial<DerivedConfig> = {}
): DerivedValues {
  const mergedConfig = { ...DEFAULT_DERIVED_CONFIG, ...config };

  return {
    currentContextTokens: getCurrentContextTokens(state),
    withinTokenBudget: isWithinTokenBudget(state, mergedConfig.tokenBudget),
    avgRelevance: getAvgRelevance(state),
    maxRelevanceFromPath: getMaxRelevanceFromPath(state),
    attemptCount: getAttemptCount(state),
    informationNotFound: isInformationNotFoundWithConfig(state, mergedConfig),
    needsExpansion: needsExpansion(state, mergedConfig),
    canAnswer: canAnswer(state, mergedConfig),
  };
}
