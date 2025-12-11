/**
 * CQE Relevance Calculation
 *
 * 질의와 노드 간의 관련성을 계산하는 함수들
 * - keyword: 키워드 매칭 기반
 * - path: 경로 오버랩 기반
 * - hybrid: 복합 계산
 */

import type { ParsedQuery } from '../reasoning/index.js';
import type { SummaryNode } from '../sct/index.js';
import type { RelevanceStrategy } from './types.js';

// ═══════════════════════════════════════════════════════
// Relevance Config
// ═══════════════════════════════════════════════════════

/**
 * 관련성 계산 설정
 */
export type RelevanceConfig = {
  /** 키워드 매칭 가중치 (기본 0.4) */
  keywordWeight: number;
  /** 경로 매칭 가중치 (기본 0.2) */
  pathWeight: number;
  /** 의미 유사도 가중치 (기본 0.4) */
  semanticWeight: number;
  /** 깊이 페널티 (기본 0.05) - 깊은 노드일수록 점수 감소 */
  depthPenalty: number;
  /** 정확한 매칭 보너스 (기본 0.2) */
  exactMatchBonus: number;
};

export const DEFAULT_RELEVANCE_CONFIG: RelevanceConfig = {
  keywordWeight: 0.4,
  pathWeight: 0.2,
  semanticWeight: 0.4,
  depthPenalty: 0.05,
  exactMatchBonus: 0.2,
};

// ═══════════════════════════════════════════════════════
// 키워드 기반 관련성
// ═══════════════════════════════════════════════════════

/**
 * 질의에서 키워드 추출
 * targetPaths와 constraints에서 키워드 추출
 */
export function extractQueryKeywords(query: ParsedQuery): string[] {
  const keywords: string[] = [];

  // targetPaths에서 키워드 추출 (경로 세그먼트)
  for (const path of query.targetPaths) {
    const segments = path.split('.');
    keywords.push(...segments.filter((s) => s !== '*' && s.length > 0));
  }

  // constraints에서 키워드 추출
  for (const constraint of query.constraints) {
    keywords.push(constraint.field);
    if (typeof constraint.value === 'string') {
      keywords.push(constraint.value);
    }
  }

  // 중복 제거 및 소문자 변환
  return [...new Set(keywords.map((k) => k.toLowerCase()))];
}

/**
 * 키워드 매칭 점수 계산
 *
 * - 정확한 키워드 매칭: +2점
 * - 부분 매칭: +1점
 * - 결과를 0-1로 정규화
 *
 * @param query - 파싱된 질의
 * @param node - SCT 노드
 * @param config - 관련성 설정
 * @returns 0-1 범위의 관련성 점수
 */
export function calculateKeywordRelevance(
  query: ParsedQuery,
  node: SummaryNode,
  config: Partial<RelevanceConfig> = {}
): number {
  const fullConfig = { ...DEFAULT_RELEVANCE_CONFIG, ...config };
  const queryKeywords = extractQueryKeywords(query);

  if (queryKeywords.length === 0) {
    return 0;
  }

  const nodeKeywords = node.keywords.map((k) => k.toLowerCase());
  let score = 0;
  let maxPossibleScore = queryKeywords.length * 2; // 정확한 매칭이면 2점

  for (const qk of queryKeywords) {
    // 정확한 매칭
    if (nodeKeywords.includes(qk)) {
      score += 2;
      continue;
    }

    // 부분 매칭 (노드 키워드가 질의 키워드를 포함하거나 그 반대)
    const hasPartialMatch = nodeKeywords.some(
      (nk) => nk.includes(qk) || qk.includes(nk)
    );
    if (hasPartialMatch) {
      score += 1;
    }
  }

  // summary에서 키워드 추가 검색
  const summaryLower = node.summary.toLowerCase();
  for (const qk of queryKeywords) {
    if (summaryLower.includes(qk)) {
      score += 0.5;
      maxPossibleScore += 0.5;
    }
  }

  // 정규화 (0-1)
  const normalizedScore = maxPossibleScore > 0 ? score / maxPossibleScore : 0;

  // 정확한 매칭 보너스 (모든 키워드가 매칭되면)
  const allExactMatch = queryKeywords.every((qk) => nodeKeywords.includes(qk));
  if (allExactMatch && queryKeywords.length > 0) {
    return Math.min(1, normalizedScore + fullConfig.exactMatchBonus);
  }

  return Math.min(1, normalizedScore);
}

// ═══════════════════════════════════════════════════════
// 경로 기반 관련성
// ═══════════════════════════════════════════════════════

/**
 * 두 경로 간 오버랩 점수 계산
 *
 * @example
 * pathOverlap("finance.revenue.q3", "finance.revenue") // → 0.67
 * pathOverlap("finance.revenue", "finance.revenue") // → 1.0
 * pathOverlap("finance", "marketing") // → 0
 *
 * @param path1 - 첫 번째 경로
 * @param path2 - 두 번째 경로
 * @returns 0-1 범위의 오버랩 점수
 */
export function pathOverlap(path1: string, path2: string): number {
  const segments1 = path1.split('.').filter((s) => s.length > 0);
  const segments2 = path2.split('.').filter((s) => s.length > 0);

  if (segments1.length === 0 || segments2.length === 0) {
    return 0;
  }

  // 공통 prefix 길이 계산
  let commonLength = 0;
  const minLength = Math.min(segments1.length, segments2.length);

  for (let i = 0; i < minLength; i++) {
    if (segments1[i]?.toLowerCase() === segments2[i]?.toLowerCase()) {
      commonLength++;
    } else {
      break;
    }
  }

  // 오버랩 비율 (긴 경로 기준)
  const maxLength = Math.max(segments1.length, segments2.length);
  return commonLength / maxLength;
}

