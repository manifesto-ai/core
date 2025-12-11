import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  euclideanSimilarity,
  createEmbeddingCache,
  getOrCreateEmbedding,
  calculateSemanticRelevance,
  calculateSemanticRelevanceBatch,
  calculateHybridRelevanceAsync,
} from '../../src/cqe/semantic.js';
import {
  createMockEmbeddingProvider,
  createControllableMockEmbeddingProvider,
} from '../../src/cqe/embedding.js';
import type { SummaryNode } from '../../src/sct/index.js';
import type { ParsedQuery } from '../../src/reasoning/index.js';

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

describe('semantic similarity', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 0, 0];

      const similarity = cosineSimilarity(vec, vec);

      expect(similarity).toBe(1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];

      const similarity = cosineSimilarity(vec1, vec2);

      expect(similarity).toBe(0);
    });

    it('should handle negative values', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];

      const similarity = cosineSimilarity(vec1, vec2);

      // 음수 유사도는 0으로 클램프
      expect(similarity).toBe(0);
    });

    it('should clamp to 0-1 range', () => {
      const vec1 = [0.5, 0.5, 0.5];
      const vec2 = [0.5, 0.5, 0.5];

      const similarity = cosineSimilarity(vec1, vec2);

      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should return 0 for zero vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 0, 0];

      const similarity = cosineSimilarity(vec1, vec2);

      expect(similarity).toBe(0);
    });

    it('should throw for mismatched dimensions', () => {
      const vec1 = [1, 0];
      const vec2 = [1, 0, 0];

      expect(() => cosineSimilarity(vec1, vec2)).toThrow(
        'Vector dimensions mismatch'
      );
    });

    it('should return 0 for empty vectors', () => {
      const similarity = cosineSimilarity([], []);

      expect(similarity).toBe(0);
    });

    it('should calculate correct similarity for unit vectors', () => {
      // 45도 각도의 두 벡터
      const vec1 = [1, 0];
      const vec2 = [Math.SQRT1_2, Math.SQRT1_2]; // 45도

      const similarity = cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(Math.SQRT1_2, 5);
    });
  });

  describe('euclideanSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 0, 0];

      const similarity = euclideanSimilarity(vec, vec);

      expect(similarity).toBe(1);
    });

    it('should return value between 0 and 1', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 0, 0];

      const similarity = euclideanSimilarity(vec1, vec2);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should throw for mismatched dimensions', () => {
      const vec1 = [1, 0];
      const vec2 = [1, 0, 0];

      expect(() => euclideanSimilarity(vec1, vec2)).toThrow(
        'Vector dimensions mismatch'
      );
    });
  });

  describe('EmbeddingCache', () => {
    it('should create empty cache', () => {
      const cache = createEmbeddingCache();

      expect(cache.size).toBe(0);
    });

    it('should store and retrieve embeddings', async () => {
      const cache = createEmbeddingCache();
      const provider = createMockEmbeddingProvider();

      const embedding1 = await getOrCreateEmbedding('test', provider, cache);
      const embedding2 = await getOrCreateEmbedding('test', provider, cache);

      expect(cache.size).toBe(1);
      expect(embedding1).toEqual(embedding2);
    });

    it('should not call provider for cached text', async () => {
      const cache = createEmbeddingCache();
      const provider = createMockEmbeddingProvider();

      // 캐시에 직접 추가
      const cachedEmbedding = [1, 0, 0];
      cache.set('cached', cachedEmbedding);

      const embedding = await getOrCreateEmbedding('cached', provider, cache);

      expect(embedding).toEqual(cachedEmbedding);
    });
  });

  describe('calculateSemanticRelevance', () => {
    it('should use embedding provider', async () => {
      const provider = createControllableMockEmbeddingProvider(3);
      provider.setCosineSimilarity('query text', 'Test summary', 0.75);

      const node = createNode({ summary: 'Test summary' });

      const relevance = await calculateSemanticRelevance(
        'query text',
        node,
        provider
      );

      expect(relevance).toBeCloseTo(0.75, 2);
    });

    it('should use cache when available', async () => {
      const provider = createMockEmbeddingProvider();
      const cache = createEmbeddingCache();

      const node = createNode();

      // 첫 번째 호출 - 캐시 채움
      await calculateSemanticRelevance('query', node, provider, cache);
      expect(cache.size).toBe(2); // query + node summary

      // 두 번째 호출 - 캐시 사용
      await calculateSemanticRelevance('query', node, provider, cache);
      expect(cache.size).toBe(2); // 캐시 크기 동일
    });

    it('should return 0-1 score', async () => {
      const provider = createMockEmbeddingProvider();
      const node = createNode();

      const relevance = await calculateSemanticRelevance(
        'random query',
        node,
        provider
      );

      expect(relevance).toBeGreaterThanOrEqual(0);
      expect(relevance).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateSemanticRelevanceBatch', () => {
    it('should process multiple nodes efficiently', async () => {
      const provider = createMockEmbeddingProvider();
      const nodes = [
        createNode({ id: 'node-1', summary: 'First summary' }),
        createNode({ id: 'node-2', summary: 'Second summary' }),
        createNode({ id: 'node-3', summary: 'Third summary' }),
      ];

      const relevanceMap = await calculateSemanticRelevanceBatch(
        'query',
        nodes,
        provider
      );

      expect(relevanceMap.size).toBe(3);
      expect(relevanceMap.has('node-1')).toBe(true);
      expect(relevanceMap.has('node-2')).toBe(true);
      expect(relevanceMap.has('node-3')).toBe(true);
    });

    it('should share query embedding across nodes', async () => {
      const provider = createMockEmbeddingProvider();
      const cache = createEmbeddingCache();
      const nodes = [
        createNode({ id: 'node-1', summary: 'Summary 1' }),
        createNode({ id: 'node-2', summary: 'Summary 2' }),
      ];

      await calculateSemanticRelevanceBatch('query', nodes, provider, cache);

      // query + 2 summaries = 3
      expect(cache.size).toBe(3);
      expect(cache.has('query')).toBe(true);
    });

    it('should handle empty nodes array', async () => {
      const provider = createMockEmbeddingProvider();

      const relevanceMap = await calculateSemanticRelevanceBatch(
        'query',
        [],
        provider
      );

      expect(relevanceMap.size).toBe(0);
    });

    it('should deduplicate identical summaries', async () => {
      const provider = createMockEmbeddingProvider();
      const cache = createEmbeddingCache();
      const nodes = [
        createNode({ id: 'node-1', summary: 'Same summary' }),
        createNode({ id: 'node-2', summary: 'Same summary' }),
      ];

      await calculateSemanticRelevanceBatch('query', nodes, provider, cache);

      // query + 1 unique summary = 2
      expect(cache.size).toBe(2);
    });
  });

  describe('calculateHybridRelevanceAsync', () => {
    it('should combine keyword, path, and semantic scores', async () => {
      const provider = createControllableMockEmbeddingProvider(3);
      provider.setCosineSimilarity('finance revenue query', 'Finance report', 0.8);

      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });
      const node = createNode({
        path: 'finance.revenue',
        keywords: ['finance', 'revenue'],
        summary: 'Finance report',
      });

      const relevance = await calculateHybridRelevanceAsync(
        query,
        node,
        provider,
        'finance revenue query'
      );

      expect(relevance).toBeGreaterThan(0.5);
    });

    it('should apply depth penalty', async () => {
      const provider = createMockEmbeddingProvider();
      const query = createQuery({ targetPaths: ['finance'] });

      const shallowNode = createNode({
        path: 'finance',
        keywords: ['finance'],
        depth: 1,
        summary: 'Finance shallow',
      });

      const deepNode = createNode({
        path: 'finance',
        keywords: ['finance'],
        depth: 5,
        summary: 'Finance deep',
      });

      const shallowRelevance = await calculateHybridRelevanceAsync(
        query,
        shallowNode,
        provider,
        'finance'
      );

      const deepRelevance = await calculateHybridRelevanceAsync(
        query,
        deepNode,
        provider,
        'finance'
      );

      expect(shallowRelevance).toBeGreaterThan(deepRelevance);
    });

    it('should use cache for efficiency', async () => {
      const provider = createMockEmbeddingProvider();
      const cache = createEmbeddingCache();
      const query = createQuery();
      const node = createNode();

      await calculateHybridRelevanceAsync(
        query,
        node,
        provider,
        'query text',
        {},
        cache
      );

      // 두 번째 호출에서 캐시 사용
      const startSize = cache.size;
      await calculateHybridRelevanceAsync(
        query,
        node,
        provider,
        'query text',
        {},
        cache
      );

      expect(cache.size).toBe(startSize);
    });

    it('should respect weight configuration', async () => {
      const provider = createControllableMockEmbeddingProvider(3);
      provider.setCosineSimilarity('query', 'summary', 0.9);

      const query = createQuery({ targetPaths: ['wrong.path'] });
      const node = createNode({
        path: 'other.path',
        keywords: [],
        summary: 'summary',
      });

      // semantic 가중치 높게
      const highSemanticConfig = {
        keywordWeight: 0.1,
        pathWeight: 0.1,
        semanticWeight: 0.8,
      };

      const relevance = await calculateHybridRelevanceAsync(
        query,
        node,
        provider,
        'query',
        highSemanticConfig
      );

      // semantic 점수(0.9)가 높은 가중치로 반영됨
      expect(relevance).toBeGreaterThan(0.5);
    });
  });
});
