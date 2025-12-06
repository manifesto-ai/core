import { describe, test, expect } from 'vitest'
import {
  type Expression,
  type ContextReference,
  ALLOWED_OPERATORS,
  isLiteral,
  isContextReference,
  isExpressionArray,
  isAllowedOperator,
} from '../expression'

describe('Expression Types', () => {
  describe('Type Guards', () => {
    test('isLiteral() identifies string literals', () => {
      expect(isLiteral('hello')).toBe(true)
      expect(isLiteral('')).toBe(true)
    })

    test('isLiteral() identifies number literals', () => {
      expect(isLiteral(42)).toBe(true)
      expect(isLiteral(0)).toBe(true)
      expect(isLiteral(-1)).toBe(true)
      expect(isLiteral(3.14)).toBe(true)
    })

    test('isLiteral() identifies boolean literals', () => {
      expect(isLiteral(true)).toBe(true)
      expect(isLiteral(false)).toBe(true)
    })

    test('isLiteral() identifies null', () => {
      expect(isLiteral(null)).toBe(true)
    })

    test('isLiteral() rejects arrays', () => {
      expect(isLiteral([])).toBe(false)
      expect(isLiteral([1, 2, 3])).toBe(false)
      expect(isLiteral(['==', 1, 2])).toBe(false)
    })

    test('isLiteral() rejects undefined', () => {
      expect(isLiteral(undefined)).toBe(false)
    })

    test('isLiteral() rejects objects', () => {
      expect(isLiteral({})).toBe(false)
      expect(isLiteral({ a: 1 })).toBe(false)
    })

    test('isContextReference() identifies $state references', () => {
      expect(isContextReference('$state.name')).toBe(true)
      expect(isContextReference('$state.user.id')).toBe(true)
      expect(isContextReference('$state')).toBe(true)
    })

    test('isContextReference() identifies $user references', () => {
      expect(isContextReference('$user.id')).toBe(true)
      expect(isContextReference('$user.role')).toBe(true)
    })

    test('isContextReference() identifies $context references', () => {
      expect(isContextReference('$context.brandId')).toBe(true)
    })

    test('isContextReference() identifies $params references', () => {
      expect(isContextReference('$params.id')).toBe(true)
    })

    test('isContextReference() identifies $result references', () => {
      expect(isContextReference('$result.data')).toBe(true)
    })

    test('isContextReference() identifies $env references', () => {
      expect(isContextReference('$env.API_URL')).toBe(true)
    })

    test('isContextReference() rejects non-$ strings', () => {
      expect(isContextReference('state.name')).toBe(false)
      expect(isContextReference('hello')).toBe(false)
      expect(isContextReference('')).toBe(false)
    })

    test('isContextReference() rejects non-string values', () => {
      expect(isContextReference(42)).toBe(false)
      expect(isContextReference(null)).toBe(false)
      expect(isContextReference(['$state'])).toBe(false)
    })

    test('isExpressionArray() identifies expression arrays', () => {
      expect(isExpressionArray(['==', 1, 2])).toBe(true)
      expect(isExpressionArray(['AND', true, false])).toBe(true)
      expect(isExpressionArray(['IF', true, 'yes', 'no'])).toBe(true)
    })

    test('isExpressionArray() accepts empty arrays (implementation is Array.isArray)', () => {
      // Note: The actual implementation uses Array.isArray only
      expect(isExpressionArray([])).toBe(true)
    })

    test('isExpressionArray() accepts any arrays (implementation is Array.isArray)', () => {
      // Note: The actual implementation uses Array.isArray only
      expect(isExpressionArray([1, 2, 3])).toBe(true)
      expect(isExpressionArray([null, 'test'])).toBe(true)
    })

    test('isExpressionArray() rejects non-arrays', () => {
      expect(isExpressionArray('test')).toBe(false)
      expect(isExpressionArray(42)).toBe(false)
      expect(isExpressionArray({})).toBe(false)
    })
  })

  describe('ALLOWED_OPERATORS', () => {
    test('contains all comparison operators', () => {
      expect(ALLOWED_OPERATORS).toContain('==')
      expect(ALLOWED_OPERATORS).toContain('!=')
      expect(ALLOWED_OPERATORS).toContain('>')
      expect(ALLOWED_OPERATORS).toContain('>=')
      expect(ALLOWED_OPERATORS).toContain('<')
      expect(ALLOWED_OPERATORS).toContain('<=')
    })

    test('contains all logical operators', () => {
      expect(ALLOWED_OPERATORS).toContain('AND')
      expect(ALLOWED_OPERATORS).toContain('OR')
      expect(ALLOWED_OPERATORS).toContain('NOT')
    })

    test('contains all collection operators', () => {
      expect(ALLOWED_OPERATORS).toContain('IN')
      expect(ALLOWED_OPERATORS).toContain('NOT_IN')
      expect(ALLOWED_OPERATORS).toContain('CONTAINS')
      expect(ALLOWED_OPERATORS).toContain('IS_EMPTY')
      expect(ALLOWED_OPERATORS).toContain('LENGTH')
    })

    test('contains all string operators', () => {
      expect(ALLOWED_OPERATORS).toContain('CONCAT')
      expect(ALLOWED_OPERATORS).toContain('UPPER')
      expect(ALLOWED_OPERATORS).toContain('LOWER')
      expect(ALLOWED_OPERATORS).toContain('TRIM')
      expect(ALLOWED_OPERATORS).toContain('STARTS_WITH')
      expect(ALLOWED_OPERATORS).toContain('ENDS_WITH')
      expect(ALLOWED_OPERATORS).toContain('MATCH')
    })

    test('contains all numeric operators', () => {
      expect(ALLOWED_OPERATORS).toContain('+')
      expect(ALLOWED_OPERATORS).toContain('-')
      expect(ALLOWED_OPERATORS).toContain('*')
      expect(ALLOWED_OPERATORS).toContain('/')
      expect(ALLOWED_OPERATORS).toContain('%')
      expect(ALLOWED_OPERATORS).toContain('ABS')
      expect(ALLOWED_OPERATORS).toContain('ROUND')
      expect(ALLOWED_OPERATORS).toContain('FLOOR')
      expect(ALLOWED_OPERATORS).toContain('CEIL')
      expect(ALLOWED_OPERATORS).toContain('MIN')
      expect(ALLOWED_OPERATORS).toContain('MAX')
    })

    test('contains all conditional operators', () => {
      expect(ALLOWED_OPERATORS).toContain('IF')
      expect(ALLOWED_OPERATORS).toContain('CASE')
      expect(ALLOWED_OPERATORS).toContain('COALESCE')
    })

    test('contains all type operators', () => {
      expect(ALLOWED_OPERATORS).toContain('IS_NULL')
      expect(ALLOWED_OPERATORS).toContain('IS_NOT_NULL')
      expect(ALLOWED_OPERATORS).toContain('TYPE_OF')
    })

    test('contains all access operators', () => {
      expect(ALLOWED_OPERATORS).toContain('GET')
      expect(ALLOWED_OPERATORS).toContain('GET_PATH')
    })

    test('contains all date operators', () => {
      expect(ALLOWED_OPERATORS).toContain('NOW')
      expect(ALLOWED_OPERATORS).toContain('TODAY')
      expect(ALLOWED_OPERATORS).toContain('DATE_DIFF')
      expect(ALLOWED_OPERATORS).toContain('DATE_ADD')
      expect(ALLOWED_OPERATORS).toContain('FORMAT_DATE')
    })

    test('does not contain dangerous operators', () => {
      expect(ALLOWED_OPERATORS).not.toContain('eval')
      expect(ALLOWED_OPERATORS).not.toContain('exec')
      expect(ALLOWED_OPERATORS).not.toContain('Function')
      expect(ALLOWED_OPERATORS).not.toContain('require')
      expect(ALLOWED_OPERATORS).not.toContain('import')
    })
  })

  describe('isAllowedOperator()', () => {
    test('returns true for valid operators', () => {
      expect(isAllowedOperator('==')).toBe(true)
      expect(isAllowedOperator('AND')).toBe(true)
      expect(isAllowedOperator('IF')).toBe(true)
      expect(isAllowedOperator('CONCAT')).toBe(true)
    })

    test('returns false for invalid operators', () => {
      expect(isAllowedOperator('INVALID')).toBe(false)
      expect(isAllowedOperator('eval')).toBe(false)
      expect(isAllowedOperator('__proto__')).toBe(false)
    })

    test('returns false for empty string', () => {
      expect(isAllowedOperator('')).toBe(false)
    })

    test('is case sensitive', () => {
      expect(isAllowedOperator('and')).toBe(false)
      expect(isAllowedOperator('And')).toBe(false)
      expect(isAllowedOperator('AND')).toBe(true)
    })
  })

  describe('Expression type safety', () => {
    test('expression can be literal', () => {
      const expr: Expression = 42
      expect(isLiteral(expr)).toBe(true)
    })

    test('expression can be context reference', () => {
      const expr: Expression = '$state.name'
      expect(isContextReference(expr)).toBe(true)
    })

    test('expression can be operator expression', () => {
      const expr: Expression = ['==', '$state.count', 0]
      expect(isExpressionArray(expr)).toBe(true)
    })

    test('nested expressions are valid', () => {
      const expr: Expression = [
        'AND',
        ['>', '$state.count', 0],
        ['<', '$state.count', 100],
      ]
      expect(isExpressionArray(expr)).toBe(true)
    })

    test('deeply nested expressions are valid', () => {
      const expr: Expression = [
        'IF',
        ['AND', ['>', '$state.a', 0], ['<', '$state.b', 10]],
        ['CONCAT', 'Hello, ', '$state.name'],
        'default',
      ]
      expect(isExpressionArray(expr)).toBe(true)
    })
  })
})
