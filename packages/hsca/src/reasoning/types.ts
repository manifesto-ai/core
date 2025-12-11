/**
 * Reasoning Types for HSCA
 *
 * hsca_arch_v2.md Appendix A 기반 스키마 정의
 * "Explainable Ignorance"의 핵심 데이터 구조
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════
// QueryIntent: 질의 의도 타입
// ═══════════════════════════════════════════════════════

/**
 * 질의 의도 타입
 * - lookup: 단순 조회
 * - compare: 비교 분석
 * - summarize: 요약 요청
 * - analyze: 심층 분석
 * - list: 목록 나열
 */
export const QueryIntentSchema = z.enum(['lookup', 'compare', 'summarize', 'analyze', 'list']);

export type QueryIntent = z.infer<typeof QueryIntentSchema>;

// ═══════════════════════════════════════════════════════
// QueryConstraint: 질의 제약 조건
// ═══════════════════════════════════════════════════════

export const QueryConstraintOperatorSchema = z.enum(['eq', 'gt', 'lt', 'contains', 'between']);

export type QueryConstraintOperator = z.infer<typeof QueryConstraintOperatorSchema>;

export const QueryConstraintSchema = z.object({
  field: z.string(),
  operator: QueryConstraintOperatorSchema,
  value: z.unknown(),
});

export type QueryConstraint = z.infer<typeof QueryConstraintSchema>;

// ═══════════════════════════════════════════════════════
// ParsedQuery: 분석된 질의
// ═══════════════════════════════════════════════════════

/**
 * LLM이 분석한 질의 구조
 *
 * @example
 * ```typescript
 * const parsed: ParsedQuery = {
 *   intent: 'lookup',
 *   targetPaths: ['finance.revenue.q3.2024'],
 *   constraints: [{ field: 'year', operator: 'eq', value: 2024 }],
 *   expectedDepth: 2
 * };
 * ```
 */
export const ParsedQuerySchema = z.object({
  /** 질의 의도 */
  intent: QueryIntentSchema,

  /** 검색 대상 경로들 */
  targetPaths: z.array(z.string()),

  /** 제약 조건들 */
  constraints: z.array(QueryConstraintSchema),

  /** 예상 탐색 깊이 */
  expectedDepth: z.number().int().nonnegative(),
});

export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;

// ═══════════════════════════════════════════════════════
// RetrievedNode: 검색된 컨텍스트 노드
// ═══════════════════════════════════════════════════════

/**
 * SCT에서 검색된 노드 정보
 *
 * @example
 * ```typescript
 * const node: RetrievedNode = {
 *   nodeId: 'node-123',
 *   level: 2,
 *   summary: 'Q3 매출 관련 요약...',
 *   relevance: 0.85,
 *   tokenCount: 150,
 *   semanticPaths: ['finance.revenue']
 * };
 * ```
 */
export const RetrievedNodeSchema = z.object({
  /** 노드 고유 ID */
  nodeId: z.string(),

  /** SCT 트리 레벨 (0 = root) */
  level: z.number().int().nonnegative(),

  /** 노드 요약 텍스트 */
  summary: z.string(),

  /** 관련성 점수 (0-1) */
  relevance: z.number().min(0).max(1),

  /** 토큰 수 */
  tokenCount: z.number().int().nonnegative(),

  /** 의미론적 경로들 */
  semanticPaths: z.array(z.string()),
});

export type RetrievedNode = z.infer<typeof RetrievedNodeSchema>;

// ═══════════════════════════════════════════════════════
// ReasoningStepType: 추론 단계 타입
// ═══════════════════════════════════════════════════════

/**
 * 추론 단계 타입
 * - analyze: 질의 분석
 * - retrieve: 컨텍스트 검색
 * - expand: 노드 확장
 * - infer: 추론 수행
 * - conclude: 결론 도출
 * - not_found: 정보 부재 확인
 */
export const ReasoningStepTypeSchema = z.enum([
  'analyze',
  'retrieve',
  'expand',
  'infer',
  'conclude',
  'not_found',
]);

