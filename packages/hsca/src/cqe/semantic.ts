/**
 * CQE Semantic Similarity
 *
 * 임베딩 기반 의미 유사도 계산
 * - cosineSimilarity: 코사인 유사도 계산
 * - calculateSemanticRelevance: 노드 의미 관련성 계산
 * - calculateSemanticRelevanceBatch: 배치 처리
 */

import type { SummaryNode } from '../sct/index.js';
import type { ParsedQuery } from '../reasoning/index.js';
import type { IEmbeddingProvider } from './embedding.js';
import {
  calculateKeywordRelevance,
  calculatePathRelevance,
  type RelevanceConfig,
  DEFAULT_RELEVANCE_CONFIG,
} from './relevance.js';

// ═══════════════════════════════════════════════════════
// 코사인 유사도
// ═══════════════════════════════════════════════════════

/**
 * 두 벡터의 코사인 유사도 계산
 *
 * cosine_similarity = (A · B) / (||A|| × ||B||)
 *
 * @param vec1 - 첫 번째 벡터
 * @param vec2 - 두 번째 벡터
 * @returns 0-1 범위의 유사도 (음수는 0으로 처리)
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error(
      `Vector dimensions mismatch: ${vec1.length} vs ${vec2.length}`
    );
  }

  if (vec1.length === 0) {
    return 0;
  }

  // 내적 계산
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    const v1 = vec1[i] ?? 0;
    const v2 = vec2[i] ?? 0;
    dotProduct += v1 * v2;
    magnitude1 += v1 * v1;
    magnitude2 += v2 * v2;
  }

  // 크기 계산
  const mag1 = Math.sqrt(magnitude1);
  const mag2 = Math.sqrt(magnitude2);

  // 0으로 나누기 방지
  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  // 유사도 계산 및 0-1 범위로 클램프
  const similarity = dotProduct / (mag1 * mag2);
  return Math.max(0, Math.min(1, similarity));
}

/**
 * 유클리드 거리 기반 유사도 계산
 *
 * similarity = 1 / (1 + distance)
 *
 * @param vec1 - 첫 번째 벡터
 * @param vec2 - 두 번째 벡터
 * @returns 0-1 범위의 유사도
 */
export function euclideanSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error(
      `Vector dimensions mismatch: ${vec1.length} vs ${vec2.length}`
    );
  }

  if (vec1.length === 0) {
    return 0;
  }

  // 유클리드 거리 계산
  let sumSquares = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = (vec1[i] ?? 0) - (vec2[i] ?? 0);
    sumSquares += diff * diff;
  }

  const distance = Math.sqrt(sumSquares);

  // 거리를 유사도로 변환
  return 1 / (1 + distance);
}

// ═══════════════════════════════════════════════════════
// 임베딩 캐시
// ═══════════════════════════════════════════════════════

/**
 * 임베딩 캐시 타입
 */
export type EmbeddingCache = Map<string, number[]>;

/**
 * 새 임베딩 캐시 생성
 */
export function createEmbeddingCache(): EmbeddingCache {
  return new Map();
}

/**
 * 캐시된 임베딩 조회 또는 생성
 *
 * @param text - 임베딩할 텍스트
 * @param provider - 임베딩 제공자
 * @param cache - 임베딩 캐시 (선택적)
 * @returns 임베딩 벡터
 */
export async function getOrCreateEmbedding(
  text: string,
  provider: IEmbeddingProvider,
  cache?: EmbeddingCache
): Promise<number[]> {
  // 캐시 확인
  if (cache) {
    const cached = cache.get(text);
    if (cached) {
      return cached;
    }
  }

  // 새 임베딩 생성
  const embedding = await provider.embed(text);

  // 캐시에 저장
  if (cache) {
    cache.set(text, embedding);
  }

  return embedding;
}

// ═══════════════════════════════════════════════════════
// 의미 관련성 계산
// ═══════════════════════════════════════════════════════

/**
 * 의미 유사도 기반 관련성 계산
 *
 * query 텍스트와 node summary의 임베딩을 비교하여
 * 코사인 유사도를 반환
 *
 * @param queryText - 질의 텍스트
 * @param node - SCT 노드
 * @param provider - 임베딩 제공자
 * @param cache - 임베딩 캐시 (선택적)
 * @returns 0-1 범위의 관련성 점수
 */
export async function calculateSemanticRelevance(
  queryText: string,
  node: SummaryNode,
  provider: IEmbeddingProvider,
  cache?: EmbeddingCache
): Promise<number> {
  // 질의와 노드 summary의 임베딩 생성
  const [queryEmbedding, nodeEmbedding] = await Promise.all([
    getOrCreateEmbedding(queryText, provider, cache),
    getOrCreateEmbedding(node.summary, provider, cache),
  ]);

  // 코사인 유사도 계산
  return cosineSimilarity(queryEmbedding, nodeEmbedding);
}

/**
 * 배치 의미 관련성 계산
 *
 * 여러 노드에 대해 효율적으로 관련성 계산
 * query 임베딩을 한 번만 생성하여 재사용
 *
 * @param queryText - 질의 텍스트
 * @param nodes - SCT 노드 배열
 * @param provider - 임베딩 제공자
 * @param cache - 임베딩 캐시 (선택적)
 * @returns nodeId → relevance 매핑
 */
