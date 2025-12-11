import { describe, it, expect } from 'vitest';
import {
  buildNotFoundExplanation,
  buildConclusionExplanation,
  formatReasoningPath,
  summarizeReasoning,
  buildStructuredExplanation,
  DEFAULT_EXPLANATION_CONFIG,
  type ReasoningStep,
  type Conclusion,
} from '../../src/reasoning/index.js';

// 헬퍼 함수
function createStep(
  step: number,
  type: ReasoningStep['type'],
  target: string,
  relevance: number,
  result: string
): ReasoningStep {
  return {
    step,
    type,
    target,
    relevance,
    result,
    evidence: [],
  };
}

describe('explanation', () => {
  describe('buildNotFoundExplanation', () => {
    it('should return message for empty reasoning path', () => {
      const explanation = buildNotFoundExplanation([]);
      expect(explanation).toBe('검색 시도가 없습니다.');
    });

    it('should build explanation with search attempts', () => {
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'finance.revenue', 0.12, 'no_match'),
        createStep(2, 'expand', 'finance.*', 0.15, 'no_relevant_children'),
      ];

      const explanation = buildNotFoundExplanation(path);

      expect(explanation).toContain('요청하신 정보를 찾을 수 없습니다.');
      expect(explanation).toContain('검색 시도 내역:');
      expect(explanation).toContain('finance.revenue');
      expect(explanation).toContain('finance.*');
      expect(explanation).toContain('12.0%');
      expect(explanation).toContain('15.0%');
      expect(explanation).toContain('no_match');
      expect(explanation).toContain('no_relevant_children');
    });

    it('should include summary with max relevance and threshold', () => {
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'test.path', 0.12, 'no_match'),
        createStep(2, 'expand', 'test.*', 0.15, 'no_children'),
      ];

      const explanation = buildNotFoundExplanation(path);

      expect(explanation).toContain('요약:');
      expect(explanation).toContain('최고 관련성: 15.0%');
      expect(explanation).toContain('임계값 30.0% 미달');
      expect(explanation).toContain('총 시도 횟수: 2회');
    });

    it('should filter only retrieve/expand steps', () => {
      const path: ReasoningStep[] = [
        createStep(1, 'analyze', 'query', 1.0, 'analyzed'),
        createStep(2, 'retrieve', 'test.path', 0.12, 'no_match'),
        createStep(3, 'conclude', 'system', 0.5, 'concluded'),
      ];

      const explanation = buildNotFoundExplanation(path);

      expect(explanation).toContain('test.path');
      expect(explanation).not.toContain('query');
      expect(explanation).not.toContain('system');
      expect(explanation).toContain('총 시도 횟수: 1회');
    });

    it('should support English language', () => {
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'finance.revenue', 0.12, 'no_match'),
      ];

      const explanation = buildNotFoundExplanation(path, { language: 'en' });

      expect(explanation).toContain('The requested information could not be found.');
      expect(explanation).toContain('Search attempts:');
      expect(explanation).toContain('Max relevance:');
      expect(explanation).toContain('Total attempts: 1');
    });

    it('should support decimal format', () => {
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'test', 0.123, 'test'),
      ];

      const explanation = buildNotFoundExplanation(path, { relevanceFormat: 'decimal' });

      expect(explanation).toContain('0.123');
    });
  });

  describe('buildConclusionExplanation', () => {
    it('should build not_found explanation', () => {
      const conclusion: Conclusion = {
        type: 'not_found',
        content: '정보 없음',
        confidence: 0.95,
        evidencePaths: ['test'],
      };
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'test', 0.1, 'no_match'),
        createStep(2, 'expand', 'test.*', 0.15, 'no_children'),
      ];

      const explanation = buildConclusionExplanation(conclusion, path);

      expect(explanation).toContain('요청하신 정보를 찾을 수 없습니다.');
    });

    it('should build answer explanation', () => {
      const conclusion: Conclusion = {
        type: 'answer',
        content: '프로젝트는 진행 중입니다.',
        confidence: 0.85,
        evidencePaths: ['project.status'],
      };
      const path: ReasoningStep[] = [];

      const explanation = buildConclusionExplanation(conclusion, path);

      expect(explanation).toContain('답변:');
      expect(explanation).toContain('프로젝트는 진행 중입니다.');
      expect(explanation).toContain('신뢰도: 85.0%');
      expect(explanation).toContain('근거: project.status');
    });

    it('should build uncertain explanation', () => {
      const conclusion: Conclusion = {
        type: 'uncertain',
        content: '확신할 수 없습니다.',
        confidence: 0.4,
        evidencePaths: [],
      };
      const path: ReasoningStep[] = [];

      const explanation = buildConclusionExplanation(conclusion, path);

      expect(explanation).toContain('불확실한 결과:');
      expect(explanation).toContain('확신할 수 없습니다.');
      expect(explanation).toContain('추가 정보가 필요할 수 있습니다.');
    });
  });

  describe('formatReasoningPath', () => {
    it('should return message for empty path', () => {
      const markdown = formatReasoningPath([]);
      expect(markdown).toBe('추론 경로가 없습니다.');
    });

    it('should format as markdown table', () => {
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'finance.revenue', 0.12, 'no_match'),
        createStep(2, 'expand', 'finance.*', 0.15, 'no_children'),
      ];

      const markdown = formatReasoningPath(path);

      expect(markdown).toContain('## 추론 경로');
      expect(markdown).toContain('| 단계 | 타입 | 대상 | 관련성 | 결과 |');
      expect(markdown).toContain('|------|------|------|--------|------|');
      expect(markdown).toContain('| 1 | retrieve | finance.revenue | 12.0% | no_match |');
      expect(markdown).toContain('| 2 | expand | finance.* | 15.0% | no_children |');
    });

    it('should support English', () => {
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'test', 0.5, 'found'),
      ];

      const markdown = formatReasoningPath(path, { language: 'en' });

      expect(markdown).toContain('## Reasoning Path');
      expect(markdown).toContain('| Step | Type | Target | Relevance | Result |');
    });
  });

  describe('summarizeReasoning', () => {
    it('should return "No attempts" for empty path', () => {
      const summary = summarizeReasoning([]);
      expect(summary).toBe('시도 없음');
    });

    it('should summarize reasoning path', () => {
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'test', 0.1, 'no_match'),
        createStep(2, 'expand', 'test.*', 0.15, 'no_children'),
        createStep(3, 'not_found', 'system', 0, 'not_found'),
      ];

      const summary = summarizeReasoning(path);

      expect(summary).toBe('2회 시도, 최고 관련성 15.0%, 정보 없음');
    });

    it('should show "결론 도출" for conclude type', () => {
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'test', 0.8, 'found'),
        createStep(2, 'conclude', 'system', 0.8, 'answer'),
      ];

      const summary = summarizeReasoning(path);

      expect(summary).toContain('결론 도출');
    });

    it('should show "진행 중" for in-progress', () => {
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'test', 0.5, 'found'),
      ];

      const summary = summarizeReasoning(path);

      expect(summary).toContain('진행 중');
    });

    it('should support English', () => {
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'test', 0.1, 'no_match'),
        createStep(2, 'not_found', 'system', 0, 'not_found'),
      ];

      const summary = summarizeReasoning(path, { language: 'en' });

      expect(summary).toBe('1 attempts, max relevance 10.0%, not found');
    });
  });

  describe('buildStructuredExplanation', () => {
    it('should build structured explanation', () => {
      const conclusion: Conclusion = {
        type: 'not_found',
        content: '정보 없음',
        confidence: 0.95,
        evidencePaths: ['finance.revenue', 'finance.*'],
      };
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'finance.revenue', 0.12, 'no_match'),
        createStep(2, 'expand', 'finance.*', 0.15, 'no_children'),
      ];

      const structured = buildStructuredExplanation(conclusion, path);

      expect(structured.conclusionType).toBe('not_found');
      expect(structured.content).toBe('정보 없음');
      expect(structured.confidence).toBe(0.95);
      expect(structured.attempts.count).toBe(2);
      expect(structured.attempts.maxRelevance).toBe(0.15);
      expect(structured.attempts.targets).toContain('finance.revenue');
      expect(structured.attempts.targets).toContain('finance.*');
      expect(structured.evidencePaths).toHaveLength(2);
      expect(structured.reasoningSteps).toHaveLength(2);
    });

    it('should deduplicate targets', () => {
      const conclusion: Conclusion = {
        type: 'not_found',
        content: '정보 없음',
        confidence: 0.95,
        evidencePaths: [],
      };
      const path: ReasoningStep[] = [
        createStep(1, 'retrieve', 'same.path', 0.1, 'try1'),
        createStep(2, 'retrieve', 'same.path', 0.15, 'try2'),
      ];

      const structured = buildStructuredExplanation(conclusion, path);

      expect(structured.attempts.targets).toHaveLength(1);
      expect(structured.attempts.targets[0]).toBe('same.path');
    });

    it('should handle empty reasoning path', () => {
      const conclusion: Conclusion = {
        type: 'answer',
        content: '답변',
        confidence: 0.9,
        evidencePaths: ['test'],
      };

      const structured = buildStructuredExplanation(conclusion, []);

      expect(structured.attempts.count).toBe(0);
      expect(structured.attempts.maxRelevance).toBe(0);
      expect(structured.attempts.targets).toHaveLength(0);
      expect(structured.reasoningSteps).toHaveLength(0);
    });
  });

  describe('핵심 시나리오: "왜 모르는지" 설명', () => {
    it('should generate complete explanation for not found scenario', () => {
      // 시나리오: "2024년 3분기 매출은?" - 정보 없음
      const conclusion: Conclusion = {
        type: 'not_found',
        content: '요청하신 정보를 찾을 수 없습니다.',
        confidence: 0.95,
        evidencePaths: ['finance.revenue.q3.2024', 'finance.*'],
      };

      const path: ReasoningStep[] = [
        {
          step: 1,
          type: 'retrieve',
          target: 'finance.revenue.q3.2024',
          relevance: 0.12,
          result: 'no_match',
          evidence: [],
        },
        {
          step: 2,
          type: 'expand',
          target: 'finance.*',
          relevance: 0.15,
          result: 'no_relevant_children',
          evidence: [],
        },
        {
          step: 3,
          type: 'not_found',
          target: 'system.conclusion',
          relevance: 0,
          result: 'information_not_found',
          evidence: ['finance.revenue.q3.2024', 'finance.*'],
        },
      ];

      // 1. 텍스트 설명
      const textExplanation = buildNotFoundExplanation(path);
      expect(textExplanation).toContain('요청하신 정보를 찾을 수 없습니다.');
      expect(textExplanation).toContain('finance.revenue.q3.2024');
      expect(textExplanation).toContain('finance.*');
      expect(textExplanation).toContain('최고 관련성: 15.0%');
      expect(textExplanation).toContain('임계값 30.0% 미달');
      expect(textExplanation).toContain('총 시도 횟수: 2회');

      // 2. 마크다운 테이블
      const markdown = formatReasoningPath(path);
      expect(markdown).toContain('| 1 | retrieve | finance.revenue.q3.2024 |');
      expect(markdown).toContain('| 2 | expand | finance.* |');

      // 3. 한 줄 요약
      const summary = summarizeReasoning(path);
      expect(summary).toBe('2회 시도, 최고 관련성 15.0%, 정보 없음');

      // 4. 구조화된 설명
      const structured = buildStructuredExplanation(conclusion, path);
      expect(structured.conclusionType).toBe('not_found');
      expect(structured.attempts.count).toBe(2);
      expect(structured.attempts.maxRelevance).toBe(0.15);
    });
  });
});
