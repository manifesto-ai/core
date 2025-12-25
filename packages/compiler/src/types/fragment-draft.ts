/**
 * FragmentDraft Types - LLM 출력을 위한 임시 형태
 *
 * FragmentDraft는 LLM이 생성한 Fragment의 임시 형태입니다.
 * 검증 후 Fragment로 변환(lowering)됩니다.
 *
 * AGENT_README 불변식:
 * - LLM은 비신뢰 제안자: Draft는 반드시 검증 후 변환
 * - 모든 출력에 출처: Provenance 필수
 */

import type { Expression, Effect, ConditionRef, FieldPolicy } from '@manifesto-ai/core';
import type { Provenance } from './provenance.js';
import type {
  FragmentId,
  FragmentKind,
  SchemaFieldType,
  EffectRisk,
  StatementType,
  Fragment,
} from './fragment.js';

// ============================================================================
// Draft Status and Validation Types
// ============================================================================

/**
 * FragmentDraft의 상태
 *
 * - 'raw': LLM이 생성한 원시 상태 (검증 전)
 * - 'validated': 구조적 검증 통과 (표현식 문법 등)
 * - 'lowered': Fragment로 변환 완료
 */
export type DraftStatus = 'raw' | 'validated' | 'lowered';

/**
 * FragmentDraft의 유효성 검사 결과
 */
export interface DraftValidation {
  /** 검증 통과 여부 */
  isValid: boolean;
  /** 검증 오류 목록 */
  errors: DraftValidationError[];
  /** 검증 경고 목록 */
  warnings: DraftValidationWarning[];
}

/**
 * Draft 검증 오류
 */
export interface DraftValidationError {
  /** 오류 코드 */
  code: 'INVALID_EXPRESSION' | 'INVALID_EFFECT' | 'MISSING_FIELD' | 'TYPE_MISMATCH' | 'UNKNOWN_PATH';
  /** 오류 메시지 */
  message: string;
  /** 오류 위치 (JSON path) */
  path?: string;
}

/**
 * Draft 검증 경고
 */
export interface DraftValidationWarning {
  /** 경고 코드 */
  code: 'LOW_CONFIDENCE' | 'AMBIGUOUS_TYPE' | 'SUGGESTED_ALTERNATIVE';
  /** 경고 메시지 */
  message: string;
  /** 제안된 대안 (있는 경우) */
  suggestion?: string;
}

// ============================================================================
// FragmentDraftBase
// ============================================================================

/**
 * FragmentDraftBase - 모든 Draft의 기본 인터페이스
 *
 * Fragment와의 차이점:
 * - id가 없음 (lowering 단계에서 할당)
 * - requires/provides가 provisional (LLM 추정, 검증 필요)
 * - validation 상태 포함
 * - loweredFragmentId로 변환된 Fragment 추적
 *
 * AGENT_README 불변식 준수:
 * - LLM은 비신뢰 제안자: Draft는 반드시 검증 후 변환
 * - 모든 출력에 출처: Provenance 필수
 */
export interface FragmentDraftBase {
  /** Draft 종류 (Fragment kind와 동일) */
  kind: FragmentKind;

  /**
   * Provisional requires - LLM이 추정한 의존성
   * Lowering 단계에서 Expression 분석으로 검증/보정됨
   */
  provisionalRequires: string[];

  /**
   * Provisional provides - LLM이 추정한 제공 경로
   * Lowering 단계에서 검증됨
   */
  provisionalProvides: string[];

  /** Draft 상태 */
  status: DraftStatus;

  /** 유효성 검사 결과 (검증 후 채워짐) */
  validation?: DraftValidation;

  /** 변환된 Fragment ID (lowered 상태일 때) */
  loweredFragmentId?: FragmentId;

  /**
   * Provenance - LLM 출처 정보 (필수)
   *
   * MUST have location.kind === 'llm'
   */
  origin: Provenance;

  /**
   * LLM confidence - 모델의 자신감 점수
   * 0-1 범위, 낮을수록 검토 필요
   */
  confidence: number;

  /** LLM이 제공한 추론 근거 */
  reasoning?: string;
}

// ============================================================================
// Specific Draft Types
// ============================================================================

/**
 * SchemaDraft - 스키마 Draft
 */
export interface SchemaDraft extends FragmentDraftBase {
  kind: 'SchemaFragment';
  namespace: 'data' | 'state';
  /** 필드 정의 (타입이 불확실할 수 있음) */
  fields: Array<{
    path: string;
    type: SchemaFieldType | 'unknown';
    optional?: boolean;
    defaultValue?: unknown;
    semantic?: {
      type?: string;
      description?: string;
    };
  }>;
}

