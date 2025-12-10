import type { Effect } from './types.js';
import type { EvaluationContext } from '../expression/types.js';

/**
 * Result: 성공/실패를 명시적으로 표현
 */
export type Result<T, E = EffectError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * EffectError: Effect 실행 에러
 */
export type EffectError = {
  _tag: 'EffectError';
  /** 실패한 Effect */
  effect: Effect;
  /** 에러 원인 */
  cause: Error;
  /** 실패 시점 컨텍스트 */
  context?: EvaluationContext;
  /** 에러 코드 (있으면) */
  code?: string;
};

// =============================================================================
// Result Constructors
// =============================================================================

/**
 * 성공 Result 생성
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * 실패 Result 생성
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * EffectError 생성
 */
export function effectError(
  effect: Effect,
  cause: Error,
  options?: { context?: EvaluationContext; code?: string }
): EffectError {
  return {
    _tag: 'EffectError',
    effect,
    cause,
    context: options?.context,
    code: options?.code,
  };
}

// =============================================================================
// Result Utilities
// =============================================================================

/**
 * Result가 성공인지 확인
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Result가 실패인지 확인
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/**
 * Result에서 값 추출 (실패 시 예외)
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Result에서 값 추출 (실패 시 기본값)
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Result에서 에러 추출 (성공 시 undefined)
 */
export function unwrapErr<T, E>(result: Result<T, E>): E | undefined {
  if (!result.ok) {
    return result.error;
  }
  return undefined;
}

// =============================================================================
// Result Transformations (Monadic Operations)
// =============================================================================

/**
 * Result.map: 성공 값 변환
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Result.mapErr: 에러 값 변환
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (!result.ok) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Result.flatMap (bind/chain): 연쇄 연산
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Result.flatten: 중첩 Result 평탄화
 */
export function flatten<T, E>(result: Result<Result<T, E>, E>): Result<T, E> {
  if (result.ok) {
    return result.value;
  }
  return result;
}

// =============================================================================
// Result Combinators
// =============================================================================

/**
 * 여러 Result를 하나로 합침 (모두 성공해야 성공)
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * 첫 번째 성공 Result 반환
 */
export function any<T, E>(results: Result<T, E>[]): Result<T, E[]> {
  const errors: E[] = [];
  for (const result of results) {
    if (result.ok) {
      return result;
    }
    errors.push(result.error);
  }
  return err(errors);
}

/**
 * Promise를 Result로 변환
 */
export async function fromPromise<T>(
  promise: Promise<T>,
  mapError?: (e: unknown) => Error
): Promise<Result<T, Error>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (e) {
    const error = mapError ? mapError(e) : e instanceof Error ? e : new Error(String(e));
    return err(error);
  }
}

/**
 * try-catch를 Result로 변환
 */
export function tryCatch<T>(fn: () => T, mapError?: (e: unknown) => Error): Result<T, Error> {
  try {
    return ok(fn());
  } catch (e) {
    const error = mapError ? mapError(e) : e instanceof Error ? e : new Error(String(e));
    return err(error);
  }
}
