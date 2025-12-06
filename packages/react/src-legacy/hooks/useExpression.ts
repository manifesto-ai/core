/**
 * useExpression - Expression evaluation hooks for React
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
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
  /** Auto re-evaluate on context change */
  autoEvaluate?: boolean
}

export interface UseExpressionReturn<T = unknown> {
  /** Evaluation result */
  result: T | null
  /** Error */
  error: EvaluatorError | null
  /** Evaluating state */
  isEvaluating: boolean
  /** Manual evaluate */
  evaluate: () => void
  /** Debug log */
  debugLog: unknown[]
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Single expression evaluation
 */
export function useExpression<T = unknown>(
  expression: Expression,
  context: EvaluationContext,
  options: UseExpressionOptions = {}
): UseExpressionReturn<T> {
  const {
    maxDepth,
    timeout,
    debug = false,
    autoEvaluate = true,
  } = options

  const evaluatorRef = useRef(createEvaluator({ maxDepth, timeout, debug }))

  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState<EvaluatorError | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)

  const evaluate = useCallback((): void => {
    setIsEvaluating(true)
    setError(null)

    try {
      const evalResult = evaluatorRef.current.evaluate(expression, context)

      if (isOk(evalResult)) {
        setResult(evalResult.value as T)
      } else {
        setError(evalResult.error)
        setResult(null)
      }
    } finally {
      setIsEvaluating(false)
    }
  }, [expression, context])

  const debugLog = useMemo(() => evaluatorRef.current.getDebugLog(), [])

  // Auto-evaluate on context changes
  useEffect(() => {
    if (autoEvaluate) {
      evaluate()
    }
  }, [autoEvaluate, evaluate])

  return {
    result,
    error,
    isEvaluating,
    evaluate,
    debugLog,
  }
}

/**
 * Condition expression evaluation (boolean result)
 */
export function useCondition(
  expression: Expression,
  context: EvaluationContext,
  options?: UseExpressionOptions
): UseExpressionReturn<boolean> {
  return useExpression<boolean>(expression, context, options)
}

/**
 * Multiple expressions evaluation
 */
export function useExpressions(
  expressions: Record<string, Expression>,
  context: EvaluationContext,
  options: UseExpressionOptions = {}
): {
  results: Record<string, unknown>
  errors: Record<string, EvaluatorError>
  evaluate: () => void
} {
  const evaluatorRef = useRef(createEvaluator(options))

  const [results, setResults] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, EvaluatorError>>({})

  const evaluate = useCallback((): void => {
    const newResults: Record<string, unknown> = {}
    const newErrors: Record<string, EvaluatorError> = {}

    for (const [key, expr] of Object.entries(expressions)) {
      const result = evaluatorRef.current.evaluate(expr, context)

      if (isOk(result)) {
        newResults[key] = result.value
      } else {
        newErrors[key] = result.error
      }
    }

    setResults(newResults)
    setErrors(newErrors)
  }, [expressions, context])

  useEffect(() => {
    if (options.autoEvaluate !== false) {
      evaluate()
    }
  }, [options.autoEvaluate, evaluate])

  return {
    results,
    errors,
    evaluate,
  }
}

/**
 * Context management helper
 */
export function useEvaluationContext(
  initial: Partial<EvaluationContext> = {}
): {
  context: EvaluationContext
  updateState: (updates: Record<string, unknown>) => void
  setState: (state: Record<string, unknown>) => void
  updateContext: (updates: Record<string, unknown>) => void
  updateUser: (updates: Record<string, unknown>) => void
  reset: () => void
} {
  const [context, setContext] = useState<EvaluationContext>(() => createContext(initial))

  const updateState = useCallback((updates: Record<string, unknown>): void => {
    setContext((prev) => ({
      ...prev,
      state: { ...prev.state, ...updates },
    }))
  }, [])

  const setState = useCallback((state: Record<string, unknown>): void => {
    setContext((prev) => ({
      ...prev,
      state,
    }))
  }, [])

  const updateContextData = useCallback((updates: Record<string, unknown>): void => {
    setContext((prev) => ({
      ...prev,
      context: { ...prev.context, ...updates },
    }))
  }, [])

  const updateUser = useCallback((updates: Record<string, unknown>): void => {
    setContext((prev) => ({
      ...prev,
      user: { ...prev.user, ...updates },
    }))
  }, [])

  const reset = useCallback((): void => {
    setContext(createContext(initial))
  }, [initial])

  return {
    context,
    updateState,
    setState,
    updateContext: updateContextData,
    updateUser,
    reset,
  }
}