/**
 * 와일드카드 경로 매칭
 *
 * @example
 * matchPathPattern("finance.revenue.q3", "finance.*") // → true
 * matchPathPattern("finance.revenue.q3", "finance.revenue.*") // → true
 * matchPathPattern("marketing.budget", "finance.*") // → false
 *
 * @param path - 대상 경로
 * @param pattern - 와일드카드 패턴
 * @returns 매칭 여부
 */
export function matchPathPattern(path: string, pattern: string): boolean {
  const pathSegments = path.split('.').filter((s) => s.length > 0);
  const patternSegments = pattern.split('.').filter((s) => s.length > 0);

  for (let i = 0; i < patternSegments.length; i++) {
    const patternSeg = patternSegments[i];

    // 와일드카드 - 나머지 모두 매칭
    if (patternSeg === '*') {
      return true;
    }

    // 경로가 패턴보다 짧으면 매칭 실패
    if (i >= pathSegments.length) {
      return false;
    }

    // 세그먼트 비교
    if (patternSeg?.toLowerCase() !== pathSegments[i]?.toLowerCase()) {
      return false;
    }
  }

  // 패턴이 와일드카드로 끝나지 않으면 길이도 맞아야 함
  return pathSegments.length === patternSegments.length;
}

/**
 * 경로 오버랩 점수 계산
 *
 * @param query - 파싱된 질의
 * @param node - SCT 노드
 * @param config - 관련성 설정
 * @returns 0-1 범위의 관련성 점수
 */
export function calculatePathRelevance(
  query: ParsedQuery,
  node: SummaryNode,
  config: Partial<RelevanceConfig> = {}
): number {
  const fullConfig = { ...DEFAULT_RELEVANCE_CONFIG, ...config };

  if (query.targetPaths.length === 0) {
    return 0;
  }

  let maxScore = 0;

  for (const targetPath of query.targetPaths) {
    // 와일드카드 패턴 매칭
    if (targetPath.includes('*')) {
      if (matchPathPattern(node.path, targetPath)) {
        maxScore = Math.max(maxScore, 0.8); // 와일드카드 매칭은 0.8점
      }
    } else {
      // 정확한 경로 오버랩
      const overlap = pathOverlap(node.path, targetPath);
      maxScore = Math.max(maxScore, overlap);
    }
  }

  // 정확한 매칭 보너스
  const exactMatch = query.targetPaths.some(
    (p) => p.toLowerCase() === node.path.toLowerCase()
  );
  if (exactMatch) {
    return Math.min(1, maxScore + fullConfig.exactMatchBonus);
  }

  return maxScore;
}

// ═══════════════════════════════════════════════════════
// 복합 관련성
// ═══════════════════════════════════════════════════════

/**
 * 하이브리드 관련성 계산 (동기)
 *
 * keyword와 path 점수만 사용 (semantic 제외)
 * hybrid = keywordWeight * keyword + pathWeight * path
 *
 * @param query - 파싱된 질의
 * @param node - SCT 노드
 * @param config - 관련성 설정
 * @returns 0-1 범위의 관련성 점수
 */
export function calculateHybridRelevance(
  query: ParsedQuery,
  node: SummaryNode,
  config: Partial<RelevanceConfig> = {}
): number {
  const fullConfig = { ...DEFAULT_RELEVANCE_CONFIG, ...config };

  const keywordScore = calculateKeywordRelevance(query, node, config);
  const pathScore = calculatePathRelevance(query, node, config);

  // semantic 제외한 가중치 재계산
  const totalWeight = fullConfig.keywordWeight + fullConfig.pathWeight;
  const normalizedKeywordWeight = fullConfig.keywordWeight / totalWeight;
  const normalizedPathWeight = fullConfig.pathWeight / totalWeight;

  let score =
    normalizedKeywordWeight * keywordScore + normalizedPathWeight * pathScore;

  // 깊이 페널티 적용
  const depthPenalty = node.depth * fullConfig.depthPenalty;
  score = Math.max(0, score - depthPenalty);

  return Math.min(1, score);
}

/**
 * 전략에 따른 관련성 계산 (동기)
 *
 * semantic 전략은 지원하지 않음 (calculateRelevanceAsync 사용)
 *
 * @param query - 파싱된 질의
 * @param node - SCT 노드
 * @param strategy - 관련성 계산 전략
 * @param config - 관련성 설정
 * @returns 0-1 범위의 관련성 점수
 */
export function calculateRelevance(
  query: ParsedQuery,
  node: SummaryNode,
  strategy: RelevanceStrategy = 'hybrid',
  config: Partial<RelevanceConfig> = {}
): number {
  switch (strategy) {
    case 'keyword':
      return calculateKeywordRelevance(query, node, config);
    case 'path':
      return calculatePathRelevance(query, node, config);
    case 'semantic':
      // semantic은 비동기만 지원, 동기에서는 0 반환
      console.warn(
        'semantic strategy requires async version. Use calculateRelevanceAsync instead.'
      );
      return 0;
    case 'hybrid':
    default:
      return calculateHybridRelevance(query, node, config);
  }
}
