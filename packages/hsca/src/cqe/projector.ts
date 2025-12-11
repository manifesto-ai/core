/**
 * CQE Context Projector
 *
 * viewScope 기반 컨텍스트 프로젝션
 * - toRetrievedNode: SummaryNode → RetrievedNode 변환
 * - projectWithinBudget: 토큰 예산 내 프로젝션
 * - formatForLLM: LLM 프롬프트용 포맷
 */

import type { SummaryNode } from '../sct/index.js';
import type { RetrievedNode, ReasoningState } from '../reasoning/index.js';
import type { ProjectionOptions } from './types.js';
import { DEFAULT_PROJECTION_OPTIONS } from './types.js';

// ═══════════════════════════════════════════════════════
// Projected Context
// ═══════════════════════════════════════════════════════

/**
 * 프로젝션된 컨텍스트
 */
export type ProjectedContext = {
  /** 프로젝션된 노드들 */
  nodes: RetrievedNode[];
  /** 총 토큰 수 */
  totalTokens: number;
  /** 예산 초과로 잘렸는지 */
  truncated: boolean;
  /** 포함된 경로들 */
  includedPaths: string[];
  /** 제외된 경로들 */
  excludedPaths: string[];
};

// ═══════════════════════════════════════════════════════
// 노드 변환
// ═══════════════════════════════════════════════════════

/**
 * SummaryNode → RetrievedNode 변환
 *
 * @param node - SCT 노드
 * @param relevance - 관련성 점수 (0-1)
 * @returns RetrievedNode
 */
export function toRetrievedNode(
  node: SummaryNode,
  relevance: number
): RetrievedNode {
  return {
    nodeId: node.id,
    level: node.depth,
    summary: node.summary,
    relevance: Math.min(1, Math.max(0, relevance)),
    tokenCount: node.tokenCount,
    semanticPaths: [node.path],
  };
}

/**
 * RetrievedNode 배열을 관련성 순으로 정렬
 *
 * @param nodes - 노드 배열
 * @param ascending - 오름차순 여부 (기본: false = 내림차순)
 * @returns 정렬된 노드 배열
 */
export function sortByRelevance(
  nodes: RetrievedNode[],
  ascending: boolean = false
): RetrievedNode[] {
  return [...nodes].sort((a, b) =>
    ascending ? a.relevance - b.relevance : b.relevance - a.relevance
  );
}

/**
 * RetrievedNode 배열을 깊이 순으로 정렬
 *
 * @param nodes - 노드 배열
 * @param ascending - 오름차순 여부 (기본: true = 얕은 노드 먼저)
 * @returns 정렬된 노드 배열
 */
export function sortByDepth(
  nodes: RetrievedNode[],
  ascending: boolean = true
): RetrievedNode[] {
  return [...nodes].sort((a, b) =>
    ascending ? a.level - b.level : b.level - a.level
  );
}

// ═══════════════════════════════════════════════════════
// viewScope 기반 필터링
// ═══════════════════════════════════════════════════════

/**
 * viewScope 기반 노드 필터링
 *
 * viewScope 경로와 매칭되는 노드만 포함
 *
 * @example
 * filterByViewScope(nodes, ['state.retrievedContext'])
 * // → 모든 노드 포함 (retrievedContext 전체)
 *
 * filterByViewScope(nodes, ['finance.*'])
 * // → finance로 시작하는 경로의 노드만 포함
 *
 * @param nodes - 노드 배열
 * @param viewScope - viewScope 경로 배열
 * @returns 필터링된 노드 배열
 */
