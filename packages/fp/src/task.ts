/**
 * Task Monad - 지연된 비동기 연산을 타입 안전하게 표현
 *
 * Promise와 달리 Task는:
 * - 지연 실행 (lazy evaluation)
 * - 합성 가능 (composable)
 * - 순수 함수형 (pure functional)
 *
 * @example
 * ```typescript
 * const fetchUser = (id: number): Task<User> =>
 *   task(() => fetch(`/users/${id}`).then(r => r.json()))
 *
 * const program = pipe(
 *   fetchUser(1),
 *   T.map(user => user.name),
 *   T.flatMap(name => task(() => console.log(name)))
 * )
 *
 * // 실행은 명시적으로
 * await program.run()
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface Task<T> {
  readonly _tag: 'Task'
  readonly run: () => Promise<T>
}

// ============================================================================
// Constructors
// ============================================================================

export const task = <T>(run: () => Promise<T>): Task<T> => ({
  _tag: 'Task',
  run,
})

export const of = <T>(value: T): Task<T> => task(() => Promise.resolve(value))

export const fromPromise = <T>(promise: Promise<T>): Task<T> => task(() => promise)

export const delay =
  (ms: number) =>
  <T>(value: T): Task<T> =>
    task(() => new Promise((resolve) => setTimeout(() => resolve(value), ms)))

// ============================================================================
// Functor (map)
// ============================================================================

export const map =
  <T, U>(fn: (value: T) => U) =>
  (t: Task<T>): Task<U> =>
    task(async () => fn(await t.run()))

// ============================================================================
// Monad (flatMap / chain)
// ============================================================================

export const flatMap =
  <T, U>(fn: (value: T) => Task<U>) =>
  (t: Task<T>): Task<U> =>
    task(async () => {
      const result = await t.run()
      return fn(result).run()
    })

export const chain = flatMap // Alias

// ============================================================================
// Applicative (ap)
// ============================================================================

export const ap =
  <T, U>(taskFn: Task<(value: T) => U>) =>
  (t: Task<T>): Task<U> =>
    task(async () => {
      const [fn, value] = await Promise.all([taskFn.run(), t.run()])
      return fn(value)
    })

// ============================================================================
// Parallel Execution
// ============================================================================

/**
 * 모든 Task를 병렬 실행
 */
export const all = <T>(tasks: Task<T>[]): Task<T[]> =>
  task(() => Promise.all(tasks.map((t) => t.run())))

/**
 * 첫 번째로 완료되는 Task 반환
 */
export const race = <T>(tasks: Task<T>[]): Task<T> =>
  task(() => Promise.race(tasks.map((t) => t.run())))

/**
 * 모든 Task 실행 후 결과 배열 반환 (성공/실패 포함)
 */
export const allSettled = <T>(
  tasks: Task<T>[]
): Task<PromiseSettledResult<T>[]> => task(() => Promise.allSettled(tasks.map((t) => t.run())))

// ============================================================================
// Sequential Execution
// ============================================================================

/**
 * Task들을 순차적으로 실행
 */
export const sequence = <T>(tasks: Task<T>[]): Task<T[]> =>
  task(async () => {
    const results: T[] = []
    for (const t of tasks) {
      results.push(await t.run())
    }
    return results
  })

// ============================================================================
// Error Handling
// ============================================================================

import type { Result } from './result'
import { ok, err } from './result'

/**
 * Task를 TaskResult로 변환 (에러를 값으로 캡처)
 */
export const tryCatch = <T>(t: Task<T>): Task<Result<T, Error>> =>
  task(async () => {
    try {
      return ok(await t.run())
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  })

// ============================================================================
// Tap (Side Effect)
// ============================================================================

export const tap =
  <T>(fn: (value: T) => void | Promise<void>) =>
  (t: Task<T>): Task<T> =>
    task(async () => {
      const value = await t.run()
      await fn(value)
      return value
    })

// ============================================================================
// Do Notation Helper
// ============================================================================

export const Do: Task<Record<string, never>> = of({} as Record<string, never>)

export const bind =
  <N extends string, T, R extends Record<string, unknown>>(
    name: Exclude<N, keyof R>,
    fn: (r: R) => Task<T>
  ) =>
  (t: Task<R>): Task<R & { [K in N]: T }> =>
    task(async () => {
      const r = await t.run()
      const value = await fn(r).run()
      return { ...r, [name]: value } as R & { [K in N]: T }
    })
