/**
 * Option Monad - 값의 존재/부재를 타입 안전하게 표현
 *
 * null/undefined 대신 Some/None으로 표현
 * Maybe monad와 동일한 개념
 *
 * @example
 * ```typescript
 * const find = (arr: number[], pred: (n: number) => boolean): Option<number> => {
 *   const found = arr.find(pred)
 *   return found !== undefined ? some(found) : none
 * }
 *
 * const result = pipe(
 *   find([1, 2, 3], x => x > 2),
 *   O.map(x => x * 2),
 *   O.getOrElse(() => 0)
 * )
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type Option<T> = Some<T> | None

export interface Some<T> {
  readonly _tag: 'Some'
  readonly value: T
}

export interface None {
  readonly _tag: 'None'
}

// ============================================================================
// Constructors
// ============================================================================

export const some = <T>(value: T): Some<T> => ({ _tag: 'Some', value })

export const none: None = { _tag: 'None' }

export const of = some // Alias

// ============================================================================
// Type Guards
// ============================================================================

export const isSome = <T>(option: Option<T>): option is Some<T> => option._tag === 'Some'

export const isNone = <T>(option: Option<T>): option is None => option._tag === 'None'

// ============================================================================
// From Nullable
// ============================================================================

export const fromNullable = <T>(value: T | null | undefined): Option<T> =>
  value != null ? some(value) : none

export const fromPredicate =
  <T>(predicate: (value: T) => boolean) =>
  (value: T): Option<T> =>
    predicate(value) ? some(value) : none

// ============================================================================
// Functor (map)
// ============================================================================

export const map =
  <T, U>(fn: (value: T) => U) =>
  (option: Option<T>): Option<U> =>
    isSome(option) ? some(fn(option.value)) : none

// ============================================================================
// Monad (flatMap / chain)
// ============================================================================

export const flatMap =
  <T, U>(fn: (value: T) => Option<U>) =>
  (option: Option<T>): Option<U> =>
    isSome(option) ? fn(option.value) : none

export const chain = flatMap // Alias

// ============================================================================
// Fold (Pattern Matching)
// ============================================================================

export const fold =
  <T, U>(onNone: () => U, onSome: (value: T) => U) =>
  (option: Option<T>): U =>
    isSome(option) ? onSome(option.value) : onNone()

export const match = fold // Alias

// ============================================================================
// Utility Functions
// ============================================================================

export const getOrElse =
  <T>(defaultValue: () => T) =>
  (option: Option<T>): T =>
    isSome(option) ? option.value : defaultValue()

export const getOrUndefined = <T>(option: Option<T>): T | undefined =>
  isSome(option) ? option.value : undefined

export const getOrNull = <T>(option: Option<T>): T | null =>
  isSome(option) ? option.value : null

export const toNullable = getOrNull // Alias

export const toUndefined = getOrUndefined // Alias

// ============================================================================
// Filter
// ============================================================================

export const filter =
  <T>(predicate: (value: T) => boolean) =>
  (option: Option<T>): Option<T> =>
    isSome(option) && predicate(option.value) ? option : none

// ============================================================================
// Alternative (orElse)
// ============================================================================

export const orElse =
  <T>(alternative: () => Option<T>) =>
  (option: Option<T>): Option<T> =>
    isSome(option) ? option : alternative()

export const alt = orElse // Alias

// ============================================================================
// Applicative (ap)
// ============================================================================

export const ap =
  <T, U>(optionFn: Option<(value: T) => U>) =>
  (option: Option<T>): Option<U> =>
    isSome(optionFn) && isSome(option) ? some(optionFn.value(option.value)) : none

// ============================================================================
// Conversion to Result
// ============================================================================

import type { Result } from './result'
import { ok, err } from './result'

export const toResult =
  <E>(onNone: () => E) =>
  <T>(option: Option<T>): Result<T, E> =>
    isSome(option) ? ok(option.value) : err(onNone())

// ============================================================================
// Do Notation Helper
// ============================================================================

export const Do: Option<Record<string, never>> = some({} as Record<string, never>)

export const bind =
  <N extends string, T, R extends Record<string, unknown>>(
    name: Exclude<N, keyof R>,
    fn: (r: R) => Option<T>
  ) =>
  (option: Option<R>): Option<R & { [K in N]: T }> => {
    if (isNone(option)) return none
    const nextOption = fn(option.value)
    if (isNone(nextOption)) return none
    return some({ ...option.value, [name]: nextOption.value } as R & { [K in N]: T })
  }
