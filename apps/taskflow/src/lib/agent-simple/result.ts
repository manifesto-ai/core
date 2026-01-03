/**
 * Result Monad - Railway-Oriented Programming
 *
 * 에러 처리를 명시적으로 타입으로 표현하여
 * try-catch 없이 안전한 파이프라인 구성
 */

// ============================================
// Result Type Definition
// ============================================

export type Ok<T> = { readonly _tag: 'Ok'; readonly value: T };
export type Err<E> = { readonly _tag: 'Err'; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

// ============================================
// Constructors
// ============================================

export const Ok = <T>(value: T): Ok<T> => ({
  _tag: 'Ok',
  value,
});

export const Err = <E>(error: E): Err<E> => ({
  _tag: 'Err',
  error,
});

// ============================================
// Type Guards
// ============================================

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> =>
  result._tag === 'Ok';

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> =>
  result._tag === 'Err';

// ============================================
// Functor: map
// ============================================

/**
 * Ok 값에 함수를 적용. Err는 그대로 통과.
 *
 * @example
 * pipe(Ok(5), map(x => x * 2)) // Ok(10)
 * pipe(Err('fail'), map(x => x * 2)) // Err('fail')
 */
export const map =
  <T, U, E>(f: (t: T) => U) =>
  (result: Result<T, E>): Result<U, E> =>
    isOk(result) ? Ok(f(result.value)) : result;

// ============================================
// Monad: flatMap (chain/bind)
// ============================================

/**
 * Ok 값에 Result를 반환하는 함수를 적용. Err는 그대로 통과.
 *
 * @example
 * const safeDivide = (n: number) => n === 0 ? Err('div by zero') : Ok(10 / n);
 * pipe(Ok(2), flatMap(safeDivide)) // Ok(5)
 * pipe(Ok(0), flatMap(safeDivide)) // Err('div by zero')
 */
export const flatMap =
  <T, U, E>(f: (t: T) => Result<U, E>) =>
  (result: Result<T, E>): Result<U, E> =>
    isOk(result) ? f(result.value) : result;

// ============================================
// Async flatMap
// ============================================

/**
 * Promise<Result>를 반환하는 함수를 체이닝
 *
 * @example
 * await pipe(Ok(url), flatMapAsync(fetchData))
 */
export const flatMapAsync =
  <T, U, E>(f: (t: T) => Promise<Result<U, E>>) =>
  async (result: Result<T, E>): Promise<Result<U, E>> =>
    isOk(result) ? f(result.value) : result;

// ============================================
// Error Mapping
// ============================================

/**
 * Err 값을 다른 타입으로 변환
 *
 * @example
 * pipe(Err('oops'), mapError(e => new Error(e))) // Err(Error('oops'))
 */
export const mapError =
  <T, E, F>(f: (e: E) => F) =>
  (result: Result<T, E>): Result<T, F> =>
    isErr(result) ? Err(f(result.error)) : result;

// ============================================
// Pattern Matching
// ============================================

/**
 * Result를 fold/match하여 단일 값으로 변환
 *
 * @example
 * pipe(result, match(
 *   err => `Error: ${err}`,
 *   val => `Success: ${val}`
 * ))
 */
export const match =
  <T, E, R>(onErr: (e: E) => R, onOk: (t: T) => R) =>
  (result: Result<T, E>): R =>
    isOk(result) ? onOk(result.value) : onErr(result.error);

// ============================================
// Unwrapping
// ============================================

/**
 * Ok 값을 반환하거나 기본값 반환
 *
 * @example
 * pipe(Ok(5), getOrElse(0)) // 5
 * pipe(Err('fail'), getOrElse(0)) // 0
 */
export const getOrElse =
  <T>(defaultValue: T) =>
  <E>(result: Result<T, E>): T =>
    isOk(result) ? result.value : defaultValue;

/**
 * Ok 값을 반환하거나 함수 실행 결과 반환
 *
 * @example
 * pipe(Err(404), getOrElseW(code => `Error ${code}`)) // 'Error 404'
 */
export const getOrElseW =
  <E, B>(f: (e: E) => B) =>
  <T>(result: Result<T, E>): T | B =>
    isOk(result) ? result.value : f(result.error);

// ============================================
// Utility: fromNullable
// ============================================

/**
 * null/undefined를 Err로 변환
 *
 * @example
 * fromNullable('not found')(getValue()) // Ok(value) or Err('not found')
 */
export const fromNullable =
  <E>(error: E) =>
  <T>(value: T | null | undefined): Result<T, E> =>
    value != null ? Ok(value) : Err(error);

// ============================================
// Utility: tryCatch
// ============================================

/**
 * try-catch를 Result로 변환
 *
 * @example
 * tryCatch(() => JSON.parse(str), e => `Parse error: ${e}`)
 */
export const tryCatch = <T, E>(
  f: () => T,
  onError: (e: unknown) => E
): Result<T, E> => {
  try {
    return Ok(f());
  } catch (e) {
    return Err(onError(e));
  }
};

/**
 * async try-catch를 Result로 변환
 *
 * @example
 * await tryCatchAsync(() => fetch(url), e => `Fetch error: ${e}`)
 */
export const tryCatchAsync = async <T, E>(
  f: () => Promise<T>,
  onError: (e: unknown) => E
): Promise<Result<T, E>> => {
  try {
    return Ok(await f());
  } catch (e) {
    return Err(onError(e));
  }
};

// ============================================
// Utility: do notation style
// ============================================

interface DoContext<T, E> {
  bind<K extends string, U>(
    key: K,
    f: (t: T) => Result<U, E>
  ): DoContext<T & Record<K, U>, E>;
  return<R>(f: (t: T) => R): Result<R, E>;
  value: Result<T, E>;
}

/**
 * 여러 Result를 순차적으로 결합 (do-notation style)
 *
 * @example
 * Do(Ok({ x: 1 }))
 *   .bind('a', ctx => Ok(ctx.x + 1))
 *   .bind('b', ctx => Ok(ctx.a * 2))
 *   .return(ctx => ctx.a + ctx.b)
 */
export function Do<T, E>(initial: Result<T, E>): DoContext<T, E> {
  return {
    bind<K extends string, U>(
      key: K,
      f: (t: T) => Result<U, E>
    ): DoContext<T & Record<K, U>, E> {
      if (isErr(initial)) {
        return Do(initial as Result<T & Record<K, U>, E>);
      }
      const next = f(initial.value);
      if (isErr(next)) {
        return Do(next as Result<T & Record<K, U>, E>);
      }
      const newValue = { ...initial.value, [key]: next.value } as T & Record<K, U>;
      return Do(Ok(newValue) as Result<T & Record<K, U>, E>);
    },
    return<R>(f: (t: T) => R): Result<R, E> {
      if (isErr(initial)) {
        return initial as Result<R, E>;
      }
      return Ok(f(initial.value));
    },
    value: initial,
  };
}
