/**
 * Pipe & Flow - 함수 합성 유틸리티
 *
 * pipe: 값을 함수들에 순차적으로 통과시킴 (left-to-right)
 * flow: 함수들을 합성하여 새 함수 생성 (left-to-right)
 *
 * @example
 * ```typescript
 * // pipe: 값으로 시작
 * const result = pipe(
 *   5,
 *   x => x * 2,
 *   x => x + 1,
 *   x => `Result: ${x}`
 * ) // "Result: 11"
 *
 * // flow: 함수 합성
 * const transform = flow(
 *   (x: number) => x * 2,
 *   x => x + 1,
 *   x => `Result: ${x}`
 * )
 * transform(5) // "Result: 11"
 * ```
 */

// ============================================================================
// Pipe (Value → Functions → Result)
// ============================================================================

export function pipe<A>(a: A): A
export function pipe<A, B>(a: A, ab: (a: A) => B): B
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C
export function pipe<A, B, C, D>(a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D): D
export function pipe<A, B, C, D, E>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E
): E
export function pipe<A, B, C, D, E, F>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F
): F
export function pipe<A, B, C, D, E, F, G>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G
): G
export function pipe<A, B, C, D, E, F, G, H>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H
): H
export function pipe<A, B, C, D, E, F, G, H, I>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I
): I
export function pipe(
  a: unknown,
  ...fns: Array<(a: unknown) => unknown>
): unknown {
  return fns.reduce((acc, fn) => fn(acc), a)
}

// ============================================================================
// Flow (Functions → Function)
// ============================================================================

export function flow<A extends readonly unknown[], B>(ab: (...a: A) => B): (...a: A) => B
export function flow<A extends readonly unknown[], B, C>(
  ab: (...a: A) => B,
  bc: (b: B) => C
): (...a: A) => C
export function flow<A extends readonly unknown[], B, C, D>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D
): (...a: A) => D
export function flow<A extends readonly unknown[], B, C, D, E>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E
): (...a: A) => E
export function flow<A extends readonly unknown[], B, C, D, E, F>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F
): (...a: A) => F
export function flow<A extends readonly unknown[], B, C, D, E, F, G>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G
): (...a: A) => G
export function flow<A extends readonly unknown[], B, C, D, E, F, G, H>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H
): (...a: A) => H
export function flow<A extends readonly unknown[], B, C, D, E, F, G, H, I>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I
): (...a: A) => I
export function flow(
  ...fns: Array<(...args: unknown[]) => unknown>
): (...args: unknown[]) => unknown {
  return (...args: unknown[]) => {
    if (fns.length === 0) return args[0]
    const [first, ...rest] = fns
    let result = first!(...args)
    for (const fn of rest) {
      result = fn(result)
    }
    return result
  }
}

// ============================================================================
// Identity
// ============================================================================

export const identity = <T>(x: T): T => x

// ============================================================================
// Constant
// ============================================================================

export const constant =
  <T>(value: T) =>
  (): T =>
    value

// ============================================================================
// Tap (Side Effect)
// ============================================================================

/**
 * 값을 변경하지 않고 side effect 실행
 */
export const tap =
  <T>(fn: (value: T) => void) =>
  (value: T): T => {
    fn(value)
    return value
  }
