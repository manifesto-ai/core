/**
 * HSCA Reasoning Actions
 *
 * Manifesto Action 패턴을 따르는 액션 정의
 *
 * ★ 핵심: concludeNotFound
 * - llmGenerated: false → LLM 호출 없음
 * - projectionScope: [] → 빈 배열
 * - precondition: isInformationNotFound(state) === true
 */

import type { ReasoningState } from './state.js';
import type { ParsedQuery, ReasoningStep, Conclusion, QueryStatus } from './types.js';
import {
  isInformationNotFound,
  getAvgRelevance,
  canAnswer,
  type DerivedConfig,
  DEFAULT_DERIVED_CONFIG,
} from './derived.js';

// ═══════════════════════════════════════════════════════
// Action Types
// ═══════════════════════════════════════════════════════

/**
 * 액션 메타데이터
 */
export type ActionMeta = {
  /** 액션 설명 */
  description: string;

  /**
   * LLM 생성 여부
   * - true: LLM 호출 필요
   * - false: 시스템이 자동으로 실행 (★ concludeNotFound의 핵심)
   */
  llmGenerated: boolean;
};

/**
 * 액션 정의
 *
 * @template TInput - 액션 입력 타입 (void면 입력 없음)
 */
export type ActionDefinition<TInput = void> = {
  /** 액션 메타데이터 */
  meta: ActionMeta;

  /**
   * projectionScope: LLM이 볼 수 있는 경로들
   *
   * - 빈 배열이면 LLM 호출 불필요 (시스템이 직접 실행)
   * - 경로가 있으면 해당 경로만 LLM에 전달
   */
  projectionScope: string[];

  /**
   * 전제 조건
   *
   * @param state - 현재 상태
   * @param config - 파생 값 설정
   * @returns 액션 실행 가능하면 true
   */
  precondition: (state: ReasoningState, config?: Partial<DerivedConfig>) => boolean;

  /**
   * 액션 실행
   *
   * 불변성을 유지하면서 새로운 상태 반환
   *
   * @param state - 현재 상태
   * @param input - 액션 입력
   * @returns 새로운 상태
   */
  execute: (state: ReasoningState, input: TInput) => ReasoningState;
};

// ═══════════════════════════════════════════════════════
// analyzeQuery: 질의 분석 액션
// ═══════════════════════════════════════════════════════

/**
 * 질의 분석 액션
 *
 * LLM이 원본 질의를 분석하여 ParsedQuery 생성
 */
export const analyzeQuery: ActionDefinition<ParsedQuery> = {
  meta: {
    description: '질의 의도 및 대상 경로 추출',
    llmGenerated: true,
  },

  projectionScope: ['state.currentQuery.raw'],

  precondition: (state) => state.currentQuery.raw !== '' && state.currentQuery.status === 'pending',

  execute: (state, parsed) => ({
    ...state,
    currentQuery: {
      ...state.currentQuery,
      parsed,
      status: 'analyzing' as QueryStatus,
    },
  }),
};

// ═══════════════════════════════════════════════════════
// setQueryStatus: 질의 상태 변경 액션
// ═══════════════════════════════════════════════════════

/**
 * 질의 상태 변경 액션
 *
 * 시스템이 질의 상태를 변경
 */
export const setQueryStatusAction: ActionDefinition<QueryStatus> = {
  meta: {
    description: '질의 처리 상태 변경',
    llmGenerated: false,
  },

  projectionScope: [],

  precondition: () => true,

  execute: (state, status) => ({
    ...state,
    currentQuery: {
      ...state.currentQuery,
      status,
    },
  }),
};

// ═══════════════════════════════════════════════════════
// addReasoningStepAction: 추론 단계 추가 액션
// ═══════════════════════════════════════════════════════

/**
 * 추론 단계 추가 액션
 *
 * 추론 경로에 새 단계를 추가 (Explainable Ignorance의 근거)
 */
export const addReasoningStepAction: ActionDefinition<ReasoningStep> = {
  meta: {
    description: '추론 경로에 단계 추가',
    llmGenerated: true,
  },

  projectionScope: [
    'state.currentQuery.parsed',
    'state.retrievedContext',
    'state.reasoningPath',
    'derived.avgRelevance',
    'derived.informationNotFound',
  ],

  precondition: (state) => state.currentQuery.status === 'reasoning',

  execute: (state, step) => ({
    ...state,
    reasoningPath: [...state.reasoningPath, step],
  }),
};

