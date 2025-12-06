/**
 * Result Monad - Re-export from @manifesto-ai/fp
 *
 * @deprecated Import directly from '@manifesto-ai/fp' for new code.
 * This re-export is maintained for backward compatibility.
 */

// Re-export types
export type { Result, Ok, Err } from '@manifesto-ai/fp'

// Re-export constructors and type guards
export { ok, err, isOk, isErr } from '@manifesto-ai/fp'

// Re-export legacy (non-curried) API
// In fp package, legacy functions are exported with their original names (map, flatMap, etc.)
export {
  map,
  flatMap,
  fold,
  getOrElse,
  getOrThrow,
  fromNullable,
  tryCatch,
  tryCatchAsync,
  allResults as all,
  anyResult as any,
} from '@manifesto-ai/fp'
