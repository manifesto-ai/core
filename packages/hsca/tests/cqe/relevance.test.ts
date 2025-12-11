import { describe, it, expect } from 'vitest';
import {
  extractQueryKeywords,
  calculateKeywordRelevance,
  calculatePathRelevance,
  calculateHybridRelevance,
  calculateRelevance,
  pathOverlap,
  matchPathPattern,
  DEFAULT_RELEVANCE_CONFIG,
  type RelevanceConfig,
} from '../../src/cqe/relevance.js';
import type { ParsedQuery } from '../../src/reasoning/index.js';
import type { SummaryNode } from '../../src/sct/index.js';

// 테스트용 노드 생성 헬퍼
function createNode(overrides: Partial<SummaryNode> = {}): SummaryNode {
  return {
    id: 'test-node',
    path: 'test.path',
    depth: 1,
    summary: 'Test summary content',
    tokenCount: 100,
    originalTokenCount: 500,
    compressionRatio: 5,
    keywords: ['test', 'summary'],
    children: [],
    parentId: null,
    ...overrides,
  };
}

// 테스트용 질의 생성 헬퍼
function createQuery(overrides: Partial<ParsedQuery> = {}): ParsedQuery {
  return {
    intent: 'lookup',
    targetPaths: [],
    constraints: [],
    expectedDepth: 1,
    ...overrides,
  };
}

