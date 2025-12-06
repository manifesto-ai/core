/**
 * useExpression - 표현식 평가 컴포저블
 */

import { ref, shallowRef, computed, watch, type Ref, type ComputedRef } from 'vue'
import type { Expression } from '@manifesto-ai/schema'
import { isOk } from '@manifesto-ai/schema'
import {
  createEvaluator,
  type EvaluationContext,
  type EvaluatorError,
  type EvaluatorOptions,
  createContext,
} from '@manifesto-ai/engine'

// ============================================================================
// Types
// ============================================================================

export interface UseExpressionOptions extends EvaluatorOptions {
  /** 자동 재평가 활성화 */
  autoEvaluate?: boolean
}

export interface UseExpressionReturn<T = unknown> {
  /** 평가 결과 */
  result: Ref<T | null>
  /** 에러 */
  error: Ref<EvaluatorError | null>
  /** 평가 중 상태 */
  isEvaluating: Ref<boolean>
  /** 수동 평가 */
  evaluate: () => void
  /** 디버그 로그 */
  debugLog: ComputedRef<unknown[]>
}

// ============================================================================
// Composables
// ============================================================================

/**
 * 단일 표현식 평가
 */
export function useExpression<T = unknown>(
  expression: Expression | Ref<Expression>,
  context: EvaluationContext | Ref<EvaluationContext>,
  options: UseExpressionOptions = {}
): UseExpressionReturn<T> {
  const {
    maxDepth,
    timeout,
    debug = false,
    autoEvaluate = true,
  } = options

  const evaluator = createEvaluator({ maxDepth, timeout, debug })

  const result = ref<T | null>(null) as Ref<T | null>
  const error = ref<EvaluatorError | null>(null)
  const isEvaluating = ref(false)

  // Use shallowRef to avoid deep type recursion with complex Expression type
  const exprRef = shallowRef<Expression>(
    (expression as Ref<Expression>).value ?? (expression as Expression)
  )
  const ctxRef = shallowRef<EvaluationContext>(
    (context as Ref<EvaluationContext>).value ?? (context as EvaluationContext)
  )

  // Update refs if input is reactive
  const isExpressionRef = typeof expression === 'object' && expression !== null && 'value' in expression
  const isContextRef = typeof context === 'object' && context !== null && 'value' in context

  if (isExpressionRef) {
    watch(() => (expression as Ref<Expression>).value, (newVal) => {
      exprRef.value = newVal
    })
  }

  if (isContextRef) {
    watch(() => (context as Ref<EvaluationContext>).value, (newVal) => {
      ctxRef.value = newVal
    }, { deep: true })
  }

  const evaluate = (): void => {
    isEvaluating.value = true
    error.value = null

    try {
      const currentExpr = exprRef.value
      const currentCtx = ctxRef.value
      const evalResult = evaluator.evaluate(currentExpr, currentCtx)

      if (isOk(evalResult)) {
        result.value = evalResult.value as T
      } else {
        error.value = evalResult.error
        result.value = null
      }
    } finally {
      isEvaluating.value = false
    }
  }

  const debugLog = computed(() => evaluator.getDebugLog())

  // Auto-evaluate on context changes
  if (autoEvaluate) {
    watch(
      [exprRef, ctxRef],
      () => evaluate(),
      { immediate: true, deep: true }
    )
  }

  return {
    result,
    error,
    isEvaluating,
    evaluate,
    debugLog,
  }
}

/**
 * 조건 표현식 평가 (boolean 결과)
 */
export function useCondition(
  expression: Expression | Ref<Expression>,
  context: EvaluationContext | Ref<EvaluationContext>,
  options?: UseExpressionOptions
): UseExpressionReturn<boolean> {
  return useExpression<boolean>(expression, context, options)
}

/**
 * 여러 표현식 동시 평가
 */
export function useExpressions(
  expressions: Record<string, Expression> | Ref<Record<string, Expression>>,
  context: EvaluationContext | Ref<EvaluationContext>,
  options: UseExpressionOptions = {}
): {
  results: Ref<Record<string, unknown>>
  errors: Ref<Record<string, EvaluatorError>>
  evaluate: () => void
} {
  const evaluator = createEvaluator(options)

  const results = ref<Record<string, unknown>>({})
  const errors = ref<Record<string, EvaluatorError>>({})

  type ExprsType = Record<string, Expression>

  // Use shallowRef to avoid deep type recursion with complex Expression type
  const exprRef = shallowRef<ExprsType>(
    (expressions as Ref<ExprsType>).value ?? (expressions as ExprsType)
  )
  const ctxRef = shallowRef<EvaluationContext>(
    (context as Ref<EvaluationContext>).value ?? (context as EvaluationContext)
  )

  // Update refs if input is reactive
  const isExprsRef = typeof expressions === 'object' && expressions !== null && 'value' in expressions
  const isCtxRef = typeof context === 'object' && context !== null && 'value' in context

  if (isExprsRef) {
    watch(() => (expressions as Ref<ExprsType>).value, (newVal) => {
      exprRef.value = newVal
    }, { deep: true })
  }

  if (isCtxRef) {
    watch(() => (context as Ref<EvaluationContext>).value, (newVal) => {
      ctxRef.value = newVal
    }, { deep: true })
  }

  const evaluate = (): void => {
    const newResults: Record<string, unknown> = {}
    const newErrors: Record<string, EvaluatorError> = {}

    const currentExprs = exprRef.value
    const currentCtx = ctxRef.value

    for (const [key, expr] of Object.entries(currentExprs)) {
      const result = evaluator.evaluate(expr, currentCtx)

      if (isOk(result)) {
        newResults[key] = result.value
      } else {
        newErrors[key] = result.error
      }
    }

    results.value = newResults
    errors.value = newErrors
  }

  if (options.autoEvaluate !== false) {
    watch(
      [exprRef, ctxRef],
      () => evaluate(),
      { immediate: true, deep: true }
    )
  }

  return {
    results,
    errors,
    evaluate,
  }
}

/**
 * 컨텍스트 관리 헬퍼
 */
export function useEvaluationContext(
  initial: Partial<EvaluationContext> = {}
): {
  context: Ref<EvaluationContext>
  updateState: (updates: Record<string, unknown>) => void
  setState: (state: Record<string, unknown>) => void
  updateContext: (updates: Record<string, unknown>) => void
  updateUser: (updates: Record<string, unknown>) => void
  reset: () => void
} {
  const context = ref<EvaluationContext>(createContext(initial))

  const updateState = (updates: Record<string, unknown>): void => {
    context.value = {
      ...context.value,
      state: { ...context.value.state, ...updates },
    }
  }

  const setState = (state: Record<string, unknown>): void => {
    context.value = {
      ...context.value,
      state,
    }
  }

  const updateContext = (updates: Record<string, unknown>): void => {
    context.value = {
      ...context.value,
      context: { ...context.value.context, ...updates },
    }
  }

  const updateUser = (updates: Record<string, unknown>): void => {
    context.value = {
      ...context.value,
      user: { ...context.value.user, ...updates },
    }
  }

  const reset = (): void => {
    context.value = createContext(initial)
  }

  return {
    context,
    updateState,
    setState,
    updateContext,
    updateUser,
    reset,
  }
}