// ═══════════════════════════════════════════════════════
// expandContext: 컨텍스트 확장 액션
// ═══════════════════════════════════════════════════════

/**
 * 컨텍스트 확장 입력
 */
export type ExpandContextInput = {
  /** 확장할 노드 ID */
  targetNodeId: string;

  /** 확장된 노드들의 요약 (LLM이 결정) */
  expandedSummary: string;
};

/**
 * 컨텍스트 확장 액션
 *
 * LLM이 어떤 노드를 확장할지 결정
 */
export const expandContext: ActionDefinition<ExpandContextInput> = {
  meta: {
    description: '더 깊은 트리 노드로 확장',
    llmGenerated: true,
  },

  projectionScope: [
    'state.currentQuery.parsed.targetPaths',
    'state.retrievedContext',
    'derived.avgRelevance',
  ],

  precondition: (state, config = {}) => {
    const mergedConfig = { ...DEFAULT_DERIVED_CONFIG, ...config };
    const avgRelevance = getAvgRelevance(state);
    const notFound = isInformationNotFound(
      state,
      mergedConfig.relevanceThreshold,
      mergedConfig.minAttemptsForNotFound
    );

    return (
      avgRelevance < mergedConfig.expansionThreshold &&
      !notFound &&
      state.currentQuery.status === 'reasoning'
    );
  },

  execute: (state, input) => {
    const newStep: ReasoningStep = {
      step: state.reasoningPath.length + 1,
      type: 'expand',
      target: input.targetNodeId,
      relevance: getAvgRelevance(state),
      result: input.expandedSummary,
      evidence: state.retrievedContext.map((n) => n.nodeId),
    };

    return {
      ...state,
      reasoningPath: [...state.reasoningPath, newStep],
    };
  },
};

// ═══════════════════════════════════════════════════════
// ★ 핵심: concludeNotFound - 정보 부재 결론 액션
// ═══════════════════════════════════════════════════════

/**
 * ★★★ 정보 부재 결론 액션 ★★★
 *
 * "Explainable Ignorance"의 핵심 구현
 *
 * 특징:
 * - llmGenerated: false → LLM 호출 없음
 * - projectionScope: [] → 빈 배열 (LLM에 아무것도 보여주지 않음)
 * - precondition: isInformationNotFound(state) === true
 *
 * 이 액션이 실행되면:
 * 1. 상태가 'not_found'로 변경
 * 2. 결론이 설정됨
 * 3. reasoningPath가 "왜 모르는지"의 증거로 사용됨
 *
 * @example
 * ```typescript
 * // 시스템이 자동으로 "모른다" 결론
 * if (concludeNotFound.precondition(state)) {
 *   const newState = concludeNotFound.execute(state);
 *   // newState.conclusion.type === 'not_found'
 *   // newState.currentQuery.status === 'not_found'
 * }
 * ```
 */
export const concludeNotFound: ActionDefinition<void> = {
  meta: {
    description: '정보를 찾을 수 없음을 결론',
    llmGenerated: false, // ★ LLM이 아닌 시스템이 결정
  },

  projectionScope: [], // ★ LLM 호출 불필요

  // ★ 시스템이 구조적으로 판단
  precondition: (state, config = {}) => {
    const mergedConfig = { ...DEFAULT_DERIVED_CONFIG, ...config };
    return isInformationNotFound(
      state,
      mergedConfig.relevanceThreshold,
      mergedConfig.minAttemptsForNotFound
    );
  },

  execute: (state) => {
    const conclusion: Conclusion = {
      type: 'not_found',
      content: '요청하신 정보를 찾을 수 없습니다.',
      confidence: 0.95,
      evidencePaths: state.reasoningPath.map((step) => step.target),
    };

    // 추론 경로에 not_found 단계 추가
    const notFoundStep: ReasoningStep = {
      step: state.reasoningPath.length + 1,
      type: 'not_found',
      target: 'system.conclusion',
      relevance: 0,
      result: 'information_not_found',
      evidence: state.reasoningPath.map((step) => step.target),
    };

    return {
      ...state,
      currentQuery: {
        ...state.currentQuery,
        status: 'not_found' as QueryStatus,
      },
      reasoningPath: [...state.reasoningPath, notFoundStep],
      conclusion,
    };
  },
};