export type ReasoningStepType = z.infer<typeof ReasoningStepTypeSchema>;

// ═══════════════════════════════════════════════════════
// ReasoningStep: 추론 경로 단계
// ═══════════════════════════════════════════════════════

/**
 * 추론 경로의 단일 단계
 *
 * "Explainable Ignorance"의 핵심 - 모든 추론 시도를 기록
 *
 * @example
 * ```typescript
 * const step: ReasoningStep = {
 *   step: 1,
 *   type: 'retrieve',
 *   target: 'finance.revenue.q3.2024',
 *   relevance: 0.12,
 *   result: 'no_match',
 *   evidence: []
 * };
 * ```
 */
export const ReasoningStepSchema = z.object({
  /** 단계 번호 (1부터 시작) */
  step: z.number().int().positive(),

  /** 단계 타입 */
  type: ReasoningStepTypeSchema,

  /** 검색/확장 대상 경로 */
  target: z.string(),

  /** 관련성 점수 (0-1) */
  relevance: z.number().min(0).max(1),

  /** 결과 요약 */
  result: z.string(),

  /** 근거 경로들 */
  evidence: z.array(z.string()),
});

export type ReasoningStep = z.infer<typeof ReasoningStepSchema>;

// ═══════════════════════════════════════════════════════
// ConclusionType: 결론 타입
// ═══════════════════════════════════════════════════════

/**
 * 결론 타입
 * - answer: 답변 도출 성공
 * - not_found: 정보 부재 (★ Explainable Ignorance의 핵심)
 * - uncertain: 불확실 (추가 정보 필요)
 */
export const ConclusionTypeSchema = z.enum(['answer', 'not_found', 'uncertain']);

export type ConclusionType = z.infer<typeof ConclusionTypeSchema>;

// ═══════════════════════════════════════════════════════
// Conclusion: 최종 결론
// ═══════════════════════════════════════════════════════

/**
 * 추론의 최종 결론
 *
 * @example
 * ```typescript
 * // 정보 부재 결론
 * const conclusion: Conclusion = {
 *   type: 'not_found',
 *   content: '요청하신 정보를 찾을 수 없습니다.',
 *   confidence: 0.95,
 *   evidencePaths: ['finance.revenue.q3.2024', 'finance.*']
 * };
 * ```
 */
export const ConclusionSchema = z.object({
  /** 결론 타입 */
  type: ConclusionTypeSchema,

  /** 결론 내용 */
  content: z.string(),

  /** 신뢰도 (0-1) */
  confidence: z.number().min(0).max(1),

  /** 근거 경로들 */
  evidencePaths: z.array(z.string()),
});

export type Conclusion = z.infer<typeof ConclusionSchema>;

// ═══════════════════════════════════════════════════════
// QueryStatus: 질의 처리 상태
// ═══════════════════════════════════════════════════════

/**
 * 질의 처리 상태
 * - pending: 대기 중
 * - analyzing: 질의 분석 중
 * - retrieving: 컨텍스트 검색 중
 * - reasoning: 추론 중
 * - complete: 완료 (답변 있음)
 * - not_found: 완료 (정보 없음)
 */
export const QueryStatusSchema = z.enum([
  'pending',
  'analyzing',
  'retrieving',
  'reasoning',
  'complete',
  'not_found',
]);

export type QueryStatus = z.infer<typeof QueryStatusSchema>;

// ═══════════════════════════════════════════════════════
// CurrentQuery: 현재 질의 상태
// ═══════════════════════════════════════════════════════

/**
 * 현재 처리 중인 질의 상태
 */
export const CurrentQuerySchema = z.object({
  /** 원본 질의 문자열 */
  raw: z.string(),

  /** 분석된 질의 (분석 전에는 null) */
  parsed: ParsedQuerySchema.nullable(),

  /** 처리 상태 */
  status: QueryStatusSchema,
});

export type CurrentQuery = z.infer<typeof CurrentQuerySchema>;
