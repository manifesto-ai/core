import { describe, it, expect } from 'vitest';
import {
  createReasoningState,
  addReasoningStep,
  setRetrievedContext,
  setQueryStatus,
  isInformationNotFound,
  analyzeQuery,
  setQueryStatusAction,
  addReasoningStepAction,
  expandContext,
  concludeNotFound,
  concludeWithAnswer,
  concludeUncertain,
  HSCA_ACTIONS,
  type ReasoningState,
  type RetrievedNode,
  type ReasoningStep,
  type ParsedQuery,
} from '../../src/reasoning/index.js';

// 헬퍼 함수들
function createNode(overrides: Partial<RetrievedNode> = {}): RetrievedNode {
  return {
    nodeId: 'node-1',
    level: 0,
    summary: 'test summary',
    relevance: 0.5,
    tokenCount: 100,
    semanticPaths: ['test.path'],
    ...overrides,
  };
}

function createStep(
  step: number,
  type: ReasoningStep['type'],
  relevance: number
): ReasoningStep {
  return {
    step,
    type,
    target: `target.${step}`,
    relevance,
    result: 'test_result',
    evidence: [],
  };
}

describe('actions', () => {
  describe('analyzeQuery', () => {
    it('should have correct meta', () => {
      expect(analyzeQuery.meta.description).toBe('질의 의도 및 대상 경로 추출');
      expect(analyzeQuery.meta.llmGenerated).toBe(true);
    });

    it('should have correct projectionScope', () => {
      expect(analyzeQuery.projectionScope).toEqual(['state.currentQuery.raw']);
    });

    it('should pass precondition when query is not empty and status is pending', () => {
      const state = createReasoningState('테스트 질의');
      expect(analyzeQuery.precondition(state)).toBe(true);
    });

    it('should fail precondition when query is empty', () => {
      const state = createReasoningState('');
      expect(analyzeQuery.precondition(state)).toBe(false);
    });

    it('should fail precondition when status is not pending', () => {
      let state = createReasoningState('테스트 질의');
      state = setQueryStatus(state, 'analyzing');
      expect(analyzeQuery.precondition(state)).toBe(false);
    });

    it('should execute and set parsed query', () => {
      const state = createReasoningState('테스트 질의');
      const parsed: ParsedQuery = {
        intent: 'lookup',
        targetPaths: ['test.path'],
        constraints: [],
        expectedDepth: 1,
      };

      const newState = analyzeQuery.execute(state, parsed);

      expect(newState.currentQuery.parsed).toEqual(parsed);
      expect(newState.currentQuery.status).toBe('analyzing');
    });
  });

  describe('setQueryStatusAction', () => {
    it('should have llmGenerated: false', () => {
      expect(setQueryStatusAction.meta.llmGenerated).toBe(false);
    });

    it('should have empty projectionScope', () => {
      expect(setQueryStatusAction.projectionScope).toEqual([]);
    });

    it('should always pass precondition', () => {
      const state = createReasoningState('test');
      expect(setQueryStatusAction.precondition(state)).toBe(true);
    });

    it('should change status', () => {
      const state = createReasoningState('test');
      const newState = setQueryStatusAction.execute(state, 'reasoning');
      expect(newState.currentQuery.status).toBe('reasoning');
    });
  });

  describe('addReasoningStepAction', () => {
    it('should have correct projectionScope', () => {
      expect(addReasoningStepAction.projectionScope).toContain('state.currentQuery.parsed');
      expect(addReasoningStepAction.projectionScope).toContain('state.reasoningPath');
      expect(addReasoningStepAction.projectionScope).toContain('derived.informationNotFound');
    });

    it('should pass precondition when status is reasoning', () => {
      let state = createReasoningState('test');
      state = setQueryStatus(state, 'reasoning');
      expect(addReasoningStepAction.precondition(state)).toBe(true);
    });

    it('should fail precondition when status is not reasoning', () => {
      const state = createReasoningState('test');
      expect(addReasoningStepAction.precondition(state)).toBe(false);
    });

    it('should add step to reasoning path', () => {
      let state = createReasoningState('test');
      state = setQueryStatus(state, 'reasoning');

      const step = createStep(1, 'retrieve', 0.5);
      const newState = addReasoningStepAction.execute(state, step);

      expect(newState.reasoningPath).toHaveLength(1);
      expect(newState.reasoningPath[0]).toEqual(step);
    });
  });

  describe('concludeNotFound', () => {
    it('should have llmGenerated: false', () => {
      expect(concludeNotFound.meta.llmGenerated).toBe(false);
    });

    it('should have empty projectionScope', () => {
      expect(concludeNotFound.projectionScope).toEqual([]);
    });

    it('should pass precondition when informationNotFound is true', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.1));
      state = addReasoningStep(state, createStep(2, 'expand', 0.15));

      expect(isInformationNotFound(state)).toBe(true);
      expect(concludeNotFound.precondition(state)).toBe(true);
    });

    it('should fail precondition when informationNotFound is false', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.5));

      expect(isInformationNotFound(state)).toBe(false);
      expect(concludeNotFound.precondition(state)).toBe(false);
    });

    it('should execute and set conclusion', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.1));
      state = addReasoningStep(state, createStep(2, 'expand', 0.15));

      const newState = concludeNotFound.execute(state, undefined);

      expect(newState.currentQuery.status).toBe('not_found');
      expect(newState.conclusion).not.toBeNull();
      expect(newState.conclusion!.type).toBe('not_found');
      expect(newState.conclusion!.content).toBe('요청하신 정보를 찾을 수 없습니다.');
      expect(newState.conclusion!.confidence).toBe(0.95);
    });

    it('should include evidence paths from reasoning path', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, {
        step: 1,
        type: 'retrieve',
        target: 'finance.revenue',
        relevance: 0.1,
        result: 'no_match',
        evidence: [],
      });
      state = addReasoningStep(state, {
        step: 2,
        type: 'expand',
        target: 'finance.*',
        relevance: 0.15,
        result: 'no_children',
        evidence: [],
      });

      const newState = concludeNotFound.execute(state, undefined);

      expect(newState.conclusion!.evidencePaths).toContain('finance.revenue');
      expect(newState.conclusion!.evidencePaths).toContain('finance.*');
    });

    it('should add not_found step to reasoning path', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.1));
      state = addReasoningStep(state, createStep(2, 'expand', 0.15));

      const newState = concludeNotFound.execute(state, undefined);

      const lastStep = newState.reasoningPath[newState.reasoningPath.length - 1];
      expect(lastStep?.type).toBe('not_found');
      expect(lastStep?.target).toBe('system.conclusion');
    });
  });

  describe('concludeWithAnswer', () => {
    it('should have llmGenerated: true', () => {
      expect(concludeWithAnswer.meta.llmGenerated).toBe(true);
    });

    it('should have correct projectionScope', () => {
      expect(concludeWithAnswer.projectionScope).toContain('state.currentQuery.parsed');
      expect(concludeWithAnswer.projectionScope).toContain('state.retrievedContext');
      expect(concludeWithAnswer.projectionScope).toContain('state.reasoningPath');
    });

    it('should pass precondition when avgRelevance >= 0.5', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ relevance: 0.6 }),
        createNode({ relevance: 0.7 }),
      ]);

      expect(concludeWithAnswer.precondition(state)).toBe(true);
    });

    it('should fail precondition when avgRelevance < 0.5', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ relevance: 0.3 }),
        createNode({ relevance: 0.4 }),
      ]);

      expect(concludeWithAnswer.precondition(state)).toBe(false);
    });

    it('should fail precondition when informationNotFound is true', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [createNode({ relevance: 0.8 })]);
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.1));
      state = addReasoningStep(state, createStep(2, 'expand', 0.15));

      // 높은 컨텍스트 관련성에도 불구하고 path에서 낮은 관련성
      expect(concludeWithAnswer.precondition(state)).toBe(false);
    });

    it('should execute and set answer conclusion', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ nodeId: 'node-1', relevance: 0.6 }),
        createNode({ nodeId: 'node-2', relevance: 0.7 }),
      ]);

      const newState = concludeWithAnswer.execute(state, {
        answer: '프로젝트 상태는 진행 중입니다.',
      });

      expect(newState.currentQuery.status).toBe('complete');
      expect(newState.conclusion!.type).toBe('answer');
      expect(newState.conclusion!.content).toBe('프로젝트 상태는 진행 중입니다.');
      expect(newState.conclusion!.confidence).toBeCloseTo(0.65);
      expect(newState.conclusion!.evidencePaths).toContain('node-1');
      expect(newState.conclusion!.evidencePaths).toContain('node-2');
    });

    it('should respect custom confidence', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [createNode({ relevance: 0.6 })]);

      const newState = concludeWithAnswer.execute(state, {
        answer: '답변',
        confidence: 0.9,
      });

      expect(newState.conclusion!.confidence).toBe(0.9);
    });
  });

  describe('concludeUncertain', () => {
    it('should have llmGenerated: true', () => {
      expect(concludeUncertain.meta.llmGenerated).toBe(true);
    });

    it('should pass precondition in uncertain state', () => {
      let state = createReasoningState('test');
      state = setQueryStatus(state, 'reasoning');
      // avgRelevance = 0.35 (not answerable, not not_found)
      state = setRetrievedContext(state, [createNode({ relevance: 0.35 })]);
      // 1회만 시도 (not_found 아님)
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.35));

      expect(concludeUncertain.precondition(state)).toBe(true);
    });

    it('should execute and set uncertain conclusion', () => {
      let state = createReasoningState('test');
      state = setQueryStatus(state, 'reasoning');
      state = setRetrievedContext(state, [createNode({ relevance: 0.35 })]);
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.35));

      const newState = concludeUncertain.execute(state, {
        reason: '관련 정보는 있으나 확신할 수 없습니다.',
      });

      expect(newState.currentQuery.status).toBe('complete');
      expect(newState.conclusion!.type).toBe('uncertain');
      expect(newState.conclusion!.content).toBe('관련 정보는 있으나 확신할 수 없습니다.');
    });
  });

  describe('expandContext', () => {
    it('should have llmGenerated: true', () => {
      expect(expandContext.meta.llmGenerated).toBe(true);
    });

    it('should pass precondition when expansion is needed', () => {
      let state = createReasoningState('test');
      state = setQueryStatus(state, 'reasoning');
      state = setRetrievedContext(state, [createNode({ relevance: 0.35, tokenCount: 100 })]);
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.35));

      expect(expandContext.precondition(state)).toBe(true);
    });

    it('should execute and add expand step', () => {
      let state = createReasoningState('test');
      state = setQueryStatus(state, 'reasoning');
      state = setRetrievedContext(state, [createNode({ relevance: 0.35 })]);
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.35));

      const newState = expandContext.execute(state, {
        targetNodeId: 'node-to-expand',
        expandedSummary: '확장 후 요약',
      });

      const lastStep = newState.reasoningPath[newState.reasoningPath.length - 1];
      expect(lastStep?.type).toBe('expand');
      expect(lastStep?.target).toBe('node-to-expand');
    });
  });

  describe('HSCA_ACTIONS registry', () => {
    it('should contain all actions', () => {
      expect(HSCA_ACTIONS.analyzeQuery).toBe(analyzeQuery);
      expect(HSCA_ACTIONS.setQueryStatus).toBe(setQueryStatusAction);
      expect(HSCA_ACTIONS.addReasoningStep).toBe(addReasoningStepAction);
      expect(HSCA_ACTIONS.expandContext).toBe(expandContext);
      expect(HSCA_ACTIONS.concludeNotFound).toBe(concludeNotFound);
      expect(HSCA_ACTIONS.concludeWithAnswer).toBe(concludeWithAnswer);
      expect(HSCA_ACTIONS.concludeUncertain).toBe(concludeUncertain);
    });
  });

  describe('핵심 시나리오: Explainable Ignorance 워크플로우', () => {
    it('should demonstrate full "not found" workflow', () => {
      // 1. 질의 시작
      let state = createReasoningState('2024년 3분기 매출은?');

      // 2. 질의 분석
      expect(analyzeQuery.precondition(state)).toBe(true);
      state = analyzeQuery.execute(state, {
        intent: 'lookup',
        targetPaths: ['finance.revenue.q3.2024'],
        constraints: [],
        expectedDepth: 2,
      });
      expect(state.currentQuery.status).toBe('analyzing');

      // 3. 상태를 reasoning으로 변경
      state = setQueryStatusAction.execute(state, 'reasoning');

      // 4. 첫 번째 검색 시도
      state = addReasoningStepAction.execute(state, {
        step: 1,
        type: 'retrieve',
        target: 'finance.revenue.q3.2024',
        relevance: 0.12,
        result: 'no_match',
        evidence: [],
      });

      // 아직 concludeNotFound 불가
      expect(concludeNotFound.precondition(state)).toBe(false);

      // 5. 두 번째 확장 시도
      state = addReasoningStepAction.execute(state, {
        step: 2,
        type: 'expand',
        target: 'finance.*',
        relevance: 0.15,
        result: 'no_relevant_children',
        evidence: [],
      });

      // 이제 concludeNotFound 가능
      expect(concludeNotFound.precondition(state)).toBe(true);
      expect(concludeWithAnswer.precondition(state)).toBe(false);

      // 6. 시스템이 "모른다" 결론 (LLM 호출 없음)
      expect(concludeNotFound.meta.llmGenerated).toBe(false);
      expect(concludeNotFound.projectionScope).toEqual([]);

      state = concludeNotFound.execute(state, undefined);

      // 7. 최종 상태 확인
      expect(state.currentQuery.status).toBe('not_found');
      expect(state.conclusion!.type).toBe('not_found');
      expect(state.conclusion!.confidence).toBe(0.95);
      expect(state.reasoningPath).toHaveLength(3); // 2 attempts + 1 not_found
    });

    it('should demonstrate full "answer found" workflow', () => {
      // 1. 질의 시작
      let state = createReasoningState('프로젝트 현황은?');

      // 2. 질의 분석
      state = analyzeQuery.execute(state, {
        intent: 'lookup',
        targetPaths: ['project.status'],
        constraints: [],
        expectedDepth: 1,
      });

      // 3. 상태를 reasoning으로 변경
      state = setQueryStatusAction.execute(state, 'reasoning');

      // 4. 검색 성공
      state = addReasoningStepAction.execute(state, {
        step: 1,
        type: 'retrieve',
        target: 'project.status',
        relevance: 0.75,
        result: 'found_3_nodes',
        evidence: ['node-1', 'node-2', 'node-3'],
      });

      // 5. 컨텍스트 추가
      state = setRetrievedContext(state, [
        createNode({ nodeId: 'node-1', relevance: 0.8 }),
        createNode({ nodeId: 'node-2', relevance: 0.7 }),
        createNode({ nodeId: 'node-3', relevance: 0.6 }),
      ]);

      // 6. concludeWithAnswer 가능
      expect(concludeWithAnswer.precondition(state)).toBe(true);
      expect(concludeNotFound.precondition(state)).toBe(false);

      // 7. LLM이 답변 생성
      expect(concludeWithAnswer.meta.llmGenerated).toBe(true);

      state = concludeWithAnswer.execute(state, {
        answer: '프로젝트는 현재 70% 완료되었습니다.',
      });

      // 8. 최종 상태 확인
      expect(state.currentQuery.status).toBe('complete');
      expect(state.conclusion!.type).toBe('answer');
      expect(state.conclusion!.content).toBe('프로젝트는 현재 70% 완료되었습니다.');
      expect(state.conclusion!.evidencePaths).toContain('node-1');
    });
  });
});
