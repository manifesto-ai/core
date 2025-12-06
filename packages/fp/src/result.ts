/**
 * Result Monad - 연산의 성공/실패를 타입 안전하게 표현
 *
 * 모나딕 특성:
 * - map: 성공 값에 함수 적용
 * - flatMap: 연쇄적인 연산 합성
 * - fold: 패턴 매칭으로 값 추출
 *
 * @example
 * ```typescript
 * const divide = (a: number, b: number): Result<number, string> =>
 *   b === 0 ? err('Division by zero') : ok(a / b)
 *
 * const result = pipe(
 *   divide(10, 2),
 *   R.map(x => x * 2),
 *   R.flatMap(x => divide(x, 2))
 * )
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type Result<T, E = Error> = Ok<T> | Err<E>

export interface Ok<T> {
  readonly _tag: 'Ok'
  readonly value: T
}

export interface Err<E> {
  readonly _tag: 'Err'
  readonly error: E
}

// ============================================================================
// Constructors
// ============================================================================

export const ok = <T>(value: T): Ok<T> => ({ _tag: 'Ok', value })

export const err = <E>(error: E): Err<E> => ({ _tag: 'Err', error })

// ============================================================================
// Type Guards
// ============================================================================

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result._tag === 'Ok'

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => result._tag === 'Err'

// ============================================================================
// Functor (map)
// ============================================================================

export const map =
  <T, U>(fn: (value: T) => U) =>
  <E>(result: Result<T, E>): Result<U, E> =>
    isOk(result) ? ok(fn(result.value)) : result

// ============================================================================
// Monad (flatMap / chain)
// ============================================================================

export const flatMap =
  <T, U, E>(fn: (value: T) => Result<U, E>) =>
  (result: Result<T, E>): Result<U, E> =>
    isOk(result) ? fn(result.value) : result

// Alias for flatMap
export const chain = flatMap

// ============================================================================
// Bifunctor (mapErr)
// ============================================================================

export const mapErr =
  <E, F>(fn: (error: E) => F) =>
  <T>(result: Result<T, E>): Result<T, F> =>
    isErr(result) ? err(fn(result.error)) : (result as unknown as Result<T, F>)

// ============================================================================
// Fold (Pattern Matching)
// ============================================================================

export const fold =
  <T, E, U>(onErr: (error: E) => U, onOk: (value: T) => U) =>
  (result: Result<T, E>): U =>
    isOk(result) ? onOk(result.value) : onErr(result.error)

export const match = fold // Alias

// ============================================================================
// Utility Functions
// ============================================================================

export const getOrElse =
  <T>(defaultValue: T) =>
  <E>(result: Result<T, E>): T =>
    isOk(result) ? result.value : defaultValue

export const getOrThrow = <T, E>(result: Result<T, E>): T => {
  if (isOk(result)) return result.value
  throw result.error
}

export const fromNullable =
  <E>(error: E) =>
  <T>(value: T | null | undefined): Result<T, E> =>
    value != null ? ok(value) : err(error)

export const fromPredicate =
  <T, E>(predicate: (value: T) => boolean, onFalse: (value: T) => E) =>
  (value: T): Result<T, E> =>
    predicate(value) ? ok(value) : err(onFalse(value))

// ============================================================================
// Try/Catch Wrappers
// ============================================================================

export const tryCatch = <T>(fn: () => T): Result<T, Error> => {
  try {
    return ok(fn())
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}

export const tryCatchAsync = async <T>(fn: () => Promise<T>): Promise<Result<T, Error>> => {
  try {
    return ok(await fn())
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)))
  }
}

// ============================================================================
// Combine Multiple Results
// ============================================================================

/**
 * 모든 Result가 Ok인 경우 Ok<T[]> 반환, 하나라도 Err면 첫 번째 Err 반환
 */
export const all = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = []
  for (const result of results) {
    if (isErr(result)) return result
    values.push(result.value)
  }
  return ok(values)
}

/**
 * 첫 번째 Ok를 반환, 모두 Err면 모든 에러를 배열로 반환
 */
export const any = <T, E>(results: Result<T, E>[]): Result<T, E[]> => {
  const errors: E[] = []
  for (const result of results) {
    if (isOk(result)) return ok(result.value)
    errors.push(result.error)
  }
  return err(errors)
}

// ============================================================================
// Applicative (ap)
// ============================================================================

/**
 * Result에 감싸진 함수를 Result에 감싸진 값에 적용
 */
export const ap =
  <T, U, E>(resultFn: Result<(value: T) => U, E>) =>
  (result: Result<T, E>): Result<U, E> =>
    isOk(resultFn) && isOk(result) ? ok(resultFn.value(result.value)) : isErr(resultFn) ? resultFn : (result as Err<E>)

// ============================================================================
// Do Notation Helper
// ============================================================================

/**
 * Do notation 스타일로 Result 체이닝
 *
 * @example
 * ```typescript
 * const result = Do
 *   .bind('a', ok(1))
 *   .bind('b', ok(2))
 *   .map(({ a, b }) => a + b)
 * ```
 */
export const Do: Result<Record<string, never>, never> = ok({} as Record<string, never>)

export const bind =
  <N extends string, T, E, R extends Record<string, unknown>>(
    name: Exclude<N, keyof R>,
    fn: (r: R) => Result<T, E>
  ) =>
  (result: Result<R, E>): Result<R & { [K in N]: T }, E> => {
    if (isErr(result)) return result
    const nextResult = fn(result.value)
    if (isErr(nextResult)) return nextResult
    return ok({ ...result.value, [name]: nextResult.value } as R & { [K in N]: T })
  }

// ============================================================================
// Legacy API (for backward compatibility)
// ============================================================================

// Non-curried versions for backward compatibility with existing code
export const mapResult = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  map(fn)(result)

export const flatMapResult = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => flatMap(fn)(result)

export const foldResult = <T, E, U>(
  result: Result<T, E>,
  onErr: (error: E) => U,
  onOk: (value: T) => U
): U => fold(onErr, onOk)(result)

export const getOrElseResult = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  getOrElse(defaultValue)(result)

export const fromNullableResult = <T>(
  value: T | null | undefined,
  error: Error
): Result<T, Error> => fromNullable(error)(value)
