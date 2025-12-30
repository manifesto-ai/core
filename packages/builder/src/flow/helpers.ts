import { flow, type Flow } from "./flow-builder.js";
import { expr } from "../expr/expr-builder.js";
import type { Expr, ExprLike } from "../expr/expr-node.js";
import type { FieldRef } from "../refs/field-ref.js";
import type { ComputedRef } from "../refs/computed-ref.js";

/**
 * FlowStepContext - Context provided to callback-style flow builders
 *
 * Used with guard() and onceNull() to build flows inline.
 */
export interface FlowStepContext {
  /**
   * Patch state field
   */
  patch<T>(ref: FieldRef<T>): {
    set(value: ExprLike<T> | FieldRef<T> | ComputedRef<T> | Expr<T>): void;
    unset(): void;
    merge(value: ExprLike<Partial<T>> | FieldRef<Partial<T>> | ComputedRef<Partial<T>> | Expr<Partial<T>>): void;
  };

  /**
   * Declare effect
   */
  effect(type: string, params: Record<string, ExprLike<unknown> | FieldRef<unknown> | ComputedRef<unknown> | Expr<unknown>>): void;

  /**
   * Conditional
   */
  when(
    cond: ExprLike<boolean> | FieldRef<boolean> | ComputedRef<boolean> | Expr<boolean>,
    then: () => void,
    otherwise?: () => void
  ): void;

  /**
   * Halt
   */
  halt(reason?: string): void;

  /**
   * Fail
   */
  fail(code: string, message?: ExprLike<string> | FieldRef<string> | ComputedRef<string> | Expr<string>): void;
}

/**
 * Build a flow from a callback function
 */
function buildFlowFromCallback(callback: (ctx: FlowStepContext) => void): Flow {
  const steps: Flow[] = [];

  const ctx: FlowStepContext = {
    patch<T>(ref: FieldRef<T>) {
      return {
        set(value: ExprLike<T> | FieldRef<T> | ComputedRef<T> | Expr<T>) {
          steps.push(flow.patch(ref).set(value));
        },
        unset() {
          steps.push(flow.patch(ref).unset());
        },
        merge(value: ExprLike<Partial<T>> | FieldRef<Partial<T>> | ComputedRef<Partial<T>> | Expr<Partial<T>>) {
          steps.push(flow.patch(ref).merge(value));
        },
      };
    },

    effect(type: string, params: Record<string, ExprLike<unknown> | FieldRef<unknown> | ComputedRef<unknown> | Expr<unknown>>) {
      steps.push(flow.effect(type, params));
    },

    when(
      cond: ExprLike<boolean> | FieldRef<boolean> | ComputedRef<boolean> | Expr<boolean>,
      then: () => void,
      otherwise?: () => void
    ) {
      const thenFlow = buildFlowFromCallback(then);
      const elseFlow = otherwise ? buildFlowFromCallback(otherwise) : undefined;
      steps.push(flow.when(cond, thenFlow, elseFlow));
    },

    halt(reason?: string) {
      steps.push(flow.halt(reason));
    },

    fail(code: string, message?: ExprLike<string> | FieldRef<string> | ComputedRef<string> | Expr<string>) {
      steps.push(flow.fail(code, message));
    },
  };

  callback(ctx);

  return steps.length === 1 ? steps[0] : flow.seq(...steps);
}

/**
 * guard - Re-entry safety helper (FDR-B004)
 *
 * Executes body ONLY if condition is true.
 * This is the general-purpose re-entry safety pattern.
 *
 * @example
 * ```ts
 * flow.guard(expr.not(state.submitted), ({ patch, effect }) => {
 *   patch(state.submitted).set(true);
 *   effect('api.submit', { data: state.formData });
 * })
 * ```
 */
export function guard(
  condition: ExprLike<boolean> | FieldRef<boolean> | ComputedRef<boolean> | Expr<boolean>,
  body: Flow | ((ctx: FlowStepContext) => void)
): Flow {
  const bodyFlow = typeof body === "function" ? buildFlowFromCallback(body) : body;
  return flow.when(condition, bodyFlow);
}

/**
 * onceNull - Re-entry safety helper for null checks (FDR-B004)
 *
 * Executes body ONLY if the field is null/undefined.
 * Common pattern for idempotent initialization.
 *
 * @example
 * ```ts
 * flow.onceNull(state.receivedAt, ({ patch, effect }) => {
 *   patch(state.receivedAt).set(expr.input('timestamp'));
 *   effect('api.receive', { id: state.id });
 * })
 * ```
 */
export function onceNull<T>(
  ref: FieldRef<T | null | undefined>,
  body: Flow | ((ctx: FlowStepContext) => void)
): Flow {
  const bodyFlow = typeof body === "function" ? buildFlowFromCallback(body) : body;
  return flow.when(expr.isNull(expr.get(ref)), bodyFlow);
}

/**
 * onceNotSet - Re-entry safety helper for undefined checks
 *
 * Executes body ONLY if field is not set (undefined).
 * Distinct from onceNull - this checks for 'undefined' specifically.
 */
export function onceNotSet<T>(
  ref: FieldRef<T | undefined>,
  body: Flow | ((ctx: FlowStepContext) => void)
): Flow {
  const bodyFlow = typeof body === "function" ? buildFlowFromCallback(body) : body;
  return flow.when(expr.isNotSet(expr.get(ref)), bodyFlow);
}
