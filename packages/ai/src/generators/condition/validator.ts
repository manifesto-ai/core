/**
 * Condition Validator - Expression AST 검증
 *
 * 생성된 Expression이 유효한지 검증:
 * - 연산자 화이트리스트 확인
 * - 필드 참조 유효성 검증
 * - 인자 개수 검증
 */

import { type Result, ok, err } from '@manifesto-ai/schema'
import {
  type Expression,
  isAllowedOperator,
  isContextReference,
} from '@manifesto-ai/schema'
import { extractReferencedFields } from '../../core/schemas/condition.schema'

// ============================================================================
// Types
// ============================================================================

export interface ValidationError {
  readonly code: string
  readonly message: string
  readonly path?: readonly (string | number)[]
}

export interface ValidationResult {
  readonly valid: boolean
  readonly errors: readonly ValidationError[]
  readonly warnings: readonly string[]
  readonly referencedFields: readonly string[]
}

// ============================================================================
// Operator Arity Map
// ============================================================================

/**
 * 연산자별 인자 개수 규칙
 */
const OPERATOR_ARITY: Record<string, { min: number; max: number }> = {
  // Comparison (binary)
  '==': { min: 2, max: 2 },
  '!=': { min: 2, max: 2 },
  '>': { min: 2, max: 2 },
  '>=': { min: 2, max: 2 },
  '<': { min: 2, max: 2 },
  '<=': { min: 2, max: 2 },
  // Logical
  AND: { min: 1, max: Infinity },
  OR: { min: 1, max: Infinity },
  NOT: { min: 1, max: 1 },
  // Collection
  IN: { min: 2, max: 2 },
  NOT_IN: { min: 2, max: 2 },
  CONTAINS: { min: 2, max: 2 },
  IS_EMPTY: { min: 1, max: 1 },
  LENGTH: { min: 1, max: 1 },
  // Type
  IS_NULL: { min: 1, max: 1 },
  IS_NOT_NULL: { min: 1, max: 1 },
  TYPE_OF: { min: 1, max: 1 },
  // String
  CONCAT: { min: 1, max: Infinity },
  UPPER: { min: 1, max: 1 },
  LOWER: { min: 1, max: 1 },
  TRIM: { min: 1, max: 1 },
  STARTS_WITH: { min: 2, max: 2 },
  ENDS_WITH: { min: 2, max: 2 },
  MATCH: { min: 2, max: 2 },
  // Numeric
  '+': { min: 2, max: 2 },
  '-': { min: 2, max: 2 },
  '*': { min: 2, max: 2 },
  '/': { min: 2, max: 2 },
  '%': { min: 2, max: 2 },
  ABS: { min: 1, max: 1 },
  ROUND: { min: 1, max: 2 },
  FLOOR: { min: 1, max: 1 },
  CEIL: { min: 1, max: 1 },
  MIN: { min: 1, max: Infinity },
  MAX: { min: 1, max: Infinity },
  // Conditional
  IF: { min: 3, max: 3 },
  CASE: { min: 2, max: Infinity },
  COALESCE: { min: 1, max: Infinity },
  // Access
  GET: { min: 2, max: 2 },
  GET_PATH: { min: 2, max: 2 },
  // Date
  NOW: { min: 0, max: 0 },
  TODAY: { min: 0, max: 0 },
  DATE_DIFF: { min: 3, max: 3 },
  DATE_ADD: { min: 3, max: 3 },
  FORMAT_DATE: { min: 2, max: 2 },
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Expression 전체 검증
 */
export const validateExpression = (
  expr: unknown,
  availableFields?: readonly string[]
): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: string[] = []
  const referencedFields = extractReferencedFields(expr)

  // 재귀적 검증
  const validate = (node: unknown, path: readonly (string | number)[] = []): void => {
    // Null literal
    if (node === null) {
      return
    }

    // Primitive literals
    if (typeof node === 'string') {
      // Context reference 검증
      if (node.startsWith('$')) {
        if (!isContextReference(node as Expression)) {
          errors.push({
            code: 'INVALID_CONTEXT_REF',
            message: `Invalid context reference format: ${node}`,
            path,
          })
        }
      }
      return
    }

    if (typeof node === 'number' || typeof node === 'boolean') {
      return
    }

    // Array (operator expression)
    if (Array.isArray(node)) {
      if (node.length === 0) {
        errors.push({
          code: 'EMPTY_EXPRESSION',
          message: 'Empty expression array',
          path,
        })
        return
      }

      const operator = node[0]

      // 연산자가 문자열인지 확인
      if (typeof operator !== 'string') {
        errors.push({
          code: 'INVALID_OPERATOR_TYPE',
          message: `Operator must be a string, got ${typeof operator}`,
          path: [...path, 0],
        })
        return
      }

      // 화이트리스트 확인
      if (!isAllowedOperator(operator)) {
        errors.push({
          code: 'DISALLOWED_OPERATOR',
          message: `Operator "${operator}" is not in the allowed list`,
          path: [...path, 0],
        })
        return
      }

      // 인자 개수 확인
      const arity = OPERATOR_ARITY[operator]
      if (arity) {
        const argCount = node.length - 1
        if (argCount < arity.min) {
          errors.push({
            code: 'TOO_FEW_ARGUMENTS',
            message: `Operator "${operator}" requires at least ${arity.min} argument(s), got ${argCount}`,
            path,
          })
        }
        if (argCount > arity.max) {
          errors.push({
            code: 'TOO_MANY_ARGUMENTS',
            message: `Operator "${operator}" accepts at most ${arity.max} argument(s), got ${argCount}`,
            path,
          })
        }
      }

      // 재귀적으로 인자 검증
      for (let i = 1; i < node.length; i++) {
        validate(node[i], [...path, i])
      }
      return
    }

    // 기타 타입
    errors.push({
      code: 'INVALID_NODE_TYPE',
      message: `Invalid expression node type: ${typeof node}`,
      path,
    })
  }

  validate(expr)

  // 필드 참조 검증 (availableFields가 제공된 경우)
  if (availableFields && availableFields.length > 0) {
    for (const field of referencedFields) {
      if (!availableFields.includes(field)) {
        errors.push({
          code: 'UNKNOWN_FIELD',
          message: `Referenced field "${field}" is not in the available fields list`,
        })
      }
    }
  }

  // 경고 추가
  if (referencedFields.length === 0 && Array.isArray(expr)) {
    warnings.push('Expression does not reference any state fields')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    referencedFields,
  }
}

