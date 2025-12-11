import { z } from 'zod';
import type { Result } from '@manifesto-ai/core';

// ═══════════════════════════════════════════════════════
// 요약 노드 스키마
// ═══════════════════════════════════════════════════════

/**
 * SCT 노드 기본 타입
 * Zod 스키마 정의 전에 타입을 먼저 선언
 */
export type SummaryNode = {
  /** 고유 식별자 */
  id: string;

  /** 의미론적 경로 (예: "chapter.1.section.2") */
  path: string;

  /** 트리 깊이 (0 = root) */
  depth: number;

  // 내용
  /** 요약 텍스트 */
  summary: string;

  /** 원본 텍스트 (리프 노드만 보유) */
  originalText?: string;

  // 메타데이터
  /** 요약의 토큰 수 */
  tokenCount: number;

  /** 원본의 토큰 수 */
  originalTokenCount: number;

  /** 압축률 (originalTokenCount / tokenCount) */
  compressionRatio: number;

  // 검색용 메타
  /** 핵심 키워드 */
  keywords: string[];

  /** 질의 관련도 (동적으로 설정) */
  relevanceScore?: number;

  // 계층 구조
  /** 자식 노드들 */
  children: SummaryNode[];

  /** 부모 노드 ID */
  parentId: string | null;
};

/**
 * 요약 노드 Zod 스키마
 * 재귀 구조를 위해 z.lazy 사용
 */
export const SummaryNodeSchema: z.ZodType<SummaryNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    path: z.string(),
    depth: z.number(),

    summary: z.string(),
    originalText: z.string().optional(),

    tokenCount: z.number(),
    originalTokenCount: z.number(),
    compressionRatio: z.number(),

    keywords: z.array(z.string()),
    relevanceScore: z.number().optional(),

    children: z.array(SummaryNodeSchema),
    parentId: z.string().nullable(),
  })
);

// ═══════════════════════════════════════════════════════
// 압축 트리 스키마
// ═══════════════════════════════════════════════════════

/**
 * 소스 타입
 */
export type SourceType = 'document' | 'code' | 'conversation' | 'mixed';

/**
 * 압축 트리 메타데이터
 */
export type CompressionTreeMetadata = {
  /** 전체 청크 수 */
  totalChunks: number;

  /** 압축된 총 토큰 수 */
  totalTokens: number;

  /** 원본 총 토큰 수 */
  originalTokens: number;

  /** 전체 압축률 */
  compressionRatio: number;

  /** 생성 시각 */
  createdAt: string;

  /** 소스 타입 */
  sourceType: SourceType;
};

/**
 * 압축 트리 전체 구조
 */
export type CompressionTree = CompressionTreeMetadata & {
  /** 루트 노드 */
  root: SummaryNode;
};

export const CompressionTreeSchema = z.object({
  root: SummaryNodeSchema,
  totalChunks: z.number(),
  totalTokens: z.number(),
  originalTokens: z.number(),
  compressionRatio: z.number(),
  createdAt: z.string(),
  sourceType: z.enum(['document', 'code', 'conversation', 'mixed']),
});

// ═══════════════════════════════════════════════════════
// 청킹 설정
// ═══════════════════════════════════════════════════════

/**
 * 청킹 전략
 * - fixed: 고정 토큰 크기로 분할
 * - semantic: 문단/섹션 경계 기반 분할
 * - adaptive: 구조 감지 후 적응형 분할
 */
export type ChunkingStrategy = 'fixed' | 'semantic' | 'adaptive';

/**
 * 청킹 설정
 */
export type ChunkingConfig = {
  /** 청킹 전략 */
  strategy: ChunkingStrategy;

  /** 목표 청크 크기 (토큰 기준, 기본: 500) */
  targetChunkTokens: number;

  /** 최대 청크 크기 (토큰 기준, 기본: 1000) */
  maxChunkTokens: number;

  /** 청크 간 중복 토큰 수 (기본: 50) */
  overlapTokens: number;

  /** 문단/섹션 경계 보존 여부 */
  preserveBoundaries: boolean;
};

