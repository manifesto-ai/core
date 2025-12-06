import { describe, it, expect, vi } from 'vitest'
import type { Option } from '../option'
import {
  some,
  none,
  isSome,
  isNone,
  fromNullable,
  fromPredicate,
  map,
  flatMap,
  fold,
  getOrElse,
  getOrUndefined,
  getOrNull,
  filter,
  orElse,
  ap,
  toResult,
  Do,
  bind,
} from '../option'
import { isOk, isErr } from '../result'
import { pipe } from '../pipe'

describe('Option', () => {
  describe('constructors and guards', () => {
    it('creates Some and None variants', () => {
      const value = some(10)
      expect(isSome(value)).toBe(true)
      expect(value.value).toBe(10)
      expect(isNone(none)).toBe(true)
    })

    it('builds from nullable values', () => {
      expect(fromNullable('text')).toMatchObject({ _tag: 'Some', value: 'text' })
      expect(fromNullable(null)).toBe(none)
      expect(fromNullable(undefined)).toBe(none)
    })

    it('builds from predicate', () => {
      const isEven = fromPredicate((n: number) => n % 2 === 0)
      expect(isSome(isEven(2))).toBe(true)
      expect(isNone(isEven(3))).toBe(true)
    })
  })

  describe('map and flatMap', () => {
    it('maps over Some and ignores None', () => {
      const mapped = pipe(some(2), map((n) => n * 3))
      expect(mapped).toMatchObject({ _tag: 'Some', value: 6 })

      const untouched = pipe(none as Option<number>, map((n) => n * 3))
      expect(untouched).toBe(none)
    })

    it('chains computations with flatMap', () => {
      const chained = pipe(
        some('hi'),
        flatMap((text) => (text.length > 1 ? some(text.length) : none))
      )
      expect(chained).toMatchObject({ _tag: 'Some', value: 2 })

      const shortCircuited = pipe(
        some('x'),
        flatMap((text) => (text.length > 1 ? some(text.length) : none)),
        flatMap((len) => some(len * 2))
      )
      expect(shortCircuited).toBe(none)
    })
  })

  describe('fold and getters', () => {
    it('patterns matches Some and None', () => {
      const onSome = pipe(
        some('value'),
        fold(
          () => 'none',
          (v) => v.toUpperCase()
        )
      )
      const onNone = pipe(
        none as Option<string>,
        fold(
          () => 'fallback',
          (v) => v
        )
      )

      expect(onSome).toBe('VALUE')
      expect(onNone).toBe('fallback')
    })

    it('extracts values safely', () => {
      expect(pipe(some(5), getOrElse(() => 0))).toBe(5)
      expect(pipe(none as Option<number>, getOrElse(() => 0))).toBe(0)
      expect(getOrUndefined(none as Option<number>)).toBeUndefined()
      expect(getOrNull(none as Option<number>)).toBeNull()
    })
  })

  describe('filter and alternatives', () => {
    it('filters Some with predicate', () => {
      const evenOnly = filter((n: number) => n % 2 === 0)
      expect(pipe(some(4), evenOnly)).toMatchObject({ _tag: 'Some', value: 4 })
      expect(pipe(some(3), evenOnly)).toBe(none)
    })

    it('fallbacks with orElse', () => {
      const alternative = vi.fn(() => some('alt'))

      expect(pipe(none as Option<string>, orElse(alternative))).toMatchObject({
        _tag: 'Some',
        value: 'alt',
      })
      expect(alternative).toHaveBeenCalledTimes(1)

      expect(pipe(some('keep'), orElse(alternative))).toMatchObject({
        _tag: 'Some',
        value: 'keep',
      })
      expect(alternative).toHaveBeenCalledTimes(1)
    })
  })

  describe('applicative and conversion', () => {
    it('applies function inside Option to another Option', () => {
      const fn = some((n: number) => `value:${n}`)
      expect(pipe(some(7), ap(fn))).toMatchObject({ _tag: 'Some', value: 'value:7' })
      expect(pipe(none as Option<number>, ap(fn))).toBe(none)
      expect(pipe(some(7), ap(none as Option<(n: number) => string>))).toBe(none)
    })

    it('converts to Result', () => {
      const success = pipe(some(3), toResult(() => 'missing'))
      const failure = pipe(none as Option<number>, toResult(() => 'missing'))

      expect(isOk(success) && success.value).toBe(3)
      expect(isErr(failure) && failure.error).toBe('missing')
    })
  })

  describe('Do notation', () => {
    it('chains computations and accumulates values', () => {
      const result = pipe(
        Do,
        bind('a', () => some(1)),
        bind('b', ({ a }) => some(a + 1)),
        map(({ a, b }) => a + b)
      )

      expect(result).toMatchObject({ _tag: 'Some', value: 3 })
    })

    it('short-circuits when any bind returns None', () => {
      const result = pipe(
        Do,
        bind('a', () => some(1)),
        bind('b', () => none),
        bind('c', () => some(3))
      )

      expect(result).toBe(none)
    })
  })
})
