/**
 * CQE Tree Navigator
 *
 * SCT 트리 탐색 함수들
 * - getAncestors: 조상 노드 반환
 * - getDescendants: 자손 노드 반환
 * - getSiblings: 형제 노드 반환
 * - findByPath: 경로 패턴 기반 검색
 * - traverseBFS/DFS: 트리 순회
 */

import type { SummaryNode, CompressionTree } from '../sct/index.js';
import type { ParsedQuery } from '../reasoning/index.js';
import { matchPathPattern, calculateRelevance } from './relevance.js';

// ═══════════════════════════════════════════════════════
// 노드 인덱스 구축
// ═══════════════════════════════════════════════════════

/**
 * 노드 인덱스 타입
 */
export type NodeIndex = {
  byId: Map<string, SummaryNode>;
  byPath: Map<string, SummaryNode>;
  byParentId: Map<string, SummaryNode[]>;
};

/**
 * 트리에서 노드 인덱스 구축
 */
export function buildNodeIndex(tree: CompressionTree): NodeIndex {
  const index: NodeIndex = {
    byId: new Map(),
    byPath: new Map(),
    byParentId: new Map(),
  };

  function traverse(node: SummaryNode): void {
    index.byId.set(node.id, node);
    index.byPath.set(node.path, node);

    // 부모별 자식 인덱스
    if (node.parentId) {
      const siblings = index.byParentId.get(node.parentId) ?? [];
      siblings.push(node);
      index.byParentId.set(node.parentId, siblings);
    }

    // 자식 순회
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(tree.root);
  return index;
}

/**
 * ID로 노드 찾기
 */
export function findNodeById(
  nodeId: string,
  tree: CompressionTree
): SummaryNode | null {
  function traverse(node: SummaryNode): SummaryNode | null {
    if (node.id === nodeId) {
      return node;
    }

    for (const child of node.children) {
      const found = traverse(child);
      if (found) {
        return found;
      }
    }

    return null;
  }

  return traverse(tree.root);
}

// ═══════════════════════════════════════════════════════
// 조상/자손/형제 탐색
// ═══════════════════════════════════════════════════════

/**
 * 노드의 조상들 반환 (root까지)
 *
 * @param nodeId - 대상 노드 ID
 * @param tree - SCT 압축 트리
 * @returns 조상 노드 배열 (부모부터 root까지)
 */
export function getAncestors(
  nodeId: string,
  tree: CompressionTree
): SummaryNode[] {
  const ancestors: SummaryNode[] = [];

  // 먼저 대상 노드 찾기
  const targetNode = findNodeById(nodeId, tree);
  if (!targetNode) {
    return [];
  }

  // 부모를 따라 올라가기
  let currentParentId = targetNode.parentId;

  while (currentParentId) {
    const parent = findNodeById(currentParentId, tree);
    if (!parent) {
      break;
    }
    ancestors.push(parent);
    currentParentId = parent.parentId;
  }

  return ancestors;
}

/**
 * 노드의 자손들 반환 (지정 깊이까지)
 *
 * @param nodeId - 대상 노드 ID
 * @param tree - SCT 압축 트리
 * @param maxDepth - 최대 탐색 깊이 (undefined = 무제한)
 * @returns 자손 노드 배열
 */
export function getDescendants(
  nodeId: string,
  tree: CompressionTree,
  maxDepth?: number
): SummaryNode[] {
  const node = findNodeById(nodeId, tree);
  if (!node) {
    return [];
  }

  const descendants: SummaryNode[] = [];

  function traverse(current: SummaryNode, currentDepth: number): void {
    if (maxDepth !== undefined && currentDepth > maxDepth) {
      return;
    }

    for (const child of current.children) {
      descendants.push(child);
      traverse(child, currentDepth + 1);
    }
  }

  traverse(node, 1);
  return descendants;
}

/**
 * 노드의 형제들 반환 (자기 자신 제외)
 *
 * @param nodeId - 대상 노드 ID
 * @param tree - SCT 압축 트리
 * @returns 형제 노드 배열
 */
export function getSiblings(
  nodeId: string,
  tree: CompressionTree
): SummaryNode[] {
  const node = findNodeById(nodeId, tree);
  if (!node || !node.parentId) {
    return [];
  }

  const parent = findNodeById(node.parentId, tree);
  if (!parent) {
    return [];
  }

  return parent.children.filter((child) => child.id !== nodeId);
}

// ═══════════════════════════════════════════════════════
// 경로 기반 검색
// ═══════════════════════════════════════════════════════

/**
 * 경로 패턴으로 노드 검색
 *
 * @example
 * findByPath("finance.revenue.*", tree) // finance.revenue로 시작하는 모든 노드
 * findByPath("finance.revenue", tree) // 정확히 finance.revenue인 노드
 *
 * @param pathPattern - 경로 패턴 (와일드카드 * 지원)
 * @param tree - SCT 압축 트리
 * @returns 매칭되는 노드 배열
 */
export function findByPath(
  pathPattern: string,
  tree: CompressionTree
): SummaryNode[] {
  const results: SummaryNode[] = [];

  function traverse(node: SummaryNode): void {
    if (matchPathPattern(node.path, pathPattern)) {
      results.push(node);
    }

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(tree.root);
  return results;
}

/**
 * 정확한 경로로 노드 찾기
 *
 * @param path - 정확한 경로
 * @param tree - SCT 압축 트리
 * @returns 노드 또는 null
 */
export function findByExactPath(
  path: string,
  tree: CompressionTree
): SummaryNode | null {
  function traverse(node: SummaryNode): SummaryNode | null {
    if (node.path.toLowerCase() === path.toLowerCase()) {
      return node;
    }

    for (const child of node.children) {
      const found = traverse(child);
      if (found) {
        return found;
      }
    }

    return null;
  }

  return traverse(tree.root);
}

// ═══════════════════════════════════════════════════════
// 트리 순회
// ═══════════════════════════════════════════════════════

/**
 * BFS 탐색 (토큰 예산 내)
 *
 * 너비 우선으로 탐색하며 토큰 예산 내에서 노드 수집
 *
 * @param tree - SCT 압축 트리
 * @param tokenBudget - 토큰 예산
 * @param visitor - 노드 방문 콜백 (false 반환 시 해당 노드 제외)
 * @returns 수집된 노드 배열
 */
export function traverseBFS(
  tree: CompressionTree,
  tokenBudget: number,
  visitor?: (node: SummaryNode) => boolean
): SummaryNode[] {
  const result: SummaryNode[] = [];
  let currentTokens = 0;
  const queue: SummaryNode[] = [tree.root];

  while (queue.length > 0) {
    const node = queue.shift()!;

    // visitor가 false 반환하면 스킵
    if (visitor && !visitor(node)) {
      // 자식은 계속 탐색
      queue.push(...node.children);
      continue;
    }

    // 토큰 예산 확인
    if (currentTokens + node.tokenCount > tokenBudget) {
      // 예산 초과 - 자식은 탐색 안 함
      continue;
    }

    result.push(node);
    currentTokens += node.tokenCount;

    // 자식 노드 큐에 추가
    queue.push(...node.children);
  }

  return result;
}

/**
 * DFS 탐색 (관련성 기반)
 *
 * 깊이 우선으로 탐색하며 관련성이 높은 경로를 따라감
 *
 * @param tree - SCT 압축 트리
 * @param query - 파싱된 질의
 * @param minRelevance - 최소 관련성 임계값
 * @returns 관련성 있는 노드 배열
 */
export function traverseDFS(
  tree: CompressionTree,
  query: ParsedQuery,
  minRelevance: number
): SummaryNode[] {
  const result: SummaryNode[] = [];

  function traverse(node: SummaryNode): void {
    const relevance = calculateRelevance(query, node, 'hybrid');

    if (relevance >= minRelevance) {
      result.push(node);
    }

    // 관련성이 너무 낮으면 자식 탐색 안 함 (pruning)
    if (relevance < minRelevance * 0.5) {
      return;
    }

    // 자식들을 관련성 순으로 정렬하여 탐색
    const sortedChildren = [...node.children].sort((a, b) => {
      const relA = calculateRelevance(query, a, 'hybrid');
      const relB = calculateRelevance(query, b, 'hybrid');
      return relB - relA;
    });

    for (const child of sortedChildren) {
      traverse(child);
    }
  }

  traverse(tree.root);
  return result;
}

// ═══════════════════════════════════════════════════════
// 공통 조상 찾기
// ═══════════════════════════════════════════════════════

/**
 * 여러 노드의 공통 조상 찾기
 *
 * @param nodes - 노드 배열
 * @param tree - SCT 압축 트리
 * @returns 가장 가까운 공통 조상 노드 또는 null
 */
export function findCommonAncestor(
  nodes: SummaryNode[],
  tree: CompressionTree
): SummaryNode | null {
  if (nodes.length === 0) {
    return null;
  }

  if (nodes.length === 1) {
    const node = nodes[0];
    if (!node) return null;
    if (node.parentId) {
      return findNodeById(node.parentId, tree);
    }
    return node; // root 자체
  }

  // 각 노드의 조상 경로 구하기
  const ancestorPaths: SummaryNode[][] = nodes.map((node) => {
    return [node, ...getAncestors(node.id, tree)].reverse(); // root부터 시작
  });

  // 공통 조상 찾기
  let commonAncestor: SummaryNode | null = null;
  const minLength = Math.min(...ancestorPaths.map((p) => p.length));

  for (let i = 0; i < minLength; i++) {
    const firstPath = ancestorPaths[0];
    if (!firstPath) break;

    const ancestor = firstPath[i];
    if (!ancestor) break;

    // 모든 경로에서 같은 조상인지 확인
    const allSame = ancestorPaths.every((path) => path[i]?.id === ancestor.id);

    if (allSame) {
      commonAncestor = ancestor;
    } else {
      break;
    }
  }

  return commonAncestor;
}

// ═══════════════════════════════════════════════════════
// 모든 노드 수집
// ═══════════════════════════════════════════════════════

/**
 * 트리의 모든 노드 수집
 *
 * @param tree - SCT 압축 트리
 * @returns 모든 노드 배열
 */
export function getAllNodes(tree: CompressionTree): SummaryNode[] {
  const nodes: SummaryNode[] = [];

  function traverse(node: SummaryNode): void {
    nodes.push(node);
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(tree.root);
  return nodes;
}

/**
 * 특정 깊이의 노드들 수집
 *
 * @param tree - SCT 압축 트리
 * @param depth - 목표 깊이
 * @returns 해당 깊이의 노드 배열
 */
export function getNodesAtDepth(
  tree: CompressionTree,
  depth: number
): SummaryNode[] {
  const nodes: SummaryNode[] = [];

  function traverse(node: SummaryNode): void {
    if (node.depth === depth) {
      nodes.push(node);
      return; // 더 깊이 갈 필요 없음
    }

    if (node.depth < depth) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(tree.root);
  return nodes;
}

/**
 * 리프 노드들만 수집
 *
 * @param tree - SCT 압축 트리
 * @returns 리프 노드 배열
 */
export function getLeafNodes(tree: CompressionTree): SummaryNode[] {
  const leaves: SummaryNode[] = [];

  function traverse(node: SummaryNode): void {
    if (node.children.length === 0) {
      leaves.push(node);
    } else {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(tree.root);
  return leaves;
}
