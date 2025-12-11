/**
 * Action Selector
 *
 * 현재 추론 상태에서 다음 액션을 선택하는 로직
 * - selectNextAction: 다음 액션 선택
 * - selectNodeToExpand: 확장할 노드 선택
 * - isTerminalState: 종료 상태 확인
 */

import type { ReasoningState } from '../reasoning/index.js';
import {
  isInformationNotFound,
  needsExpansion,
  canAnswer,
  getAttemptCount,
  getMaxRelevance,
} from '../reasoning/index.js';
import type { LoopConfig, SelectedAction } from './types.js';

// ═══════════════════════════════════════════════════════
// Terminal State Check
// ═══════════════════════════════════════════════════════

/**
 * 종료 상태 확인
 *
 * 다음 상태가 종료 상태:
 * - 'complete': 답변 완료
 * - 'not_found': 정보 부재 확정
 *
 * @param state - 추론 상태
 * @returns 종료 상태 여부
 */
export function isTerminalState(state: ReasoningState): boolean {
  const { status } = state.currentQuery;
  return status === 'complete' || status === 'not_found';
}

// ═══════════════════════════════════════════════════════
// Node Selection
// ═══════════════════════════════════════════════════════

/**
 * 확장할 노드 선택
 *
 * 전략:
 * - 가장 관련성 높은 노드 선택
 * - 이미 확장된 노드는 제외
 *
 * @param state - 추론 상태
 * @returns 확장할 노드 ID 또는 null
 */
export function selectNodeToExpand(state: ReasoningState): string | null {
  const { retrievedContext, reasoningPath } = state;

  if (retrievedContext.length === 0) {
    return null;
  }

  // 이미 확장한 노드 ID들
  const expandedNodeIds = new Set(
    reasoningPath
      .filter((step) => step.type === 'expand')
      .map((step) => step.target)
  );

  // 관련성 순으로 정렬 후 확장되지 않은 첫 번째 노드 선택
  const sortedNodes = [...retrievedContext].sort(
    (a, b) => b.relevance - a.relevance
  );

  for (const node of sortedNodes) {
    if (!expandedNodeIds.has(node.nodeId)) {
      return node.nodeId;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// Action Selection
// ═══════════════════════════════════════════════════════

/**
 * 현재 상태에서 다음 액션 선택
 *
 * 우선순위:
 * 1. terminal - 이미 종료 상태
 * 2. analyze - 질의 분석 필요 (status === 'pending')
 * 3. retrieve - 컨텍스트 검색 필요 (status === 'analyzing' && parsed 존재)
 * 4. conclude_not_found - 정보 부재 판정 ★ LLM 호출 없음
 * 5. expand - 확장 필요 (관련성 낮음)
 * 6. conclude_answer - 답변 가능 (관련성 충분)
 * 7. conclude_uncertain - 불확실
 *
 * @param state - 추론 상태
 * @param config - 루프 설정
 * @returns 선택된 액션
 */
export function selectNextAction(
  state: ReasoningState,
  config: LoopConfig
): SelectedAction {
  const { status } = state.currentQuery;
  const { parsed } = state.currentQuery;

  // 1. 종료 상태 확인
  if (isTerminalState(state)) {
    return { type: 'terminal' };
  }

  // 2. 질의 분석 필요
  if (status === 'pending') {
    return { type: 'analyze' };
  }

  // 3. 컨텍스트 검색 필요
  if (status === 'analyzing' && parsed) {
    return { type: 'retrieve' };
  }

  // 4. 정보 부재 판정 (★ LLM 호출 없이 시스템이 결정)
  if (
    isInformationNotFound(
      state,
      config.relevanceThreshold,
      config.minAttemptsForNotFound
    )
  ) {
    return { type: 'conclude_not_found' };
  }

  // 5. 확장 필요 여부 확인
  if (needsExpansion(state, config.expansionThreshold)) {
    const nodeId = selectNodeToExpand(state);
    if (nodeId) {
      return { type: 'expand', nodeId };
    }
  }

  // 6. 답변 가능 여부 확인
  if (canAnswer(state, config.expansionThreshold)) {
    return { type: 'conclude_answer' };
  }

  // 7. 불확실 (기본)
  return { type: 'conclude_uncertain' };
}

// ═══════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════

/**
 * 현재 상태의 액션 가능성 진단
 *
 * 디버깅용 - 각 액션의 조건 충족 여부 반환
 *
 * @param state - 추론 상태
 * @param config - 루프 설정
 * @returns 각 액션별 조건 충족 여부
 */
export function diagnoseActionConditions(
  state: ReasoningState,
  config: LoopConfig
): Record<string, boolean> {
  const { status, parsed } = state.currentQuery;

  return {
    terminal: isTerminalState(state),
    analyze: status === 'pending',
    retrieve: status === 'analyzing' && !!parsed,
    conclude_not_found: isInformationNotFound(
      state,
      config.relevanceThreshold,
      config.minAttemptsForNotFound
    ),
    expand:
      needsExpansion(state, config.expansionThreshold) &&
      selectNodeToExpand(state) !== null,
    conclude_answer: canAnswer(state, config.expansionThreshold),
    conclude_uncertain: true, // 항상 가능 (기본 폴백)
  };
}

/**
 * 액션 설명 반환
 *
 * @param action - 선택된 액션
 * @returns 액션 설명 문자열
 */
export function describeAction(action: SelectedAction): string {
  switch (action.type) {
    case 'analyze':
      return '질의 분석 (LLM)';
    case 'retrieve':
      return '컨텍스트 검색 (CQE)';
    case 'expand':
      return `노드 확장: ${action.nodeId} (CQE)`;
    case 'conclude_answer':
      return '답변 생성 (LLM)';
    case 'conclude_not_found':
      return '정보 부재 결론 (시스템 - LLM 없음)';
    case 'conclude_uncertain':
      return '불확실 결론 (LLM)';
    case 'terminal':
      return '종료 상태';
  }
}
