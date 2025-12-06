import { describe, it, expect, vi } from 'vitest'
import { pipe, flow, identity, constant, tap } from '../pipe'

describe('pipe utilities', () => {
  it('pipes values through functions', () => {
    const result = pipe(
      2,
      (n) => n + 1,
      (n) => n * 3
    )
    expect(result).toBe(9)
  })

  it('returns the same value when no functions are provided', () => {
    expect(pipe('value')).toBe('value')
  })

  it('flows functions left-to-right', () => {
    const transform = flow(
      (a: number, b: number) => a + b,
      (sum) => `sum:${sum}`
    )
    expect(transform(2, 3)).toBe('sum:5')
  })

  it('flows with no functions as passthrough', () => {
    const passthrough = flow()
    expect(passthrough('first', 'second')).toBe('first')
  })

  it('returns the same reference with identity', () => {
    const original = { value: 1 }
    expect(identity(original)).toBe(original)
  })

  it('creates constant-producing functions', () => {
    const always = constant(7)
    expect(always()).toBe(7)
  })

  it('taps side effects without changing the value', () => {
    const spy = vi.fn()
    const value = tap(spy)('hello')

    expect(value).toBe('hello')
    expect(spy).toHaveBeenCalledWith('hello')
  })
})
