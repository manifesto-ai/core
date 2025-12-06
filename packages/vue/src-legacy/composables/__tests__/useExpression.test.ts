import { describe, test, expect, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import {
  useExpression,
  useCondition,
  useExpressions,
  useEvaluationContext,
} from '../useExpression'
import { createContext, createEmptyContext } from '@manifesto-ai/engine'
import type { Expression } from '@manifesto-ai/schema'

describe('useExpression', () => {
  describe('Basic Evaluation', () => {
    test('evaluates literal expression', () => {
      const ctx = createEmptyContext()
      const { result } = useExpression(42, ctx)

      expect(result.value).toBe(42)
    })

    test('evaluates string literal', () => {
      const ctx = createEmptyContext()
      const { result } = useExpression('hello', ctx)

      expect(result.value).toBe('hello')
    })

    test('evaluates boolean literal', () => {
      const ctx = createEmptyContext()
      const { result } = useExpression(true, ctx)

      expect(result.value).toBe(true)
    })

    test('evaluates null-like literal via array', () => {
      const ctx = createEmptyContext()
      // null expression이 아닌 null을 반환하는 IF 조건 사용
      const { result } = useExpression(['IF', false, 'yes', null], ctx)

      expect(result.value).toBe(null)
    })
  })

  describe('Operator Expressions', () => {
    test('evaluates comparison operator', () => {
      const ctx = createEmptyContext()
      const { result } = useExpression(['>', 10, 5], ctx)

      expect(result.value).toBe(true)
    })

    test('evaluates arithmetic operator', () => {
      const ctx = createEmptyContext()
      const { result } = useExpression(['+', 2, 3], ctx)

      expect(result.value).toBe(5)
    })

    test('evaluates nested operators', () => {
      const ctx = createEmptyContext()
      const { result } = useExpression(
        ['*', ['+', 2, 3], 4],
        ctx
      )

      expect(result.value).toBe(20)
    })

    test('evaluates string operator', () => {
      const ctx = createEmptyContext()
      const { result } = useExpression(['UPPER', 'hello'], ctx)

      expect(result.value).toBe('HELLO')
    })

    test('evaluates conditional operator', () => {
      const ctx = createEmptyContext()
      const { result } = useExpression(
        ['IF', ['>', 10, 5], 'yes', 'no'],
        ctx
      )

      expect(result.value).toBe('yes')
    })
  })

  describe('Error Handling', () => {
    test('sets error for unknown operator', () => {
      const ctx = createEmptyContext()
      const { result, error } = useExpression(['UNKNOWN_OP', 1, 2], ctx)

      expect(result.value).toBe(null)
      expect(error.value).not.toBe(null)
      expect(error.value?.type).toBe('UNKNOWN_OPERATOR')
    })

    test('evaluate with valid expression sets result correctly', () => {
      const ctx = createEmptyContext()
      const { result, error, evaluate } = useExpression(['+', 1, 2], ctx, {
        autoEvaluate: false,
      })

      // Initially result is null
      expect(result.value).toBe(null)

      // After evaluate
      evaluate()

      expect(error.value).toBe(null)
      expect(result.value).toBe(3)
    })
  })

  describe('Reactive Expression', () => {
    test('re-evaluates when expression ref changes', async () => {
      const exprRef = ref<Expression>(1)
      const ctx = createEmptyContext()
      const { result } = useExpression(exprRef, ctx)

      expect(result.value).toBe(1)

      exprRef.value = 42
      await nextTick()

      expect(result.value).toBe(42)
    })

    test('re-evaluates when context ref changes', async () => {
      const expr: Expression = ['+', 1, 2]
      const ctxRef = ref(createEmptyContext())
      const { result } = useExpression(expr, ctxRef)

      expect(result.value).toBe(3)

      // Change context (doesn't affect this expression but triggers re-eval)
      ctxRef.value = createContext({ state: { x: 10 } })
      await nextTick()

      // Result should still be 3 (context doesn't affect literal addition)
      expect(result.value).toBe(3)
    })
  })

  describe('Manual Evaluation', () => {
    test('does not auto-evaluate when disabled', () => {
      const ctx = createEmptyContext()
      const { result } = useExpression(42, ctx, { autoEvaluate: false })

      // Result should be null before manual evaluation
      expect(result.value).toBe(null)
    })

    test('evaluate() triggers evaluation', () => {
      const ctx = createEmptyContext()
      const { result, evaluate } = useExpression(42, ctx, { autoEvaluate: false })

      expect(result.value).toBe(null)

      evaluate()

      expect(result.value).toBe(42)
    })
  })

  describe('Debug Mode', () => {
    test('collects debug log when enabled', () => {
      const ctx = createEmptyContext()
      const { debugLog } = useExpression(['+', 1, 2], ctx, { debug: true })

      expect(debugLog.value.length).toBeGreaterThan(0)
    })

    test('debug log is empty when disabled', () => {
      const ctx = createEmptyContext()
      const { debugLog } = useExpression(['+', 1, 2], ctx, { debug: false })

      expect(debugLog.value.length).toBe(0)
    })
  })

  describe('isEvaluating State', () => {
    test('isEvaluating starts as false', () => {
      const ctx = createEmptyContext()
      const { isEvaluating } = useExpression(42, ctx, { autoEvaluate: false })

      expect(isEvaluating.value).toBe(false)
    })
  })
})

describe('useCondition', () => {
  test('returns boolean result for comparison', () => {
    const ctx = createEmptyContext()
    const { result } = useCondition(['>', 10, 5], ctx)

    expect(result.value).toBe(true)
  })

  test('returns boolean result for equality', () => {
    const ctx = createEmptyContext()
    const { result } = useCondition(['==', 'a', 'a'], ctx)

    expect(result.value).toBe(true)
  })

  test('returns boolean result for logical AND', () => {
    const ctx = createEmptyContext()
    const { result } = useCondition(['AND', true, false], ctx)

    expect(result.value).toBe(false)
  })

  test('returns boolean result for logical OR', () => {
    const ctx = createEmptyContext()
    const { result } = useCondition(['OR', true, false], ctx)

    expect(result.value).toBe(true)
  })

  test('returns boolean result for NOT', () => {
    const ctx = createEmptyContext()
    const { result } = useCondition(['NOT', false], ctx)

    expect(result.value).toBe(true)
  })
})

describe('useExpressions', () => {
  test('evaluates multiple expressions', () => {
    const ctx = createEmptyContext()
    const { results, errors } = useExpressions(
      {
        sum: ['+', 1, 2],
        product: ['*', 3, 4],
        comparison: ['>', 5, 3],
      },
      ctx
    )

    expect(results.value.sum).toBe(3)
    expect(results.value.product).toBe(12)
    expect(results.value.comparison).toBe(true)
    expect(Object.keys(errors.value).length).toBe(0)
  })

  test('collects errors for invalid expressions', () => {
    const ctx = createEmptyContext()
    const { results, errors } = useExpressions(
      {
        valid: ['+', 1, 2],
        invalid: ['UNKNOWN', 1, 2] as Expression,
      },
      ctx
    )

    expect(results.value.valid).toBe(3)
    expect(results.value.invalid).toBeUndefined()
    expect(errors.value.invalid).toBeDefined()
  })

  test('re-evaluates when expressions change', async () => {
    const exprsRef = ref<Record<string, Expression>>({
      x: ['+', 1, 2],
    })
    const ctx = createEmptyContext()
    const { results } = useExpressions(exprsRef, ctx)

    expect(results.value.x).toBe(3)

    exprsRef.value = { x: ['+', 10, 20] }
    await nextTick()

    expect(results.value.x).toBe(30)
  })

  test('evaluate() can be called manually', () => {
    const ctx = createEmptyContext()
    const { results, evaluate } = useExpressions(
      { x: ['+', 5, 5] },
      ctx,
      { autoEvaluate: false }
    )

    expect(results.value.x).toBeUndefined()

    evaluate()

    expect(results.value.x).toBe(10)
  })
})

describe('useEvaluationContext', () => {
  describe('Initial State', () => {
    test('creates empty context by default', () => {
      const { context } = useEvaluationContext()

      expect(context.value.state).toEqual({})
      expect(context.value.user).toEqual({})
      expect(context.value.context).toEqual({})
      expect(context.value.params).toEqual({})
      expect(context.value.result).toEqual({})
      expect(context.value.env).toEqual({})
    })

    test('creates context with initial values', () => {
      const { context } = useEvaluationContext({
        state: { name: 'John' },
        user: { role: 'admin' },
      })

      expect(context.value.state).toEqual({ name: 'John' })
      expect(context.value.user).toEqual({ role: 'admin' })
    })
  })

  describe('updateState()', () => {
    test('merges updates into state', () => {
      const { context, updateState } = useEvaluationContext({
        state: { name: 'John' },
      })

      updateState({ age: 30 })

      expect(context.value.state).toEqual({ name: 'John', age: 30 })
    })

    test('overwrites existing state values', () => {
      const { context, updateState } = useEvaluationContext({
        state: { name: 'John' },
      })

      updateState({ name: 'Jane' })

      expect(context.value.state.name).toBe('Jane')
    })
  })

  describe('setState()', () => {
    test('replaces entire state', () => {
      const { context, setState } = useEvaluationContext({
        state: { name: 'John', age: 30 },
      })

      setState({ email: 'john@example.com' })

      expect(context.value.state).toEqual({ email: 'john@example.com' })
      expect(context.value.state.name).toBeUndefined()
    })
  })

  describe('updateContext()', () => {
    test('merges updates into context', () => {
      const { context, updateContext } = useEvaluationContext({
        context: { brandId: 'brand1' },
      })

      updateContext({ theme: 'dark' })

      expect(context.value.context).toEqual({ brandId: 'brand1', theme: 'dark' })
    })
  })

  describe('updateUser()', () => {
    test('merges updates into user', () => {
      const { context, updateUser } = useEvaluationContext({
        user: { id: 'user1' },
      })

      updateUser({ role: 'admin' })

      expect(context.value.user).toEqual({ id: 'user1', role: 'admin' })
    })
  })

  describe('reset()', () => {
    test('resets to initial values', () => {
      const initial = { state: { name: 'John' } }
      const { context, updateState, reset } = useEvaluationContext(initial)

      updateState({ age: 30, city: 'NYC' })
      expect(context.value.state).toEqual({ name: 'John', age: 30, city: 'NYC' })

      reset()

      expect(context.value.state).toEqual({ name: 'John' })
    })

    test('resets to empty when no initial provided', () => {
      const { context, updateState, reset } = useEvaluationContext()

      updateState({ name: 'Added' })
      expect(context.value.state).toEqual({ name: 'Added' })

      reset()

      expect(context.value.state).toEqual({})
    })
  })

  describe('Reactivity', () => {
    test('context is reactive', async () => {
      const { context, updateState } = useEvaluationContext()

      const values: string[] = []

      // Track value
      values.push(JSON.stringify(context.value.state))

      updateState({ x: 1 })
      await nextTick()

      values.push(JSON.stringify(context.value.state))

      expect(values[0]).toBe('{}')
      expect(values[1]).toBe('{"x":1}')
    })
  })
})
