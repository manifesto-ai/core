/**
 * CQE Context Query Engine
 *
 * IContextQueryEngine 및 IAsyncContextQueryEngine 구현
 * SCT에서 관련 노드를 검색하고 RetrievedNode[]를 반환
 */

import { ok, err, type Result } from '@manifesto-ai/core';
import type { SummaryNode, CompressionTree } from '../sct/index.js';
import type { ParsedQuery, RetrievedNode } from '../reasoning/index.js';
import type {
  IContextQueryEngine,
  IAsyncContextQueryEngine,
  SearchOptions,
  RelevanceStrategy,
  CQEError,
} from './types.js';
import { DEFAULT_SEARCH_OPTIONS, createCQEError } from './types.js';
import { calculateRelevance, type RelevanceConfig } from './relevance.js';
import type { IEmbeddingProvider } from './embedding.js';
import {
  calculateHybridRelevanceAsync,
  calculateHybridRelevanceBatch,
  type EmbeddingCache,
  createEmbeddingCache,
} from './semantic.js';
import {
  findByPath,
  traverseDFS,
  findNodeById,
  getDescendants,
  getAllNodes,
} from './navigator.js';
import { toRetrievedNode, projectWithinBudget } from './projector.js';

// ═══════════════════════════════════════════════════════
// ContextQueryEngine (동기)
// ═══════════════════════════════════════════════════════

/**
 * Context Query Engine 구현 (동기)
 *
 * keyword, path, hybrid 전략 지원
 * semantic 전략은 AsyncContextQueryEngine 사용
 */
export class ContextQueryEngine implements IContextQueryEngine {
  private readonly config: Partial<SearchOptions>;
  private readonly relevanceConfig: Partial<RelevanceConfig>;

  constructor(
    config?: Partial<SearchOptions>,
    relevanceConfig?: Partial<RelevanceConfig>
  ) {
    this.config = config ?? {};
    this.relevanceConfig = relevanceConfig ?? {};
  }

  /**
   * 질의 기반 관련 노드 검색
   */
  retrieve(
    query: ParsedQuery,
    tree: CompressionTree,
    options?: Partial<SearchOptions>
  ): Result<RetrievedNode[], CQEError> {
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...this.config, ...options };

    // semantic 전략은 동기에서 지원 안 함
    if (opts.strategy === 'semantic') {
      return err(
        createCQEError(
          'INVALID_QUERY',
          'semantic strategy requires async version. Use AsyncContextQueryEngine.',
          { strategy: opts.strategy }
        )
      );
    }

    try {
      // 1. 초기 노드 집합 찾기
      let candidates: SummaryNode[] = [];

      if (query.targetPaths.length > 0) {
        // targetPaths 기반 검색
        for (const path of query.targetPaths) {
          candidates.push(...findByPath(path, tree));
        }
        // 중복 제거
        candidates = [...new Map(candidates.map((n) => [n.id, n])).values()];
      } else {
        // targetPaths 없으면 DFS로 관련 노드 탐색
        candidates = traverseDFS(tree, query, opts.minRelevance);
      }

      // 후보가 없으면 전체 노드 사용
      if (candidates.length === 0) {
        candidates = getAllNodes(tree);
      }

      // 2. 관련성 점수 계산 및 필터링
      const scored = candidates
        .map((node) => ({
          node,
          relevance: calculateRelevance(
            query,
            node,
            opts.strategy,
            this.relevanceConfig
          ),
        }))
        .filter(({ relevance }) => relevance >= opts.minRelevance)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, opts.maxResults);

      // 관련 노드 없음
      if (scored.length === 0) {
        return ok([]);
      }

      // 3. RetrievedNode로 변환
      const retrieved = scored.map(({ node, relevance }) =>
        toRetrievedNode(node, relevance)
      );

      // 4. 토큰 예산 적용
      const projected = projectWithinBudget(retrieved, opts.tokenBudget);

      return ok(projected.nodes);
    } catch (error) {
      return err(
        createCQEError(
          'INVALID_QUERY',
          error instanceof Error ? error.message : 'Unknown error',
          { error }
        )
      );
    }
  }

  /**
   * 특정 노드 확장 (자식들 검색)
   */
  expandNode(
    nodeId: string,
    tree: CompressionTree,
    query: ParsedQuery,
    options?: Partial<SearchOptions>
  ): Result<RetrievedNode[], CQEError> {
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...this.config, ...options };

    // 노드 찾기
    const node = findNodeById(nodeId, tree);
    if (!node) {
      return err(
        createCQEError('NODE_NOT_FOUND', `Node not found: ${nodeId}`, {
          nodeId,
        })
      );
    }

    // 직계 자식만 (maxDepth = 1)
    const descendants = getDescendants(nodeId, tree, 1);

    if (descendants.length === 0) {
      return ok([]);
    }

    // 관련성 점수 계산
    const scored = descendants
      .map((child) => ({
        node: child,
        relevance: calculateRelevance(
          query,
          child,
          opts.strategy === 'semantic' ? 'hybrid' : opts.strategy,
          this.relevanceConfig
        ),
      }))
      .filter(({ relevance }) => relevance >= opts.minRelevance)
      .sort((a, b) => b.relevance - a.relevance);

    // RetrievedNode로 변환
    const retrieved = scored.map(({ node: n, relevance }) =>
      toRetrievedNode(n, relevance)
    );

    return ok(retrieved);
  }

  /**
   * 단일 노드 관련성 계산
   */
  calculateRelevance(
    query: ParsedQuery,
    node: SummaryNode,
    strategy: RelevanceStrategy = 'hybrid'
  ): number {
    if (strategy === 'semantic') {
      console.warn(
        'semantic strategy requires async version. Falling back to hybrid.'
      );
      return calculateRelevance(query, node, 'hybrid', this.relevanceConfig);
    }
    return calculateRelevance(query, node, strategy, this.relevanceConfig);
  }
}

