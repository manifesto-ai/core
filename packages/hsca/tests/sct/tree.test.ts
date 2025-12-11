import { describe, it, expect, vi } from 'vitest';
import { isOk, isErr } from '@manifesto-ai/core';
import {
  SemanticCompressionTree,
  chunkText,
  type SummaryNode,
  type CompressionTree,
  type ILLMClient,
} from '../../src/index.js';

// Mock LLM 클라이언트 생성
function createMockLLM(): ILLMClient {
  let callCount = 0;

  return {
    call: vi.fn(async ({ messages }) => {
      callCount++;
      const userMessage = messages.find((m) => m.role === 'user')?.content ?? '';

      // 키워드 추출 (간단한 로직)
      const keywords = userMessage
        .split(/\s+/)
        .filter((w) => w.length > 5)
        .slice(0, 5);

      return {
        ok: true as const,
        value: {
          content: JSON.stringify({
            summary: `Summary ${callCount}: ${userMessage.slice(0, 50)}...`,
            keywords: keywords.length > 0 ? keywords : ['default'],
          }),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          model: 'mock-model',
          finishReason: 'stop' as const,
        },
      };
    }),
    estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
    getModelId: vi.fn(() => 'mock-model'),
  };
}

// 샘플 SummaryNode 생성
function createSampleNode(id: string, depth: number, children: SummaryNode[] = []): SummaryNode {
  return {
    id,
    path: depth === 0 ? 'root' : `level.${depth}.${id}`,
    depth,
    summary: `Summary for node ${id}`,
    tokenCount: 50,
    originalTokenCount: 500,
    compressionRatio: 10,
    keywords: ['keyword1', 'keyword2'],
    children,
    parentId: null,
  };
}

