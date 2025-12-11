/**
 * CQE (Context Query Engine) Types
 *
 * SCT 트리에서 관련 노드를 검색하기 위한 타입 정의
 */

import { z } from 'zod';
import type { Result } from '@manifesto-ai/core';
import type { SummaryNode, CompressionTree } from '../sct/index.js';
import type { ParsedQuery, RetrievedNode } from '../reasoning/index.js';

// ═══════════════════════════════════════════════════════
// Relevance Strategy
// ═══════════════════════════════════════════════════════

/**
 * 관련성 계산 전략
 * - keyword: 키워드 매칭 기반
 * - path: 경로 오버랩 기반
 * - semantic: 임베딩 기반 의미 유사도
 * - hybrid: keyword + path + semantic 조합
 */
export const RelevanceStrategySchema = z.enum([
  'keyword',
  'path',
  'semantic',
  'hybrid',
]);

export type RelevanceStrategy = z.infer<typeof RelevanceStrategySchema>;

// ═══════════════════════════════════════════════════════
// Search Options
// ═══════════════════════════════════════════════════════

/**
 * 검색 옵션
 */
export type SearchOptions = {
  /** 관련성 계산 전략 */
  strategy: RelevanceStrategy;
  /** 최대 결과 수 */
  maxResults: number;
  /** 최소 관련성 임계값 (0-1) */
  minRelevance: number;
  /** 토큰 예산 */
  tokenBudget: number;
  /** 조상 노드 포함 여부 */
  includeAncestors: boolean;
  /** 탐색 깊이 제한 (undefined = 무제한) */
  maxDepth?: number;
};

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  strategy: 'hybrid',
  maxResults: 10,
  minRelevance: 0.1,
  tokenBudget: 4000,
  includeAncestors: true,
  maxDepth: undefined,
};

// ═══════════════════════════════════════════════════════
// Projection Options
// ═══════════════════════════════════════════════════════

/**
 * 프로젝션 옵션
 */
export type ProjectionOptions = {
  /** 포함할 경로들 (viewScope) */
  viewScope: string[];
  /** 토큰 예산 */
  tokenBudget: number;
  /** 정렬 기준 */
  sortBy: 'relevance' | 'depth' | 'tokenCount';
};

export const DEFAULT_PROJECTION_OPTIONS: ProjectionOptions = {
  viewScope: [],
  tokenBudget: 4000,
  sortBy: 'relevance',
};

// ═══════════════════════════════════════════════════════
// CQE Errors
// ═══════════════════════════════════════════════════════

/**
 * CQE 에러 코드
 */
export type CQEErrorCode =
  | 'INVALID_QUERY'
  | 'TREE_NOT_FOUND'
  | 'NODE_NOT_FOUND'
  | 'TOKEN_BUDGET_EXCEEDED'
  | 'NO_RELEVANT_NODES'
  | 'EMBEDDING_ERROR';

/**
 * CQE 에러
 */
export type CQEError = {
  code: CQEErrorCode;
  message: string;
  details?: unknown;
};

/**
 * CQE 에러 생성 헬퍼
 */
export function createCQEError(
  code: CQEErrorCode,
  message: string,
  details?: unknown
): CQEError {
  return { code, message, details };
}

// ═══════════════════════════════════════════════════════
// IContextQueryEngine Interface
// ═══════════════════════════════════════════════════════

/**
 * Context Query Engine 인터페이스
 *
 * ParsedQuery를 받아 SCT에서 관련 노드를 검색하고
 * RetrievedNode[]를 반환하는 핵심 엔진
 */
export interface IContextQueryEngine {
  /**
   * 질의를 기반으로 SCT에서 관련 노드 검색
   *
   * @param query - 파싱된 질의
   * @param tree - SCT 압축 트리
   * @param options - 검색 옵션
   * @returns 관련 노드 배열 또는 에러
   */
  retrieve(
    query: ParsedQuery,
    tree: CompressionTree,
    options?: Partial<SearchOptions>
  ): Result<RetrievedNode[], CQEError>;

  /**
   * 특정 노드 확장 (자식 노드들 검색)
   *
   * @param nodeId - 확장할 노드 ID
   * @param tree - SCT 압축 트리
   * @param query - 파싱된 질의 (관련성 계산용)
   * @param options - 검색 옵션
   * @returns 자식 노드 배열 또는 에러
   */
  expandNode(
    nodeId: string,
    tree: CompressionTree,
    query: ParsedQuery,
    options?: Partial<SearchOptions>
  ): Result<RetrievedNode[], CQEError>;

  /**
   * 단일 노드의 관련성 점수 계산
   *
   * @param query - 파싱된 질의
   * @param node - SCT 노드
   * @param strategy - 관련성 계산 전략
   * @returns 0-1 범위의 관련성 점수
   */
  calculateRelevance(
    query: ParsedQuery,
    node: SummaryNode,
    strategy?: RelevanceStrategy
  ): number;
}

// ═══════════════════════════════════════════════════════
// Async Engine Interface (Semantic 지원)
// ═══════════════════════════════════════════════════════

/**
 * 비동기 Context Query Engine 인터페이스
 *
 * semantic 전략 사용 시 임베딩 API 호출이 필요하므로
 * 비동기 버전의 인터페이스 제공
 */
export interface IAsyncContextQueryEngine {
  /**
   * 질의를 기반으로 SCT에서 관련 노드 검색 (비동기)
   */
  retrieveAsync(
    query: ParsedQuery,
    tree: CompressionTree,
    queryText: string,
    options?: Partial<SearchOptions>
  ): Promise<Result<RetrievedNode[], CQEError>>;

  /**
   * 특정 노드 확장 (비동기)
   */
  expandNodeAsync(
    nodeId: string,
    tree: CompressionTree,
    query: ParsedQuery,
    queryText: string,
    options?: Partial<SearchOptions>
  ): Promise<Result<RetrievedNode[], CQEError>>;

  /**
   * 단일 노드의 관련성 점수 계산 (비동기)
   */
  calculateRelevanceAsync(
    query: ParsedQuery,
    node: SummaryNode,
    queryText: string,
    strategy?: RelevanceStrategy
  ): Promise<number>;
}
