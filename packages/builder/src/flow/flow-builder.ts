import type { FlowNode, ExprNode } from "@manifesto-ai/core";
import type { Expr, ExprLike } from "../expr/expr-node.js";
import { isExpr, ExprImpl } from "../expr/expr-node.js";
import type { FieldRef } from "../refs/field-ref.js";
import { isFieldRef } from "../refs/field-ref.js";
import type { ComputedRef } from "../refs/computed-ref.js";
import { isComputedRef } from "../refs/computed-ref.js";
import type { FlowRef } from "../refs/flow-ref.js";

/**
 * Flow - Compilable flow definition
 *
 * Wraps a FlowNode IR and provides type-safe construction.
 */
export interface Flow {
  readonly __brand: "Flow";

  /**
   * Compile to FlowNode IR
   */
  compile(): FlowNode;
}

/**
 * Internal Flow implementation
 */
class FlowImpl implements Flow {
  readonly __brand = "Flow" as const;

  constructor(private readonly node: FlowNode) {}

  compile(): FlowNode {
    return this.node;
  }
}

/**
 * Type guard for Flow
 */
export function isFlow(value: unknown): value is Flow {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Flow).__brand === "Flow"
  );
}

/**
 * Normalize value to ExprNode for flow compilation
 */
function toExprNode<T>(
  value: ExprLike<T> | FieldRef<T> | ComputedRef<T> | Expr<T>
): ExprNode {
  if (isExpr(value)) {
    return value.compile();
  }
  if (isFieldRef(value) || isComputedRef(value)) {
    return { kind: "get", path: value.path };
  }
  // Raw value - wrap as literal
  return { kind: "lit", value };
}

/**
 * Helper type to extract non-undefined parts for assignability
 * Allows Expr<null> to be assigned to a field of type number | null
 */
type AssignableTo<T> = T extends null | undefined ? T : T;

/**
 * PatchOps - Operations available on patch builder
 */
export interface PatchOps<T> {
  /**
   * Set the field to a new value
   * Accepts any value assignable to the field type (handles nullable/optional)
   */
  set<V extends T>(value: ExprLike<V> | FieldRef<V> | ComputedRef<V> | Expr<V>): Flow;

  /**
   * Unset (delete) the field
   */
  unset(): Flow;

  /**
   * Delete the field (alias for unset)
   */
  delete(): Flow;

  /**
   * Merge partial object into the field (objects only)
   */
  merge(value: ExprLike<Partial<T>> | FieldRef<Partial<T>> | ComputedRef<Partial<T>> | Expr<Partial<T>>): Flow;
}

/**
 * Create PatchOps for a FieldRef
 */
function createPatchOps<T>(ref: FieldRef<T>): PatchOps<T> {
  return {
    set(value) {
      return new FlowImpl({
        kind: "patch",
        op: "set",
        path: ref.path,
        value: toExprNode(value),
      });
    },

    unset() {
      return new FlowImpl({
        kind: "patch",
        op: "unset",
        path: ref.path,
      });
    },

    delete() {
      // Alias for unset
      return new FlowImpl({
        kind: "patch",
        op: "unset",
        path: ref.path,
      });
    },

    merge(value) {
      return new FlowImpl({
        kind: "patch",
        op: "merge",
        path: ref.path,
        value: toExprNode(value),
      });
    },
  };
}

/**
 * FlowBuilder - Flow DSL API
 *
 * Provides type-safe flow building that compiles to FlowNode IR.
 */
export const flow = {
  /**
   * Sequential execution - execute steps in order
   */
  seq(...steps: Flow[]): Flow {
    return new FlowImpl({
      kind: "seq",
      steps: steps.map((s) => s.compile()),
    });
  },

  /**
   * Conditional execution
   */
  when(
    cond: ExprLike<boolean> | FieldRef<boolean> | ComputedRef<boolean> | Expr<boolean>,
    then: Flow,
    otherwise?: Flow
  ): Flow {
    return new FlowImpl({
      kind: "if",
      cond: toExprNode(cond),
      then: then.compile(),
      else: otherwise?.compile(),
    });
  },

  /**
   * Patch state - returns PatchOps for the given field
   */
  patch<T>(ref: FieldRef<T>): PatchOps<T> {
    return createPatchOps(ref);
  },

  /**
   * Declare an external effect
   *
   * Effects are not executed by Builder/Core - they are recorded in the Snapshot
   * for Host to execute.
   */
  effect(type: string, params: Record<string, ExprLike<unknown> | FieldRef<unknown> | ComputedRef<unknown> | Expr<unknown>>): Flow {
    const compiledParams: Record<string, ExprNode> = {};
    for (const [key, value] of Object.entries(params)) {
      compiledParams[key] = toExprNode(value);
    }
    return new FlowImpl({
      kind: "effect",
      type,
      params: compiledParams,
    });
  },

  /**
   * Call another flow by reference
   */
  call(ref: FlowRef): Flow {
    if (!ref.name) {
      throw new Error("FlowRef must have a name to be called");
    }
    return new FlowImpl({
      kind: "call",
      flow: ref.name,
    });
  },

  /**
   * Halt flow execution normally (not an error)
   */
  halt(reason?: string): Flow {
    return new FlowImpl({
      kind: "halt",
      reason,
    });
  },

  /**
   * Fail flow execution with an error
   */
  fail(code: string, message?: ExprLike<string> | FieldRef<string> | ComputedRef<string> | Expr<string>): Flow {
    return new FlowImpl({
      kind: "fail",
      code,
      message: message ? toExprNode(message) : undefined,
    });
  },

  /**
   * Empty flow (no-op)
   */
  noop(): Flow {
    return new FlowImpl({
      kind: "seq",
      steps: [],
    });
  },
};

export type FlowBuilder = typeof flow;
