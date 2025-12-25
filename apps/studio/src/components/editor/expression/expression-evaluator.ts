/**
 * Expression Evaluator
 *
 * Core First 원칙: @manifesto-ai/core의 evaluate 함수를 래핑하여 사용
 * Studio 전용 컨텍스트 인터페이스만 제공하고, 실제 평가는 Core에 위임
 */

import {
  evaluate as coreEvaluate,
  type Expression,
  type EvaluationContext as CoreEvaluationContext,
} from "@manifesto-ai/core";

/**
 * Studio용 컨텍스트 인터페이스
 * Core와 다른 형태로, values 레코드와 $/$index/$acc 변수 사용
 */
export interface EvaluationContext {
  /** Available values by semantic path */
  values: Record<string, unknown>;
  /** Context variable for map/filter ($) */
  $?: unknown;
  /** Index variable for map/filter ($index) */
  $index?: number;
  /** Accumulator variable for reduce ($acc) */
  $acc?: unknown;
}

/**
 * Evaluation result (Studio 포맷)
 */
export interface EvaluationResult {
  /** Whether evaluation succeeded */
  success: boolean;
  /** The evaluated value (if success) */
  value?: unknown;
  /** Error message (if failure) */
  error?: string;
}

/**
 * Studio 컨텍스트를 Core 컨텍스트로 변환
 */
function adaptContext(ctx: EvaluationContext): CoreEvaluationContext {
  return {
    get: (path: string) => {
      // Handle context variables
      if (path === "$") return ctx.$;
      if (path === "$index") return ctx.$index;
      if (path === "$acc") return ctx.$acc;
      if (path.startsWith("$.") && ctx.$ && typeof ctx.$ === "object") {
        const field = path.slice(2);
        return (ctx.$ as Record<string, unknown>)[field] ?? null;
      }
      return ctx.values[path] ?? null;
    },
    current: ctx.$,
    index: ctx.$index,
    accumulator: ctx.$acc,
  };
}

/**
 * Check if an array is an operator expression (starts with string operator)
 */
function isOperatorExpression(arr: unknown[]): boolean {
  return arr.length > 0 && typeof arr[0] === "string";
}

/**
 * Evaluate an expression using Core evaluator
 *
 * @param expr - Expression to evaluate
 * @param context - Studio evaluation context
 * @returns Evaluation result in Studio format
 */
export function evaluateExpression(
  expr: unknown,
  context: EvaluationContext
): EvaluationResult {
  // Handle null/undefined expression
  if (expr === null || expr === undefined) {
    return { success: true, value: expr };
  }

  // Handle primitives directly
  if (typeof expr === "string" || typeof expr === "number" || typeof expr === "boolean") {
    return { success: true, value: expr };
  }

  // Handle array literals (not operator expressions)
  // Core treats all arrays as operator expressions, but Studio allows array literals
  if (Array.isArray(expr)) {
    if (expr.length === 0) {
      return { success: true, value: expr };
    }
    if (!isOperatorExpression(expr)) {
      // Array literal - return as-is
      return { success: true, value: expr };
    }
  }

  // Adapt context to Core format
  const coreCtx = adaptContext(context);

  // Use Core evaluator
  const result = coreEvaluate(expr as Expression, coreCtx);

  // Convert to Studio result format
  if (result.ok) {
    return { success: true, value: result.value };
  }
  return { success: false, error: result.error };
}
