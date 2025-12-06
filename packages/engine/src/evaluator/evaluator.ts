/**
 * Expression Evaluator
 *
 * Mapbox Style Expression 기반의 안전한 표현식 평가기
 * eval() 없이 배열 기반 AST를 파싱하여 실행
 */

import type { Expression, Operator } from '@manifesto-ai/schema'
import { isAllowedOperator, isContextReference, isLiteral, isExpressionArray } from '@manifesto-ai/schema'
import { ok, err, type Result } from '@manifesto-ai/schema'
import type { EvaluationContext } from './context'
import { resolveContextReference } from './context'
import { operatorRegistry } from './operators'

// ============================================================================
// Types
// ============================================================================

export interface EvaluatorOptions {
  /** 최대 재귀 깊이 (기본값: 100) */
  maxDepth?: number
  /** 평가 시간 제한 (ms, 기본값: 1000) */
  timeout?: number
  /** 디버그 모드 */
  debug?: boolean
}

export interface EvaluatorError {
  type: 'UNKNOWN_OPERATOR' | 'MAX_DEPTH_EXCEEDED' | 'TIMEOUT' | 'INVALID_EXPRESSION'
  message: string
  expression?: unknown
}

export interface EvaluatorDebugInfo {
  expression: unknown
  result: unknown
  depth: number
  timeMs: number
}

// ============================================================================
// Evaluator Class
// ============================================================================

export class ExpressionEvaluator {
  private readonly options: Required<EvaluatorOptions>
  private debugLog: EvaluatorDebugInfo[] = []
  private startTime = 0
  private currentDepth = 0

