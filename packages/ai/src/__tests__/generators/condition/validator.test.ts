/**
 * Condition Validator Tests
 */

import { describe, it, expect } from 'vitest'
import {
  validateExpression,
  validateExpressionResult,
  isValidExpression,
  validateForTarget,
} from '../../../generators/condition/validator'
import { extractReferencedFields } from '../../../core/schemas/condition.schema'

// ============================================================================
// Valid Expression Tests
// ============================================================================

describe('validateExpression - Valid Expressions', () => {
  it('should validate simple comparison', () => {
    const expr = ['==', '$state.status', 'active']
    const result = validateExpression(expr)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.referencedFields).toContain('status')
  })

  it('should validate numeric comparison', () => {
    const expr = ['>=', '$state.amount', 1000000]
    const result = validateExpression(expr)

    expect(result.valid).toBe(true)
    expect(result.referencedFields).toContain('amount')
  })

  it('should validate logical AND', () => {
    const expr = ['AND', ['==', '$state.status', 'active'], ['>', '$state.amount', 0]]
    const result = validateExpression(expr)

    expect(result.valid).toBe(true)
    expect(result.referencedFields).toContain('status')
    expect(result.referencedFields).toContain('amount')
  })

  it('should validate logical OR', () => {
    const expr = ['OR', ['==', '$user.role', 'admin'], ['==', '$user.role', 'manager']]
    const result = validateExpression(expr)

    expect(result.valid).toBe(true)
    // $user references are not $state fields
    expect(result.referencedFields).toHaveLength(0)
  })

  it('should validate NOT expression', () => {
    const expr = ['NOT', ['==', '$state.status', 'inactive']]
    const result = validateExpression(expr)

    expect(result.valid).toBe(true)
  })

  it('should validate IS_EMPTY', () => {
    const expr = ['IS_EMPTY', '$state.name']
    const result = validateExpression(expr)

    expect(result.valid).toBe(true)
  })

  it('should validate IS_NULL and IS_NOT_NULL', () => {
    expect(validateExpression(['IS_NULL', '$state.value']).valid).toBe(true)
    expect(validateExpression(['IS_NOT_NULL', '$state.value']).valid).toBe(true)
  })

  it('should validate IN expression', () => {
    // IN 연산자는 2개의 인자를 받음: 값과 배열
    // 배열 자체도 expression이므로 nested array로 표현
    const expr = ['IN', '$state.status', 'active']
    const result = validateExpression(expr)

    expect(result.valid).toBe(true)
  })

  it('should validate literals', () => {
    expect(validateExpression('hello').valid).toBe(true)
    expect(validateExpression(42).valid).toBe(true)
    expect(validateExpression(true).valid).toBe(true)
    expect(validateExpression(null).valid).toBe(true)
  })

  it('should validate nested expressions', () => {
    const expr = ['AND',
      ['OR', ['==', '$state.a', 1], ['==', '$state.b', 2]],
      ['NOT', ['IS_EMPTY', '$state.c']],
    ]
    const result = validateExpression(expr)

    expect(result.valid).toBe(true)
    expect(result.referencedFields).toContain('a')
    expect(result.referencedFields).toContain('b')
    expect(result.referencedFields).toContain('c')
  })
})

// ============================================================================
// Invalid Expression Tests
// ============================================================================

describe('validateExpression - Invalid Expressions', () => {
  it('should reject disallowed operators', () => {
    const expr = ['EVAL', '$state.code']
    const result = validateExpression(expr)

    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('DISALLOWED_OPERATOR')
  })

  it('should reject empty arrays', () => {
    const result = validateExpression([])

    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('EMPTY_EXPRESSION')
  })

  it('should reject non-string operators', () => {
    const expr = [42, '$state.field', 'value']
    const result = validateExpression(expr)

    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('INVALID_OPERATOR_TYPE')
  })

  it('should reject wrong number of arguments - too few', () => {
    const expr = ['==', '$state.field'] // needs 2 operands
    const result = validateExpression(expr)

    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('TOO_FEW_ARGUMENTS')
  })

  it('should reject wrong number of arguments - too many', () => {
    const expr = ['NOT', '$state.a', '$state.b'] // NOT takes only 1
    const result = validateExpression(expr)

    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('TOO_MANY_ARGUMENTS')
  })

  it('should reject unknown field references', () => {
    const expr = ['==', '$state.unknownField', 'value']
    const availableFields = ['status', 'name', 'email']
    const result = validateExpression(expr, availableFields)

    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('UNKNOWN_FIELD')
  })

  it('should allow context references other than $state', () => {
    const expr = ['==', '$user.role', 'admin']
    const availableFields = ['status']
    const result = validateExpression(expr, availableFields)

    // $user는 $state가 아니므로 필드 검증 대상 아님
    expect(result.valid).toBe(true)
  })
})