export function filterByViewScope(
  nodes: RetrievedNode[],
  viewScope: string[]
): RetrievedNode[] {
  // viewScope가 비어있으면 빈 배열 반환
  if (viewScope.length === 0) {
    return [];
  }

  // 'state.retrievedContext' 같은 전체 포함 패턴 확인
  const includesAll = viewScope.some(
    (scope) =>
      scope.includes('retrievedContext') ||
      scope.includes('context') ||
      scope === '*'
  );

  if (includesAll) {
    return nodes;
  }

  // 경로 패턴 매칭
  return nodes.filter((node) =>
    viewScope.some((scope) => {
      // 와일드카드 처리
      if (scope.endsWith('.*')) {
        const prefix = scope.slice(0, -2);
        return node.semanticPaths.some((path) =>
          path.toLowerCase().startsWith(prefix.toLowerCase())
        );
      }
      // 정확한 매칭
      return node.semanticPaths.some(
        (path) => path.toLowerCase() === scope.toLowerCase()
      );
    })
  );
}

// ═══════════════════════════════════════════════════════
// 토큰 예산 프로젝션
// ═══════════════════════════════════════════════════════

/**
 * 토큰 예산 내로 프로젝션
 *
 * 관련성 높은 노드를 우선으로 토큰 예산 내에서 선택
 *
 * @param nodes - 노드 배열
 * @param tokenBudget - 토큰 예산
 * @param sortBy - 정렬 기준 ('relevance' | 'depth')
 * @returns ProjectedContext
 */
export function projectWithinBudget(
  nodes: RetrievedNode[],
  tokenBudget: number,
  sortBy: 'relevance' | 'depth' = 'relevance'
): ProjectedContext {
  // 정렬
  const sortedNodes =
    sortBy === 'relevance' ? sortByRelevance(nodes) : sortByDepth(nodes);

  const selected: RetrievedNode[] = [];
  const excluded: RetrievedNode[] = [];
  let totalTokens = 0;

  for (const node of sortedNodes) {
    if (totalTokens + node.tokenCount <= tokenBudget) {
      selected.push(node);
      totalTokens += node.tokenCount;
    } else {
      excluded.push(node);
    }
  }

  return {
    nodes: selected,
    totalTokens,
    truncated: excluded.length > 0,
    includedPaths: [...new Set(selected.flatMap((n) => n.semanticPaths))],
    excludedPaths: [...new Set(excluded.flatMap((n) => n.semanticPaths))],
  };
}

/**
 * 전체 상태에서 viewScope에 해당하는 부분만 추출
 *
 * @param state - 추론 상태
 * @param viewScope - viewScope 경로 배열
 * @param tokenBudget - 토큰 예산
 * @returns ProjectedContext
 */
export function projectState(
  state: ReasoningState,
  viewScope: string[],
  tokenBudget: number
): ProjectedContext {
  // viewScope가 비어있으면 빈 프로젝션 반환
  if (viewScope.length === 0) {
    return {
      nodes: [],
      totalTokens: 0,
      truncated: false,
      includedPaths: [],
      excludedPaths: [],
    };
  }

  // retrievedContext에서 노드 필터링
  const filteredNodes = filterByViewScope(state.retrievedContext, viewScope);

  // 토큰 예산 적용
  return projectWithinBudget(filteredNodes, tokenBudget);
}

// ═══════════════════════════════════════════════════════
// LLM 프롬프트 포맷
// ═══════════════════════════════════════════════════════

/**
 * 노드들을 LLM 프롬프트용 마크다운으로 변환
 *
 * @param projected - 프로젝션된 컨텍스트
 * @returns 마크다운 문자열
 */
export function formatAsMarkdown(projected: ProjectedContext): string {
  if (projected.nodes.length === 0) {
    return '*컨텍스트 없음*';
  }

  const lines: string[] = ['## 관련 컨텍스트', ''];

  for (const node of projected.nodes) {
    const paths = node.semanticPaths.join(', ');
    const relevancePercent = (node.relevance * 100).toFixed(1);

    lines.push(`### [${paths}] (관련성: ${relevancePercent}%)`);
    lines.push('');
    lines.push(node.summary);
    lines.push('');
  }

  // 메타 정보
  lines.push('---');
  lines.push(
    `*총 ${projected.nodes.length}개 노드, ${projected.totalTokens} 토큰*`
  );

  if (projected.truncated) {
    lines.push(`*토큰 예산 초과로 일부 제외됨*`);
  }

  return lines.join('\n');
}

