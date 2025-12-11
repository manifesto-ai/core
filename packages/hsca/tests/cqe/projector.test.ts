import { describe, it, expect } from 'vitest';
import {
  toRetrievedNode,
  sortByRelevance,
  sortByDepth,
  filterByViewScope,
  projectWithinBudget,
  formatAsMarkdown,
  formatAsJSON,
  formatAsPlain,
  formatForLLM,
  getProjectionStats,
  type ProjectedContext,
} from '../../src/cqe/projector.js';
import type { SummaryNode } from '../../src/sct/index.js';
import type { RetrievedNode } from '../../src/reasoning/index.js';

// 테스트용 노드 생성 헬퍼
function createSummaryNode(
  overrides: Partial<SummaryNode> = {}
): SummaryNode {
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

// 테스트용 RetrievedNode 생성 헬퍼
function createRetrievedNode(
  overrides: Partial<RetrievedNode> = {}
): RetrievedNode {
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

describe('context projection', () => {
  describe('toRetrievedNode', () => {
    it('should convert SummaryNode to RetrievedNode', () => {
      const node = createSummaryNode({
        id: 'my-node',
        path: 'my.path',
        depth: 2,
        summary: 'My summary',
        tokenCount: 150,
      });

      const retrieved = toRetrievedNode(node, 0.75);

      expect(retrieved.nodeId).toBe('my-node');
      expect(retrieved.level).toBe(2);
      expect(retrieved.summary).toBe('My summary');
      expect(retrieved.relevance).toBe(0.75);
      expect(retrieved.tokenCount).toBe(150);
      expect(retrieved.semanticPaths).toContain('my.path');
    });

    it('should clamp relevance to 0-1', () => {
      const node = createSummaryNode();

      const highRelevance = toRetrievedNode(node, 1.5);
      const lowRelevance = toRetrievedNode(node, -0.5);

      expect(highRelevance.relevance).toBe(1);
      expect(lowRelevance.relevance).toBe(0);
    });
  });

  describe('sortByRelevance', () => {
    it('should sort descending by default', () => {
      const nodes = [
        createRetrievedNode({ nodeId: 'low', relevance: 0.3 }),
        createRetrievedNode({ nodeId: 'high', relevance: 0.9 }),
        createRetrievedNode({ nodeId: 'mid', relevance: 0.5 }),
      ];

      const sorted = sortByRelevance(nodes);

      expect(sorted[0]?.nodeId).toBe('high');
      expect(sorted[1]?.nodeId).toBe('mid');
      expect(sorted[2]?.nodeId).toBe('low');
    });

    it('should sort ascending when specified', () => {
      const nodes = [
        createRetrievedNode({ nodeId: 'high', relevance: 0.9 }),
        createRetrievedNode({ nodeId: 'low', relevance: 0.3 }),
      ];

      const sorted = sortByRelevance(nodes, true);

      expect(sorted[0]?.nodeId).toBe('low');
      expect(sorted[1]?.nodeId).toBe('high');
    });

    it('should not mutate original array', () => {
      const nodes = [
        createRetrievedNode({ nodeId: 'a', relevance: 0.5 }),
        createRetrievedNode({ nodeId: 'b', relevance: 0.8 }),
      ];

      const sorted = sortByRelevance(nodes);

      expect(nodes[0]?.nodeId).toBe('a');
      expect(sorted[0]?.nodeId).toBe('b');
    });
  });

  describe('sortByDepth', () => {
    it('should sort ascending by default', () => {
      const nodes = [
        createRetrievedNode({ nodeId: 'deep', level: 5 }),
        createRetrievedNode({ nodeId: 'shallow', level: 1 }),
        createRetrievedNode({ nodeId: 'mid', level: 3 }),
      ];

      const sorted = sortByDepth(nodes);

      expect(sorted[0]?.nodeId).toBe('shallow');
      expect(sorted[1]?.nodeId).toBe('mid');
      expect(sorted[2]?.nodeId).toBe('deep');
    });

    it('should sort descending when specified', () => {
      const nodes = [
        createRetrievedNode({ nodeId: 'shallow', level: 1 }),
        createRetrievedNode({ nodeId: 'deep', level: 5 }),
      ];

      const sorted = sortByDepth(nodes, false);

      expect(sorted[0]?.nodeId).toBe('deep');
      expect(sorted[1]?.nodeId).toBe('shallow');
    });
  });

  describe('filterByViewScope', () => {
    it('should return empty for empty viewScope', () => {
      const nodes = [createRetrievedNode()];

      const filtered = filterByViewScope(nodes, []);

      expect(filtered).toHaveLength(0);
    });

    it('should return all for retrievedContext scope', () => {
      const nodes = [
        createRetrievedNode({ nodeId: 'a' }),
        createRetrievedNode({ nodeId: 'b' }),
      ];

      const filtered = filterByViewScope(nodes, ['state.retrievedContext']);

      expect(filtered).toHaveLength(2);
    });

    it('should filter by path pattern', () => {
      const nodes = [
        createRetrievedNode({
          nodeId: 'finance1',
          semanticPaths: ['finance.revenue'],
        }),
        createRetrievedNode({
          nodeId: 'finance2',
          semanticPaths: ['finance.budget'],
        }),
        createRetrievedNode({
          nodeId: 'marketing',
          semanticPaths: ['marketing.campaigns'],
        }),
      ];

      const filtered = filterByViewScope(nodes, ['finance.*']);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((n) => n.nodeId)).toContain('finance1');
      expect(filtered.map((n) => n.nodeId)).toContain('finance2');
    });

    it('should filter by exact path', () => {
      const nodes = [
        createRetrievedNode({
          nodeId: 'exact',
          semanticPaths: ['finance.revenue'],
        }),
        createRetrievedNode({
          nodeId: 'other',
          semanticPaths: ['finance.budget'],
        }),
      ];

      const filtered = filterByViewScope(nodes, ['finance.revenue']);

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.nodeId).toBe('exact');
    });
  });

  describe('projectWithinBudget', () => {
    it('should include all nodes within budget', () => {
      const nodes = [
        createRetrievedNode({
          nodeId: 'a',
          tokenCount: 100,
          relevance: 0.8,
        }),
        createRetrievedNode({
          nodeId: 'b',
          tokenCount: 100,
          relevance: 0.6,
        }),
      ];

      const projected = projectWithinBudget(nodes, 250);

      expect(projected.nodes).toHaveLength(2);
      expect(projected.totalTokens).toBe(200);
      expect(projected.truncated).toBe(false);
    });

    it('should prioritize high relevance nodes', () => {
      const nodes = [
        createRetrievedNode({
          nodeId: 'low',
          tokenCount: 100,
          relevance: 0.3,
        }),
        createRetrievedNode({
          nodeId: 'high',
          tokenCount: 100,
          relevance: 0.9,
        }),
      ];

      const projected = projectWithinBudget(nodes, 150);

      expect(projected.nodes).toHaveLength(1);
      expect(projected.nodes[0]?.nodeId).toBe('high');
      expect(projected.truncated).toBe(true);
    });

    it('should mark truncated when over budget', () => {
      const nodes = [
        createRetrievedNode({ tokenCount: 200 }),
        createRetrievedNode({ tokenCount: 200 }),
      ];

      const projected = projectWithinBudget(nodes, 300);

      expect(projected.truncated).toBe(true);
      expect(projected.excludedPaths.length).toBeGreaterThan(0);
    });

    it('should track included and excluded paths', () => {
      const nodes = [
        createRetrievedNode({
          nodeId: 'included',
          tokenCount: 100,
          relevance: 0.8,
          semanticPaths: ['path.included'],
        }),
        createRetrievedNode({
          nodeId: 'excluded',
          tokenCount: 100,
          relevance: 0.3,
          semanticPaths: ['path.excluded'],
        }),
      ];

      const projected = projectWithinBudget(nodes, 150);

      expect(projected.includedPaths).toContain('path.included');
      expect(projected.excludedPaths).toContain('path.excluded');
    });

    it('should sort by depth when specified', () => {
      const nodes = [
        createRetrievedNode({ nodeId: 'deep', level: 5, tokenCount: 100 }),
        createRetrievedNode({ nodeId: 'shallow', level: 1, tokenCount: 100 }),
      ];

      const projected = projectWithinBudget(nodes, 150, 'depth');

      expect(projected.nodes[0]?.nodeId).toBe('shallow');
    });
  });

  describe('formatAsMarkdown', () => {
    it('should format nodes as markdown', () => {
      const projected: ProjectedContext = {
        nodes: [
          createRetrievedNode({
            summary: 'Test content',
            relevance: 0.8,
            semanticPaths: ['test.path'],
          }),
        ],
        totalTokens: 100,
        truncated: false,
        includedPaths: ['test.path'],
        excludedPaths: [],
      };

      const markdown = formatAsMarkdown(projected);

      expect(markdown).toContain('## 관련 컨텍스트');
      expect(markdown).toContain('test.path');
      expect(markdown).toContain('80.0%');
      expect(markdown).toContain('Test content');
    });

    it('should indicate truncation', () => {
      const projected: ProjectedContext = {
        nodes: [
          createRetrievedNode({
            summary: 'Included content',
            relevance: 0.9,
            semanticPaths: ['included.path'],
          }),
        ],
        totalTokens: 100,
        truncated: true,
        includedPaths: ['included.path'],
        excludedPaths: ['excluded.path'],
      };

      const markdown = formatAsMarkdown(projected);

      // 토큰 예산 초과로 일부 제외됨 메시지 확인
      expect(markdown).toContain('제외됨');
    });

    it('should handle empty context', () => {
      const projected: ProjectedContext = {
        nodes: [],
        totalTokens: 0,
        truncated: false,
        includedPaths: [],
        excludedPaths: [],
      };

      const markdown = formatAsMarkdown(projected);

      expect(markdown).toContain('컨텍스트 없음');
    });
  });

  describe('formatAsJSON', () => {
    it('should format as valid JSON', () => {
      const projected: ProjectedContext = {
        nodes: [
          createRetrievedNode({
            summary: 'Test',
            relevance: 0.5,
            semanticPaths: ['test'],
          }),
        ],
        totalTokens: 100,
        truncated: false,
        includedPaths: ['test'],
        excludedPaths: [],
      };

      const json = formatAsJSON(projected);
      const parsed = JSON.parse(json);

      expect(parsed.nodes).toHaveLength(1);
      expect(parsed.meta.totalTokens).toBe(100);
      expect(parsed.meta.truncated).toBe(false);
    });
  });

  describe('formatAsPlain', () => {
    it('should format as plain text', () => {
      const projected: ProjectedContext = {
        nodes: [
          createRetrievedNode({
            summary: 'Plain text content',
            semanticPaths: ['plain.path'],
          }),
        ],
        totalTokens: 100,
        truncated: false,
        includedPaths: [],
        excludedPaths: [],
      };

      const plain = formatAsPlain(projected);

      expect(plain).toContain('[plain.path]');
      expect(plain).toContain('Plain text content');
    });

    it('should handle empty context', () => {
      const projected: ProjectedContext = {
        nodes: [],
        totalTokens: 0,
        truncated: false,
        includedPaths: [],
        excludedPaths: [],
      };

      const plain = formatAsPlain(projected);

      expect(plain).toContain('컨텍스트 없음');
    });
  });

  describe('formatForLLM', () => {
    it('should use markdown by default', () => {
      const projected: ProjectedContext = {
        nodes: [createRetrievedNode()],
        totalTokens: 100,
        truncated: false,
        includedPaths: [],
        excludedPaths: [],
      };

      const output = formatForLLM(projected);

      expect(output).toContain('##');
    });

    it('should support json format', () => {
      const projected: ProjectedContext = {
        nodes: [],
        totalTokens: 0,
        truncated: false,
        includedPaths: [],
        excludedPaths: [],
      };

      const output = formatForLLM(projected, 'json');

      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should support plain format', () => {
      const projected: ProjectedContext = {
        nodes: [],
        totalTokens: 0,
        truncated: false,
        includedPaths: [],
        excludedPaths: [],
      };

      const output = formatForLLM(projected, 'plain');

      expect(output).not.toContain('##');
      expect(output).not.toContain('{');
    });
  });

  describe('getProjectionStats', () => {
    it('should calculate statistics', () => {
      const projected: ProjectedContext = {
        nodes: [
          createRetrievedNode({ relevance: 0.8, tokenCount: 100 }),
          createRetrievedNode({ relevance: 0.6, tokenCount: 150 }),
          createRetrievedNode({ relevance: 0.4, tokenCount: 50 }),
        ],
        totalTokens: 300,
        truncated: false,
        includedPaths: [],
        excludedPaths: [],
      };

      const stats = getProjectionStats(projected);

      expect(stats.nodeCount).toBe(3);
      expect(stats.totalTokens).toBe(300);
      expect(stats.avgRelevance).toBeCloseTo(0.6, 2);
      expect(stats.maxRelevance).toBe(0.8);
      expect(stats.minRelevance).toBe(0.4);
      expect(stats.truncated).toBe(false);
    });

    it('should handle empty projection', () => {
      const projected: ProjectedContext = {
        nodes: [],
        totalTokens: 0,
        truncated: true,
        includedPaths: [],
        excludedPaths: [],
      };

      const stats = getProjectionStats(projected);

      expect(stats.nodeCount).toBe(0);
      expect(stats.avgRelevance).toBe(0);
      expect(stats.maxRelevance).toBe(0);
      expect(stats.minRelevance).toBe(0);
      expect(stats.truncated).toBe(true);
    });
  });
});
