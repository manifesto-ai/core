import { ok, err, type Result, estimateTokens } from '@manifesto-ai/core';
import type { ILLMClient } from '../llm/types.js';
import type {
  SummaryNode,
  CompressionTree,
  CompressionTreeMetadata,
  SCTBuildConfig,
  SCTError,
  ChunkingConfig,
  SummarizerConfig,
} from './types.js';
import {
  DEFAULT_SCT_BUILD_CONFIG,
  DEFAULT_CHUNKING_CONFIG,
  DEFAULT_SUMMARIZER_CONFIG,
  CompressionTreeSchema,
} from './types.js';
import { chunkText } from './chunker.js';
import { hierarchicalSummarize } from './summarizer.js';

/**
 * Semantic Compression Tree
 *
 * 대규모 컨텍스트를 계층적으로 압축하여 효율적인 탐색을 가능하게 하는 트리 구조
 *
 * @example
 * ```typescript
 * const llm = new OpenAIClient({ apiKey: '...' });
 * const result = await SemanticCompressionTree.build(largeText, llm);
 *
 * if (result.ok) {
 *   const tree = result.value;
 *   const relevant = tree.searchByKeywords(['authentication']);
 *   const context = tree.collectWithinBudget(2000);
 * }
 * ```
 */
export class SemanticCompressionTree {
  private nodeIndex: Map<string, SummaryNode> = new Map();
  private keywordIndex: Map<string, Set<string>> = new Map();

  private constructor(
    private _root: SummaryNode,
    private _metadata: CompressionTreeMetadata
  ) {
    this.buildIndices(this._root);
  }

  // ═══════════════════════════════════════════════════════
  // 정적 생성 메서드
  // ═══════════════════════════════════════════════════════

  /**
   * 텍스트로부터 SCT 구축
   *
   * @param text - 압축할 원본 텍스트
   * @param llm - LLM 클라이언트 (요약 생성용)
   * @param config - 빌드 설정
   * @returns SCT 인스턴스 또는 에러
   */
  static async build(
    text: string,
    llm: ILLMClient,
    config: Partial<SCTBuildConfig> = {}
  ): Promise<Result<SemanticCompressionTree, SCTError>> {
    const fullConfig: SCTBuildConfig = {
      chunking: { ...DEFAULT_CHUNKING_CONFIG, ...config.chunking },
      summarizer: { ...DEFAULT_SUMMARIZER_CONFIG, ...config.summarizer },
      sourceType: config.sourceType ?? DEFAULT_SCT_BUILD_CONFIG.sourceType,
    };

    // 입력 검증
    if (!text || text.trim().length === 0) {
      return err({
        code: 'EMPTY_INPUT',
        message: 'Input text is empty',
      });
    }

    // 1. 청킹
    const chunkResult = chunkText(text, fullConfig.chunking as Partial<ChunkingConfig>);

    if (chunkResult.chunks.length === 0) {
      return err({
        code: 'CHUNKING_FAILED',
        message: 'Chunking produced no chunks',
      });
    }

    // 2. 계층적 요약
    const summarizeResult = await hierarchicalSummarize(
      chunkResult.chunks,
      llm,
      fullConfig.summarizer as Partial<SummarizerConfig>
    );

    if (!summarizeResult.ok) {
      return err({
        code: 'SUMMARIZATION_FAILED',
        message: summarizeResult.error.message,
        cause: summarizeResult.error,
      });
    }

    // 3. 메타데이터 계산
    const root = summarizeResult.value;
    const originalTokens = estimateTokens(text);
    const totalTokens = calculateTotalTokens(root);

    const metadata: CompressionTreeMetadata = {
      totalChunks: chunkResult.chunks.length,
      totalTokens,
      originalTokens,
      compressionRatio: originalTokens / Math.max(totalTokens, 1),
      createdAt: new Date().toISOString(),
      sourceType: fullConfig.sourceType,
    };

    return ok(new SemanticCompressionTree(root, metadata));
  }