  constructor(options: EvaluatorOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 100,
      timeout: options.timeout ?? 1000,
      debug: options.debug ?? false,
    }
  }

  /**
   * 표현식 평가
   */
  evaluate(expression: Expression, context: EvaluationContext): Result<unknown, EvaluatorError> {
    this.debugLog = []
    this.startTime = Date.now()
    this.currentDepth = 0

    try {
      const result = this.evaluateInternal(expression, context)
      return ok(result)
    } catch (e) {
      if (e instanceof EvaluatorException) {
        return err(e.error)
      }
      return err({
        type: 'INVALID_EXPRESSION',
        message: e instanceof Error ? e.message : 'Unknown error',
        expression,
      })
    }
  }

  /**
   * 여러 표현식 평가 (동일 컨텍스트)
   */
  evaluateMany(
    expressions: Record<string, Expression>,
    context: EvaluationContext
  ): Result<Record<string, unknown>, EvaluatorError> {
    const results: Record<string, unknown> = {}

    for (const [key, expr] of Object.entries(expressions)) {
      const result = this.evaluate(expr, context)
      if (result._tag === 'Err') {
        return result
      }
      results[key] = result.value
    }

    return ok(results)
  }

  /**
   * 디버그 로그 반환
   */
  getDebugLog(): EvaluatorDebugInfo[] {
    return [...this.debugLog]
  }

  private evaluateInternal(expr: unknown, context: EvaluationContext): unknown {
    // 타임아웃 체크
    if (Date.now() - this.startTime > this.options.timeout) {
      throw new EvaluatorException({
        type: 'TIMEOUT',
        message: `Expression evaluation timeout after ${this.options.timeout}ms`,
        expression: expr,
      })
    }

    // 깊이 체크
    if (this.currentDepth > this.options.maxDepth) {
      throw new EvaluatorException({
        type: 'MAX_DEPTH_EXCEEDED',
        message: `Maximum expression depth (${this.options.maxDepth}) exceeded`,
        expression: expr,
      })
    }

    this.currentDepth++
    const startTime = Date.now()

    try {
      let result: unknown

      // 컨텍스트 참조 ($state.xxx, $user.xxx 등) - 리터럴보다 먼저 체크!
      if (typeof expr === 'string' && isContextReference(expr as Expression)) {
        result = resolveContextReference(context, expr)
      }
      // 리터럴 (null, string, number, boolean)
      else if (isLiteral(expr as Expression)) {
        result = expr
      }
      // 배열 표현식 (연산자)
      else if (isExpressionArray(expr as Expression) && Array.isArray(expr)) {
        result = this.evaluateArrayExpression(expr, context)
      }
      // 객체 형태의 표현식 (예: { _expr: 'eq', field: 'x', value: 1 })
      else if (typeof expr === 'object' && expr !== null && '_expr' in expr) {
        result = this.evaluateObjectExpression(expr as Record<string, unknown>, context)
      }
      // 알 수 없는 표현식
      else {
        throw new EvaluatorException({
          type: 'INVALID_EXPRESSION',
          message: `Invalid expression type: ${typeof expr}`,
          expression: expr,
        })
      }

      // 디버그 로깅
      if (this.options.debug) {
        this.debugLog.push({
          expression: expr,
          result,
          depth: this.currentDepth,
          timeMs: Date.now() - startTime,
        })
      }

      return result
    } finally {
      this.currentDepth--
    }
  }

  private evaluateArrayExpression(expr: unknown[], context: EvaluationContext): unknown {
    if (expr.length === 0) {
      throw new EvaluatorException({
        type: 'INVALID_EXPRESSION',
        message: 'Empty array expression',
        expression: expr,
      })
    }

    const [operator, ...args] = expr

    if (typeof operator !== 'string') {
      throw new EvaluatorException({
        type: 'INVALID_EXPRESSION',
        message: `Operator must be a string, got: ${typeof operator}`,
        expression: expr,
      })
    }

    if (!isAllowedOperator(operator)) {
      throw new EvaluatorException({
        type: 'UNKNOWN_OPERATOR',
        message: `Unknown operator: ${operator}`,
        expression: expr,
      })
    }

    const operatorFn = operatorRegistry[operator as Operator]
    if (!operatorFn) {
      throw new EvaluatorException({
        type: 'UNKNOWN_OPERATOR',
        message: `No implementation for operator: ${operator}`,
        expression: expr,
      })
    }

    // 재귀적 평가 함수를 연산자에 전달
    const evaluateFn = (e: unknown) => this.evaluateInternal(e, context)

    return operatorFn(args, evaluateFn)
  }

  /**
   * 객체 형태의 표현식 평가
   * { _expr: 'eq', field: 'x', value: 1 } → ['==', '$state.x', 1]
   */
  private evaluateObjectExpression(
    expr: Record<string, unknown>,
    context: EvaluationContext
  ): unknown {
    const exprType = expr._expr as string

    switch (exprType) {
      case 'eq': {
        // { _expr: 'eq', field: 'x', value: 1 } → $state.x === 1
        const fieldValue = this.evaluateInternal(`$state.${expr.field}`, context)
        const targetValue = expr.value
        return fieldValue === targetValue
      }
      case 'neq': {
        const fieldValue = this.evaluateInternal(`$state.${expr.field}`, context)
        const targetValue = expr.value
        return fieldValue !== targetValue
      }
      case 'gt': {
        const fieldValue = this.evaluateInternal(`$state.${expr.field}`, context)
        return (fieldValue as number) > (expr.value as number)
      }
      case 'gte': {
        const fieldValue = this.evaluateInternal(`$state.${expr.field}`, context)
        return (fieldValue as number) >= (expr.value as number)
      }
      case 'lt': {
        const fieldValue = this.evaluateInternal(`$state.${expr.field}`, context)
        return (fieldValue as number) < (expr.value as number)
      }
      case 'lte': {
        const fieldValue = this.evaluateInternal(`$state.${expr.field}`, context)
        return (fieldValue as number) <= (expr.value as number)
      }
      case 'and': {
        const conditions = expr.conditions as unknown[]
        return conditions.every(c => this.evaluateInternal(c, context))
      }
      case 'or': {
        const conditions = expr.conditions as unknown[]
        return conditions.some(c => this.evaluateInternal(c, context))
      }
      case 'not': {
        const condition = expr.condition as unknown
        return !this.evaluateInternal(condition, context)
      }
      default:
        throw new EvaluatorException({
          type: 'UNKNOWN_OPERATOR',
          message: `Unknown object expression type: ${exprType}`,
          expression: expr,
        })
    }
  }
}

class EvaluatorException extends Error {
  constructor(public readonly error: EvaluatorError) {
    super(error.message)
    this.name = 'EvaluatorException'
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 새 평가기 생성
 */
export const createEvaluator = (options?: EvaluatorOptions): ExpressionEvaluator => {
  return new ExpressionEvaluator(options)
}

/**
 * 단일 표현식 평가 (간편 함수)
 */
export const evaluate = (
  expression: Expression,
  context: EvaluationContext,
  options?: EvaluatorOptions
): Result<unknown, EvaluatorError> => {
  const evaluator = createEvaluator(options)
  return evaluator.evaluate(expression, context)
}
