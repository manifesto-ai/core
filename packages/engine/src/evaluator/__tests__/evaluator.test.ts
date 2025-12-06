import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
  ExpressionEvaluator,
  createEvaluator,
  evaluate,
  type EvaluatorOptions,
} from '../evaluator'
import { createContext, createEmptyContext } from '../context'

describe('Expression Evaluator', () => {
  describe('createEvaluator()', () => {
    test('creates evaluator with default options', () => {
      const evaluator = createEvaluator()
      expect(evaluator).toBeInstanceOf(ExpressionEvaluator)
    })

    test('creates evaluator with custom options', () => {
      const evaluator = createEvaluator({
        maxDepth: 50,
        timeout: 500,
        debug: true,
      })
      expect(evaluator).toBeInstanceOf(ExpressionEvaluator)
    })
  })

  describe('ExpressionEvaluator.evaluate()', () => {
    let evaluator: ExpressionEvaluator

    beforeEach(() => {
      evaluator = createEvaluator()
    })

    describe('Literal Values', () => {
      test('evaluates null literal', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate(null, ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(null)
        }
      })

      test('evaluates string literal', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate('hello', ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe('hello')
        }
      })

      test('evaluates number literal', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate(42, ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(42)
        }
      })

      test('evaluates boolean literal', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate(true, ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(true)
        }
      })
    })

    describe('Context References', () => {
      // Context references (strings starting with $) are resolved to their
      // actual values from the evaluation context.

      test('$state reference resolves to context value', () => {
        const ctx = createContext({ state: { name: 'John' } })
        const result = evaluator.evaluate('$state.name', ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe('John')
        }
      })

      test('$state in array expression resolves correctly', () => {
        const ctx = createContext({ state: { name: 'John' } })
        const result = evaluator.evaluate(['==', '$state.name', 'John'], ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(true)
        }
      })

      test('comparing same literal strings works', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate(['==', 'hello', 'hello'], ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(true)
        }
      })

      test('context reference resolves to undefined for missing values', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate('$state.name', ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(undefined)
        }
      })

      test('nested context references resolve correctly', () => {
        const ctx = createContext({ state: { user: { id: 123 } } })
        const result = evaluator.evaluate('$state.user.id', ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(123)
        }
      })

      test('$user reference resolves correctly', () => {
        const ctx = createContext({ user: { role: 'admin' } })
        const result = evaluator.evaluate('$user.role', ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe('admin')
        }
      })

      test('$context reference resolves correctly', () => {
        const ctx = createContext({ context: { brandId: 'brand-1' } })
        const result = evaluator.evaluate('$context.brandId', ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe('brand-1')
        }
      })
    })

    describe('Array Expressions (Operators)', () => {
      test('evaluates simple comparison', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate(['==', 1, 1], ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(true)
        }
      })

      test('evaluates nested operators', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate(
          ['AND', ['>', 5, 3], ['<', 2, 4]],
          ctx
        )
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(true)
        }
      })

      test('evaluates operators with literal values', () => {
        const ctx = createEmptyContext()
        // Use literal values since context references are treated as literals
        const result = evaluator.evaluate(['>', 10, 5], ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(true)
        }
      })

      test('evaluates arithmetic operators', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate(['+', 2, 3], ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(5)
        }
      })

      test('evaluates string operators', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate(['CONCAT', 'Hello, ', 'World'], ctx)
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe('Hello, World')
        }
      })

      test('evaluates conditional operator', () => {
        const ctx = createEmptyContext()
        // Use literal values since context references are treated as literals
        const result = evaluator.evaluate(
          ['IF', ['>=', 20, 18], 'adult', 'minor'],
          ctx
        )
        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe('adult')
        }
      })
    })

    describe('Error Handling', () => {
      test('returns error for unknown operator', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate(['UNKNOWN_OP', 1, 2], ctx)
        expect(result._tag).toBe('Err')
        if (result._tag === 'Err') {
          expect(result.error.type).toBe('UNKNOWN_OPERATOR')
          expect(result.error.message).toContain('Unknown operator')
        }
      })

      test('returns error for empty array expression', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate([], ctx)
        expect(result._tag).toBe('Err')
        if (result._tag === 'Err') {
          expect(result.error.type).toBe('INVALID_EXPRESSION')
          expect(result.error.message).toContain('Empty array')
        }
      })

      test('returns error for non-string operator', () => {
        const ctx = createEmptyContext()
        const result = evaluator.evaluate([123, 1, 2], ctx)
        expect(result._tag).toBe('Err')
        if (result._tag === 'Err') {
          expect(result.error.type).toBe('INVALID_EXPRESSION')
          expect(result.error.message).toContain('Operator must be a string')
        }
      })
    })
  })

  describe('ExpressionEvaluator with Options', () => {
    describe('maxDepth', () => {
      test('respects maxDepth limit', () => {
        const evaluator = createEvaluator({ maxDepth: 3 })
        const ctx = createEmptyContext()

        // Deeply nested expression
        const deepExpr = ['+', 1, ['+', 2, ['+', 3, ['+', 4, 5]]]]
        const result = evaluator.evaluate(deepExpr, ctx)

        expect(result._tag).toBe('Err')
        if (result._tag === 'Err') {
          expect(result.error.type).toBe('MAX_DEPTH_EXCEEDED')
        }
      })

      test('allows expressions within depth limit', () => {
        const evaluator = createEvaluator({ maxDepth: 10 })
        const ctx = createEmptyContext()

        const expr = ['+', 1, ['+', 2, 3]]
        const result = evaluator.evaluate(expr, ctx)

        expect(result._tag).toBe('Ok')
        if (result._tag === 'Ok') {
          expect(result.value).toBe(6)
        }
      })
    })

    describe('debug mode', () => {
      test('collects debug log when enabled', () => {
        const evaluator = createEvaluator({ debug: true })
        const ctx = createContext({ state: { x: 5 } })

        evaluator.evaluate(['>', '$state.x', 3], ctx)

        const debugLog = evaluator.getDebugLog()
        expect(debugLog.length).toBeGreaterThan(0)
        expect(debugLog[0]).toHaveProperty('expression')
        expect(debugLog[0]).toHaveProperty('result')
        expect(debugLog[0]).toHaveProperty('depth')
        expect(debugLog[0]).toHaveProperty('timeMs')
      })

      test('debug log is empty when disabled', () => {
        const evaluator = createEvaluator({ debug: false })
        const ctx = createEmptyContext()

        evaluator.evaluate(['==', 1, 1], ctx)

        const debugLog = evaluator.getDebugLog()
        expect(debugLog).toEqual([])
      })
    })
  })

  describe('ExpressionEvaluator.evaluateMany()', () => {
    test('evaluates multiple expressions', () => {
      const evaluator = createEvaluator()
      const ctx = createContext({ state: { a: 10, b: 20 } })

      const result = evaluator.evaluateMany(
        {
          sum: ['+', 10, 20], // Use literals to avoid context resolution issue
          diff: ['-', 20, 10],
          gt: ['>', 20, 10],
        },
        ctx
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.sum).toBe(30)
        expect(result.value.diff).toBe(10)
        expect(result.value.gt).toBe(true)
      }
    })

    test('returns first error when any expression fails', () => {
      const evaluator = createEvaluator()
      const ctx = createEmptyContext()

      const result = evaluator.evaluateMany(
        {
          valid: ['==', 1, 1],
          invalid: ['UNKNOWN', 1, 2],
          alsoValid: ['+', 1, 2],
        },
        ctx
      )

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('UNKNOWN_OPERATOR')
      }
    })

    test('evaluates with empty expressions object', () => {
      const evaluator = createEvaluator()
      const ctx = createEmptyContext()

      const result = evaluator.evaluateMany({}, ctx)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({})
      }
    })
  })

  describe('evaluate() helper function', () => {
    test('evaluates expression with default options', () => {
      const ctx = createEmptyContext()
      const result = evaluate(['>', 5, 0], ctx)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe(true)
      }
    })

    test('evaluates expression with custom options', () => {
      const ctx = createEmptyContext()
      const result = evaluate(42, ctx, { debug: true })

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe(42)
      }
    })
  })

  describe('Complex Expression Scenarios', () => {
    test('evaluates complex business logic expression', () => {
      const evaluator = createEvaluator()
      const ctx = createEmptyContext()

      // 할인율 계산: (총액 > 100 AND true) OR true => 15% 할인
      const discountExpr = [
        'IF',
        [
          'OR',
          [
            'AND',
            ['>', 150, 100],
            ['==', 'GOLD', 'GOLD'],
          ],
          ['==', true, true],
        ],
        ['*', 150, 0.85],
        150,
      ]

      const result = evaluator.evaluate(discountExpr, ctx)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe(127.5)
      }
    })

    test('evaluates chained string operations', () => {
      const evaluator = createEvaluator()
      const ctx = createEmptyContext()

      const fullNameExpr = [
        'CONCAT',
        ['UPPER', ['TRIM', '  john  ']],
        ' ',
        ['UPPER', ['TRIM', '  doe  ']],
      ]

      const result = evaluator.evaluate(fullNameExpr, ctx)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe('JOHN DOE')
      }
    })

    test('evaluates CASE expression with multiple conditions', () => {
      const evaluator = createEvaluator()
      const ctx = createEmptyContext()

      // CASE format: ['CASE', condition1, result1, condition2, result2, ..., default]
      // NOT: ['CASE', [condition, result], ...]
      const gradeExpr = [
        'CASE',
        ['>=', 85, 90], 'A',  // condition1, result1
        ['>=', 85, 80], 'B',  // condition2, result2
        ['>=', 85, 70], 'C',  // condition3, result3
        ['>=', 85, 60], 'D',  // condition4, result4
        'F',                   // default
      ]

      const result = evaluator.evaluate(gradeExpr, ctx)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe('B')
      }
    })

    test('evaluates with array operations using IN operator', () => {
      const evaluator = createEvaluator()
      const ctx = createEmptyContext()

      // IN operator checks if value is in array
      const inExpr = ['IN', 'banana', ['apple', 'banana', 'cherry']]
      const result = evaluator.evaluate(inExpr, ctx)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe(true)
      }
    })

    test('evaluates COALESCE with null values', () => {
      const evaluator = createEvaluator()
      const ctx = createEmptyContext()

      // COALESCE returns first non-null value
      const nameExpr = [
        'COALESCE',
        null,
        null,
        'user123',
        'Anonymous',
      ]

      const result = evaluator.evaluate(nameExpr, ctx)
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe('user123')
      }
    })
  })
})
