import type { SemanticPath } from '../domain/types.js';

/**
 * ProjectedSnapshot: 투영된 스냅샷
 * 전체 스냅샷에서 projectionScope에 지정된 경로만 포함
 */
export type ProjectedSnapshot = {
  data?: Record<string, unknown>;
  state?: Record<string, unknown>;
  derived?: Record<string, unknown>;
};

/**
 * ProjectedContext: LLM에게 전달될 컨텍스트
 */
export type ProjectedContext = {
  /** 투영된 스냅샷 */
  snapshot: ProjectedSnapshot;

  /** 추정 토큰 수 */
  tokenCount: number;

  /** 액션 ID */
  actionId: string;

  /** 적용된 프로젝션 범위 */
  projectionScope: SemanticPath[];

  /** 압축 여부 */
  compressed?: boolean;

  /** 압축 메타데이터 */
  compressionMetadata?: {
    /** 압축 전 토큰 수 */
    originalTokenCount: number;
    /** 적용된 압축 전략 */
    strategy: string;
    /** 제거된 항목 수 */
    itemsRemoved?: number;
  };
};

/**
 * ProjectionErrorCode: 프로젝션 에러 코드
 */
export type ProjectionErrorCode =
  | 'UNKNOWN_ACTION'
  | 'CANNOT_FIT_BUDGET'
  | 'INVALID_PATH'
  | 'EMPTY_PROJECTION';

/**
 * ProjectionError: 프로젝션 에러
 */
export type ProjectionError = {
  /** 에러 코드 */
  code: ProjectionErrorCode;

  /** 에러 메시지 */
  message: string;

  /** 추가 세부 정보 */
  details?: unknown;
};

/**
 * ProjectionEngineConfig: 프로젝션 엔진 설정
 */
export type ProjectionEngineConfig = {
  /** 기본 토큰 예산 (기본값: 4000) */
  defaultTokenBudget?: number;

  /** 사용자 정의 토큰 추정 함수 */
  tokenEstimator?: (obj: unknown) => number;

  /** 프로젝션 범위가 없을 때 경고 출력 여부 */
  warnOnMissingScope?: boolean;
};

/**
 * CompressionStrategy: 압축 전략
 */
export type CompressionStrategy = 'truncate' | 'summarize' | 'prioritize';

/**
 * CompressionResult: 압축 결과
 */
export type CompressionResult = {
  /** 압축된 스냅샷 */
  snapshot: ProjectedSnapshot;

  /** 압축 후 토큰 수 */
  tokenCount: number;

  /** 제거된 항목 수 */
  itemsRemoved: number;

  /** 압축 성공 여부 */
  success: boolean;
};
