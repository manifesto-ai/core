import { describe, it, expect } from 'vitest';
import {
  createReasoningState,
  addReasoningStep,
  setRetrievedContext,
  getCurrentContextTokens,
  isWithinTokenBudget,
  getAvgRelevance,
  getMaxRelevanceFromPath,
  getAttemptCount,
  isInformationNotFound,
  isInformationNotFoundWithConfig,
  needsExpansion,
  canAnswer,
  computeDerivedValues,
  DEFAULT_DERIVED_CONFIG,
  type ReasoningState,
  type RetrievedNode,
  type ReasoningStep,
} from '../../src/reasoning/index.js';

// 헬퍼: 테스트용 RetrievedNode 생성
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

// 헬퍼: 테스트용 ReasoningStep 생성
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

describe('derived values', () => {
  describe('getCurrentContextTokens', () => {
    it('should return 0 for empty context', () => {
      const state = createReasoningState('test');
      expect(getCurrentContextTokens(state)).toBe(0);
    });

    it('should sum token counts from retrieved nodes', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ tokenCount: 100 }),
        createNode({ tokenCount: 200 }),
        createNode({ tokenCount: 50 }),
      ]);

      expect(getCurrentContextTokens(state)).toBe(350);
    });
  });

  describe('isWithinTokenBudget', () => {
    it('should return true for empty context', () => {
      const state = createReasoningState('test');
      expect(isWithinTokenBudget(state)).toBe(true);
    });

    it('should return true when within budget', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ tokenCount: 1000 }),
        createNode({ tokenCount: 1000 }),
      ]);

      expect(isWithinTokenBudget(state, 4000)).toBe(true);
    });

    it('should return false when exceeding budget', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ tokenCount: 2000 }),
        createNode({ tokenCount: 3000 }),
      ]);

      expect(isWithinTokenBudget(state, 4000)).toBe(false);
    });

    it('should use default budget when not specified', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ tokenCount: DEFAULT_DERIVED_CONFIG.tokenBudget + 1 }),
      ]);

      expect(isWithinTokenBudget(state)).toBe(false);
    });
  });

  describe('getAvgRelevance', () => {
    it('should return 0 for empty context', () => {
      const state = createReasoningState('test');
      expect(getAvgRelevance(state)).toBe(0);
    });

    it('should calculate average correctly', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ relevance: 0.2 }),
        createNode({ relevance: 0.4 }),
        createNode({ relevance: 0.6 }),
      ]);

      expect(getAvgRelevance(state)).toBeCloseTo(0.4);
    });

    it('should handle single node', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [createNode({ relevance: 0.75 })]);

      expect(getAvgRelevance(state)).toBe(0.75);
    });
  });

  describe('getMaxRelevanceFromPath', () => {
    it('should return 0 for empty reasoning path', () => {
      const state = createReasoningState('test');
      expect(getMaxRelevanceFromPath(state)).toBe(0);
    });

    it('should return max relevance from retrieve/expand steps', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.2));
      state = addReasoningStep(state, createStep(2, 'expand', 0.4));
      state = addReasoningStep(state, createStep(3, 'retrieve', 0.15));

      expect(getMaxRelevanceFromPath(state)).toBe(0.4);
    });

    it('should ignore non-retrieve/expand steps', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'analyze', 1.0));
      state = addReasoningStep(state, createStep(2, 'retrieve', 0.2));
      state = addReasoningStep(state, createStep(3, 'conclude', 0.9));

      expect(getMaxRelevanceFromPath(state)).toBe(0.2);
    });
  });

  describe('getAttemptCount', () => {
    it('should return 0 for empty reasoning path', () => {
      const state = createReasoningState('test');
      expect(getAttemptCount(state)).toBe(0);
    });

    it('should count only retrieve and expand steps', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'analyze', 1.0));
      state = addReasoningStep(state, createStep(2, 'retrieve', 0.2));
      state = addReasoningStep(state, createStep(3, 'expand', 0.3));
      state = addReasoningStep(state, createStep(4, 'conclude', 0.5));

      expect(getAttemptCount(state)).toBe(2);
    });
  });

  describe('isInformationNotFound', () => {
    it('should return false for empty reasoning path', () => {
      const state = createReasoningState('test');
      expect(isInformationNotFound(state)).toBe(false);
    });

    it('should return false with only 1 attempt', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.1));

      expect(isInformationNotFound(state)).toBe(false);
    });

    it('should return true when relevance < threshold AND attempts >= minAttempts', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.12));
      state = addReasoningStep(state, createStep(2, 'expand', 0.15));

      // 기본 threshold = 0.3, minAttempts = 2
      expect(isInformationNotFound(state)).toBe(true);
    });

    it('should return false when relevance >= threshold', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.35));
      state = addReasoningStep(state, createStep(2, 'expand', 0.4));

      expect(isInformationNotFound(state)).toBe(false);
    });

    it('should respect custom threshold', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.25));
      state = addReasoningStep(state, createStep(2, 'expand', 0.28));

      // 기본 threshold 0.3이면 true
      expect(isInformationNotFound(state, 0.3)).toBe(true);

      // threshold 0.2면 false
      expect(isInformationNotFound(state, 0.2)).toBe(false);
    });

    it('should respect custom minAttempts', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.1));
      state = addReasoningStep(state, createStep(2, 'expand', 0.1));

      // minAttempts = 2면 true
      expect(isInformationNotFound(state, 0.3, 2)).toBe(true);

      // minAttempts = 3이면 false
      expect(isInformationNotFound(state, 0.3, 3)).toBe(false);
    });
  });

  describe('isInformationNotFoundWithConfig', () => {
    it('should use config object', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.1));
      state = addReasoningStep(state, createStep(2, 'expand', 0.15));

      expect(
        isInformationNotFoundWithConfig(state, {
          relevanceThreshold: 0.3,
          minAttemptsForNotFound: 2,
        })
      ).toBe(true);

      expect(
        isInformationNotFoundWithConfig(state, {
          relevanceThreshold: 0.1, // threshold 이하로 설정
          minAttemptsForNotFound: 2,
        })
      ).toBe(false);
    });
  });

  describe('needsExpansion', () => {
    it('should return true for empty context (avgRelevance=0 < threshold, not notFound)', () => {
      const state = createReasoningState('test');
      // 빈 컨텍스트면 avgRelevance = 0 < expansionThreshold
      // 시도도 없으므로 isInformationNotFound = false
      // withinBudget = true
      // → needsExpansion = true (기술적으로)
      // 실제 사용 시에는 검색을 시작해야 함
      expect(needsExpansion(state)).toBe(true);
    });

    it('should return true when avgRelevance < threshold AND not notFound AND within budget', () => {
      let state = createReasoningState('test');
      // 컨텍스트 추가 (avgRelevance = 0.4 < 0.5)
      state = setRetrievedContext(state, [
        createNode({ relevance: 0.4, tokenCount: 100 }),
      ]);
      // 시도 1회만 추가 (아직 notFound 아님)
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.4));

      expect(needsExpansion(state)).toBe(true);
    });

    it('should return false when avgRelevance >= threshold', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ relevance: 0.6, tokenCount: 100 }),
      ]);
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.6));

      expect(needsExpansion(state)).toBe(false);
    });

    it('should return false when isInformationNotFound is true', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ relevance: 0.1, tokenCount: 100 }),
      ]);
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.1));
      state = addReasoningStep(state, createStep(2, 'expand', 0.15));

      // isInformationNotFound = true이므로 needsExpansion = false
      expect(needsExpansion(state)).toBe(false);
    });

    it('should return false when exceeding token budget', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ relevance: 0.3, tokenCount: 5000 }),
      ]);
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.3));

      expect(needsExpansion(state, { tokenBudget: 4000 })).toBe(false);
    });
  });

  describe('canAnswer', () => {
    it('should return false when avgRelevance < threshold', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [createNode({ relevance: 0.4 })]);

      expect(canAnswer(state)).toBe(false);
    });

    it('should return true when avgRelevance >= threshold', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ relevance: 0.6 }),
        createNode({ relevance: 0.7 }),
      ]);

      expect(canAnswer(state)).toBe(true);
    });

    it('should return false when isInformationNotFound is true', () => {
      let state = createReasoningState('test');
      // 높은 관련성의 컨텍스트
      state = setRetrievedContext(state, [createNode({ relevance: 0.8 })]);
      // 하지만 reasoning path에서 낮은 관련성
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.1));
      state = addReasoningStep(state, createStep(2, 'expand', 0.15));

      // isInformationNotFound가 true면 canAnswer = false
      expect(canAnswer(state)).toBe(false);
    });
  });

  describe('computeDerivedValues', () => {
    it('should compute all derived values', () => {
      let state = createReasoningState('test');
      state = setRetrievedContext(state, [
        createNode({ relevance: 0.4, tokenCount: 100 }),
        createNode({ relevance: 0.6, tokenCount: 200 }),
      ]);
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.3));
      state = addReasoningStep(state, createStep(2, 'expand', 0.4));

      const derived = computeDerivedValues(state);

      expect(derived.currentContextTokens).toBe(300);
      expect(derived.withinTokenBudget).toBe(true);
      expect(derived.avgRelevance).toBe(0.5);
      expect(derived.maxRelevanceFromPath).toBe(0.4);
      expect(derived.attemptCount).toBe(2);
      expect(derived.informationNotFound).toBe(false);
      expect(derived.needsExpansion).toBe(false); // avgRelevance = 0.5 >= 0.5
      expect(derived.canAnswer).toBe(true);
    });

    it('should detect informationNotFound', () => {
      let state = createReasoningState('test');
      state = addReasoningStep(state, createStep(1, 'retrieve', 0.1));
      state = addReasoningStep(state, createStep(2, 'expand', 0.15));

      const derived = computeDerivedValues(state);

      expect(derived.informationNotFound).toBe(true);
      expect(derived.needsExpansion).toBe(false);
      expect(derived.canAnswer).toBe(false);
    });
  });

  describe('핵심 시나리오: Explainable Ignorance', () => {
    it('should correctly identify "information not found" scenario', () => {
      // 시나리오: "2024년 3분기 매출은?" 질의에 대해 관련 정보가 없는 경우

      let state = createReasoningState('2024년 3분기 매출은?');

      // 첫 번째 시도: finance.revenue 검색
      state = addReasoningStep(state, {
        step: 1,
        type: 'retrieve',
        target: 'finance.revenue.q3.2024',
        relevance: 0.12,
        result: 'no_match',
        evidence: [],
      });

      // 아직 1회 시도 - 모른다 판정 안됨
      expect(isInformationNotFound(state)).toBe(false);

      // 두 번째 시도: finance.* 확장
      state = addReasoningStep(state, {
        step: 2,
        type: 'expand',
        target: 'finance.*',
        relevance: 0.15,
        result: 'no_relevant_children',
        evidence: [],
      });

      // 이제 2회 시도, 최고 관련성 0.15 < 0.3
      // → 시스템이 "모른다" 판정
      expect(isInformationNotFound(state)).toBe(true);

      // 파생 값 확인
      const derived = computeDerivedValues(state);
      expect(derived.informationNotFound).toBe(true);
      expect(derived.needsExpansion).toBe(false);
      expect(derived.canAnswer).toBe(false);
      expect(derived.attemptCount).toBe(2);
      expect(derived.maxRelevanceFromPath).toBe(0.15);
    });

    it('should correctly identify "can answer" scenario', () => {
      // 시나리오: 관련 정보를 찾은 경우

      let state = createReasoningState('프로젝트 현황은?');

      // 검색 시도
      state = addReasoningStep(state, {
        step: 1,
        type: 'retrieve',
        target: 'project.status',
        relevance: 0.75,
        result: 'found_3_nodes',
        evidence: ['node-1', 'node-2', 'node-3'],
      });

      // 관련 노드 추가
      state = setRetrievedContext(state, [
        createNode({ nodeId: 'node-1', relevance: 0.8, tokenCount: 100 }),
        createNode({ nodeId: 'node-2', relevance: 0.7, tokenCount: 150 }),
        createNode({ nodeId: 'node-3', relevance: 0.6, tokenCount: 120 }),
      ]);

      // 파생 값 확인
      const derived = computeDerivedValues(state);
      expect(derived.avgRelevance).toBeCloseTo(0.7);
      expect(derived.informationNotFound).toBe(false);
      expect(derived.canAnswer).toBe(true);
      expect(derived.needsExpansion).toBe(false);
    });
  });
});
