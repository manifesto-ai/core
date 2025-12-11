import { describe, it, expect } from 'vitest';
import {
  isTerminalState,
  selectNodeToExpand,
  selectNextAction,
  diagnoseActionConditions,
  describeAction,
} from '../../src/loop/selector.js';
import type { LoopConfig, SelectedAction } from '../../src/loop/types.js';
import { DEFAULT_LOOP_CONFIG } from '../../src/loop/types.js';
import type { ReasoningState, RetrievedNode, ReasoningStep } from '../../src/reasoning/index.js';
import { createReasoningState, setParsedQuery, setQueryStatus, setRetrievedContext, addReasoningStep } from '../../src/reasoning/index.js';

// 테스트용 RetrievedNode 생성 헬퍼
function createRetrievedNode(overrides: Partial<RetrievedNode> = {}): RetrievedNode {
  return {
    nodeId: 'test-node',
    level: 1,
    summary: 'Test summary',
    relevance: 0.5,
    tokenCount: 100,
    semanticPaths: ['test.path'],
    ...overrides,
  };
}

// 테스트용 상태 생성 헬퍼
function createTestState(overrides: Partial<ReasoningState> = {}): ReasoningState {
  const base = createReasoningState('테스트 질의');
  return { ...base, ...overrides };
}

describe('action selector', () => {
  describe('isTerminalState', () => {
    it('should return true for complete status', () => {
      const state = createTestState();
      const completeState = setQueryStatus(state, 'complete');

      expect(isTerminalState(completeState)).toBe(true);
    });

    it('should return true for not_found status', () => {
      const state = createTestState();
      const notFoundState = setQueryStatus(state, 'not_found');

      expect(isTerminalState(notFoundState)).toBe(true);
    });

    it('should return false for pending status', () => {
      const state = createTestState();

      expect(isTerminalState(state)).toBe(false);
    });

    it('should return false for reasoning status', () => {
      const state = createTestState();
      const reasoningState = setQueryStatus(state, 'reasoning');

      expect(isTerminalState(reasoningState)).toBe(false);
    });
  });

  describe('selectNodeToExpand', () => {
    it('should return null for empty retrievedContext', () => {
      const state = createTestState();

      expect(selectNodeToExpand(state)).toBeNull();
    });

    it('should select highest relevance node', () => {
      const nodes = [
        createRetrievedNode({ nodeId: 'low', relevance: 0.3 }),
        createRetrievedNode({ nodeId: 'high', relevance: 0.9 }),
        createRetrievedNode({ nodeId: 'mid', relevance: 0.5 }),
      ];
      const state = setRetrievedContext(createTestState(), nodes);

      expect(selectNodeToExpand(state)).toBe('high');
    });

    it('should skip already expanded nodes', () => {
      const nodes = [
        createRetrievedNode({ nodeId: 'high', relevance: 0.9 }),
        createRetrievedNode({ nodeId: 'mid', relevance: 0.5 }),
      ];
      let state = setRetrievedContext(createTestState(), nodes);

      // 'high' 노드를 확장한 기록 추가
      const expandStep: ReasoningStep = {
        step: 1,
        type: 'expand',
        target: 'high',
        relevance: 0.9,
        result: 'expanded',
        evidence: [],
      };
      state = addReasoningStep(state, expandStep);

      // 이미 확장한 'high' 대신 'mid' 선택
      expect(selectNodeToExpand(state)).toBe('mid');
    });

    it('should return null if all nodes are expanded', () => {
      const nodes = [createRetrievedNode({ nodeId: 'only', relevance: 0.5 })];
      let state = setRetrievedContext(createTestState(), nodes);

      const expandStep: ReasoningStep = {
        step: 1,
        type: 'expand',
        target: 'only',
        relevance: 0.5,
        result: 'expanded',
        evidence: [],
      };
      state = addReasoningStep(state, expandStep);

      expect(selectNodeToExpand(state)).toBeNull();
    });
  });

  describe('selectNextAction', () => {
    const config = DEFAULT_LOOP_CONFIG;

    it('should return analyze for pending state', () => {
      const state = createTestState();

      const action = selectNextAction(state, config);

      expect(action.type).toBe('analyze');
    });

    it('should return retrieve after analysis (with parsed)', () => {
      let state = createTestState();
      state = setParsedQuery(state, {
        intent: 'lookup',
        targetPaths: ['test.path'],
        constraints: [],
        expectedDepth: 1,
      });
      state = setQueryStatus(state, 'analyzing');

      const action = selectNextAction(state, config);

      expect(action.type).toBe('retrieve');
    });

    it('should return terminal for complete state', () => {
      let state = createTestState();
      state = setQueryStatus(state, 'complete');

      const action = selectNextAction(state, config);

      expect(action.type).toBe('terminal');
    });

    it('should return terminal for not_found state', () => {
      let state = createTestState();
      state = setQueryStatus(state, 'not_found');

      const action = selectNextAction(state, config);

      expect(action.type).toBe('terminal');
    });

    it('should return conclude_not_found when criteria met', () => {
      // 조건: maxRelevance < 0.3 && attemptCount >= 2
      const lowRelevanceNodes = [
        createRetrievedNode({ nodeId: 'a', relevance: 0.1 }),
        createRetrievedNode({ nodeId: 'b', relevance: 0.2 }),
      ];

      let state = createTestState();
      state = setParsedQuery(state, {
        intent: 'lookup',
        targetPaths: ['test'],
        constraints: [],
        expectedDepth: 1,
      });
      state = setRetrievedContext(state, lowRelevanceNodes);
      state = setQueryStatus(state, 'reasoning');

      // 2회 시도 기록 추가
      state = addReasoningStep(state, {
        step: 1,
        type: 'retrieve',
        target: 'test',
        relevance: 0.15,
        result: 'found',
        evidence: [],
      });
      state = addReasoningStep(state, {
        step: 2,
        type: 'expand',
        target: 'a',
        relevance: 0.1,
        result: 'expanded',
        evidence: [],
      });

      const action = selectNextAction(state, config);

      expect(action.type).toBe('conclude_not_found');
    });

    it('should return expand when relevance is low but not not_found', () => {
      // 조건: avgRelevance < 0.5 && attemptCount < minAttemptsForNotFound
      const lowRelevanceNodes = [
        createRetrievedNode({ nodeId: 'a', relevance: 0.4 }),
      ];

      let state = createTestState();
      state = setParsedQuery(state, {
        intent: 'lookup',
        targetPaths: ['test'],
        constraints: [],
        expectedDepth: 1,
      });
      state = setRetrievedContext(state, lowRelevanceNodes);
      state = setQueryStatus(state, 'reasoning');

      // 1회만 시도
      state = addReasoningStep(state, {
        step: 1,
        type: 'retrieve',
        target: 'test',
        relevance: 0.4,
        result: 'found',
        evidence: [],
      });

      const action = selectNextAction(state, config);

      expect(action.type).toBe('expand');
      if (action.type === 'expand') {
        expect(action.nodeId).toBe('a');
      }
    });

    it('should return conclude_answer when can answer', () => {
      // 조건: avgRelevance >= 0.5
      const highRelevanceNodes = [
        createRetrievedNode({ nodeId: 'a', relevance: 0.8 }),
        createRetrievedNode({ nodeId: 'b', relevance: 0.7 }),
      ];

      let state = createTestState();
      state = setParsedQuery(state, {
        intent: 'lookup',
        targetPaths: ['test'],
        constraints: [],
        expectedDepth: 1,
      });
      state = setRetrievedContext(state, highRelevanceNodes);
      state = setQueryStatus(state, 'reasoning');

      // 1회 시도
      state = addReasoningStep(state, {
        step: 1,
        type: 'retrieve',
        target: 'test',
        relevance: 0.75,
        result: 'found',
        evidence: [],
      });

      const action = selectNextAction(state, config);

      expect(action.type).toBe('conclude_answer');
    });
  });

  describe('diagnoseActionConditions', () => {
    it('should return conditions for each action', () => {
      const state = createTestState();
      const config = DEFAULT_LOOP_CONFIG;

      const conditions = diagnoseActionConditions(state, config);

      expect(conditions).toHaveProperty('terminal');
      expect(conditions).toHaveProperty('analyze');
      expect(conditions).toHaveProperty('retrieve');
      expect(conditions).toHaveProperty('conclude_not_found');
      expect(conditions).toHaveProperty('expand');
      expect(conditions).toHaveProperty('conclude_answer');
      expect(conditions).toHaveProperty('conclude_uncertain');
    });

    it('should show analyze=true for pending state', () => {
      const state = createTestState();
      const config = DEFAULT_LOOP_CONFIG;

      const conditions = diagnoseActionConditions(state, config);

      expect(conditions.analyze).toBe(true);
      expect(conditions.terminal).toBe(false);
    });
  });

  describe('describeAction', () => {
    it('should describe analyze action', () => {
      const description = describeAction({ type: 'analyze' });

      expect(description).toContain('분석');
      expect(description).toContain('LLM');
    });

    it('should describe retrieve action', () => {
      const description = describeAction({ type: 'retrieve' });

      expect(description).toContain('검색');
      expect(description).toContain('CQE');
    });

    it('should describe expand action with nodeId', () => {
      const description = describeAction({ type: 'expand', nodeId: 'test-node' });

      expect(description).toContain('확장');
      expect(description).toContain('test-node');
    });

    it('should describe conclude_not_found without LLM', () => {
      const description = describeAction({ type: 'conclude_not_found' });

      expect(description).toContain('부재');
      expect(description).toContain('LLM 없음');
    });

    it('should describe conclude_answer action', () => {
      const description = describeAction({ type: 'conclude_answer' });

      expect(description).toContain('답변');
    });

    it('should describe terminal action', () => {
      const description = describeAction({ type: 'terminal' });

      expect(description).toContain('종료');
    });
  });
});
