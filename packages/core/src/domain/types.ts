import type { ZodType } from 'zod';
import type { Expression } from '../expression/types.js';
import type { Effect } from '../effect/types.js';

/**
 * SemanticPath: 의미론적 주소
 * 도메인 내 모든 값에 부여되는 고유한 주소
 *
 * Namespaces:
 * - data.*: 사용자 입력 데이터
 * - state.*: 시스템/비동기 상태
 * - derived.*: 계산된 값
 * - actions.*: 실행 가능한 조작
 */
export type SemanticPath = string;

/**
 * SemanticMeta: AI 이해용 메타데이터
 */
export type SemanticMeta = {
  /** 의미 유형 */
  type: string;

  /** 자연어 설명 */
  description: string;

  /** 중요도 */
  importance?: 'critical' | 'high' | 'medium' | 'low';

  /** Agent가 값을 볼 수 있는지 */
  readable?: boolean;

  /** Agent가 값을 변경할 수 있는지 */
  writable?: boolean;

  /** 값 예시 */
  examples?: unknown[];

  /** 추가 힌트 */
  hints?: Record<string, unknown>;
};

/**
 * ConditionRef: 조건 참조
 */
export type ConditionRef = {
  /** 참조하는 경로 */
  path: SemanticPath;

  /** 기대 값 */
  expect?: 'true' | 'false';

  /** 사람/AI가 읽을 수 있는 이유 */
  reason?: string;
};

/**
 * FieldPolicy: 도메인 레벨의 필드 정책
 */
export type FieldPolicy = {
  /** 이 필드가 의미있는 조건 */
  relevantWhen?: ConditionRef[];

  /** 이 필드가 수정 가능한 조건 */
  editableWhen?: ConditionRef[];

  /** 이 필드가 필수인 조건 */
  requiredWhen?: ConditionRef[];
};

/**
 * SourceDefinition: 외부 입력 경로
 */
export type SourceDefinition = {
  /** 값 스키마 */
  schema: ZodType;

  /** 기본값 */
  defaultValue?: unknown;

  /** 필드 정책 */
  policy?: FieldPolicy;

  /** Semantic 메타데이터 */
  semantic: SemanticMeta;
};

/**
 * DerivedDefinition: 동기 계산 경로
 */
export type DerivedDefinition = {
  /** 의존하는 경로들 */
  deps: SemanticPath[];

  /** 계산 표현식 */
  expr: Expression;

  /** Semantic 메타데이터 */
  semantic: SemanticMeta;
};

/**
 * AsyncDefinition: 비동기 획득 경로
 */
export type AsyncDefinition = {
  /** 트리거 경로들 */
  deps: SemanticPath[];

  /** 실행 조건 (없으면 deps 변경 시 항상) */
  condition?: Expression;

  /** 디바운스 (ms) */
  debounce?: number;

  /** 실행할 Effect */
  effect: Effect;

  /** 결과 저장 경로 */
  resultPath: SemanticPath;

  /** 로딩 상태 경로 */
  loadingPath: SemanticPath;

  /** 에러 상태 경로 */
  errorPath: SemanticPath;

  /** Semantic 메타데이터 */
  semantic: SemanticMeta;
};

/**
 * ProjectionScopePath: 프로젝션 범위 경로
 * LLM에게 노출될 스냅샷 경로
 */
export type ProjectionScopePath = SemanticPath;

/**
 * ProjectionScopeConfig: 프로젝션 범위 설정
 * LLM 컨텍스트를 제한하기 위한 설정
 */
export type ProjectionScopeConfig = {
  /** 포함할 경로들 */
  paths: ProjectionScopePath[];

  /** 토큰 예산 (기본값: 4000) */
  tokenBudget?: number;

  /** 예산 초과 시 압축 전략 */
  compressionStrategy?: 'truncate' | 'summarize' | 'prioritize';
};

/**
 * ActionSemanticMeta: 액션 전용 메타데이터
 */
export type ActionSemanticMeta = SemanticMeta & {
  /** 동사 (AI가 이해하는 행위) */
  verb: string;

  /** 위험도 */
  risk?: 'none' | 'low' | 'medium' | 'high' | 'critical';

  /** 예상 결과 */
  expectedOutcome?: string;

  /** 되돌릴 수 있는지 */
  reversible?: boolean;
};

/**
 * ActionDefinition: 액션 정의
 */
export type ActionDefinition = {
  /** 의존하는 경로들 */
  deps: SemanticPath[];

  /** 입력 파라미터 스키마 */
  input?: ZodType;

  /** 실행할 Effect */
  effect: Effect;

  /** 실행 전제조건 */
  preconditions?: ConditionRef[];

  /** Semantic 메타데이터 */
  semantic: ActionSemanticMeta;

  /**
   * 프로젝션 범위: LLM이 볼 수 있는 스냅샷 범위
   * - 배열: 경로 목록 (기본 토큰 예산 4000 적용)
   * - 객체: 상세 설정 (경로, 토큰 예산, 압축 전략)
   */
  projectionScope?: ProjectionScopeConfig | ProjectionScopePath[];
};

/**
 * PathDefinitions: 모든 Semantic Path의 정의
 */
export type PathDefinitions<TData = unknown, TState = unknown> = {
  /** Source Paths: 외부 입력 */
  sources: Record<SemanticPath, SourceDefinition>;

  /** Derived Paths: 동기 계산 */
  derived: Record<SemanticPath, DerivedDefinition>;

  /** Async Paths: 비동기 획득 */
  async: Record<SemanticPath, AsyncDefinition>;
};

/**
 * DomainMeta: 도메인 수준 메타데이터
 */
export type DomainMeta = {
  /** 도메인 버전 */
  version?: string;

  /** 도메인 카테고리 */
  category?: string;

  /** AI용 도메인 설명 */
  aiDescription?: string;
};

/**
 * ManifestoDomain: 비즈니스 도메인의 완전한 정의
 */
export type ManifestoDomain<TData = unknown, TState = unknown> = {
  /** 도메인 식별자 */
  id: string;

  /** 도메인 이름 */
  name: string;

  /** 도메인 설명 */
  description: string;

  /** Semantic Paths 정의 */
  paths: PathDefinitions<TData, TState>;

  /** Actions 정의 */
  actions: Record<string, ActionDefinition>;

  /** Data Schema (Zod) */
  dataSchema: ZodType<TData>;

  /** State Schema (Zod) */
  stateSchema: ZodType<TState>;

  /** 초기 상태 */
  initialState: TState;

  /** 도메인 메타데이터 */
  meta?: DomainMeta;
};

/**
 * ValidationIssue: 개별 검증 이슈
 */
export type ValidationIssue = {
  /** 이슈 코드 */
  code: string;

  /** 사람이 읽을 수 있는 메시지 */
  message: string;

  /** 해당 경로 */
  path: SemanticPath;

  /** 심각도 */
  severity: 'error' | 'warning' | 'info' | 'suggestion';

  /** 자동 수정 제안 */
  suggestedFix?: {
    /** 수정 설명 */
    description: string;

    /** 수정 값 표현식 */
    value: Expression;
  };
};

/**
 * ValidationResult: 검증 결과
 */
export type ValidationResult = {
  /** 전체 유효 여부 */
  valid: boolean;

  /** 검증 이슈 목록 */
  issues: ValidationIssue[];
};
