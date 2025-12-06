/**
 * Visibility Expression Analyzer
 *
 * Expression AST를 분석하여 visibility 조건의 실패 이유를 추론
 */

import type { Expression } from '@manifesto-ai/schema'
import { ok, err, type Result } from '@manifesto-ai/schema'
import type { EvaluationContext } from '@manifesto-ai/engine'
import type { FailedDependency, VisibilityMeta, SatisfactionStep } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface AnalyzerError {
  readonly type: 'INVALID_EXPRESSION' | 'UNSUPPORTED_OPERATOR' | 'CONTEXT_ERROR'
  readonly message: string
}

export interface AnalyzerOptions {
  readonly includeExpression?: boolean
  readonly computeSatisfactionPath?: boolean
}

// ============================================================================
// Operator Description Mapping
// ============================================================================

const OPERATOR_DESCRIPTIONS: Record<string, (expected: unknown) => string> = {
  '==': (expected) => `must equal ${formatValue(expected)}`,
  '!=': (expected) => `must not equal ${formatValue(expected)}`,
  '>': (expected) => `must be greater than ${formatValue(expected)}`,
  '>=': (expected) => `must be greater than or equal to ${formatValue(expected)}`,
  '<': (expected) => `must be less than ${formatValue(expected)}`,
  '<=': (expected) => `must be less than or equal to ${formatValue(expected)}`,
  'IN': (expected) => `must be one of ${formatValue(expected)}`,
  'NOT_IN': (expected) => `must not be one of ${formatValue(expected)}`,
  'IS_NULL': () => 'must be empty',
  'IS_NOT_NULL': () => 'must not be empty',
  'CONTAINS': (expected) => `must contain ${formatValue(expected)}`,
  'STARTS_WITH': (expected) => `must start with ${formatValue(expected)}`,
  'ENDS_WITH': (expected) => `must end with ${formatValue(expected)}`,
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatValue = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return `"${value}"`
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`
  return String(value)
}

const isContextReference = (expr: unknown): expr is string =>
  typeof expr === 'string' && expr.startsWith('$')

const extractFieldFromReference = (ref: string): string | null => {
  if (ref.startsWith('$state.')) {
    return ref.slice(7).split('.')[0] ?? null
  }
  return null
}

/**
 * OR 조건에서 최적의 경로 선택
 * 가장 쉬운(단계가 적은) 경로를 우선 선택
 */
const selectOptimalPath = (allFailures: FailedDependency[][]): FailedDependency[] => {
  if (allFailures.length === 0) return []
  if (allFailures.length === 1) return allFailures[0] ?? []

  // 경로별 비용 계산 후 최소 비용 경로 선택
  let optimalPath = allFailures[0]!
  let minCost = calculatePathCost(optimalPath)

  for (let i = 1; i < allFailures.length; i++) {
    const path = allFailures[i]!
    const cost = calculatePathCost(path)
    if (cost < minCost) {
      minCost = cost
      optimalPath = path
    }
  }

  return optimalPath
}

/**
 * 경로 비용 계산
 * - 기본 비용: 단계 수
 * - 연산자별 가중치: '==' (1), '!=' (1.5), 기타 (2)
 */
const calculatePathCost = (path: FailedDependency[]): number => {
  if (path.length === 0) return 0

  return path.reduce((total, dep) => {
    const operatorWeight = getOperatorWeight(dep.operator)
    return total + operatorWeight
  }, 0)
}

/**
 * 연산자별 비용 가중치
 * - '==' : 가장 간단 (특정 값으로 설정)
 * - '!=' : 중간 (다른 값으로 변경)
 * - 범위 연산자: 복잡 (숫자 범위 이해 필요)
 * - IS_NULL/IS_NOT_NULL: 간단 (빈 값/채우기)
 */
const getOperatorWeight = (operator: string): number => {
  switch (operator) {
    case '==':
    case 'IS_NULL':
    case 'IS_NOT_NULL':
      return 1
    case '!=':
    case 'IN':
    case 'NOT_IN':
      return 1.5
    case '>':
    case '>=':
    case '<':
    case '<=':
      return 2
    default:
      return 2
  }
}

const resolveValue = (expr: unknown, context: EvaluationContext): unknown => {
  if (isContextReference(expr)) {
    const parts = (expr as string).slice(1).split('.')
    const [namespace, ...path] = parts

    let value: unknown
    switch (namespace) {
      case 'state':
        value = context.state
        break
      case 'context':
        value = context.context
        break
      case 'user':
        value = context.user
        break
      case 'params':
        value = context.params
        break
      default:
        return undefined
    }

    for (const key of path) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[key]
      } else {
        return undefined
      }
    }
    return value
  }
  return expr
}

// ============================================================================
// Analyzer Implementation
// ============================================================================

/**
 * 비교 연산자 분석
 */
const analyzeComparison = (
  operator: string,
  left: unknown,
  right: unknown,
  context: EvaluationContext
): FailedDependency | null => {
  const leftValue = resolveValue(left, context)
  const rightValue = resolveValue(right, context)

  // 왼쪽이 $state 참조인 경우
  const field = isContextReference(left) ? extractFieldFromReference(left as string) : null
  if (!field) return null

  const expectedValue = rightValue
  const currentValue = leftValue

  // 조건 평가
  let satisfied = false
  switch (operator) {
    case '==':
      satisfied = currentValue === expectedValue
      break
    case '!=':
      satisfied = currentValue !== expectedValue
      break
    case '>':
      satisfied = (currentValue as number) > (expectedValue as number)
      break
    case '>=':
      satisfied = (currentValue as number) >= (expectedValue as number)
      break
    case '<':
      satisfied = (currentValue as number) < (expectedValue as number)
      break
    case '<=':
      satisfied = (currentValue as number) <= (expectedValue as number)
      break
    case 'IN':
      satisfied = Array.isArray(expectedValue) && expectedValue.includes(currentValue)
      break
    case 'NOT_IN':
      satisfied = Array.isArray(expectedValue) && !expectedValue.includes(currentValue)
      break
    default:
      return null
  }

  if (satisfied) return null

  const descriptionFn = OPERATOR_DESCRIPTIONS[operator]
  const description = descriptionFn
    ? `${field} ${descriptionFn(expectedValue)}`
    : `${field} condition not met`

  return {
    field,
    currentValue,
    operator,
    expectedValue,
    description,
  }
}

/**
 * 단항 연산자 분석
 */
const analyzeUnary = (
  operator: string,
  operand: unknown,
  context: EvaluationContext
): FailedDependency | null => {
  const field = isContextReference(operand) ? extractFieldFromReference(operand as string) : null
  if (!field) return null

  const currentValue = resolveValue(operand, context)
  let satisfied = false

  switch (operator) {
    case 'IS_NULL':
      satisfied = currentValue === null || currentValue === undefined || currentValue === ''
      break
    case 'IS_NOT_NULL':
      satisfied = currentValue !== null && currentValue !== undefined && currentValue !== ''
      break
    default:
      return null
  }

  if (satisfied) return null

  const descriptionFn = OPERATOR_DESCRIPTIONS[operator]
  const description = descriptionFn
    ? `${field} ${descriptionFn(undefined)}`
    : `${field} condition not met`

  return {
    field,
    currentValue,
    operator,
    expectedValue: operator === 'IS_NULL' ? null : 'non-empty',
    description,
  }
}

/**
 * Expression AST 분석 (재귀)
 */
const analyzeExpression = (
  expr: Expression,
  context: EvaluationContext
): FailedDependency[] => {
  // Literal
  if (expr === null || typeof expr !== 'object') {
    return []
  }

  // Array expression
  if (!Array.isArray(expr) || expr.length === 0) {
    return []
  }

  const [operator, ...args] = expr

  if (typeof operator !== 'string') {
    return []
  }

  // NOT 연산자: hidden 조건이 NOT이면 내부 조건이 true가 되어야 숨겨짐
  // 따라서 내부 조건이 false면 보이는 것이고, 우리는 숨겨진 이유를 찾는 것이므로
  // NOT 내부 조건이 true인 경우를 분석
  if (operator === 'NOT' && args.length === 1) {
    // NOT의 경우는 복잡하므로 현재는 단순화
    return analyzeExpression(args[0] as Expression, context)
  }

  // AND 연산자: 모든 조건이 true여야 함
  if (operator === 'AND') {
    const failures: FailedDependency[] = []
    for (const arg of args) {
      failures.push(...analyzeExpression(arg as Expression, context))
    }
    return failures
  }

  // OR 연산자: 하나라도 true면 OK - 모두 실패해야 실패
  if (operator === 'OR') {
    const allFailures: FailedDependency[][] = []
    for (const arg of args) {
      const failures = analyzeExpression(arg as Expression, context)
      if (failures.length === 0) {
        // 하나라도 성공하면 전체 성공
        return []
      }
      allFailures.push(failures)
    }
    // 모두 실패 - 가장 쉬운(단계가 적은) 경로 선택
    return selectOptimalPath(allFailures)
  }

  // 비교 연산자
  if (['==', '!=', '>', '>=', '<', '<=', 'IN', 'NOT_IN'].includes(operator)) {
    const failure = analyzeComparison(operator, args[0], args[1], context)
    return failure ? [failure] : []
  }

  // 단항 연산자
  if (['IS_NULL', 'IS_NOT_NULL'].includes(operator)) {
    const failure = analyzeUnary(operator, args[0], context)
    return failure ? [failure] : []
  }

  return []
}

/**
 * 조건 충족 경로 계산
 */
const computeSatisfactionPath = (
  failedDeps: readonly FailedDependency[]
): readonly SatisfactionStep[] => {
  return failedDeps.map((dep, index) => ({
    field: dep.field,
    action: dep.operator === 'IS_NULL' ? 'clear' : 'set',
    targetValue: dep.expectedValue,
    order: index + 1,
  }))
}

/**
 * Visibility 조건 분석 결과 타입 판별
 */
const determineConditionType = (expr: Expression): 'simple' | 'compound' => {
  if (!Array.isArray(expr) || expr.length === 0) {
    return 'simple'
  }
  const operator = expr[0]
  if (operator === 'AND' || operator === 'OR') {
    return 'compound'
  }
  return 'simple'
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Visibility 조건 분석
 */
export const analyzeVisibility = (
  expression: Expression,
  context: EvaluationContext,
  options: AnalyzerOptions = {}
): Result<VisibilityMeta, AnalyzerError> => {
  try {
    const failedDependencies = analyzeExpression(expression, context)
    const satisfied = failedDependencies.length === 0
    const conditionType = determineConditionType(expression)

    const meta: VisibilityMeta = {
      conditionType,
      satisfied,
      failedDependencies,
      ...(options.includeExpression ? { expression } : {}),
      ...(options.computeSatisfactionPath && !satisfied
        ? { satisfactionPath: computeSatisfactionPath(failedDependencies) }
        : {}),
    }

    return ok(meta)
  } catch (e) {
    return err({
      type: 'INVALID_EXPRESSION',
      message: e instanceof Error ? e.message : 'Unknown error during analysis',
    })
  }
}

/**
 * 간단한 설명 생성 (AI 응답용)
 */
export const generateVisibilityExplanation = (meta: VisibilityMeta): string => {
  if (meta.satisfied) {
    return 'Field visibility conditions are satisfied.'
  }

  if (meta.failedDependencies.length === 0) {
    return 'Field is hidden due to unspecified conditions.'
  }

  const reasons = meta.failedDependencies.map((dep) => `- ${dep.description}`)
  return `Field is hidden because:\n${reasons.join('\n')}`
}

/**
 * 조건 충족 안내 생성 (AI 가이드용)
 */
export const generateSatisfactionGuide = (meta: VisibilityMeta): string => {
  if (meta.satisfied) {
    return 'No changes needed.'
  }

  if (!meta.satisfactionPath || meta.satisfactionPath.length === 0) {
    return 'Unable to determine how to make this field visible.'
  }

  const steps = meta.satisfactionPath.map((step) => {
    const action = step.action === 'set'
      ? `set ${step.field} to ${formatValue(step.targetValue)}`
      : `clear ${step.field}`
    return `${step.order}. ${action}`
  })

  return `To make this field visible:\n${steps.join('\n')}`
}
