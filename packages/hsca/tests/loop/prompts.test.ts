import { describe, it, expect } from 'vitest';
import {
  PARSED_QUERY_SCHEMA,
  EXPAND_DECISION_SCHEMA,
  buildAnalyzePrompt,
  buildExpandDecisionPrompt,
  buildAnswerPrompt,
  buildUncertainPrompt,
  formatReasoningPath,
  formatContextAsMarkdown,
  getSystemMessage,
} from '../../src/loop/prompts.js';
import type { ReasoningState, ReasoningStep } from '../../src/reasoning/index.js';
import {
  createReasoningState,
  setParsedQuery,
  setRetrievedContext,
  addReasoningStep,
} from '../../src/reasoning/index.js';
import type { ProjectedContext } from '../../src/cqe/index.js';

// 테스트용 상태 생성 헬퍼
function createTestState(query: string = '테스트 질의'): ReasoningState {
  return createReasoningState(query);
}

// 테스트용 ProjectedContext 생성
function createProjectedContext(
  overrides: Partial<ProjectedContext> = {}
): ProjectedContext {
  return {
    nodes: [],
    totalTokens: 0,
    truncated: false,
    ...overrides,
  };
}

describe('prompt templates', () => {
  describe('PARSED_QUERY_SCHEMA', () => {
    it('should include intent field', () => {
      expect(PARSED_QUERY_SCHEMA).toContain('intent');
    });

    it('should include targetPaths field', () => {
      expect(PARSED_QUERY_SCHEMA).toContain('targetPaths');
    });

    it('should include constraints field', () => {
      expect(PARSED_QUERY_SCHEMA).toContain('constraints');
    });

    it('should include expectedDepth field', () => {
      expect(PARSED_QUERY_SCHEMA).toContain('expectedDepth');
    });
  });

  describe('EXPAND_DECISION_SCHEMA', () => {
    it('should include decision field', () => {
      expect(EXPAND_DECISION_SCHEMA).toContain('decision');
    });

    it('should include nodeId field', () => {
      expect(EXPAND_DECISION_SCHEMA).toContain('nodeId');
    });

    it('should include reason field', () => {
      expect(EXPAND_DECISION_SCHEMA).toContain('reason');
    });
  });

  describe('buildAnalyzePrompt', () => {
    it('should include raw query', () => {
      const query = '2024년 3분기 매출은 얼마인가요?';
      const prompt = buildAnalyzePrompt(query);

      expect(prompt).toContain(query);
    });

    it('should include JSON output schema', () => {
      const prompt = buildAnalyzePrompt('테스트');

      expect(prompt).toContain('intent');
      expect(prompt).toContain('targetPaths');
    });

    it('should include intent definitions', () => {
      const prompt = buildAnalyzePrompt('테스트');

      expect(prompt).toContain('lookup');
      expect(prompt).toContain('compare');
      expect(prompt).toContain('summarize');
    });

    it('should request JSON only response', () => {
      const prompt = buildAnalyzePrompt('테스트');

      expect(prompt).toContain('JSON only');
    });
  });

  describe('buildExpandDecisionPrompt', () => {
    it('should include user question', () => {
      const state = createTestState('매출 분석');
      const context = createProjectedContext();

      const prompt = buildExpandDecisionPrompt(state, context);

      expect(prompt).toContain('매출 분석');
    });

    it('should include parsed query info', () => {
      let state = createTestState('매출 분석');
      state = setParsedQuery(state, {
        intent: 'analyze',
        targetPaths: ['finance.revenue'],
        constraints: [],
        expectedDepth: 2,
      });
      const context = createProjectedContext();

      const prompt = buildExpandDecisionPrompt(state, context);

      expect(prompt).toContain('analyze');
      expect(prompt).toContain('finance.revenue');
    });

    it('should include context nodes', () => {
      const state = createTestState('매출 분석');
      const context = createProjectedContext({
        nodes: [
          {
            nodeId: 'node-1',
            level: 1,
            summary: '매출 요약',
            relevance: 0.8,
            tokenCount: 100,
            semanticPaths: ['finance.revenue'],
          },
        ],
        totalTokens: 100,
      });

      const prompt = buildExpandDecisionPrompt(state, context);

      expect(prompt).toContain('node-1');
      expect(prompt).toContain('finance.revenue');
      expect(prompt).toContain('80.0%');
    });

    it('should include expand decision schema', () => {
      const state = createTestState();
      const context = createProjectedContext();

      const prompt = buildExpandDecisionPrompt(state, context);

      expect(prompt).toContain('expand');
      expect(prompt).toContain('none');
    });
  });

  describe('buildAnswerPrompt', () => {
    it('should include user question', () => {
      const state = createTestState('매출이 얼마인가요?');
      const context = createProjectedContext();

      const prompt = buildAnswerPrompt(state, context);

      expect(prompt).toContain('매출이 얼마인가요?');
    });

    it('should include context in markdown format', () => {
      const state = createTestState();
      const context = createProjectedContext({
        nodes: [
          {
            nodeId: 'node-1',
            level: 1,
            summary: '2024년 3분기 매출은 100억원입니다.',
            relevance: 0.9,
            tokenCount: 50,
            semanticPaths: ['finance.revenue.q3'],
          },
        ],
        totalTokens: 50,
      });

      const prompt = buildAnswerPrompt(state, context);

      expect(prompt).toContain('finance.revenue.q3');
      expect(prompt).toContain('100억원');
      expect(prompt).toContain('90.0%');
    });

    it('should include reasoning path', () => {
      let state = createTestState();
      const step: ReasoningStep = {
        step: 1,
        type: 'retrieve',
        target: 'finance',
        relevance: 0.8,
        result: 'found',
        evidence: [],
      };
      state = addReasoningStep(state, step);
      const context = createProjectedContext();

      const prompt = buildAnswerPrompt(state, context);

      expect(prompt).toContain('retrieve');
      expect(prompt).toContain('finance');
    });

    it('should request Korean response', () => {
      const state = createTestState();
      const context = createProjectedContext();

      const prompt = buildAnswerPrompt(state, context);

      expect(prompt).toContain('한국어');
    });
  });

  describe('buildUncertainPrompt', () => {
    it('should include user question', () => {
      const state = createTestState('불분명한 질문');
      const context = createProjectedContext();

      const prompt = buildUncertainPrompt(state, context);

      expect(prompt).toContain('불분명한 질문');
    });

    it('should include found context', () => {
      const state = createTestState();
      const context = createProjectedContext({
        nodes: [
          {
            nodeId: 'partial-1',
            level: 1,
            summary: '부분적으로 관련된 정보입니다. 이 정보는 일부만 질문과 관련이 있습니다.',
            relevance: 0.4,
            tokenCount: 80,
            semanticPaths: ['partial.path'],
          },
        ],
        totalTokens: 80,
      });

      const prompt = buildUncertainPrompt(state, context);

      expect(prompt).toContain('partial.path');
      expect(prompt).toContain('40.0%');
    });

    it('should ask for uncertainty explanation', () => {
      const state = createTestState();
      const context = createProjectedContext();

      const prompt = buildUncertainPrompt(state, context);

      expect(prompt).toContain('uncertain');
    });

    it('should request Korean explanation', () => {
      const state = createTestState();
      const context = createProjectedContext();

      const prompt = buildUncertainPrompt(state, context);

      expect(prompt).toContain('한국어');
    });
  });

  describe('formatReasoningPath', () => {
    it('should return empty string for empty path', () => {
      const result = formatReasoningPath([]);

      expect(result).toBe('');
    });

    it('should format single step', () => {
      const steps: ReasoningStep[] = [
        {
          step: 1,
          type: 'retrieve',
          target: 'test.path',
          relevance: 0.75,
          result: 'found',
          evidence: [],
        },
      ];

      const result = formatReasoningPath(steps);

      expect(result).toContain('1.');
      expect(result).toContain('retrieve');
      expect(result).toContain('test.path');
      expect(result).toContain('75.0%');
    });

    it('should format multiple steps', () => {
      const steps: ReasoningStep[] = [
        {
          step: 1,
          type: 'retrieve',
          target: 'a',
          relevance: 0.5,
          result: 'found',
          evidence: [],
        },
        {
          step: 2,
          type: 'expand',
          target: 'b',
          relevance: 0.6,
          result: 'expanded',
          evidence: [],
        },
      ];

      const result = formatReasoningPath(steps);

      expect(result).toContain('1.');
      expect(result).toContain('2.');
      expect(result).toContain('retrieve');
      expect(result).toContain('expand');
    });
  });

  describe('formatContextAsMarkdown', () => {
    it('should return placeholder for empty context', () => {
      const context = createProjectedContext({ nodes: [] });

      const result = formatContextAsMarkdown(context);

      expect(result).toContain('없음');
    });

    it('should format nodes as markdown', () => {
      const context = createProjectedContext({
        nodes: [
          {
            nodeId: 'node-1',
            level: 1,
            summary: '노드 1 요약 내용',
            relevance: 0.85,
            tokenCount: 100,
            semanticPaths: ['path.to.node1'],
          },
        ],
        totalTokens: 100,
      });

      const result = formatContextAsMarkdown(context);

      expect(result).toContain('###');
      expect(result).toContain('path.to.node1');
      expect(result).toContain('85.0%');
      expect(result).toContain('노드 1 요약 내용');
    });

    it('should format multiple nodes', () => {
      const context = createProjectedContext({
        nodes: [
          {
            nodeId: 'node-1',
            level: 1,
            summary: '첫 번째 노드',
            relevance: 0.9,
            tokenCount: 50,
            semanticPaths: ['first.path'],
          },
          {
            nodeId: 'node-2',
            level: 2,
            summary: '두 번째 노드',
            relevance: 0.7,
            tokenCount: 50,
            semanticPaths: ['second.path'],
          },
        ],
        totalTokens: 100,
      });

      const result = formatContextAsMarkdown(context);

      expect(result).toContain('first.path');
      expect(result).toContain('second.path');
      expect(result).toContain('첫 번째 노드');
      expect(result).toContain('두 번째 노드');
    });
  });

  describe('getSystemMessage', () => {
    it('should include AI assistant role', () => {
      const message = getSystemMessage();

      expect(message).toContain('AI assistant');
    });

    it('should mention accuracy', () => {
      const message = getSystemMessage();

      expect(message).toContain('Accurate');
    });

    it('should mention JSON format', () => {
      const message = getSystemMessage();

      expect(message).toContain('JSON');
    });

    it('should mention Korean', () => {
      const message = getSystemMessage();

      expect(message).toContain('Korean');
    });
  });
});