/**
 * Expression 검증 (Result 반환)
 */
export const validateExpressionResult = (
  expr: unknown,
  availableFields?: readonly string[]
): Result<Expression, ValidationError[]> => {
  const result = validateExpression(expr, availableFields)

  if (!result.valid) {
    return err(result.errors as ValidationError[])
  }

  return ok(expr as Expression)
}

/**
 * 단순 검증 (boolean 반환)
 */
export const isValidExpression = (expr: unknown): boolean => {
  return validateExpression(expr).valid
}

/**
 * 특정 타겟에 대한 Expression 검증
 * visibility/disabled는 boolean 결과를 반환해야 함
 */
export const validateForTarget = (
  expr: unknown,
  target: 'visibility' | 'disabled' | 'validation' | 'reaction',
  availableFields?: readonly string[]
): ValidationResult => {
  const baseResult = validateExpression(expr, availableFields)

  const warnings = [...baseResult.warnings]

  // visibility/disabled는 boolean 결과를 기대
  if ((target === 'visibility' || target === 'disabled') && Array.isArray(expr)) {
    const operator = expr[0]
    const booleanOperators = ['==', '!=', '>', '>=', '<', '<=', 'AND', 'OR', 'NOT', 'IN', 'NOT_IN', 'IS_EMPTY', 'IS_NULL', 'IS_NOT_NULL', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'MATCH']
    if (typeof operator === 'string' && !booleanOperators.includes(operator)) {
      warnings.push(`Expression for ${target} should return boolean, but operator "${operator}" may not return boolean`)
    }
  }

  return {
    ...baseResult,
    warnings,
  }
}
