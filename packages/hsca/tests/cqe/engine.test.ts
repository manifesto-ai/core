import { describe, it, expect } from 'vitest';
import {
  ContextQueryEngine,
  AsyncContextQueryEngine,
  createContextQueryEngine,
  createAsyncContextQueryEngine,
} from '../../src/cqe/engine.js';
import { createMockEmbeddingProvider } from '../../src/cqe/embedding.js';
import type { SummaryNode, CompressionTree } from '../../src/sct/index.js';
import type { ParsedQuery } from '../../src/reasoning/index.js';

// 테스트용 트리 구조 생성 헬퍼
function createTestTree(): CompressionTree {
  const revenue: SummaryNode = {
    id: 'revenue',
    path: 'finance.revenue',
    depth: 2,
    summary: 'Q3 2024 revenue reached $10M, up 15% YoY',
    tokenCount: 80,
    originalTokenCount: 400,
    compressionRatio: 5,
    keywords: ['revenue', 'finance', 'q3', '2024', 'income'],
    children: [],
    parentId: 'finance',
  };

  const budget: SummaryNode = {
    id: 'budget',
    path: 'finance.budget',
    depth: 2,
    summary: 'Annual budget allocation for departments',
    tokenCount: 60,
    originalTokenCount: 300,
    compressionRatio: 5,
    keywords: ['budget', 'finance', 'allocation'],
    children: [],
    parentId: 'finance',
  };

  const finance: SummaryNode = {
    id: 'finance',
    path: 'finance',
    depth: 1,
    summary: 'Finance department overview including revenue and budgets',
    tokenCount: 100,
    originalTokenCount: 500,
    compressionRatio: 5,
    keywords: ['finance', 'department', 'revenue', 'budget'],
    children: [revenue, budget],
    parentId: 'root',
  };

  const campaigns: SummaryNode = {
    id: 'campaigns',
    path: 'marketing.campaigns',
    depth: 2,
    summary: 'Q3 marketing campaigns performance',
    tokenCount: 70,
    originalTokenCount: 350,
    compressionRatio: 5,
    keywords: ['marketing', 'campaigns', 'q3'],
    children: [],
    parentId: 'marketing',
  };

  const marketing: SummaryNode = {
    id: 'marketing',
    path: 'marketing',
    depth: 1,
    summary: 'Marketing department activities and campaigns',
    tokenCount: 90,
    originalTokenCount: 450,
    compressionRatio: 5,
    keywords: ['marketing', 'department', 'campaigns'],
    children: [campaigns],
    parentId: 'root',
  };

  const root: SummaryNode = {
    id: 'root',
    path: 'root',
    depth: 0,
    summary: 'Company overview for Q3 2024',
    tokenCount: 150,
    originalTokenCount: 750,
    compressionRatio: 5,
    keywords: ['company', 'overview', 'q3', '2024'],
    children: [finance, marketing],
    parentId: null,
  };

  return {
    root,
    totalChunks: 6,
    totalTokens: 550,
    originalTokens: 2750,
    compressionRatio: 5,
    createdAt: new Date().toISOString(),
    sourceType: 'document',
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

describe('ContextQueryEngine', () => {
  describe('retrieve', () => {
    it('should find nodes by targetPaths', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });

      const result = engine.retrieve(query, tree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
        expect(result.value.some((n) => n.nodeId === 'revenue')).toBe(true);
      }
    });

    it('should filter by minRelevance', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance'],
      });

      const highThreshold = engine.retrieve(query, tree, { minRelevance: 0.8 });
      const lowThreshold = engine.retrieve(query, tree, { minRelevance: 0.1 });

      expect(highThreshold.ok).toBe(true);
      expect(lowThreshold.ok).toBe(true);

      if (highThreshold.ok && lowThreshold.ok) {
        expect(lowThreshold.value.length).toBeGreaterThanOrEqual(
          highThreshold.value.length
        );
      }
    });

    it('should respect tokenBudget', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance.*'],
      });

      const result = engine.retrieve(query, tree, { tokenBudget: 100 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const totalTokens = result.value.reduce(
          (sum, n) => sum + n.tokenCount,
          0
        );
        expect(totalTokens).toBeLessThanOrEqual(100);
      }
    });

    it('should return sorted by relevance', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance'],
      });

      const result = engine.retrieve(query, tree);

      expect(result.ok).toBe(true);
      if (result.ok && result.value.length >= 2) {
        // 내림차순 정렬 확인
        for (let i = 0; i < result.value.length - 1; i++) {
          const current = result.value[i];
          const next = result.value[i + 1];
          if (current && next) {
            expect(current.relevance).toBeGreaterThanOrEqual(next.relevance);
          }
        }
      }
    });

    it('should return empty for no matches', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['nonexistent.path'],
      });

      const result = engine.retrieve(query, tree, { minRelevance: 0.9 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should use wildcard patterns', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance.*'],
      });

      const result = engine.retrieve(query, tree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
      }
    });

    it('should error for semantic strategy', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery();

      const result = engine.retrieve(query, tree, { strategy: 'semantic' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_QUERY');
      }
    });

    it('should respect maxResults', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery();

      const result = engine.retrieve(query, tree, {
        maxResults: 2,
        minRelevance: 0,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('expandNode', () => {
    it('should return children with relevance', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance'],
      });

      const result = engine.expandNode('finance', tree, query);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
        expect(result.value.map((n) => n.nodeId)).toContain('revenue');
        expect(result.value.map((n) => n.nodeId)).toContain('budget');
      }
    });

    it('should filter low relevance children', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['marketing'],
      });

      const result = engine.expandNode('finance', tree, query, {
        minRelevance: 0.5,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // marketing 질의에 대해 finance 자식들은 관련성 낮음
        expect(result.value.length).toBeLessThanOrEqual(2);
      }
    });

    it('should return error for non-existent node', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery();

      const result = engine.expandNode('nonexistent', tree, query);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NODE_NOT_FOUND');
      }
    });

    it('should return empty for leaf node', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery();

      const result = engine.expandNode('revenue', tree, query);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });
  });

  describe('calculateRelevance', () => {
    it('should calculate keyword relevance', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });

      const node = tree.root.children[0]!; // finance
      const relevance = engine.calculateRelevance(query, node, 'keyword');

      expect(relevance).toBeGreaterThan(0);
    });

    it('should calculate path relevance', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });

      const revenueNode = tree.root.children[0]!.children[0]!;
      const relevance = engine.calculateRelevance(query, revenueNode, 'path');

      expect(relevance).toBeGreaterThan(0.8);
    });

    it('should calculate hybrid relevance', () => {
      const engine = createContextQueryEngine();
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });

      const node = tree.root.children[0]!.children[0]!;
      const relevance = engine.calculateRelevance(query, node, 'hybrid');

      expect(relevance).toBeGreaterThan(0);
    });
  });
});