/**
 * 기본 청킹 설정
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  strategy: 'semantic',
  targetChunkTokens: 500,
  maxChunkTokens: 1000,
  overlapTokens: 50,
  preserveBoundaries: true,
};

// ═══════════════════════════════════════════════════════
// 요약 설정
// ═══════════════════════════════════════════════════════

/**
 * 요약기 설정
 */
export type SummarizerConfig = {
  /** 목표 압축률 (기본: 10) */
  targetCompressionRatio: number;

  /** 요약당 최대 토큰 수 (기본: 200) */
  maxSummaryTokens: number;

  /** 키워드 자동 추출 여부 */
  preserveKeywords: boolean;

  /** 계층적 요약 활성화 여부 */
  hierarchical: boolean;

  /** 한 그룹에 포함할 최대 청크/요약 수 (기본: 5) */
  groupSize: number;
};

/**
 * 기본 요약 설정
 */
export const DEFAULT_SUMMARIZER_CONFIG: SummarizerConfig = {
  targetCompressionRatio: 10,
  maxSummaryTokens: 200,
  preserveKeywords: true,
  hierarchical: true,
  groupSize: 5,
};

// ═══════════════════════════════════════════════════════
// 청크 타입
// ═══════════════════════════════════════════════════════

/**
 * 청크 데이터
 */
export type Chunk = {
  /** 고유 식별자 */
  id: string;

  /** 청크 텍스트 */
  text: string;

  /** 토큰 수 */
  tokenCount: number;

  /** 원본 텍스트에서의 시작 오프셋 */
  startOffset: number;

  /** 원본 텍스트에서의 끝 오프셋 */
  endOffset: number;

  /** 추가 메타데이터 */
  metadata?: Record<string, unknown>;
};

/**
 * 청킹 결과
 */
export type ChunkResult = {
  /** 생성된 청크들 */
  chunks: Chunk[];

  /** 전체 토큰 수 */
  totalTokens: number;

  /** 사용된 전략 */
  strategy: string;
};

// ═══════════════════════════════════════════════════════
// 요약 결과 타입
// ═══════════════════════════════════════════════════════

/**
 * 단일 요약 결과
 */
export type SummaryResult = {
  /** 요약 텍스트 */
  summary: string;

  /** 추출된 키워드 */
  keywords: string[];

  /** 요약의 토큰 수 */
  tokenCount: number;

  /** 압축률 */
  compressionRatio: number;
};

// ═══════════════════════════════════════════════════════
// SCT 빌드 설정
// ═══════════════════════════════════════════════════════

/**
 * SCT 빌드 설정
 */
export type SCTBuildConfig = {
  /** 청킹 설정 */
  chunking: Partial<ChunkingConfig>;

  /** 요약 설정 */
  summarizer: Partial<SummarizerConfig>;

  /** 소스 타입 */
  sourceType: SourceType;
};

/**
 * 기본 SCT 빌드 설정
 */
export const DEFAULT_SCT_BUILD_CONFIG: SCTBuildConfig = {
  chunking: DEFAULT_CHUNKING_CONFIG,
  summarizer: DEFAULT_SUMMARIZER_CONFIG,
  sourceType: 'document',
};

// ═══════════════════════════════════════════════════════
// 에러 타입
// ═══════════════════════════════════════════════════════

/**
 * SCT 에러 코드
 */
export type SCTErrorCode =
  | 'EMPTY_INPUT'
  | 'CHUNKING_FAILED'
  | 'SUMMARIZATION_FAILED'
  | 'LLM_ERROR'
  | 'INVALID_CONFIG'
  | 'NODE_NOT_FOUND'
  | 'SERIALIZATION_ERROR';

/**
 * SCT 에러
 */
export type SCTError = {
  code: SCTErrorCode;
  message: string;
  cause?: unknown;
};

/**
 * 요약기 에러
 */
export type SummarizerError = {
  code: 'LLM_ERROR' | 'PARSE_ERROR' | 'EMPTY_INPUT';
  message: string;
  cause?: unknown;
};