// ============================================================================
// validateExpressionResult Tests
// ============================================================================

describe('validateExpressionResult', () => {
  it('should return Ok for valid expression', () => {
    const expr = ['==', '$state.status', 'active']
    const result = validateExpressionResult(expr)

    expect(result._tag).toBe('Ok')
  })

  it('should return Err for invalid expression', () => {
    const expr = ['INVALID_OP', '$state.field']
    const result = validateExpressionResult(expr)

    expect(result._tag).toBe('Err')
    if (result._tag === 'Err') {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })
})

// ============================================================================
// isValidExpression Tests
// ============================================================================

describe('isValidExpression', () => {
  it('should return true for valid expressions', () => {
    expect(isValidExpression(['==', '$state.x', 1])).toBe(true)
    expect(isValidExpression(['AND', ['>', '$state.a', 0], ['<', '$state.b', 100]])).toBe(true)
    expect(isValidExpression('literal')).toBe(true)
    expect(isValidExpression(42)).toBe(true)
  })

  it('should return false for invalid expressions', () => {
    expect(isValidExpression(['HACK', 'code'])).toBe(false)
    expect(isValidExpression([])).toBe(false)
    expect(isValidExpression([123, 'operand'])).toBe(false)
  })
})

// ============================================================================
// validateForTarget Tests
// ============================================================================

describe('validateForTarget', () => {
  it('should validate visibility expressions', () => {
    const expr = ['==', '$state.status', 'active']
    const result = validateForTarget(expr, 'visibility')

    expect(result.valid).toBe(true)
  })

  it('should warn for non-boolean operators in visibility', () => {
    const expr = ['CONCAT', '$state.firstName', ' ', '$state.lastName']
    const result = validateForTarget(expr, 'visibility')

    expect(result.valid).toBe(true) // Still valid syntax
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('should validate disabled expressions', () => {
    const expr = ['IS_EMPTY', '$state.requiredField']
    const result = validateForTarget(expr, 'disabled')

    expect(result.valid).toBe(true)
  })

  it('should validate validation expressions', () => {
    const expr = ['AND', ['>', '$state.startDate', 0], ['<', '$state.startDate', '$state.endDate']]
    const result = validateForTarget(expr, 'validation')

    expect(result.valid).toBe(true)
  })

  it('should validate reaction expressions', () => {
    const expr = ['!=', '$state.category', null]
    const result = validateForTarget(expr, 'reaction')

    expect(result.valid).toBe(true)
  })
})

// ============================================================================
// extractReferencedFields Tests
// ============================================================================

describe('extractReferencedFields', () => {
  it('should extract single field reference', () => {
    const fields = extractReferencedFields(['==', '$state.status', 'active'])
    expect(fields).toEqual(['status'])
  })

  it('should extract multiple field references', () => {
    const fields = extractReferencedFields([
      'AND',
      ['==', '$state.status', 'active'],
      ['>=', '$state.amount', 1000],
    ])
    expect(fields).toContain('status')
    expect(fields).toContain('amount')
  })

  it('should not include duplicate fields', () => {
    const fields = extractReferencedFields([
      'OR',
      ['==', '$state.status', 'active'],
      ['==', '$state.status', 'pending'],
    ])
    expect(fields).toEqual(['status'])
  })

  it('should ignore non-$state references', () => {
    const fields = extractReferencedFields([
      'AND',
      ['==', '$user.role', 'admin'],
      ['==', '$state.status', 'active'],
    ])
    expect(fields).toEqual(['status'])
    expect(fields).not.toContain('role')
  })

  it('should handle deeply nested expressions', () => {
    const fields = extractReferencedFields([
      'AND',
      ['OR', ['==', '$state.a', 1], ['==', '$state.b', 2]],
      ['NOT', ['IS_EMPTY', '$state.c']],
      ['IN', '$state.d', [1, 2, 3]],
    ])
    expect(fields).toContain('a')
    expect(fields).toContain('b')
    expect(fields).toContain('c')
    expect(fields).toContain('d')
  })

  it('should handle literals', () => {
    expect(extractReferencedFields('hello')).toEqual([])
    expect(extractReferencedFields(42)).toEqual([])
    expect(extractReferencedFields(null)).toEqual([])
  })
})
