import type { Expression } from '../expression/types.js';
import type { SemanticPath } from '../domain/types.js';

/**
 * Effect: 부수효과를 캡슐화하는 타입
 *
 * Monadic Design Principles:
 * - 실행 전까지는 "설명"일 뿐 (데이터로서의 Effect)
 * - 합성 가능 (Sequence, Parallel, Conditional)
 * - 에러 처리 일관됨 (Result<T, E>)
 * - AI가 "무슨 일이 일어날지" 이해 가능
 */
export type Effect =
  | SetValueEffect
  | SetStateEffect
  | ApiCallEffect
  | DelayEffect
  | NavigateEffect
  | SequenceEffect
  | ParallelEffect
  | ConditionalEffect
  | CatchEffect
  | EmitEventEffect;

// =============================================================================
// State Effects
// =============================================================================

/**
 * SetValueEffect: 데이터 값 설정
 */
export type SetValueEffect = {
  _tag: 'SetValue';
  /** 대상 경로 */
  path: SemanticPath;
  /** 설정할 값 (Expression으로 계산 가능) */
  value: Expression;
  /** 설명 */
  description: string;
};

/**
 * SetStateEffect: 상태 값 설정
 */
export type SetStateEffect = {
  _tag: 'SetState';
  /** 대상 경로 */
  path: SemanticPath;
  /** 설정할 값 */
  value: Expression;
  /** 설명 */
  description: string;
};

// =============================================================================
// IO Effects
// =============================================================================

/**
 * ApiCallEffect: API 호출
 */
export type ApiCallEffect = {
  _tag: 'ApiCall';
  /** 엔드포인트 (Expression 가능) */
  endpoint: string | Expression;
  /** HTTP 메서드 */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** 요청 본문 */
  body?: Record<string, Expression>;
  /** 요청 헤더 */
  headers?: Record<string, string>;
  /** 쿼리 파라미터 */
  query?: Record<string, Expression>;
  /** 타임아웃 (ms) */
  timeout?: number;
  /** 설명 */
  description: string;
};

/**
 * NavigateEffect: 페이지 이동
 */
export type NavigateEffect = {
  _tag: 'Navigate';
  /** 이동할 경로 (Expression 가능) */
  to: string | Expression;
  /** 히스토리 모드 */
  mode?: 'push' | 'replace';
  /** 설명 */
  description: string;
};

// =============================================================================
// Temporal Effects
// =============================================================================

/**
 * DelayEffect: 대기
 */
export type DelayEffect = {
  _tag: 'Delay';
  /** 대기 시간 (ms) */
  ms: number;
  /** 설명 */
  description: string;
};

// =============================================================================
// Control Effects
// =============================================================================

/**
 * SequenceEffect: 순차 실행
 */
export type SequenceEffect = {
  _tag: 'Sequence';
  /** 순차 실행할 Effect들 */
  effects: Effect[];
  /** 설명 */
  description: string;
};

/**
 * ParallelEffect: 병렬 실행
 */
export type ParallelEffect = {
  _tag: 'Parallel';
  /** 병렬 실행할 Effect들 */
  effects: Effect[];
  /** 모두 완료 대기 여부 */
  waitAll?: boolean;
  /** 설명 */
  description: string;
};

/**
 * ConditionalEffect: 조건부 실행
 */
export type ConditionalEffect = {
  _tag: 'Conditional';
  /** 조건 */
  condition: Expression;
  /** 참일 때 실행 */
  then: Effect;
  /** 거짓일 때 실행 (선택) */
  else?: Effect;
  /** 설명 */
  description: string;
};

/**
 * CatchEffect: 에러 처리
 */
export type CatchEffect = {
  _tag: 'Catch';
  /** 시도할 Effect */
  try: Effect;
  /** 에러 시 실행할 Effect */
  catch: Effect;
  /** 항상 실행할 Effect (선택) */
  finally?: Effect;
  /** 설명 */
  description: string;
};

// =============================================================================
// Event Effects
// =============================================================================

/**
 * EmitEventEffect: 일회성 이벤트 발행
 *
 * State와 달리 Snapshot에 저장되지 않음.
 * Projection Layer에서 구독하여 처리.
 */
export type EmitEventEffect = {
  _tag: 'EmitEvent';
  /** 이벤트 채널 */
  channel: 'ui' | 'domain' | 'analytics';
  /** 이벤트 페이로드 */
  payload: {
    /** 이벤트 타입 */
    type: string;
    /** 메시지 (선택) */
    message?: string;
    /** 추가 데이터 (선택) */
    data?: unknown;
    /** 이벤트 심각도 (선택, UI 채널용) */
    severity?: 'success' | 'info' | 'warning' | 'error';
    /** 지속 시간 (선택, 토스트 등) */
    duration?: number;
  };
  /** 설명 */
  description: string;
};

// =============================================================================
// Effect Helpers
// =============================================================================

/**
 * Effect 타입 가드
 */
export function isEffect(value: unknown): value is Effect {
  if (!value || typeof value !== 'object') return false;
  const { _tag } = value as { _tag?: string };
  return (
    _tag === 'SetValue' ||
    _tag === 'SetState' ||
    _tag === 'ApiCall' ||
    _tag === 'Navigate' ||
    _tag === 'Delay' ||
    _tag === 'Sequence' ||
    _tag === 'Parallel' ||
    _tag === 'Conditional' ||
    _tag === 'Catch' ||
    _tag === 'EmitEvent'
  );
}

/**
 * Effect 태그 타입
 */
export type EffectTag = Effect['_tag'];

/**
 * 특정 태그의 Effect인지 확인
 */
export function isEffectOfType<T extends EffectTag>(
  effect: Effect,
  tag: T
): effect is Extract<Effect, { _tag: T }> {
  return effect._tag === tag;
}