/**
 * SourceDraft - Source Draft
 */
export interface SourceDraft extends FragmentDraftBase {
  kind: 'SourceFragment';
  path: string;
  semantic: {
    type?: string;
    description?: string;
    writable?: boolean;
  };
}

/**
 * ExpressionDraft - Expression Draft
 *
 * rawExpr는 LLM이 생성한 원시 표현식 (문법 오류 가능)
 * validatedExpr는 검증 후 정규화된 표현식
 */
export interface ExpressionDraft extends FragmentDraftBase {
  kind: 'ExpressionFragment';
  /** LLM이 생성한 원시 표현식 (검증 전) */
  rawExpr: unknown;
  /** 검증/정규화된 표현식 (validated 상태 이후) */
  validatedExpr?: Expression;
  name?: string;
}

/**
 * DerivedDraft - Derived Draft
 */
export interface DerivedDraft extends FragmentDraftBase {
  kind: 'DerivedFragment';
  path: string;
  rawExpr: unknown;
  validatedExpr?: Expression;
  semantic?: {
    type?: string;
    description?: string;
  };
}

/**
 * PolicyDraft - Policy Draft
 */
export interface PolicyDraft extends FragmentDraftBase {
  kind: 'PolicyFragment';
  target:
    | { kind: 'action'; actionId: string }
    | { kind: 'field'; path: string };
  /** 원시 precondition 표현 (검증 전) */
  rawPreconditions?: Array<{
    path: string;
    expect: string;
    reason?: string;
  }>;
  /** 검증된 preconditions */
  validatedPreconditions?: ConditionRef[];
  rawFieldPolicy?: {
    relevantWhen?: Array<{ path: string; expect: string }>;
    editableWhen?: Array<{ path: string; expect: string }>;
    requiredWhen?: Array<{ path: string; expect: string }>;
  };
  validatedFieldPolicy?: FieldPolicy;
}

/**
 * EffectDraft - Effect Draft
 *
 * IMPORTANT: Effect는 description만, 절대 실행하지 않음 (AGENT_README Invariant #5)
 */
export interface EffectDraft extends FragmentDraftBase {
  kind: 'EffectFragment';
  /** LLM이 생성한 원시 Effect (검증 전) */
  rawEffect: unknown;
  /** 검증된 Effect AST */
  validatedEffect?: Effect;
  risk?: EffectRisk;
  name?: string;
}

/**
 * ActionDraft - Action Draft
 */
export interface ActionDraft extends FragmentDraftBase {
  kind: 'ActionFragment';
  actionId: string;
  rawPreconditions?: Array<{
    path: string;
    expect: string;
    reason?: string;
  }>;
  validatedPreconditions?: ConditionRef[];
  rawEffect?: unknown;
  validatedEffect?: Effect;
  effectRef?: string;
  semantic?: {
    verb?: string;
    description?: string;
    risk?: EffectRisk;
  };
  risk?: EffectRisk;
}

/**
 * StatementDraft - Statement Draft
 */
export interface StatementDraft extends FragmentDraftBase {
  kind: 'StatementFragment';
  statementType: StatementType | 'unknown';
  sourceCode?: string;
}

// ============================================================================
// Union Type and Type Guard
// ============================================================================

/**
 * Union type of all FragmentDraft kinds
 */
export type FragmentDraft =
  | SchemaDraft
  | SourceDraft
  | ExpressionDraft
  | DerivedDraft
  | PolicyDraft
  | EffectDraft
  | ActionDraft
  | StatementDraft;

/**
 * Type guard for FragmentDraft
 */
export function isFragmentDraft(obj: unknown): obj is FragmentDraft {
  if (!obj || typeof obj !== 'object') return false;
  const draft = obj as FragmentDraftBase;
  return (
    draft.status !== undefined &&
    ['raw', 'validated', 'lowered'].includes(draft.status) &&
    draft.origin !== undefined &&
    draft.confidence !== undefined
  );
}

// ============================================================================
// Draft Lowering Result
// ============================================================================

/**
 * Draft lowering 결과
 */
export interface DraftLoweringResult {
  /** 변환 성공 여부 */
  success: boolean;
  /** 변환된 Fragment (성공 시) */
  fragment?: Fragment;
  /** 변환 실패 이유 (실패 시) */
  errors?: DraftValidationError[];
  /** 경고 (성공 시에도 있을 수 있음) */
  warnings?: DraftValidationWarning[];
}
