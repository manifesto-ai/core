/**
 * Result Monad Tests
 */

import { describe, it, expect } from 'vitest'
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  flatMap,
  mapErr,
  fold,
  getOrElse,
  getOrThrow,
  fromNullable,
  fromPredicate,
  tryCatch,
  tryCatchAsync,
  all,
  any,
  ap,
  Do,
  bind,
} from '../result'
import { pipe } from '../pipe'

describe('Result', () => {
  describe('constructors', () => {
    it('ok creates Ok', () => {
      const result = ok(42)
      expect(result._tag).toBe('Ok')
      expect(result.value).toBe(42)
    })

    it('err creates Err', () => {
      const result = err('error')
      expect(result._tag).toBe('Err')
      expect(result.error).toBe('error')
    })
  })

  describe('type guards', () => {
    it('isOk returns true for Ok', () => {
      expect(isOk(ok(42))).toBe(true)
      expect(isOk(err('error'))).toBe(false)
    })

    it('isErr returns true for Err', () => {
      expect(isErr(err('error'))).toBe(true)
      expect(isErr(ok(42))).toBe(false)
    })
  })

  describe('map', () => {
    it('transforms Ok value', () => {
      const result = pipe(ok(5), map((x) => x * 2))
      expect(isOk(result) && result.value).toBe(10)
    })

    it('passes through Err', () => {
      const result = pipe(
        err('error') as ReturnType<typeof err<string>>,
        map((x: number) => x * 2)
      )
      expect(isErr(result) && result.error).toBe('error')
    })
  })

  describe('flatMap', () => {
    it('chains Ok values', () => {
      const divide = (a: number, b: number) =>
        b === 0 ? err('Division by zero') : ok(a / b)

      const result = pipe(
        ok(10),
        flatMap((x) => divide(x, 2))
      )
      expect(isOk(result) && result.value).toBe(5)
    })

    it('short-circuits on Err', () => {
      const divide = (a: number, b: number) =>
        b === 0 ? err('Division by zero') : ok(a / b)

      const result = pipe(
        ok(10),
        flatMap((x) => divide(x, 0)),
        flatMap((x) => ok(x * 2))
      )
      expect(isErr(result) && result.error).toBe('Division by zero')
    })
  })

  describe('mapErr', () => {
    it('transforms Err value', () => {
      const result = pipe(
        err('error'),
        mapErr((e) => `Wrapped: ${e}`)
      )
      expect(isErr(result) && result.error).toBe('Wrapped: error')
    })

    it('passes through Ok', () => {
      const result = pipe(
        ok(42) as ReturnType<typeof ok<number>> | ReturnType<typeof err<string>>,
        mapErr((e: string) => `Wrapped: ${e}`)
      )
      expect(isOk(result) && result.value).toBe(42)
    })
  })

  describe('fold', () => {
    it('applies onOk for Ok', () => {
      const result = pipe(
        ok(5),
        fold(
          () => 'error',
          (x) => `value: ${x}`
        )
      )
      expect(result).toBe('value: 5')
    })

    it('applies onErr for Err', () => {
      const result = pipe(
        err('oops'),
        fold(
          (e) => `error: ${e}`,
          () => 'value'
        )
      )
      expect(result).toBe('error: oops')
    })
  })

  describe('getOrElse', () => {
    it('returns value for Ok', () => {
      expect(pipe(ok(42), getOrElse(0))).toBe(42)
    })

    it('returns default for Err', () => {
      expect(pipe(err('error'), getOrElse(0))).toBe(0)
    })
  })

  describe('getOrThrow', () => {
    it('returns value for Ok', () => {
      expect(getOrThrow(ok(42))).toBe(42)
    })

    it('throws for Err', () => {
      expect(() => getOrThrow(err(new Error('test')))).toThrow('test')
    })
  })

  describe('fromNullable', () => {
    it('returns Ok for non-null', () => {
      const result = fromNullable('error')(42)
      expect(isOk(result) && result.value).toBe(42)
    })

    it('returns Err for null', () => {
      const result = fromNullable('error')(null)
      expect(isErr(result) && result.error).toBe('error')
    })

    it('returns Err for undefined', () => {
      const result = fromNullable('error')(undefined)
      expect(isErr(result) && result.error).toBe('error')
    })
  })

  describe('fromPredicate', () => {
    it('returns Ok when predicate is true', () => {
      const isPositive = fromPredicate(
        (n: number) => n > 0,
        (n) => `${n} is not positive`
      )
      expect(isOk(isPositive(5))).toBe(true)
    })

    it('returns Err when predicate is false', () => {
      const isPositive = fromPredicate(
        (n: number) => n > 0,
        (n) => `${n} is not positive`
      )
      const result = isPositive(-5)
      expect(isErr(result) && result.error).toBe('-5 is not positive')
    })
  })

  describe('tryCatch', () => {
    it('returns Ok for successful function', () => {
      const result = tryCatch(() => 42)
      expect(isOk(result) && result.value).toBe(42)
    })

    it('returns Err for throwing function', () => {
      const result = tryCatch(() => {
        throw new Error('test')
      })
      expect(isErr(result) && result.error.message).toBe('test')
    })
  })

  describe('tryCatchAsync', () => {
    it('returns Ok for successful async function', async () => {
      const result = await tryCatchAsync(async () => 42)
      expect(isOk(result) && result.value).toBe(42)
    })

    it('returns Err for rejected promise', async () => {
      const result = await tryCatchAsync(async () => {
        throw new Error('async error')
      })
      expect(isErr(result) && result.error.message).toBe('async error')
    })
  })

  describe('all', () => {
    it('combines all Ok values', () => {
      const result = all([ok(1), ok(2), ok(3)])
      expect(isOk(result) && result.value).toEqual([1, 2, 3])
    })

    it('returns first Err', () => {
      const result = all([ok(1), err('error'), ok(3)])
      expect(isErr(result) && result.error).toBe('error')
    })
  })

  describe('any', () => {
    it('returns first Ok', () => {
      const result = any([err('e1'), ok(42), err('e2')])
      expect(isOk(result) && result.value).toBe(42)
    })

    it('returns all errors if no Ok', () => {
      const result = any([err('e1'), err('e2')])
      expect(isErr(result) && result.error).toEqual(['e1', 'e2'])
    })
  })

  describe('ap', () => {
    it('applies function in Result to value in Result', () => {
      const fn = ok((x: number) => x * 2)
      const result = pipe(ok(5), ap(fn))
      expect(isOk(result) && result.value).toBe(10)
    })
  })

  describe('Do notation', () => {
    it('chains multiple bindings', () => {
      const result = pipe(
        Do,
        bind('a', () => ok(1)),
        bind('b', () => ok(2)),
        bind('c', ({ a, b }) => ok(a + b)),
        map(({ c }) => c)
      )
      expect(isOk(result) && result.value).toBe(3)
    })

    it('short-circuits on error', () => {
      const result = pipe(
        Do,
        bind('a', () => ok(1)),
        bind('b', () => err('error')),
        bind('c', ({ a }) => ok(a + 1))
      )
      expect(isErr(result) && result.error).toBe('error')
    })
  })
})