export async function calculateSemanticRelevanceBatch(
  queryText: string,
  nodes: SummaryNode[],
  provider: IEmbeddingProvider,
  cache?: EmbeddingCache
): Promise<Map<string, number>> {
  if (nodes.length === 0) {
    return new Map();
  }

  // 질의 임베딩 생성 (캐시 사용)
  const queryEmbedding = await getOrCreateEmbedding(queryText, provider, cache);

  // 노드 summary 텍스트들 수집 (중복 제거)
  const uniqueSummaries = [...new Set(nodes.map((n) => n.summary))];

  // 캐시에 없는 summary만 배치 임베딩
  const uncachedSummaries = cache
    ? uniqueSummaries.filter((s) => !cache.has(s))
    : uniqueSummaries;

  if (uncachedSummaries.length > 0) {
    const embeddings = await provider.embedBatch(uncachedSummaries);

    // 캐시에 저장
    if (cache) {
      for (let i = 0; i < uncachedSummaries.length; i++) {
        const summary = uncachedSummaries[i];
        const embedding = embeddings[i];
        if (summary && embedding) {
          cache.set(summary, embedding);
        }
      }
    }
  }

  // 각 노드의 관련성 계산
  const result = new Map<string, number>();

  for (const node of nodes) {
    const nodeEmbedding = await getOrCreateEmbedding(
      node.summary,
      provider,
      cache
    );
    const similarity = cosineSimilarity(queryEmbedding, nodeEmbedding);
    result.set(node.id, similarity);
  }

  return result;
}

// ═══════════════════════════════════════════════════════
// 복합 관련성 (비동기)
// ═══════════════════════════════════════════════════════

/**
 * 하이브리드 관련성 계산 (비동기 - semantic 포함)
 *
 * hybrid = keywordWeight * keyword + pathWeight * path + semanticWeight * semantic
 *
 * @param query - 파싱된 질의
 * @param node - SCT 노드
 * @param provider - 임베딩 제공자
 * @param queryText - 원본 질의 텍스트
 * @param config - 관련성 설정
 * @param cache - 임베딩 캐시 (선택적)
 * @returns 0-1 범위의 관련성 점수
 */
export async function calculateHybridRelevanceAsync(
  query: ParsedQuery,
  node: SummaryNode,
  provider: IEmbeddingProvider,
  queryText: string,
  config: Partial<RelevanceConfig> = {},
  cache?: EmbeddingCache
): Promise<number> {
  const fullConfig = { ...DEFAULT_RELEVANCE_CONFIG, ...config };

  // 동기 점수 계산
  const keywordScore = calculateKeywordRelevance(query, node, config);
  const pathScore = calculatePathRelevance(query, node, config);

  // 비동기 semantic 점수 계산
  const semanticScore = await calculateSemanticRelevance(
    queryText,
    node,
    provider,
    cache
  );

  // 가중 합계
  const totalWeight =
    fullConfig.keywordWeight +
    fullConfig.pathWeight +
    fullConfig.semanticWeight;

  let score =
    (fullConfig.keywordWeight * keywordScore +
      fullConfig.pathWeight * pathScore +
      fullConfig.semanticWeight * semanticScore) /
    totalWeight;

  // 깊이 페널티 적용
  const depthPenalty = node.depth * fullConfig.depthPenalty;
  score = Math.max(0, score - depthPenalty);

  return Math.min(1, score);
}

/**
 * 배치 하이브리드 관련성 계산 (비동기)
 *
 * @param query - 파싱된 질의
 * @param nodes - SCT 노드 배열
 * @param provider - 임베딩 제공자
 * @param queryText - 원본 질의 텍스트
 * @param config - 관련성 설정
 * @param cache - 임베딩 캐시 (선택적)
 * @returns nodeId → relevance 매핑
 */
export async function calculateHybridRelevanceBatch(
  query: ParsedQuery,
  nodes: SummaryNode[],
  provider: IEmbeddingProvider,
  queryText: string,
  config: Partial<RelevanceConfig> = {},
  cache?: EmbeddingCache
): Promise<Map<string, number>> {
  const fullConfig = { ...DEFAULT_RELEVANCE_CONFIG, ...config };

  // semantic 점수 배치 계산
  const semanticScores = await calculateSemanticRelevanceBatch(
    queryText,
    nodes,
    provider,
    cache
  );

  const result = new Map<string, number>();

  for (const node of nodes) {
    // 동기 점수 계산
    const keywordScore = calculateKeywordRelevance(query, node, config);
    const pathScore = calculatePathRelevance(query, node, config);
    const semanticScore = semanticScores.get(node.id) ?? 0;

    // 가중 합계
    const totalWeight =
      fullConfig.keywordWeight +
      fullConfig.pathWeight +
      fullConfig.semanticWeight;

    let score =
      (fullConfig.keywordWeight * keywordScore +
        fullConfig.pathWeight * pathScore +
        fullConfig.semanticWeight * semanticScore) /
      totalWeight;

    // 깊이 페널티 적용
    const depthPenalty = node.depth * fullConfig.depthPenalty;
    score = Math.max(0, score - depthPenalty);

    result.set(node.id, Math.min(1, score));
  }

  return result;
}
