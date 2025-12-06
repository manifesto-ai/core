import { describe, test, expect } from 'vitest'
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  flatMap,
  fold,
  getOrElse,
  getOrThrow,
  fromNullable,
  tryCatch,
  tryCatchAsync,
  all,
  any,
  type Result,
} from '../result'

describe('Result Monad', () => {
  describe('Constructors', () => {
    test('ok() creates Ok result with value', () => {
      const result = ok(42)
      expect(result._tag).toBe('Ok')
      expect(result.value).toBe(42)
    })

    test('err() creates Err result with error', () => {
      const result = err('error message')
      expect(result._tag).toBe('Err')
      expect(result.error).toBe('error message')
    })

    test('ok() works with various types', () => {
      expect(ok('string').value).toBe('string')
      expect(ok(null).value).toBe(null)
      expect(ok(undefined).value).toBe(undefined)
      expect(ok({ a: 1 }).value).toEqual({ a: 1 })
      expect(ok([1, 2, 3]).value).toEqual([1, 2, 3])
    })

    test('err() works with various error types', () => {
      expect(err(new Error('test')).error).toBeInstanceOf(Error)
      expect(err({ code: 404 }).error).toEqual({ code: 404 })
      expect(err(null).error).toBe(null)
    })
  })

  describe('Type Guards', () => {
    test('isOk() returns true for Ok result', () => {
      const result = ok(42)
      expect(isOk(result)).toBe(true)
    })

    test('isOk() returns false for Err result', () => {
      const result = err('error')
      expect(isOk(result)).toBe(false)
    })

    test('isErr() returns true for Err result', () => {
      const result = err('error')
      expect(isErr(result)).toBe(true)
    })

    test('isErr() returns false for Ok result', () => {
      const result = ok(42)
      expect(isErr(result)).toBe(false)
    })

    test('type narrowing works correctly', () => {
      const result: Result<number, string> = ok(42)
      if (isOk(result)) {
        // TypeScript should know result.value is number
        expect(result.value + 1).toBe(43)
      }
    })
  })

  describe('map()', () => {
    test('transforms value in Ok result', () => {
      const result = ok(5)
      const mapped = map(result, (x) => x * 2)
      expect(isOk(mapped) && mapped.value).toBe(10)
    })

    test('passes through Err unchanged', () => {
      const result: Result<number, string> = err('error')
      const mapped = map(result, (x) => x * 2)
      expect(isErr(mapped) && mapped.error).toBe('error')
    })

    test('works with type-changing transformations', () => {
      const result = ok(42)
      const mapped = map(result, (x) => x.toString())
      expect(isOk(mapped) && mapped.value).toBe('42')
    })

    test('chains multiple map operations', () => {
      const result = ok(2)
      const final = map(map(map(result, (x) => x + 1), (x) => x * 2), (x) => x.toString())
      expect(isOk(final) && final.value).toBe('6')
    })
  })

  describe('flatMap()', () => {
    test('chains successful operations', () => {
      const result = ok(5)
      const chained = flatMap(result, (x) => ok(x * 2))
      expect(isOk(chained) && chained.value).toBe(10)
    })

    test('short-circuits on first error', () => {
      const result: Result<number, string> = err('first error')
      const chained = flatMap(result, (x) => ok(x * 2))
      expect(isErr(chained) && chained.error).toBe('first error')
    })

    test('propagates error from chained operation', () => {
      const result = ok(5)
      const chained = flatMap(result, () => err('chained error'))
      expect(isErr(chained) && chained.error).toBe('chained error')
    })

    test('chains multiple flatMap operations', () => {
      const divide = (a: number, b: number): Result<number, string> =>
        b === 0 ? err('division by zero') : ok(a / b)

      const result = flatMap(flatMap(ok(100), (x) => divide(x, 2)), (x) => divide(x, 5))
      expect(isOk(result) && result.value).toBe(10)
    })

    test('stops at first error in chain', () => {
      const divide = (a: number, b: number): Result<number, string> =>
        b === 0 ? err('division by zero') : ok(a / b)

      const result = flatMap(flatMap(ok(100), (x) => divide(x, 0)), (x) => divide(x, 5))
      expect(isErr(result) && result.error).toBe('division by zero')
    })
  })

  describe('fold()', () => {
    test('calls onOk handler for Ok result', () => {
      const result = ok(42)
      // Note: fold signature is (result, onErr, onOk)
      const folded = fold(
        result,
        (error) => `error: ${error}`,
        (value) => `success: ${value}`
      )
      expect(folded).toBe('success: 42')
    })

    test('calls onErr handler for Err result', () => {
      const result: Result<number, string> = err('failed')
      // Note: fold signature is (result, onErr, onOk)
      const folded = fold(
        result,
        (error) => `error: ${error}`,
        (value) => `success: ${value}`
      )
      expect(folded).toBe('error: failed')
    })

    test('returns correct value from handlers', () => {
      const okResult = ok(10)
      const errResult: Result<number, string> = err('error')

      // Note: fold signature is (result, onErr, onOk)
      expect(fold(okResult, () => 0, (v) => v * 2)).toBe(20)
      expect(fold(errResult, () => 0, (v) => v * 2)).toBe(0)
    })
  })

  describe('Utility Functions', () => {
    test('getOrElse() returns value for Ok', () => {
      const result = ok(42)
      expect(getOrElse(result, 0)).toBe(42)
    })

    test('getOrElse() returns default for Err', () => {
      const result: Result<number, string> = err('error')
      expect(getOrElse(result, 0)).toBe(0)
    })

    test('getOrThrow() returns value for Ok', () => {
      const result = ok(42)
      expect(getOrThrow(result)).toBe(42)
    })

    test('getOrThrow() throws for Err', () => {
      const result: Result<number, string> = err('error')
      expect(() => getOrThrow(result)).toThrow('error')
    })

    test('getOrThrow() throws Error object for Err', () => {
      const error = new Error('test error')
      const result: Result<number, Error> = err(error)
      expect(() => getOrThrow(result)).toThrow(error)
    })

    test('fromNullable() creates Ok for non-null', () => {
      // Note: fromNullable takes Error type as second parameter
      const result = fromNullable(42, new Error('was null'))
      expect(isOk(result)).toBe(true)
      expect(isOk(result) && result.value).toBe(42)
    })

    test('fromNullable() creates Err for null', () => {
      // Note: fromNullable takes Error type as second parameter
      const error = new Error('was null')
      const result = fromNullable(null, error)
      expect(isErr(result)).toBe(true)
      expect(isErr(result) && result.error).toBe(error)
    })

    test('fromNullable() creates Err for undefined', () => {
      // Note: fromNullable takes Error type as second parameter
      const error = new Error('was undefined')
      const result = fromNullable(undefined, error)
      expect(isErr(result)).toBe(true)
      expect(isErr(result) && result.error).toBe(error)
    })

    test('fromNullable() keeps falsy non-null values', () => {
      // Note: fromNullable takes Error type as second parameter
      const error = new Error('error')
      expect(isOk(fromNullable(0, error))).toBe(true)
      expect(isOk(fromNullable('', error))).toBe(true)
      expect(isOk(fromNullable(false, error))).toBe(true)
    })

    test('tryCatch() returns Ok for successful function', () => {
      // Note: tryCatch only takes fn parameter
      const result = tryCatch(() => JSON.parse('{"a": 1}'))
      expect(isOk(result)).toBe(true)
      expect(isOk(result) && result.value).toEqual({ a: 1 })
    })

    test('tryCatch() returns Err for throwing function', () => {
      // Note: tryCatch only takes fn parameter, error is wrapped in Error
      const result = tryCatch(() => JSON.parse('invalid json'))
      expect(isErr(result)).toBe(true)
      expect(isErr(result) && result.error instanceof Error).toBe(true)
    })

    test('tryCatchAsync() handles async success', async () => {
      // Note: tryCatchAsync only takes fn parameter
      const result = await tryCatchAsync(async () => Promise.resolve(42))
      expect(isOk(result)).toBe(true)
      expect(isOk(result) && result.value).toBe(42)
    })

    test('tryCatchAsync() handles async failure', async () => {
      // Note: tryCatchAsync only takes fn parameter, error is wrapped in Error
      const result = await tryCatchAsync(
        async () => Promise.reject(new Error('async error'))
      )
      expect(isErr(result)).toBe(true)
      expect(isErr(result) && result.error instanceof Error).toBe(true)
      expect(isErr(result) && result.error.message).toBe('async error')
    })
  })

  describe('Combinators', () => {
    test('all() returns Ok with all values when all succeed', () => {
      const results: Result<number, string>[] = [ok(1), ok(2), ok(3)]
      const combined = all(results)
      expect(isOk(combined)).toBe(true)
      expect(isOk(combined) && combined.value).toEqual([1, 2, 3])
    })

    test('all() returns first Err when any fails', () => {
      const results: Result<number, string>[] = [ok(1), err('error'), ok(3)]
      const combined = all(results)
      expect(isErr(combined)).toBe(true)
      expect(isErr(combined) && combined.error).toBe('error')
    })

    test('all() handles empty array', () => {
      const results: Result<number, string>[] = []
      const combined = all(results)
      expect(isOk(combined)).toBe(true)
      expect(isOk(combined) && combined.value).toEqual([])
    })

    test('all() returns first error in sequence', () => {
      const results: Result<number, string>[] = [ok(1), err('first'), err('second')]
      const combined = all(results)
      expect(isErr(combined) && combined.error).toBe('first')
    })

    test('any() returns first Ok when any succeeds', () => {
      const results: Result<number, string>[] = [err('e1'), ok(2), err('e3')]
      const combined = any(results)
      expect(isOk(combined)).toBe(true)
      expect(isOk(combined) && combined.value).toBe(2)
    })

    test('any() returns all errors when all fail', () => {
      const results: Result<number, string>[] = [err('e1'), err('e2'), err('e3')]
      const combined = any(results)
      expect(isErr(combined)).toBe(true)
      expect(isErr(combined) && combined.error).toEqual(['e1', 'e2', 'e3'])
    })

    test('any() handles empty array', () => {
      const results: Result<number, string>[] = []
      const combined = any(results)
      expect(isErr(combined)).toBe(true)
      expect(isErr(combined) && combined.error).toEqual([])
    })

    test('any() returns first success in sequence', () => {
      const results: Result<number, string>[] = [ok(1), ok(2), ok(3)]
      const combined = any(results)
      expect(isOk(combined) && combined.value).toBe(1)
    })
  })
})