// ═══════════════════════════════════════════════════════
// AsyncContextQueryEngine (비동기 - semantic 지원)
// ═══════════════════════════════════════════════════════

/**
 * 비동기 Context Query Engine 구현
 *
 * semantic 전략 포함 모든 전략 지원
 * 임베딩 API 호출이 필요한 경우 사용
 */
export class AsyncContextQueryEngine
  implements IContextQueryEngine, IAsyncContextQueryEngine
{
  private readonly config: Partial<SearchOptions>;
  private readonly relevanceConfig: Partial<RelevanceConfig>;
  private readonly embeddingProvider: IEmbeddingProvider;
  private readonly embeddingCache: EmbeddingCache;

  constructor(
    embeddingProvider: IEmbeddingProvider,
    config?: Partial<SearchOptions>,
    relevanceConfig?: Partial<RelevanceConfig>
  ) {
    this.embeddingProvider = embeddingProvider;
    this.config = config ?? {};
    this.relevanceConfig = relevanceConfig ?? {};
    this.embeddingCache = createEmbeddingCache();
  }

  // ═══════════════════════════════════════════════════════
  // 동기 인터페이스 (IContextQueryEngine)
  // ═══════════════════════════════════════════════════════

  /**
   * 동기 검색 (semantic 제외)
   */
  retrieve(
    query: ParsedQuery,
    tree: CompressionTree,
    options?: Partial<SearchOptions>
  ): Result<RetrievedNode[], CQEError> {
    const syncEngine = new ContextQueryEngine(
      this.config,
      this.relevanceConfig
    );
    return syncEngine.retrieve(query, tree, {
      ...options,
      strategy:
        options?.strategy === 'semantic' ? 'hybrid' : options?.strategy,
    });
  }

  /**
   * 동기 노드 확장
   */
  expandNode(
    nodeId: string,
    tree: CompressionTree,
    query: ParsedQuery,
    options?: Partial<SearchOptions>
  ): Result<RetrievedNode[], CQEError> {
    const syncEngine = new ContextQueryEngine(
      this.config,
      this.relevanceConfig
    );
    return syncEngine.expandNode(nodeId, tree, query, options);
  }

  /**
   * 동기 관련성 계산
   */
  calculateRelevance(
    query: ParsedQuery,
    node: SummaryNode,
    strategy: RelevanceStrategy = 'hybrid'
  ): number {
    const syncEngine = new ContextQueryEngine(
      this.config,
      this.relevanceConfig
    );
    return syncEngine.calculateRelevance(query, node, strategy);
  }

  // ═══════════════════════════════════════════════════════
  // 비동기 인터페이스 (IAsyncContextQueryEngine)
  // ═══════════════════════════════════════════════════════

  /**
   * 비동기 검색 (semantic 포함)
   */
  async retrieveAsync(
    query: ParsedQuery,
    tree: CompressionTree,
    queryText: string,
    options?: Partial<SearchOptions>
  ): Promise<Result<RetrievedNode[], CQEError>> {
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...this.config, ...options };

    try {
      // 1. 초기 노드 집합 찾기
      let candidates: SummaryNode[] = [];

      if (query.targetPaths.length > 0) {
        for (const path of query.targetPaths) {
          candidates.push(...findByPath(path, tree));
        }
        candidates = [...new Map(candidates.map((n) => [n.id, n])).values()];
      } else {
        // semantic은 전체 노드에서 검색
        candidates = getAllNodes(tree);
      }

      if (candidates.length === 0) {
        candidates = getAllNodes(tree);
      }

      // 2. 관련성 점수 계산 (비동기)
      let scored: Array<{ node: SummaryNode; relevance: number }>;

      if (
        opts.strategy === 'semantic' ||
        (opts.strategy === 'hybrid' && this.relevanceConfig.semanticWeight)
      ) {
        // 배치로 semantic 관련성 계산
        const relevanceMap = await calculateHybridRelevanceBatch(
          query,
          candidates,
          this.embeddingProvider,
          queryText,
          this.relevanceConfig,
          this.embeddingCache
        );

        scored = candidates.map((node) => ({
          node,
          relevance: relevanceMap.get(node.id) ?? 0,
        }));
      } else {
        // 동기 계산
        scored = candidates.map((node) => ({
          node,
          relevance: calculateRelevance(
            query,
            node,
            opts.strategy,
            this.relevanceConfig
          ),
        }));
      }

      // 3. 필터링 및 정렬
      const filtered = scored
        .filter(({ relevance }) => relevance >= opts.minRelevance)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, opts.maxResults);

      if (filtered.length === 0) {
        return ok([]);
      }

      // 4. RetrievedNode로 변환
      const retrieved = filtered.map(({ node, relevance }) =>
        toRetrievedNode(node, relevance)
      );

      // 5. 토큰 예산 적용
      const projected = projectWithinBudget(retrieved, opts.tokenBudget);

      return ok(projected.nodes);
    } catch (error) {
      return err(
        createCQEError(
          'EMBEDDING_ERROR',
          error instanceof Error ? error.message : 'Embedding error',
          { error }
        )
      );
    }
  }

  /**
   * 비동기 노드 확장
   */
  async expandNodeAsync(
    nodeId: string,
    tree: CompressionTree,
    query: ParsedQuery,
    queryText: string,
    options?: Partial<SearchOptions>
  ): Promise<Result<RetrievedNode[], CQEError>> {
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...this.config, ...options };

    // 노드 찾기
    const node = findNodeById(nodeId, tree);
    if (!node) {
      return err(
        createCQEError('NODE_NOT_FOUND', `Node not found: ${nodeId}`, {
          nodeId,
        })
      );
    }

    // 직계 자식만
    const descendants = getDescendants(nodeId, tree, 1);

    if (descendants.length === 0) {
      return ok([]);
    }

    try {
      // 관련성 점수 계산
      let scored: Array<{ node: SummaryNode; relevance: number }>;

      if (opts.strategy === 'semantic' || opts.strategy === 'hybrid') {
        const relevanceMap = await calculateHybridRelevanceBatch(
          query,
          descendants,
          this.embeddingProvider,
          queryText,
          this.relevanceConfig,
          this.embeddingCache
        );

        scored = descendants.map((n) => ({
          node: n,
          relevance: relevanceMap.get(n.id) ?? 0,
        }));
      } else {
        scored = descendants.map((n) => ({
          node: n,
          relevance: calculateRelevance(
            query,
            n,
            opts.strategy,
            this.relevanceConfig
          ),
        }));
      }

      // 필터링 및 정렬
      const filtered = scored
        .filter(({ relevance }) => relevance >= opts.minRelevance)
        .sort((a, b) => b.relevance - a.relevance);

      // RetrievedNode로 변환
      const retrieved = filtered.map(({ node: n, relevance }) =>
        toRetrievedNode(n, relevance)
      );

      return ok(retrieved);
    } catch (error) {
      return err(
        createCQEError(
          'EMBEDDING_ERROR',
          error instanceof Error ? error.message : 'Embedding error',
          { error }
        )
      );
    }
  }

  /**
   * 비동기 관련성 계산
   */
  async calculateRelevanceAsync(
    query: ParsedQuery,
    node: SummaryNode,
    queryText: string,
    strategy: RelevanceStrategy = 'hybrid'
  ): Promise<number> {
    if (strategy === 'keyword' || strategy === 'path') {
      return calculateRelevance(query, node, strategy, this.relevanceConfig);
    }

    return calculateHybridRelevanceAsync(
      query,
      node,
      this.embeddingProvider,
      queryText,
      this.relevanceConfig,
      this.embeddingCache
    );
  }

  /**
   * 임베딩 캐시 클리어
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }
}

// ═══════════════════════════════════════════════════════
// 팩토리 함수
// ═══════════════════════════════════════════════════════

/**
 * 동기 Context Query Engine 생성
 *
 * @param options - 검색 옵션
 * @param relevanceConfig - 관련성 설정
 * @returns IContextQueryEngine
 */
export function createContextQueryEngine(
  options?: Partial<SearchOptions>,
  relevanceConfig?: Partial<RelevanceConfig>
): IContextQueryEngine {
  return new ContextQueryEngine(options, relevanceConfig);
}

/**
 * 비동기 Context Query Engine 생성
 *
 * @param embeddingProvider - 임베딩 제공자
 * @param options - 검색 옵션
 * @param relevanceConfig - 관련성 설정
 * @returns AsyncContextQueryEngine
 */
export function createAsyncContextQueryEngine(
  embeddingProvider: IEmbeddingProvider,
  options?: Partial<SearchOptions>,
  relevanceConfig?: Partial<RelevanceConfig>
): AsyncContextQueryEngine {
  return new AsyncContextQueryEngine(
    embeddingProvider,
    options,
    relevanceConfig
  );
}
