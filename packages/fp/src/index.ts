/**
 * @manifesto-ai/fp
 *
 * Functional programming primitives for Manifesto
 * Atomic, composable, type-safe utilities
 *
 * @example
 * ```typescript
 * import { pipe, Result, Option, Task } from '@manifesto-ai/fp'
 * import * as R from '@manifesto-ai/fp/result'
 * import * as O from '@manifesto-ai/fp/option'
 * import * as T from '@manifesto-ai/fp/task'
 *
 * // pipe로 함수 합성
 * const result = pipe(
 *   R.ok(5),
 *   R.map(x => x * 2),
 *   R.flatMap(x => x > 5 ? R.ok(x) : R.err('Too small'))
 * )
 *
 * // Do notation 스타일
 * const program = pipe(
 *   R.Do,
 *   R.bind('a', () => R.ok(1)),
 *   R.bind('b', () => R.ok(2)),
 *   R.map(({ a, b }) => a + b)
 * )
 * ```
 */

// ============================================================================
// Result Monad
// ============================================================================

export {
  // Types
  type Result,
  type Ok,
  type Err,
  // Constructors
  ok,
  err,
  // Type Guards
  isOk,
  isErr,
  // Operations (curried)
  map as mapResult,
  flatMap as flatMapResult,
  chain as chainResult,
  mapErr,
  fold as foldResult,
  match as matchResult,
  getOrElse as getOrElseResult,
  getOrThrow,
  fromNullable as fromNullableResult,
  fromPredicate as fromPredicateResult,
  // Try/Catch
  tryCatch,
  tryCatchAsync,
  // Combine
  all as allResults,
  any as anyResult,
  // Applicative
  ap as apResult,
  // Do notation
  Do as DoResult,
  bind as bindResult,
  // Legacy API (non-curried, for backward compatibility)
  mapResult as map,
  flatMapResult as flatMap,
  foldResult as fold,
  getOrElseResult as getOrElse,
  fromNullableResult as fromNullable,
} from './result'

// ============================================================================
// Option Monad
// ============================================================================

export {
  // Types
  type Option,
  type Some,
  type None,
  // Constructors
  some,
  none,
  of as ofOption,
  fromNullable as fromNullableOption,
  fromPredicate as fromPredicateOption,
  // Type Guards
  isSome,
  isNone,
  // Operations
  map as mapOption,
  flatMap as flatMapOption,
  chain as chainOption,
  fold as foldOption,
  match as matchOption,
  getOrElse as getOrElseOption,
  getOrUndefined,
  getOrNull,
  toNullable,
  toUndefined,
  filter as filterOption,
  orElse,
  alt,
  // Applicative
  ap as apOption,
  // Conversion
  toResult,
  // Do notation
  Do as DoOption,
  bind as bindOption,
} from './option'

// ============================================================================
// Task Monad
// ============================================================================

export {
  // Types
  type Task,
  // Constructors
  task,
  of as ofTask,
  fromPromise,
  delay,
  // Operations
  map as mapTask,
  flatMap as flatMapTask,
  chain as chainTask,
  // Applicative
  ap as apTask,
  // Parallel
  all as allTasks,
  race as raceTasks,
  allSettled as allSettledTasks,
  // Sequential
  sequence as sequenceTasks,
  // Error handling
  tryCatch as tryCatchTask,
  // Side effects
  tap as tapTask,
  // Do notation
  Do as DoTask,
  bind as bindTask,
} from './task'

// ============================================================================
// Pipe & Flow
// ============================================================================

export { pipe, flow, identity, constant, tap } from './pipe'

// ============================================================================
// Namespace Exports (for qualified imports)
// ============================================================================

import * as ResultNS from './result'
import * as OptionNS from './option'
import * as TaskNS from './task'

export { ResultNS as R, OptionNS as O, TaskNS as T }