describe('relevance calculation', () => {
  describe('extractQueryKeywords', () => {
    it('should extract keywords from targetPaths', () => {
      const query = createQuery({
        targetPaths: ['finance.revenue.q3'],
      });

      const keywords = extractQueryKeywords(query);

      expect(keywords).toContain('finance');
      expect(keywords).toContain('revenue');
      expect(keywords).toContain('q3');
    });

    it('should extract keywords from constraints', () => {
      const query = createQuery({
        constraints: [{ field: 'year', operator: 'eq', value: '2024' }],
      });

      const keywords = extractQueryKeywords(query);

      expect(keywords).toContain('year');
      expect(keywords).toContain('2024');
    });

    it('should ignore wildcard in paths', () => {
      const query = createQuery({
        targetPaths: ['finance.*'],
      });

      const keywords = extractQueryKeywords(query);

      expect(keywords).toContain('finance');
      expect(keywords).not.toContain('*');
    });

    it('should deduplicate and lowercase keywords', () => {
      const query = createQuery({
        targetPaths: ['Finance.Revenue', 'finance.budget'],
      });

      const keywords = extractQueryKeywords(query);

      // 중복 제거 확인
      const financeCount = keywords.filter((k) => k === 'finance').length;
      expect(financeCount).toBe(1);
    });
  });

  describe('calculateKeywordRelevance', () => {
    it('should return 0 for no keyword match', () => {
      const query = createQuery({
        targetPaths: ['marketing.budget'],
      });
      const node = createNode({
        keywords: ['finance', 'revenue'],
      });

      const relevance = calculateKeywordRelevance(query, node);

      expect(relevance).toBe(0);
    });

    it('should boost exact keyword matches', () => {
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });
      const node = createNode({
        keywords: ['finance', 'revenue'],
      });

      const relevance = calculateKeywordRelevance(query, node);

      expect(relevance).toBeGreaterThan(0.5);
    });

    it('should handle partial matches', () => {
      const query = createQuery({
        targetPaths: ['financial.revenues'],
      });
      const node = createNode({
        keywords: ['finance', 'revenue'],
      });

      const relevance = calculateKeywordRelevance(query, node);

      expect(relevance).toBeGreaterThan(0);
      expect(relevance).toBeLessThan(1);
    });

    it('should normalize to 0-1 range', () => {
      const query = createQuery({
        targetPaths: ['finance.revenue.q3.2024'],
      });
      const node = createNode({
        keywords: ['finance', 'revenue', 'q3', '2024'],
        summary: 'Finance revenue Q3 2024 report',
      });

      const relevance = calculateKeywordRelevance(query, node);

      expect(relevance).toBeGreaterThanOrEqual(0);
      expect(relevance).toBeLessThanOrEqual(1);
    });

    it('should return 0 for empty query keywords', () => {
      const query = createQuery({ targetPaths: [] });
      const node = createNode({ keywords: ['test'] });

      const relevance = calculateKeywordRelevance(query, node);

      expect(relevance).toBe(0);
    });

    it('should include summary text in matching', () => {
      const query = createQuery({
        targetPaths: ['quarterly.report'],
      });
      const node = createNode({
        keywords: ['finance'],
        summary: 'This is a quarterly report summary',
      });

      const relevance = calculateKeywordRelevance(query, node);

      expect(relevance).toBeGreaterThan(0);
    });
  });

  describe('pathOverlap', () => {
    it('should return 1 for exact path match', () => {
      const overlap = pathOverlap('finance.revenue', 'finance.revenue');

      expect(overlap).toBe(1);
    });

    it('should calculate partial overlap', () => {
      const overlap = pathOverlap('finance.revenue.q3', 'finance.revenue');

      expect(overlap).toBeCloseTo(0.67, 1);
    });

    it('should return 0 for no overlap', () => {
      const overlap = pathOverlap('finance', 'marketing');

      expect(overlap).toBe(0);
    });

    it('should handle empty paths', () => {
      expect(pathOverlap('', 'finance')).toBe(0);
      expect(pathOverlap('finance', '')).toBe(0);
    });

    it('should be case insensitive', () => {
      const overlap = pathOverlap('Finance.Revenue', 'finance.revenue');

      expect(overlap).toBe(1);
    });
  });

  describe('matchPathPattern', () => {
    it('should match exact paths', () => {
      expect(matchPathPattern('finance.revenue', 'finance.revenue')).toBe(true);
      expect(matchPathPattern('finance.revenue', 'finance.budget')).toBe(false);
    });

    it('should support wildcard patterns', () => {
      expect(matchPathPattern('finance.revenue.q3', 'finance.*')).toBe(true);
      expect(matchPathPattern('finance.revenue.q3', 'finance.revenue.*')).toBe(
        true
      );
      expect(matchPathPattern('marketing.budget', 'finance.*')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(matchPathPattern('Finance.Revenue', 'finance.revenue')).toBe(true);
    });

    it('should not match shorter paths for non-wildcard patterns', () => {
      expect(matchPathPattern('finance', 'finance.revenue')).toBe(false);
    });
  });

  describe('calculatePathRelevance', () => {
    it('should return 0 for empty targetPaths', () => {
      const query = createQuery({ targetPaths: [] });
      const node = createNode({ path: 'finance.revenue' });

      const relevance = calculatePathRelevance(query, node);

      expect(relevance).toBe(0);
    });

    it('should return high score for exact path match', () => {
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });
      const node = createNode({
        path: 'finance.revenue',
      });

      const relevance = calculatePathRelevance(query, node);

      expect(relevance).toBeGreaterThan(0.8);
    });

    it('should return partial score for overlap', () => {
      const query = createQuery({
        targetPaths: ['finance.revenue.q3.2024'],
      });
      const node = createNode({
        path: 'finance.revenue',
      });

      const relevance = calculatePathRelevance(query, node);

      expect(relevance).toBeGreaterThan(0);
      expect(relevance).toBeLessThan(1);
    });

    it('should support wildcard patterns', () => {
      const query = createQuery({
        targetPaths: ['finance.*'],
      });
      const node = createNode({
        path: 'finance.revenue.q3',
      });

      const relevance = calculatePathRelevance(query, node);

      expect(relevance).toBe(0.8); // 와일드카드 매칭은 0.8점
    });

    it('should take maximum score from multiple paths', () => {
      const query = createQuery({
        targetPaths: ['marketing.budget', 'finance.revenue'],
      });
      const node = createNode({
        path: 'finance.revenue',
      });

      const relevance = calculatePathRelevance(query, node);

      expect(relevance).toBeGreaterThan(0.8); // finance.revenue 정확 매칭
    });
  });

  describe('calculateHybridRelevance', () => {
    it('should combine keyword and path scores', () => {
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });
      const node = createNode({
        path: 'finance.revenue',
        keywords: ['finance', 'revenue'],
      });

      const relevance = calculateHybridRelevance(query, node);

      expect(relevance).toBeGreaterThan(0.5);
    });

    it('should respect weight configuration', () => {
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });
      const node = createNode({
        path: 'marketing.budget', // path 불일치
        keywords: ['finance', 'revenue'], // keyword 일치
      });

      // 키워드 가중치 높게
      const config: Partial<RelevanceConfig> = {
        keywordWeight: 0.9,
        pathWeight: 0.1,
      };

      const relevance = calculateHybridRelevance(query, node, config);

      // 키워드 점수가 더 많이 반영됨
      expect(relevance).toBeGreaterThan(0.3);
    });

    it('should apply depth penalty', () => {
      const query = createQuery({
        targetPaths: ['finance'],
      });

      const shallowNode = createNode({
        path: 'finance',
        keywords: ['finance'],
        depth: 1,
      });

      const deepNode = createNode({
        path: 'finance',
        keywords: ['finance'],
        depth: 5,
      });

      const shallowRelevance = calculateHybridRelevance(query, shallowNode);
      const deepRelevance = calculateHybridRelevance(query, deepNode);

      expect(shallowRelevance).toBeGreaterThan(deepRelevance);
    });
  });

  describe('calculateRelevance', () => {
    it('should use keyword strategy', () => {
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });
      const node = createNode({
        keywords: ['finance', 'revenue'],
      });

      const relevance = calculateRelevance(query, node, 'keyword');

      expect(relevance).toBeGreaterThan(0);
    });

    it('should use path strategy', () => {
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });
      const node = createNode({
        path: 'finance.revenue',
      });

      const relevance = calculateRelevance(query, node, 'path');

      expect(relevance).toBeGreaterThan(0.8);
    });

    it('should return 0 for semantic strategy (sync)', () => {
      const query = createQuery({
        targetPaths: ['finance'],
      });
      const node = createNode();

      const relevance = calculateRelevance(query, node, 'semantic');

      expect(relevance).toBe(0);
    });

    it('should default to hybrid strategy', () => {
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });
      const node = createNode({
        path: 'finance.revenue',
        keywords: ['finance', 'revenue'],
      });

      const defaultRelevance = calculateRelevance(query, node);
      const hybridRelevance = calculateRelevance(query, node, 'hybrid');

      expect(defaultRelevance).toBe(hybridRelevance);
    });
  });

  describe('DEFAULT_RELEVANCE_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_RELEVANCE_CONFIG.keywordWeight).toBe(0.4);
      expect(DEFAULT_RELEVANCE_CONFIG.pathWeight).toBe(0.2);
      expect(DEFAULT_RELEVANCE_CONFIG.semanticWeight).toBe(0.4);
      expect(DEFAULT_RELEVANCE_CONFIG.depthPenalty).toBe(0.05);
      expect(DEFAULT_RELEVANCE_CONFIG.exactMatchBonus).toBe(0.2);
    });

    it('should have weights summing to 1', () => {
      const sum =
        DEFAULT_RELEVANCE_CONFIG.keywordWeight +
        DEFAULT_RELEVANCE_CONFIG.pathWeight +
        DEFAULT_RELEVANCE_CONFIG.semanticWeight;

      expect(sum).toBe(1);
    });
  });
});