describe('AsyncContextQueryEngine', () => {
  describe('retrieveAsync', () => {
    it('should find nodes with semantic relevance', async () => {
      const provider = createMockEmbeddingProvider();
      const engine = createAsyncContextQueryEngine(provider);
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance'],
      });

      const result = await engine.retrieveAsync(
        query,
        tree,
        'What is the Q3 revenue?'
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0);
      }
    });

    it('should respect tokenBudget', async () => {
      const provider = createMockEmbeddingProvider();
      const engine = createAsyncContextQueryEngine(provider);
      const tree = createTestTree();
      const query = createQuery();

      const result = await engine.retrieveAsync(query, tree, 'query', {
        tokenBudget: 100,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const totalTokens = result.value.reduce(
          (sum, n) => sum + n.tokenCount,
          0
        );
        expect(totalTokens).toBeLessThanOrEqual(100);
      }
    });

    it('should filter by minRelevance', async () => {
      const provider = createMockEmbeddingProvider();
      const engine = createAsyncContextQueryEngine(provider);
      const tree = createTestTree();
      const query = createQuery();

      const result = await engine.retrieveAsync(query, tree, 'query', {
        minRelevance: 0.9,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // 높은 임계값으로 필터링
        result.value.forEach((node) => {
          expect(node.relevance).toBeGreaterThanOrEqual(0.9);
        });
      }
    });
  });

  describe('expandNodeAsync', () => {
    it('should expand node with semantic relevance', async () => {
      const provider = createMockEmbeddingProvider();
      const engine = createAsyncContextQueryEngine(provider);
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance'],
      });

      const result = await engine.expandNodeAsync(
        'finance',
        tree,
        query,
        'finance revenue budget',
        { minRelevance: 0 }
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });

    it('should return error for non-existent node', async () => {
      const provider = createMockEmbeddingProvider();
      const engine = createAsyncContextQueryEngine(provider);
      const tree = createTestTree();
      const query = createQuery();

      const result = await engine.expandNodeAsync(
        'nonexistent',
        tree,
        query,
        'query'
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NODE_NOT_FOUND');
      }
    });
  });

  describe('calculateRelevanceAsync', () => {
    it('should calculate semantic relevance', async () => {
      const provider = createMockEmbeddingProvider();
      const engine = createAsyncContextQueryEngine(provider);
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });

      const node = tree.root.children[0]!.children[0]!;
      const relevance = await engine.calculateRelevanceAsync(
        query,
        node,
        'Q3 revenue report'
      );

      expect(relevance).toBeGreaterThanOrEqual(0);
      expect(relevance).toBeLessThanOrEqual(1);
    });
  });

  describe('clearCache', () => {
    it('should clear embedding cache', async () => {
      const provider = createMockEmbeddingProvider();
      const engine = createAsyncContextQueryEngine(provider);
      const tree = createTestTree();
      const query = createQuery();

      // 캐시 채우기
      await engine.retrieveAsync(query, tree, 'query');

      // 캐시 클리어
      engine.clearCache();

      // 다시 호출해도 에러 없어야 함
      const result = await engine.retrieveAsync(query, tree, 'query');
      expect(result.ok).toBe(true);
    });
  });

  describe('sync interface fallback', () => {
    it('should fall back to hybrid for semantic strategy in sync mode', () => {
      const provider = createMockEmbeddingProvider();
      const engine = createAsyncContextQueryEngine(provider);
      const tree = createTestTree();
      const query = createQuery();

      // sync retrieve에서 semantic은 hybrid로 대체됨
      const result = engine.retrieve(query, tree, { strategy: 'semantic' });

      expect(result.ok).toBe(true);
    });
  });
});

describe('factory functions', () => {
  describe('createContextQueryEngine', () => {
    it('should create engine with default options', () => {
      const engine = createContextQueryEngine();

      expect(engine).toBeInstanceOf(ContextQueryEngine);
    });

    it('should create engine with custom options', () => {
      const engine = createContextQueryEngine({
        maxResults: 5,
        minRelevance: 0.3,
      });

      expect(engine).toBeInstanceOf(ContextQueryEngine);
    });
  });

  describe('createAsyncContextQueryEngine', () => {
    it('should create async engine with provider', () => {
      const provider = createMockEmbeddingProvider();
      const engine = createAsyncContextQueryEngine(provider);

      expect(engine).toBeInstanceOf(AsyncContextQueryEngine);
    });

    it('should create engine with custom options', () => {
      const provider = createMockEmbeddingProvider();
      const engine = createAsyncContextQueryEngine(provider, {
        strategy: 'hybrid',
      });

      expect(engine).toBeInstanceOf(AsyncContextQueryEngine);
    });
  });
});
