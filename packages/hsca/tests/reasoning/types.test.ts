import { describe, it, expect } from 'vitest';
import {
  ParsedQuerySchema,
  RetrievedNodeSchema,
  ReasoningStepSchema,
  ConclusionSchema,
  CurrentQuerySchema,
  QueryStatusSchema,
} from '../../src/reasoning/index.js';

describe('reasoning types', () => {
  describe('ParsedQuerySchema', () => {
    it('should validate valid ParsedQuery', () => {
      const valid = {
        intent: 'lookup',
        targetPaths: ['finance.revenue.q3.2024'],
        constraints: [{ field: 'year', operator: 'eq', value: 2024 }],
        expectedDepth: 2,
      };

      const result = ParsedQuerySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should validate all intent types', () => {
      const intents = ['lookup', 'compare', 'summarize', 'analyze', 'list'];

      for (const intent of intents) {
        const result = ParsedQuerySchema.safeParse({
          intent,
          targetPaths: [],
          constraints: [],
          expectedDepth: 0,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should validate all constraint operators', () => {
      const operators = ['eq', 'gt', 'lt', 'contains', 'between'];

      for (const operator of operators) {
        const result = ParsedQuerySchema.safeParse({
          intent: 'lookup',
          targetPaths: [],
          constraints: [{ field: 'test', operator, value: 1 }],
          expectedDepth: 0,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid intent', () => {
      const invalid = {
        intent: 'invalid_intent',
        targetPaths: [],
        constraints: [],
        expectedDepth: 0,
      };

      const result = ParsedQuerySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject negative expectedDepth', () => {
      const invalid = {
        intent: 'lookup',
        targetPaths: [],
        constraints: [],
        expectedDepth: -1,
      };

      const result = ParsedQuerySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalid = { intent: 'lookup' };

      const result = ParsedQuerySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('RetrievedNodeSchema', () => {
    it('should validate valid RetrievedNode', () => {
      const valid = {
        nodeId: 'node-123',
        level: 2,
        summary: 'Q3 매출 관련 요약...',
        relevance: 0.85,
        tokenCount: 150,
        semanticPaths: ['finance.revenue'],
      };

      const result = RetrievedNodeSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject relevance outside 0-1 range', () => {
      const invalidHigh = {
        nodeId: 'node-1',
        level: 0,
        summary: 'test',
        relevance: 1.5,
        tokenCount: 100,
        semanticPaths: [],
      };

      const invalidLow = {
        nodeId: 'node-1',
        level: 0,
        summary: 'test',
        relevance: -0.1,
        tokenCount: 100,
        semanticPaths: [],
      };

      expect(RetrievedNodeSchema.safeParse(invalidHigh).success).toBe(false);
      expect(RetrievedNodeSchema.safeParse(invalidLow).success).toBe(false);
    });

    it('should accept edge values for relevance', () => {
      const zero = {
        nodeId: 'node-1',
        level: 0,
        summary: 'test',
        relevance: 0,
        tokenCount: 100,
        semanticPaths: [],
      };

      const one = {
        nodeId: 'node-1',
        level: 0,
        summary: 'test',
        relevance: 1,
        tokenCount: 100,
        semanticPaths: [],
      };

      expect(RetrievedNodeSchema.safeParse(zero).success).toBe(true);
      expect(RetrievedNodeSchema.safeParse(one).success).toBe(true);
    });

    it('should reject negative level', () => {
      const invalid = {
        nodeId: 'node-1',
        level: -1,
        summary: 'test',
        relevance: 0.5,
        tokenCount: 100,
        semanticPaths: [],
      };

      const result = RetrievedNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('ReasoningStepSchema', () => {
    it('should validate valid ReasoningStep', () => {
      const valid = {
        step: 1,
        type: 'retrieve',
        target: 'finance.revenue.q3.2024',
        relevance: 0.12,
        result: 'no_match',
        evidence: [],
      };

      const result = ReasoningStepSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should validate all step types', () => {
      const types = ['analyze', 'retrieve', 'expand', 'infer', 'conclude', 'not_found'];

      for (const type of types) {
        const result = ReasoningStepSchema.safeParse({
          step: 1,
          type,
          target: 'test',
          relevance: 0.5,
          result: 'test',
          evidence: [],
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject step number <= 0', () => {
      const zeroStep = {
        step: 0,
        type: 'retrieve',
        target: 'test',
        relevance: 0.5,
        result: 'test',
        evidence: [],
      };

      const negativeStep = {
        step: -1,
        type: 'retrieve',
        target: 'test',
        relevance: 0.5,
        result: 'test',
        evidence: [],
      };

      expect(ReasoningStepSchema.safeParse(zeroStep).success).toBe(false);
      expect(ReasoningStepSchema.safeParse(negativeStep).success).toBe(false);
    });

    it('should accept evidence array with paths', () => {
      const valid = {
        step: 1,
        type: 'retrieve',
        target: 'finance.revenue',
        relevance: 0.5,
        result: 'found',
        evidence: ['node-1', 'node-2', 'node-3'],
      };

      const result = ReasoningStepSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.evidence).toHaveLength(3);
      }
    });
  });

  describe('ConclusionSchema', () => {
    it('should validate valid Conclusion', () => {
      const valid = {
        type: 'not_found',
        content: '요청하신 정보를 찾을 수 없습니다.',
        confidence: 0.95,
        evidencePaths: ['finance.revenue.q3.2024', 'finance.*'],
      };

      const result = ConclusionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should validate all conclusion types', () => {
      const types = ['answer', 'not_found', 'uncertain'];

      for (const type of types) {
        const result = ConclusionSchema.safeParse({
          type,
          content: 'test',
          confidence: 0.5,
          evidencePaths: [],
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject confidence outside 0-1 range', () => {
      const invalidHigh = {
        type: 'answer',
        content: 'test',
        confidence: 1.1,
        evidencePaths: [],
      };

      expect(ConclusionSchema.safeParse(invalidHigh).success).toBe(false);
    });
  });

  describe('QueryStatusSchema', () => {
    it('should validate all status values', () => {
      const statuses = ['pending', 'analyzing', 'retrieving', 'reasoning', 'complete', 'not_found'];

      for (const status of statuses) {
        const result = QueryStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const result = QueryStatusSchema.safeParse('invalid_status');
      expect(result.success).toBe(false);
    });
  });

  describe('CurrentQuerySchema', () => {
    it('should validate valid CurrentQuery with parsed query', () => {
      const valid = {
        raw: '2024년 3분기 매출은?',
        parsed: {
          intent: 'lookup',
          targetPaths: ['finance.revenue'],
          constraints: [],
          expectedDepth: 1,
        },
        status: 'analyzing',
      };

      const result = CurrentQuerySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should validate CurrentQuery with null parsed', () => {
      const valid = {
        raw: '질문',
        parsed: null,
        status: 'pending',
      };

      const result = CurrentQuerySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid parsed query', () => {
      const invalid = {
        raw: '질문',
        parsed: { invalid: true },
        status: 'pending',
      };

      const result = CurrentQuerySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