// ═══════════════════════════════════════════════════════
// concludeWithAnswer: 답변 결론 액션
// ═══════════════════════════════════════════════════════

/**
 * 답변 결론 입력
 */
export type ConcludeWithAnswerInput = {
  /** 답변 내용 */
  answer: string;

  /** 신뢰도 (선택, 기본값은 avgRelevance) */
  confidence?: number;
};

/**
 * 답변 결론 액션
 *
 * LLM이 충분한 컨텍스트를 기반으로 답변 생성
 */
export const concludeWithAnswer: ActionDefinition<ConcludeWithAnswerInput> = {
  meta: {
    description: '답변 도출',
    llmGenerated: true,
  },

  projectionScope: [
    'state.currentQuery.parsed',
    'state.retrievedContext',
    'state.reasoningPath',
  ],

  precondition: (state, config = {}) => canAnswer(state, config),

  execute: (state, input) => {
    const avgRelevance = getAvgRelevance(state);

    const conclusion: Conclusion = {
      type: 'answer',
      content: input.answer,
      confidence: input.confidence ?? avgRelevance,
      evidencePaths: state.retrievedContext.map((node) => node.nodeId),
    };

    // 추론 경로에 conclude 단계 추가
    const concludeStep: ReasoningStep = {
      step: state.reasoningPath.length + 1,
      type: 'conclude',
      target: 'system.answer',
      relevance: avgRelevance,
      result: 'answer_generated',
      evidence: state.retrievedContext.map((n) => n.nodeId),
    };

    return {
      ...state,
      currentQuery: {
        ...state.currentQuery,
        status: 'complete' as QueryStatus,
      },
      reasoningPath: [...state.reasoningPath, concludeStep],
      conclusion,
    };
  },
};

// ═══════════════════════════════════════════════════════
// concludeUncertain: 불확실 결론 액션
// ═══════════════════════════════════════════════════════

/**
 * 불확실 결론 입력
 */
export type ConcludeUncertainInput = {
  /** 불확실 이유 */
  reason: string;
};

/**
 * 불확실 결론 액션
 *
 * 충분히 시도했지만 확신할 수 없는 경우
 */
export const concludeUncertain: ActionDefinition<ConcludeUncertainInput> = {
  meta: {
    description: '불확실한 결론',
    llmGenerated: true,
  },

  projectionScope: [
    'state.currentQuery.parsed',
    'state.retrievedContext',
    'state.reasoningPath',
    'derived.avgRelevance',
  ],

  // 정보 부재도 아니고, 답변 가능도 아닌 경우
  precondition: (state, config = {}) => {
    const mergedConfig = { ...DEFAULT_DERIVED_CONFIG, ...config };
    const notFound = isInformationNotFound(
      state,
      mergedConfig.relevanceThreshold,
      mergedConfig.minAttemptsForNotFound
    );
    const answerable = canAnswer(state, mergedConfig);

    return !notFound && !answerable && state.currentQuery.status === 'reasoning';
  },

  execute: (state, input) => {
    const avgRelevance = getAvgRelevance(state);

    const conclusion: Conclusion = {
      type: 'uncertain',
      content: input.reason,
      confidence: avgRelevance,
      evidencePaths: state.retrievedContext.map((node) => node.nodeId),
    };

    const concludeStep: ReasoningStep = {
      step: state.reasoningPath.length + 1,
      type: 'conclude',
      target: 'system.uncertain',
      relevance: avgRelevance,
      result: 'uncertain',
      evidence: state.retrievedContext.map((n) => n.nodeId),
    };

    return {
      ...state,
      currentQuery: {
        ...state.currentQuery,
        status: 'complete' as QueryStatus,
      },
      reasoningPath: [...state.reasoningPath, concludeStep],
      conclusion,
    };
  },
};

// ═══════════════════════════════════════════════════════
// 액션 레지스트리
// ═══════════════════════════════════════════════════════

/**
 * 모든 HSCA 액션 레지스트리
 */
export const HSCA_ACTIONS = {
  analyzeQuery,
  setQueryStatus: setQueryStatusAction,
  addReasoningStep: addReasoningStepAction,
  expandContext,
  concludeNotFound,
  concludeWithAnswer,
  concludeUncertain,
} as const;

/**
 * 액션 이름 타입
 */
export type HSCAActionName = keyof typeof HSCA_ACTIONS;
