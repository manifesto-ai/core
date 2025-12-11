import { describe, it, expect } from 'vitest';
import {
  buildNodeIndex,
  findNodeById,
  getAncestors,
  getDescendants,
  getSiblings,
  findByPath,
  findByExactPath,
  traverseBFS,
  traverseDFS,
  findCommonAncestor,
  getAllNodes,
  getNodesAtDepth,
  getLeafNodes,
} from '../../src/cqe/navigator.js';
import type { SummaryNode, CompressionTree } from '../../src/sct/index.js';
import type { ParsedQuery } from '../../src/reasoning/index.js';

// 테스트용 트리 구조 생성 헬퍼
function createTestTree(): CompressionTree {
  // 구조:
  // root (depth 0)
  // ├── finance (depth 1)
  // │   ├── revenue (depth 2)
  // │   │   ├── q1 (depth 3)
  // │   │   └── q2 (depth 3)
  // │   └── budget (depth 2)
  // └── marketing (depth 1)
  //     └── campaigns (depth 2)

  const q1: SummaryNode = {
    id: 'q1',
    path: 'finance.revenue.q1',
    depth: 3,
    summary: 'Q1 revenue report',
    tokenCount: 50,
    originalTokenCount: 200,
    compressionRatio: 4,
    keywords: ['q1', 'revenue', 'quarterly'],
    children: [],
    parentId: 'revenue',
  };

  const q2: SummaryNode = {
    id: 'q2',
    path: 'finance.revenue.q2',
    depth: 3,
    summary: 'Q2 revenue report',
    tokenCount: 50,
    originalTokenCount: 200,
    compressionRatio: 4,
    keywords: ['q2', 'revenue', 'quarterly'],
    children: [],
    parentId: 'revenue',
  };

  const revenue: SummaryNode = {
    id: 'revenue',
    path: 'finance.revenue',
    depth: 2,
    summary: 'Revenue summary',
    tokenCount: 80,
    originalTokenCount: 400,
    compressionRatio: 5,
    keywords: ['revenue', 'finance', 'income'],
    children: [q1, q2],
    parentId: 'finance',
  };

  const budget: SummaryNode = {
    id: 'budget',
    path: 'finance.budget',
    depth: 2,
    summary: 'Budget allocation',
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
    summary: 'Finance department overview',
    tokenCount: 100,
    originalTokenCount: 500,
    compressionRatio: 5,
    keywords: ['finance', 'department'],
    children: [revenue, budget],
    parentId: 'root',
  };

  const campaigns: SummaryNode = {
    id: 'campaigns',
    path: 'marketing.campaigns',
    depth: 2,
    summary: 'Marketing campaigns',
    tokenCount: 70,
    originalTokenCount: 350,
    compressionRatio: 5,
    keywords: ['marketing', 'campaigns', 'ads'],
    children: [],
    parentId: 'marketing',
  };

  const marketing: SummaryNode = {
    id: 'marketing',
    path: 'marketing',
    depth: 1,
    summary: 'Marketing department overview',
    tokenCount: 90,
    originalTokenCount: 450,
    compressionRatio: 5,
    keywords: ['marketing', 'department'],
    children: [campaigns],
    parentId: 'root',
  };

  const root: SummaryNode = {
    id: 'root',
    path: 'root',
    depth: 0,
    summary: 'Company overview',
    tokenCount: 150,
    originalTokenCount: 750,
    compressionRatio: 5,
    keywords: ['company', 'overview'],
    children: [finance, marketing],
    parentId: null,
  };

  return {
    root,
    totalChunks: 7,
    totalTokens: 650,
    originalTokens: 3150,
    compressionRatio: 4.85,
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

describe('tree navigation', () => {
  describe('buildNodeIndex', () => {
    it('should build index from tree', () => {
      const tree = createTestTree();

      const index = buildNodeIndex(tree);

      // 8 nodes: root, finance, marketing, revenue, budget, campaigns, q1, q2
      expect(index.byId.size).toBe(8);
      expect(index.byPath.size).toBe(8);
      expect(index.byParentId.get('finance')?.length).toBe(2);
    });
  });

  describe('findNodeById', () => {
    it('should find node by ID', () => {
      const tree = createTestTree();

      const node = findNodeById('revenue', tree);

      expect(node).not.toBeNull();
      expect(node?.id).toBe('revenue');
      expect(node?.path).toBe('finance.revenue');
    });

    it('should return null for non-existent ID', () => {
      const tree = createTestTree();

      const node = findNodeById('non-existent', tree);

      expect(node).toBeNull();
    });
  });

  describe('getAncestors', () => {
    it('should return path to root', () => {
      const tree = createTestTree();

      const ancestors = getAncestors('q1', tree);

      expect(ancestors).toHaveLength(3);
      expect(ancestors[0]?.id).toBe('revenue');
      expect(ancestors[1]?.id).toBe('finance');
      expect(ancestors[2]?.id).toBe('root');
    });

    it('should return empty for root node', () => {
      const tree = createTestTree();

      const ancestors = getAncestors('root', tree);

      expect(ancestors).toHaveLength(0);
    });

    it('should return empty for non-existent node', () => {
      const tree = createTestTree();

      const ancestors = getAncestors('non-existent', tree);

      expect(ancestors).toHaveLength(0);
    });
  });

  describe('getDescendants', () => {
    it('should return all children', () => {
      const tree = createTestTree();

      const descendants = getDescendants('finance', tree);

      expect(descendants.length).toBeGreaterThanOrEqual(3);
      expect(descendants.map((d) => d.id)).toContain('revenue');
      expect(descendants.map((d) => d.id)).toContain('budget');
      expect(descendants.map((d) => d.id)).toContain('q1');
      expect(descendants.map((d) => d.id)).toContain('q2');
    });

    it('should respect maxDepth', () => {
      const tree = createTestTree();

      const descendants = getDescendants('finance', tree, 1);

      expect(descendants).toHaveLength(2);
      expect(descendants.map((d) => d.id)).toContain('revenue');
      expect(descendants.map((d) => d.id)).toContain('budget');
      expect(descendants.map((d) => d.id)).not.toContain('q1');
    });

    it('should return empty for leaf node', () => {
      const tree = createTestTree();

      const descendants = getDescendants('q1', tree);

      expect(descendants).toHaveLength(0);
    });

    it('should return empty for non-existent node', () => {
      const tree = createTestTree();

      const descendants = getDescendants('non-existent', tree);

      expect(descendants).toHaveLength(0);
    });
  });

  describe('getSiblings', () => {
    it('should return sibling nodes', () => {
      const tree = createTestTree();

      const siblings = getSiblings('q1', tree);

      expect(siblings).toHaveLength(1);
      expect(siblings[0]?.id).toBe('q2');
    });

    it('should return empty for root node', () => {
      const tree = createTestTree();

      const siblings = getSiblings('root', tree);

      expect(siblings).toHaveLength(0);
    });

    it('should return empty for only child', () => {
      const tree = createTestTree();

      const siblings = getSiblings('campaigns', tree);

      expect(siblings).toHaveLength(0);
    });
  });

  describe('findByPath', () => {
    it('should find exact path match', () => {
      const tree = createTestTree();

      const nodes = findByPath('finance.revenue', tree);

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.id).toBe('revenue');
    });

    it('should support wildcard patterns', () => {
      const tree = createTestTree();

      const nodes = findByPath('finance.*', tree);

      expect(nodes.length).toBeGreaterThanOrEqual(2);
      expect(nodes.map((n) => n.id)).toContain('revenue');
      expect(nodes.map((n) => n.id)).toContain('budget');
    });

    it('should return empty for no match', () => {
      const tree = createTestTree();

      const nodes = findByPath('sales.orders', tree);

      expect(nodes).toHaveLength(0);
    });
  });

  describe('findByExactPath', () => {
    it('should find exact path', () => {
      const tree = createTestTree();

      const node = findByExactPath('finance.revenue', tree);

      expect(node).not.toBeNull();
      expect(node?.id).toBe('revenue');
    });

    it('should be case insensitive', () => {
      const tree = createTestTree();

      const node = findByExactPath('Finance.Revenue', tree);

      expect(node).not.toBeNull();
      expect(node?.id).toBe('revenue');
    });

    it('should return null for no match', () => {
      const tree = createTestTree();

      const node = findByExactPath('sales.orders', tree);

      expect(node).toBeNull();
    });
  });

  describe('traverseBFS', () => {
    it('should traverse in breadth-first order', () => {
      const tree = createTestTree();

      const nodes = traverseBFS(tree, 10000);

      // BFS: root -> finance, marketing -> revenue, budget, campaigns -> q1, q2
      expect(nodes[0]?.id).toBe('root');
      expect(nodes[1]?.id).toBe('finance');
      expect(nodes[2]?.id).toBe('marketing');
    });

    it('should respect token budget', () => {
      const tree = createTestTree();

      const nodes = traverseBFS(tree, 200);

      // 토큰 예산 내에서만 수집
      const totalTokens = nodes.reduce((sum, n) => sum + n.tokenCount, 0);
      expect(totalTokens).toBeLessThanOrEqual(200);
    });

    it('should use visitor to filter nodes', () => {
      const tree = createTestTree();

      const nodes = traverseBFS(tree, 10000, (node) =>
        node.path.startsWith('finance')
      );

      // finance로 시작하는 노드만
      expect(nodes.every((n) => n.path.startsWith('finance'))).toBe(true);
    });
  });

  describe('traverseDFS', () => {
    it('should find relevant nodes', () => {
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance.revenue'],
      });

      // minRelevance 0으로 설정하면 모든 노드 탐색
      const nodes = traverseDFS(tree, query, 0);

      expect(nodes.length).toBeGreaterThan(0);
    });

    it('should filter by minRelevance', () => {
      const tree = createTestTree();
      const query = createQuery({
        targetPaths: ['finance'],
      });

      const highThreshold = traverseDFS(tree, query, 0.9);
      const lowThreshold = traverseDFS(tree, query, 0.1);

      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });
  });

  describe('findCommonAncestor', () => {
    it('should find common ancestor', () => {
      const tree = createTestTree();
      const q1 = findNodeById('q1', tree)!;
      const q2 = findNodeById('q2', tree)!;

      const ancestor = findCommonAncestor([q1, q2], tree);

      expect(ancestor?.id).toBe('revenue');
    });

    it('should return null for empty array', () => {
      const tree = createTestTree();

      const ancestor = findCommonAncestor([], tree);

      expect(ancestor).toBeNull();
    });

    it('should return parent for single node', () => {
      const tree = createTestTree();
      const q1 = findNodeById('q1', tree)!;

      const ancestor = findCommonAncestor([q1], tree);

      expect(ancestor?.id).toBe('revenue');
    });

    it('should find root as common ancestor for unrelated nodes', () => {
      const tree = createTestTree();
      const q1 = findNodeById('q1', tree)!;
      const campaigns = findNodeById('campaigns', tree)!;

      const ancestor = findCommonAncestor([q1, campaigns], tree);

      expect(ancestor?.id).toBe('root');
    });
  });

  describe('getAllNodes', () => {
    it('should return all nodes', () => {
      const tree = createTestTree();

      const nodes = getAllNodes(tree);

      // 8 nodes: root, finance, marketing, revenue, budget, campaigns, q1, q2
      expect(nodes).toHaveLength(8);
    });
  });

  describe('getNodesAtDepth', () => {
    it('should return nodes at specific depth', () => {
      const tree = createTestTree();

      const depth1 = getNodesAtDepth(tree, 1);
      const depth2 = getNodesAtDepth(tree, 2);

      expect(depth1).toHaveLength(2);
      expect(depth1.map((n) => n.id)).toContain('finance');
      expect(depth1.map((n) => n.id)).toContain('marketing');

      expect(depth2).toHaveLength(3);
      expect(depth2.map((n) => n.id)).toContain('revenue');
      expect(depth2.map((n) => n.id)).toContain('budget');
      expect(depth2.map((n) => n.id)).toContain('campaigns');
    });

    it('should return root at depth 0', () => {
      const tree = createTestTree();

      const depth0 = getNodesAtDepth(tree, 0);

      expect(depth0).toHaveLength(1);
      expect(depth0[0]?.id).toBe('root');
    });
  });

  describe('getLeafNodes', () => {
    it('should return only leaf nodes', () => {
      const tree = createTestTree();

      const leaves = getLeafNodes(tree);

      expect(leaves).toHaveLength(4);
      expect(leaves.map((n) => n.id)).toContain('q1');
      expect(leaves.map((n) => n.id)).toContain('q2');
      expect(leaves.map((n) => n.id)).toContain('budget');
      expect(leaves.map((n) => n.id)).toContain('campaigns');
    });
  });
});
