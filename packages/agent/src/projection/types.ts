/**
 * @manifesto-ai/agent - Projection Types
 *
 * LLM 컨텍스트 투영을 위한 타입 정의.
 * @manifesto-ai/core의 ProjectionEngine과 통합하여
 * 토큰 예산 관리 및 컨텍스트 제한 기능을 제공.
 *
 * @version 0.1.x
 */

/**
 * ProjectedSnapshot - 투영된 스냅샷
 * 전체 스냅샷에서 projectionScope에 지정된 경로만 포함
 */
export type ProjectedSnapshot = {
  /** 투영된 data 영역 */
  data?: Record<string, unknown>;
  /** 투영된 state 영역 */
  state?: Record<string, unknown>;
  /** 투영된 derived 영역 */
  derived?: Record<string, unknown>;
};

/**
 * ProjectionMetadata - 투영 메타데이터
 * LLM Client에 전달되어 투영 상태를 알림
 */
export type ProjectionMetadata = {
  /** 투영 여부 */
  isProjected: boolean;
  /** 추정 토큰 수 */
  tokenCount: number;
  /** 포함된 경로 목록 */
  includedPaths: string[];
  /** 압축 적용 여부 */
  compressed?: boolean;
  /** 압축 전략 (압축 적용 시) */
  compressionStrategy?: CompressionStrategy;
};

/**
 * ProjectionResult - 투영 결과
 */
export type ProjectionResult<S = unknown> = {
  /** 투영된 스냅샷 */
  snapshot: S;
  /** 투영 메타데이터 */
  metadata: ProjectionMetadata;
};

/**
 * CompressionStrategy - 압축 전략
 * 토큰 예산 초과 시 적용할 전략
 */
export type CompressionStrategy = 'truncate' | 'summarize' | 'prioritize';

/**
 * ProjectionProviderConfig - Provider 설정
 */
export type ProjectionProviderConfig = {
  /** 토큰 예산 (기본: 4000) */
  tokenBudget?: number;
  /** 항상 포함할 경로 */
  requiredPaths?: string[];
  /** 항상 제외할 경로 */
  excludePaths?: string[];
  /** 압축 전략 (기본: 'truncate') */
  compressionStrategy?: CompressionStrategy;
  /** 사용자 정의 토큰 추정 함수 */
  tokenEstimator?: (obj: unknown) => number;
};

/**
 * ProjectionProvider - 투영 제공자 인터페이스
 *
 * 전체 스냅샷을 LLM 컨텍스트용으로 투영하는 추상화.
 * @manifesto-ai/core의 ProjectionEngine을 래핑하거나
 * 단순 경로 기반 필터링을 제공.
 */
export interface ProjectionProvider<S = unknown> {
  /**
   * 전체 스냅샷을 LLM 컨텍스트용으로 투영
   *
   * @param fullSnapshot - 전체 도메인 스냅샷
   * @returns 투영 결과 (스냅샷 + 메타데이터)
   */
  project(fullSnapshot: S): ProjectionResult<Partial<S>>;

  /**
   * 마지막 투영의 메타데이터 조회
   */
  getMetadata(): ProjectionMetadata | undefined;

  /**
   * 현재 설정 조회
   */
  getConfig(): ProjectionProviderConfig;
}

/**
 * CreateProjectionProviderOptions - ProjectionProvider 생성 옵션
 */
export type CreateProjectionProviderOptions = {
  /** 투영할 경로 목록 */
  paths: string[];
  /** Provider 설정 */
  config?: ProjectionProviderConfig;
};
