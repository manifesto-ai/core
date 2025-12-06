import { describe, it, expect, vi } from 'vitest'
import { pipe } from '../pipe'
import {
  task,
  of,
  fromPromise,
  delay,
  map,
  flatMap,
  ap,
  all,
  race,
  allSettled,
  sequence,
  tryCatch,
  tap,
  Do,
  bind,
} from '../task'
import { isOk, isErr } from '../result'

describe('Task', () => {
  it('creates tasks from values and promises', async () => {
    expect(await of(42).run()).toBe(42)
    expect(await fromPromise(Promise.resolve('done')).run()).toBe('done')
  })

  it('delays resolution', async () => {
    vi.useFakeTimers()
    const promise = delay(50)('waited').run()

    await vi.advanceTimersByTimeAsync(50)
    expect(await promise).toBe('waited')
    vi.useRealTimers()
  })

  it('maps and chains tasks', async () => {
    const mapped = pipe(of(2), map((n) => n + 1))
    expect(await mapped.run()).toBe(3)

    const chained = pipe(
      of(2),
      flatMap((n) => of(n * 2)),
      flatMap((n) => of(n + 1))
    )
    expect(await chained.run()).toBe(5)
  })

  it('applies task-wrapped functions', async () => {
    const result = await pipe(of(3), ap(of((n: number) => n * 3))).run()
    expect(result).toBe(9)
  })

  it('runs tasks in parallel with all', async () => {
    vi.useFakeTimers()
    const promise = all([delay(10)('a'), delay(20)('b')]).run()

    await vi.runAllTimersAsync()
    expect(await promise).toEqual(['a', 'b'])
    vi.useRealTimers()
  })

  it('returns the fastest task with race', async () => {
    const result = await race([delay(5)('slow'), of('fast')]).run()
    expect(result).toBe('fast')
  })

  it('captures fulfillment and rejection with allSettled', async () => {
    const settled = await allSettled([
      of('ok'),
      task(() => Promise.reject(new Error('fail'))),
    ]).run()

    expect(settled[0]).toMatchObject({ status: 'fulfilled', value: 'ok' })
    expect(settled[1].status).toBe('rejected')
    if (settled[1].status === 'rejected') {
      const reason = settled[1].reason as Error
      expect(reason.message).toBe('fail')
    }
  })

  it('executes tasks sequentially with sequence', async () => {
    vi.useFakeTimers()
    const events: string[] = []
    const makeTask = (label: string, ms: number) =>
      task(async () => {
        events.push(`start-${label}`)
        await new Promise((resolve) => setTimeout(resolve, ms))
        events.push(`end-${label}`)
        return label
      })

    const promise = sequence([makeTask('a', 5), makeTask('b', 1)]).run()
    await vi.runAllTimersAsync()

    expect(await promise).toEqual(['a', 'b'])
    expect(events).toEqual(['start-a', 'end-a', 'start-b', 'end-b'])
    vi.useRealTimers()
  })

  it('wraps task results with tryCatch', async () => {
    const okResult = await tryCatch(of(1)).run()
    const errorResult = await tryCatch(
      task(async () => {
        throw new Error('boom')
      })
    ).run()

    expect(isOk(okResult) && okResult.value).toBe(1)
    expect(isErr(errorResult) && errorResult.error.message).toBe('boom')
  })

  it('taps side effects without altering value', async () => {
    const sideEffect = vi.fn()
    const result = await pipe(of(5), tap(sideEffect)).run()

    expect(result).toBe(5)
    expect(sideEffect).toHaveBeenCalledWith(5)
  })

  it('supports Do notation', async () => {
    const result = await pipe(
      Do,
      bind('a', () => of(1)),
      bind('b', ({ a }) => of(a + 2)),
      map(({ a, b }) => a + b)
    ).run()

    expect(result).toBe(4)
  })
})