/**
 * 노드들을 LLM 프롬프트용 JSON으로 변환
 *
 * @param projected - 프로젝션된 컨텍스트
 * @returns JSON 문자열
 */
export function formatAsJSON(projected: ProjectedContext): string {
  const data = {
    nodes: projected.nodes.map((node) => ({
      path: node.semanticPaths[0],
      relevance: node.relevance,
      summary: node.summary,
    })),
    meta: {
      totalNodes: projected.nodes.length,
      totalTokens: projected.totalTokens,
      truncated: projected.truncated,
    },
  };

  return JSON.stringify(data, null, 2);
}

/**
 * 노드들을 LLM 프롬프트용 평문으로 변환
 *
 * @param projected - 프로젝션된 컨텍스트
 * @returns 평문 문자열
 */
export function formatAsPlain(projected: ProjectedContext): string {
  if (projected.nodes.length === 0) {
    return '관련 컨텍스트 없음';
  }

  const lines: string[] = [];

  for (const node of projected.nodes) {
    const paths = node.semanticPaths.join(', ');
    lines.push(`[${paths}]`);
    lines.push(node.summary);
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * 노드들을 LLM 프롬프트용 텍스트로 변환
 *
 * @param projected - 프로젝션된 컨텍스트
 * @param format - 출력 형식
 * @returns 포맷된 문자열
 */
export function formatForLLM(
  projected: ProjectedContext,
  format: 'markdown' | 'json' | 'plain' = 'markdown'
): string {
  switch (format) {
    case 'json':
      return formatAsJSON(projected);
    case 'plain':
      return formatAsPlain(projected);
    case 'markdown':
    default:
      return formatAsMarkdown(projected);
  }
}

// ═══════════════════════════════════════════════════════
// 프로젝션 유틸리티
// ═══════════════════════════════════════════════════════

/**
 * 프로젝션 옵션 적용
 *
 * @param nodes - 노드 배열
 * @param options - 프로젝션 옵션
 * @returns ProjectedContext
 */
export function applyProjectionOptions(
  nodes: RetrievedNode[],
  options: Partial<ProjectionOptions> = {}
): ProjectedContext {
  const opts = { ...DEFAULT_PROJECTION_OPTIONS, ...options };

  // viewScope 필터링
  let filtered = filterByViewScope(nodes, opts.viewScope);

  // viewScope가 비어있지 않은데 필터링 결과가 비어있으면 전체 사용
  if (filtered.length === 0 && opts.viewScope.length === 0) {
    filtered = nodes;
  }

  // 토큰 예산 적용
  return projectWithinBudget(filtered, opts.tokenBudget, opts.sortBy);
}

/**
 * 프로젝션 통계 계산
 *
 * @param projected - 프로젝션된 컨텍스트
 * @returns 통계 객체
 */
export function getProjectionStats(projected: ProjectedContext): {
  nodeCount: number;
  totalTokens: number;
  avgRelevance: number;
  maxRelevance: number;
  minRelevance: number;
  truncated: boolean;
} {
  if (projected.nodes.length === 0) {
    return {
      nodeCount: 0,
      totalTokens: 0,
      avgRelevance: 0,
      maxRelevance: 0,
      minRelevance: 0,
      truncated: projected.truncated,
    };
  }

  const relevances = projected.nodes.map((n) => n.relevance);
  const avgRelevance =
    relevances.reduce((a, b) => a + b, 0) / relevances.length;

  return {
    nodeCount: projected.nodes.length,
    totalTokens: projected.totalTokens,
    avgRelevance,
    maxRelevance: Math.max(...relevances),
    minRelevance: Math.min(...relevances),
    truncated: projected.truncated,
  };
}
