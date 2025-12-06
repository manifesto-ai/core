/**
 * Expression Primitives - 안전한 표현식 빌더
 *
 * 타입 안전한 방식으로 표현식을 구성하는 헬퍼 함수들
 * 런타임에 eval() 없이 안전하게 평가됨
 */

import type {
  Expression,
  ContextReference,
  ComparisonExpression,
  LogicalExpression,
  CollectionExpression,
  StringExpression,
  NumericExpression,
  ConditionalExpression,
  DateExpression,
} from '../types'

// ============================================================================
// Context References
// ============================================================================

export const $ = {
  /** 현재 폼 상태 참조 */
  state: (path: string): ContextReference => `$state.${path}`,

  /** 앱 컨텍스트 참조 */
  context: (path: string): ContextReference => `$context.${path}`,

  /** 유저 정보 참조 */
  user: (path: string): ContextReference => `$user.${path}`,

  /** URL/라우트 파라미터 참조 */
  params: (path: string): ContextReference => `$params.${path}`,

  /** 이전 액션 결과 참조 */
  result: (path: string): ContextReference => `$result.${path}`,

  /** 환경 변수 참조 */
  env: (path: string): ContextReference => `$env.${path}`,
}

// ============================================================================
// Comparison Operators
// ============================================================================

export const eq = (left: Expression, right: Expression): ComparisonExpression =>
  ['==', left, right]

export const neq = (left: Expression, right: Expression): ComparisonExpression =>
  ['!=', left, right]

export const gt = (left: Expression, right: Expression): ComparisonExpression =>
  ['>', left, right]

export const gte = (left: Expression, right: Expression): ComparisonExpression =>
  ['>=', left, right]

export const lt = (left: Expression, right: Expression): ComparisonExpression =>
  ['<', left, right]

export const lte = (left: Expression, right: Expression): ComparisonExpression =>
  ['<=', left, right]

// ============================================================================
// Logical Operators
// ============================================================================

export const and = (...conditions: Expression[]): LogicalExpression =>
  ['AND', ...conditions]

export const or = (...conditions: Expression[]): LogicalExpression =>
  ['OR', ...conditions]

export const not = (condition: Expression): LogicalExpression =>
  ['NOT', condition]

// ============================================================================
// Collection Operators
// ============================================================================

export const isIn = (value: Expression, list: Expression[]): CollectionExpression =>
  ['IN', value, list]

export const notIn = (value: Expression, list: Expression[]): CollectionExpression =>
  ['NOT_IN', value, list]

export const contains = (collection: Expression, item: Expression): CollectionExpression =>
  ['CONTAINS', collection, item]

export const isEmpty = (collection: Expression): CollectionExpression =>
  ['IS_EMPTY', collection]

export const length = (collection: Expression): CollectionExpression =>
  ['LENGTH', collection]

// ============================================================================
// String Operators
// ============================================================================

export const concat = (...parts: Expression[]): StringExpression =>
  ['CONCAT', ...parts]

export const upper = (str: Expression): StringExpression =>
  ['UPPER', str]

export const lower = (str: Expression): StringExpression =>
  ['LOWER', str]

export const trim = (str: Expression): StringExpression =>
  ['TRIM', str]

export const startsWith = (str: Expression, prefix: Expression): StringExpression =>
  ['STARTS_WITH', str, prefix]

export const endsWith = (str: Expression, suffix: Expression): StringExpression =>
  ['ENDS_WITH', str, suffix]

export const match = (str: Expression, pattern: string): StringExpression =>
  ['MATCH', str, pattern]

// ============================================================================
// Numeric Operators
// ============================================================================

export const add = (left: Expression, right: Expression): NumericExpression =>
  ['+', left, right]

export const sub = (left: Expression, right: Expression): NumericExpression =>
  ['-', left, right]

export const mul = (left: Expression, right: Expression): NumericExpression =>
  ['*', left, right]

export const div = (left: Expression, right: Expression): NumericExpression =>
  ['/', left, right]

export const mod = (left: Expression, right: Expression): NumericExpression =>
  ['%', left, right]

export const abs = (num: Expression): NumericExpression =>
  ['ABS', num]

export const round = (num: Expression, decimals?: Expression): NumericExpression =>
  decimals !== undefined ? ['ROUND', num, decimals] : ['ROUND', num]

export const floor = (num: Expression): NumericExpression =>
  ['FLOOR', num]

export const ceil = (num: Expression): NumericExpression =>
  ['CEIL', num]

export const min = (...nums: Expression[]): NumericExpression =>
  ['MIN', ...nums]

export const max = (...nums: Expression[]): NumericExpression =>
  ['MAX', ...nums]

// ============================================================================
// Conditional Operators
// ============================================================================

export const when = (
  condition: Expression,
  then: Expression,
  otherwise: Expression
): ConditionalExpression => ['IF', condition, then, otherwise]

export const caseOf = (
  ...args: [...[Expression, Expression][], Expression]
): ConditionalExpression => ['CASE', ...args] as ConditionalExpression

export const coalesce = (...values: Expression[]): ConditionalExpression =>
  ['COALESCE', ...values]

// ============================================================================
// Type Checking Operators
// ============================================================================

export const isNull = (value: Expression): Expression =>
  ['IS_NULL', value]

export const isNotNull = (value: Expression): Expression =>
  ['IS_NOT_NULL', value]

export const typeOf = (value: Expression): Expression =>
  ['TYPE_OF', value]

// ============================================================================
// Object Access Operators
// ============================================================================

export const get = (obj: Expression, key: string): Expression =>
  ['GET', obj, key]

export const getPath = (obj: Expression, path: string): Expression =>
  ['GET_PATH', obj, path]

// ============================================================================
// Date Operators
// ============================================================================

export const now = (): DateExpression => ['NOW']

export const today = (): DateExpression => ['TODAY']

export const dateDiff = (
  date1: Expression,
  date2: Expression,
  unit: 'days' | 'hours' | 'minutes'
): DateExpression => ['DATE_DIFF', date1, date2, unit]

export const dateAdd = (
  date: Expression,
  amount: number,
  unit: 'days' | 'hours' | 'minutes'
): DateExpression => ['DATE_ADD', date, amount, unit]

export const formatDate = (date: Expression, format: string): DateExpression =>
  ['FORMAT_DATE', date, format]

// ============================================================================
// Convenience Aliases
// ============================================================================

/** 필드가 특정 값일 때 */
export const fieldEquals = (field: string, value: Expression) =>
  eq($.state(field), value)

/** 필드가 비어있을 때 */
export const fieldIsEmpty = (field: string) =>
  or(isNull($.state(field)), eq($.state(field), ''))

/** 필드가 특정 값들 중 하나일 때 */
export const fieldIn = (field: string, values: Expression[]) =>
  isIn($.state(field), values)