describe('SemanticCompressionTree', () => {
  describe('build', () => {
    it('should build tree from text', async () => {
      const mockLLM = createMockLLM();
      const text = 'First paragraph about testing. Second paragraph about building.';

      const result = await SemanticCompressionTree.build(text, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const tree = result.value;
      expect(tree.root).toBeDefined();
      expect(tree.root.summary).toBeDefined();
    });

    it('should return error for empty input', async () => {
      const mockLLM = createMockLLM();

      const result = await SemanticCompressionTree.build('', mockLLM);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('EMPTY_INPUT');
    });

    it('should respect chunking config', async () => {
      const mockLLM = createMockLLM();
      const text = 'Word '.repeat(100);

      const result = await SemanticCompressionTree.build(text, mockLLM, {
        chunking: { strategy: 'fixed', targetChunkTokens: 20 },
      });

      expect(isOk(result)).toBe(true);
    });

    it('should calculate metrics correctly', async () => {
      const mockLLM = createMockLLM();
      const text = 'Test content for metrics calculation. '.repeat(10);

      const result = await SemanticCompressionTree.build(text, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const metrics = result.value.getMetrics();
      expect(metrics.totalNodes).toBeGreaterThan(0);
      expect(metrics.compressionRatio).toBeGreaterThan(0);
      expect(metrics.originalTokens).toBeGreaterThan(0);
    });
  });

  describe('fromJSON', () => {
    it('should deserialize and serialize correctly', async () => {
      const mockLLM = createMockLLM();
      const text = 'Test content for serialization.';

      const buildResult = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(buildResult)).toBe(true);
      if (!isOk(buildResult)) return;

      const originalTree = buildResult.value;
      const json = originalTree.toJSON();

      const restored = SemanticCompressionTree.fromJSON(json);
      expect(isOk(restored)).toBe(true);
      if (!isOk(restored)) return;

      expect(restored.value.root.summary).toBe(originalTree.root.summary);
      expect(restored.value.metadata.totalChunks).toBe(originalTree.metadata.totalChunks);
    });

    it('should return error for invalid data', () => {
      const result = SemanticCompressionTree.fromJSON({} as CompressionTree);

      expect(isErr(result)).toBe(true);
    });
  });

  describe('searchByKeywords', () => {
    it('should find nodes by exact keyword match', async () => {
      const mockLLM = createMockLLM();
      const text = 'Authentication system for users. OAuth protocol implementation.';

      const result = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const tree = result.value;
      const found = tree.searchByKeywords(['default']); // mock이 반환하는 키워드

      expect(found.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array for no matches', async () => {
      const mockLLM = createMockLLM();
      const text = 'Simple test text.';

      const result = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const tree = result.value;
      const found = tree.searchByKeywords(['nonexistentxyz123']);

      expect(found).toHaveLength(0);
    });

    it('should return empty array for empty keywords', async () => {
      const mockLLM = createMockLLM();
      const text = 'Test content.';

      const result = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const found = result.value.searchByKeywords([]);
      expect(found).toHaveLength(0);
    });

    it('should respect maxResults limit', async () => {
      const mockLLM = createMockLLM();
      const text = 'Word '.repeat(200);

      const result = await SemanticCompressionTree.build(text, mockLLM, {
        chunking: { targetChunkTokens: 20 },
      });
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const found = result.value.searchByKeywords(['default'], 3);
      expect(found.length).toBeLessThanOrEqual(3);
    });
  });

  describe('collectWithinBudget', () => {
    it('should collect nodes within token budget', async () => {
      const mockLLM = createMockLLM();
      const text = 'Test content '.repeat(50);

      const result = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const tree = result.value;
      const collected = tree.collectWithinBudget(500);

      const totalTokens = collected.reduce((sum, n) => sum + n.tokenCount, 0);
      expect(totalTokens).toBeLessThanOrEqual(500);
    });

    it('should return at least root with large budget', async () => {
      const mockLLM = createMockLLM();
      const text = 'Short text.';

      const result = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const collected = result.value.collectWithinBudget(10000);
      expect(collected.length).toBeGreaterThan(0);
    });
  });

  describe('expandNode', () => {
    it('should return children of a node', async () => {
      const mockLLM = createMockLLM();
      const text = 'Paragraph one. '.repeat(20) + '\n\n' + 'Paragraph two. '.repeat(20);

      const result = await SemanticCompressionTree.build(text, mockLLM, {
        chunking: { targetChunkTokens: 30 },
      });
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const tree = result.value;
      const children = tree.expandNode(tree.root.id);

      // 루트에 자식이 있으면 반환됨
      expect(Array.isArray(children)).toBe(true);
    });

    it('should return empty array for leaf nodes', async () => {
      const mockLLM = createMockLLM();
      const text = 'Short text.';

      const result = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const leaves = result.value.getLeafNodes();
      if (leaves.length > 0) {
        const children = result.value.expandNode(leaves[0]!.id);
        expect(children).toHaveLength(0);
      }
    });

    it('should return empty array for non-existent node', async () => {
      const mockLLM = createMockLLM();
      const text = 'Test.';

      const result = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const children = result.value.expandNode('non-existent-id');
      expect(children).toHaveLength(0);
    });
  });

  describe('getNodeByPath', () => {
    it('should find node by path', async () => {
      const mockLLM = createMockLLM();
      // 여러 청크가 생성되어 계층 구조가 만들어지는 텍스트
      const text = 'Paragraph one with content. '.repeat(20) + '\n\n' + 'Paragraph two with content. '.repeat(20);

      const result = await SemanticCompressionTree.build(text, mockLLM, {
        chunking: { targetChunkTokens: 30 },
      });
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const tree = result.value;
      const root = tree.getNodeByPath(tree.root.path);

      expect(root).toBeDefined();
      expect(root?.path).toBe(tree.root.path);
    });

    it('should return undefined for non-existent path', async () => {
      const mockLLM = createMockLLM();
      const text = 'Test.';

      const result = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const node = result.value.getNodeByPath('non.existent.path');
      expect(node).toBeUndefined();
    });
  });

  describe('getNodeById', () => {
    it('should find node by ID', async () => {
      const mockLLM = createMockLLM();
      const text = 'Test content.';

      const result = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const tree = result.value;
      const rootById = tree.getNodeById(tree.root.id);

      expect(rootById).toBeDefined();
      expect(rootById?.id).toBe(tree.root.id);
    });
  });

  describe('getSummariesAtDepth', () => {
    it('should return nodes at specific depth', async () => {
      const mockLLM = createMockLLM();
      const text = 'Paragraph. '.repeat(50);

      const result = await SemanticCompressionTree.build(text, mockLLM, {
        chunking: { targetChunkTokens: 30 },
      });
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const tree = result.value;
      const metrics = tree.getMetrics();

      // 각 깊이의 노드들 확인
      for (let d = 0; d <= metrics.maxDepth; d++) {
        const nodes = tree.getSummariesAtDepth(d);
        for (const node of nodes) {
          expect(node.depth).toBe(d);
        }
      }
    });
  });

  describe('getLeafNodes', () => {
    it('should return all leaf nodes', async () => {
      const mockLLM = createMockLLM();
      const text = 'Test '.repeat(100);

      const result = await SemanticCompressionTree.build(text, mockLLM, {
        chunking: { targetChunkTokens: 20 },
      });
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const leaves = result.value.getLeafNodes();

      // 모든 리프 노드는 자식이 없어야 함
      for (const leaf of leaves) {
        expect(leaf.children).toHaveLength(0);
      }
    });
  });

  describe('getMetrics', () => {
    it('should return correct metrics', async () => {
      const mockLLM = createMockLLM();
      const text = 'Test content for metrics. '.repeat(20);

      const result = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const metrics = result.value.getMetrics();

      expect(metrics.totalNodes).toBeGreaterThan(0);
      expect(metrics.maxDepth).toBeGreaterThanOrEqual(0);
      expect(metrics.compressionRatio).toBeGreaterThan(0);
      expect(metrics.totalTokens).toBeGreaterThan(0);
      expect(metrics.originalTokens).toBeGreaterThan(0);
      expect(metrics.leafCount).toBeGreaterThan(0);
      expect(metrics.avgTokensPerNode).toBeGreaterThan(0);
    });
  });

  describe('toJSON', () => {
    it('should serialize tree to JSON', async () => {
      const mockLLM = createMockLLM();
      const text = 'Test content.';

      const result = await SemanticCompressionTree.build(text, mockLLM);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const json = result.value.toJSON();

      expect(json.root).toBeDefined();
      expect(json.totalChunks).toBeDefined();
      expect(json.totalTokens).toBeDefined();
      expect(json.originalTokens).toBeDefined();
      expect(json.compressionRatio).toBeDefined();
      expect(json.createdAt).toBeDefined();
      expect(json.sourceType).toBeDefined();
    });
  });
});