  /**
   * 직렬화된 데이터로부터 복원
   *
   * @param data - CompressionTree JSON 데이터
   * @returns SCT 인스턴스
   */
  static fromJSON(data: CompressionTree): Result<SemanticCompressionTree, SCTError> {
    try {
      const parsed = CompressionTreeSchema.parse(data);

      const metadata: CompressionTreeMetadata = {
        totalChunks: parsed.totalChunks,
        totalTokens: parsed.totalTokens,
        originalTokens: parsed.originalTokens,
        compressionRatio: parsed.compressionRatio,
        createdAt: parsed.createdAt,
        sourceType: parsed.sourceType,
      };

      return ok(new SemanticCompressionTree(parsed.root, metadata));
    } catch (error) {
      return err({
        code: 'SERIALIZATION_ERROR',
        message: 'Failed to parse compression tree data',
        cause: error,
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  // 탐색 메서드
  // ═══════════════════════════════════════════════════════

  /**
   * 루트 노드 반환
   */
  get root(): SummaryNode {
    return this._root;
  }

  /**
   * 메타데이터 반환
   */
  get metadata(): CompressionTreeMetadata {
    return this._metadata;
  }

  /**
   * 특정 깊이의 모든 요약 노드 반환
   *
   * @param depth - 트리 깊이 (0 = 루트)
   * @returns 해당 깊이의 노드들
   */
  getSummariesAtDepth(depth: number): SummaryNode[] {
    const result: SummaryNode[] = [];
    collectNodesAtDepth(this._root, depth, result);
    return result;
  }

  /**
   * 경로로 노드 조회
   *
   * @param path - 노드 경로 (예: "root", "level.1.0", "chunk.5")
   * @returns 노드 또는 undefined
   */
  getNodeByPath(path: string): SummaryNode | undefined {
    return this.findNodeByPath(this._root, path);
  }

  /**
   * ID로 노드 조회
   *
   * @param nodeId - 노드 ID
   * @returns 노드 또는 undefined
   */
  getNodeById(nodeId: string): SummaryNode | undefined {
    return this.nodeIndex.get(nodeId);
  }

  /**
   * 노드 확장 (자식 노드 반환)
   *
   * @param nodeId - 확장할 노드 ID
   * @returns 자식 노드들
   */
  expandNode(nodeId: string): SummaryNode[] {
    const node = this.nodeIndex.get(nodeId);
    return node?.children ?? [];
  }

  /**
   * 모든 리프 노드 반환
   */
  getLeafNodes(): SummaryNode[] {
    const leaves: SummaryNode[] = [];
    collectLeafNodes(this._root, leaves);
    return leaves;
  }

  // ═══════════════════════════════════════════════════════
  // 검색 메서드
  // ═══════════════════════════════════════════════════════

  /**
   * 키워드 기반 관련 노드 검색
   *
   * @param keywords - 검색할 키워드들
   * @param maxResults - 최대 결과 수 (기본: 10)
   * @returns 관련도 순으로 정렬된 노드들
   */
  searchByKeywords(keywords: string[], maxResults: number = 10): SummaryNode[] {
    if (keywords.length === 0) {
      return [];
    }

    const nodeScores: Map<string, number> = new Map();

    // 각 키워드에 대해 관련 노드 찾기
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();

      // 정확한 키워드 매칭
      const exactMatches = this.keywordIndex.get(lowerKeyword);
      if (exactMatches) {
        for (const nodeId of exactMatches) {
          nodeScores.set(nodeId, (nodeScores.get(nodeId) ?? 0) + 2);
        }
      }

      // 부분 매칭
      for (const [indexKeyword, nodeIds] of this.keywordIndex) {
        if (indexKeyword.includes(lowerKeyword) || lowerKeyword.includes(indexKeyword)) {
          for (const nodeId of nodeIds) {
            nodeScores.set(nodeId, (nodeScores.get(nodeId) ?? 0) + 1);
          }
        }
      }
    }

    // 점수 순으로 정렬
    const sortedNodes = Array.from(nodeScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxResults)
      .map(([nodeId, score]) => {
        const node = this.nodeIndex.get(nodeId)!;
        // 관련도 점수 설정
        return {
          ...node,
          relevanceScore: score / keywords.length,
        };
      });

    return sortedNodes;
  }

  /**
   * 토큰 예산 내 관련 노드 수집
   *
   * 관련도가 높은 노드부터 예산 내에서 수집합니다.
   * 관련도가 설정되지 않은 경우 깊이 우선으로 수집합니다.
   *
   * @param tokenBudget - 토큰 예산
   * @param relevanceThreshold - 최소 관련도 (기본: 0)
   * @returns 수집된 노드들
   */
  collectWithinBudget(tokenBudget: number, relevanceThreshold: number = 0): SummaryNode[] {
    const allNodes = Array.from(this.nodeIndex.values());

    // 관련도가 있는 노드들을 우선 정렬
    const sortedNodes = allNodes
      .filter((n) => (n.relevanceScore ?? 0) >= relevanceThreshold)
      .sort((a, b) => {
        // 관련도 우선, 같으면 깊이가 얕은 것 우선
        const scoreA = a.relevanceScore ?? 0;
        const scoreB = b.relevanceScore ?? 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.depth - b.depth;
      });

    const selected: SummaryNode[] = [];
    let currentTokens = 0;

    for (const node of sortedNodes) {
      if (currentTokens + node.tokenCount <= tokenBudget) {
        selected.push(node);
        currentTokens += node.tokenCount;
      }
    }

    // 관련도 설정된 노드가 없으면 루트부터 BFS로 수집
    if (selected.length === 0) {
      return this.collectByBFS(tokenBudget);
    }

    return selected;
  }

  /**
   * BFS로 토큰 예산 내 수집
   */
  private collectByBFS(tokenBudget: number): SummaryNode[] {
    const selected: SummaryNode[] = [];
    const queue: SummaryNode[] = [this._root];
    let currentTokens = 0;

    while (queue.length > 0) {
      const node = queue.shift()!;

      if (currentTokens + node.tokenCount <= tokenBudget) {
        selected.push(node);
        currentTokens += node.tokenCount;

        // 자식 노드 추가
        for (const child of node.children) {
          queue.push(child);
        }
      }
    }

    return selected;
  }

  // ═══════════════════════════════════════════════════════
  // 직렬화
  // ═══════════════════════════════════════════════════════

  /**
   * JSON으로 직렬화
   */
  toJSON(): CompressionTree {
    return {
      root: this._root,
      ...this._metadata,
    };
  }

  // ═══════════════════════════════════════════════════════
  // 메트릭
  // ═══════════════════════════════════════════════════════

  /**
   * 트리 메트릭 계산
   */
  getMetrics(): {
    totalNodes: number;
    maxDepth: number;
    compressionRatio: number;
    totalTokens: number;
    originalTokens: number;
    leafCount: number;
    avgTokensPerNode: number;
  } {
    const maxDepth = calculateMaxDepth(this._root);
    const leafCount = this.getLeafNodes().length;
    const totalNodes = this.nodeIndex.size;

    return {
      totalNodes,
      maxDepth,
      compressionRatio: this._metadata.compressionRatio,
      totalTokens: this._metadata.totalTokens,
      originalTokens: this._metadata.originalTokens,
      leafCount,
      avgTokensPerNode: totalNodes > 0 ? this._metadata.totalTokens / totalNodes : 0,
    };
  }

  // ═══════════════════════════════════════════════════════
  // 내부 헬퍼
  // ═══════════════════════════════════════════════════════

  /**
   * 인덱스 구축
   */
  private buildIndices(node: SummaryNode): void {
    // 노드 인덱스
    this.nodeIndex.set(node.id, node);

    // 키워드 인덱스
    for (const keyword of node.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (!this.keywordIndex.has(lowerKeyword)) {
        this.keywordIndex.set(lowerKeyword, new Set());
      }
      this.keywordIndex.get(lowerKeyword)!.add(node.id);
    }

    // 자식 노드 재귀 처리
    for (const child of node.children) {
      this.buildIndices(child);
    }
  }

  /**
   * 경로로 노드 찾기
   */
  private findNodeByPath(node: SummaryNode, path: string): SummaryNode | undefined {
    if (node.path === path) {
      return node;
    }

    for (const child of node.children) {
      const found = this.findNodeByPath(child, path);
      if (found) return found;
    }

    return undefined;
  }
}

// ═══════════════════════════════════════════════════════
// 유틸리티 함수
// ═══════════════════════════════════════════════════════

/**
 * 특정 깊이의 노드 수집
 */
function collectNodesAtDepth(node: SummaryNode, targetDepth: number, result: SummaryNode[]): void {
  if (node.depth === targetDepth) {
    result.push(node);
    return;
  }

  // 현재 깊이가 목표보다 작으면 자식 탐색
  if (node.depth < targetDepth) {
    for (const child of node.children) {
      collectNodesAtDepth(child, targetDepth, result);
    }
  }
}

/**
 * 리프 노드 수집
 */
function collectLeafNodes(node: SummaryNode, result: SummaryNode[]): void {
  if (node.children.length === 0) {
    result.push(node);
    return;
  }

  for (const child of node.children) {
    collectLeafNodes(child, result);
  }
}

/**
 * 최대 깊이 계산
 */
function calculateMaxDepth(node: SummaryNode): number {
  if (node.children.length === 0) {
    return node.depth;
  }

  let maxChildDepth = node.depth;
  for (const child of node.children) {
    maxChildDepth = Math.max(maxChildDepth, calculateMaxDepth(child));
  }

  return maxChildDepth;
}

/**
 * 전체 토큰 수 계산
 */
function calculateTotalTokens(node: SummaryNode): number {
  let total = node.tokenCount;

  for (const child of node.children) {
    total += calculateTotalTokens(child);
  }

  return total;
}
