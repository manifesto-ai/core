import type { z } from "zod";
import type { ExprNode, FlowNode } from "@manifesto-ai/core";
import { type Expr, isExpr, ExprImpl } from "../expr/expr-node.js";
import { type Flow, isFlow } from "../flow/flow-builder.js";
import { type ComputedRef, isComputedRef } from "../refs/computed-ref.js";
import { type ActionRef, type IntentBody, createActionRef, type ActionDef } from "../refs/action-ref.js";
import { type FieldRef, isFieldRef } from "../refs/field-ref.js";

/**
 * ActionSpec input for define()
 */
export interface ActionSpecInput<TInput = void> {
  /**
   * Display label for the action
   */
  readonly label?: string;

  /**
   * Zod schema for action input validation
   */
  readonly input?: z.ZodType<TInput>;

  /**
   * Availability condition - when is this action available?
   * SHOULD reference ComputedRef<boolean> for explainability (FDR-B002).
   * Raw Expr<boolean> is allowed but discouraged.
   */
  readonly available?: Expr<boolean> | ComputedRef<boolean>;

  /**
   * Flow to execute when action is dispatched
   */
  readonly flow: Flow;

  /**
   * Optional description
   */
  readonly description?: string;
}

/**
 * Built action spec for schema generation
 */
export interface BuiltActionSpec {
  readonly label?: string;
  readonly inputSchema?: z.ZodTypeAny;
  readonly available: ExprNode;
  readonly flow: FlowNode;
  readonly description?: string;
}

/**
 * Type helper to extract input type from ActionSpec
 * If the spec has an `input` field with a ZodType, extract that type.
 * Otherwise, return void (for actions without input).
 */
type ActionInputType<S> = S extends { input: z.ZodType<infer I> } ? I : void;

/**
 * ActionsBuilder - Builder for action definitions
 *
 * Per FDR-B006, ActionRef.intent() returns IntentBody only.
 * IntentInstance creation (intentId, intentKey, origin) is Bridge/Issuer responsibility.
 */
export class ActionsBuilder {
  private readonly definitions: Map<string, BuiltActionSpec> = new Map();

  /**
   * Define actions
   *
   * @example
   * ```ts
   * const { receive, complete } = actions.define({
   *   receive: {
   *     label: '접수',
   *     input: z.object({ requesterId: z.string() }),
   *     available: canReceive,  // ComputedRef for explainability
   *     flow: flow.onceNull(state.receivedAt, ({ patch, effect }) => {
   *       patch(state.receivedAt).set(expr.input('timestamp'));
   *       effect('api.receive', { id: state.id });
   *     }),
   *   },
   * });
   * ```
   */
  define<T extends Record<string, ActionSpecInput<unknown>>>(
    definitions: T
  ): { [K in keyof T]: ActionRef<ActionInputType<T[K]>> } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, ActionRef<any>> = {};

    for (const [name, spec] of Object.entries(definitions)) {
      const availableExpr = this.normalizeAvailable(spec.available);
      const flowNode = spec.flow.compile();

      // Store built spec
      this.definitions.set(name, {
        label: spec.label,
        inputSchema: spec.input,
        available: availableExpr,
        flow: flowNode,
        description: spec.description,
      });

      // Create ActionRef with intent() method
      const actionDef: ActionDef<ActionInputType<typeof spec>> = {
        name,
        label: spec.label,
        inputSchema: spec.input,
        available: availableExpr,
        flow: flowNode,
      };

      result[name] = createActionRef(actionDef);
    }

    return result as { [K in keyof T]: ActionRef<ActionInputType<T[K]>> };
  }

  /**
   * Define a single action
   */
  defineOne<TInput = void>(
    name: string,
    spec: ActionSpecInput<TInput>
  ): ActionRef<TInput> {
    const availableExpr = this.normalizeAvailable(spec.available);
    const flowNode = spec.flow.compile();

    this.definitions.set(name, {
      label: spec.label,
      inputSchema: spec.input,
      available: availableExpr,
      flow: flowNode,
      description: spec.description,
    });

    return createActionRef<TInput>({
      name,
      label: spec.label,
      inputSchema: spec.input,
      available: availableExpr,
      flow: flowNode,
    });
  }

  /**
   * Get all action definitions
   */
  getDefinitions(): Map<string, BuiltActionSpec> {
    return new Map(this.definitions);
  }

  /**
   * Build action specs for schema generation
   */
  buildSpec(): Record<string, BuiltActionSpec> {
    const spec: Record<string, BuiltActionSpec> = {};

    for (const [name, def] of this.definitions) {
      spec[name] = def;
    }

    return spec;
  }

  /**
   * Get all defined action names
   */
  getNames(): Set<string> {
    return new Set(this.definitions.keys());
  }

  /**
   * Get all dependencies from all action flows
   */
  getAllDeps(): Set<string> {
    const deps = new Set<string>();
    for (const def of this.definitions.values()) {
      // Collect deps from flow nodes recursively
      this.collectFlowDeps(def.flow, deps);
      // Collect deps from availability expression
      this.collectExprDeps(def.available, deps);
    }
    return deps;
  }

  /**
   * Collect dependencies from a FlowNode
   */
  private collectFlowDeps(flow: FlowNode, deps: Set<string>): void {
    switch (flow.kind) {
      case "seq":
        for (const step of flow.steps) {
          this.collectFlowDeps(step, deps);
        }
        break;
      case "if":
        this.collectExprDeps(flow.cond, deps);
        this.collectFlowDeps(flow.then, deps);
        if (flow.else) {
          this.collectFlowDeps(flow.else, deps);
        }
        break;
      case "patch":
        deps.add(flow.path);
        if (flow.value) {
          this.collectExprDeps(flow.value, deps);
        }
        break;
      case "effect":
        if (flow.params && typeof flow.params === "object") {
          for (const value of Object.values(flow.params)) {
            if (typeof value === "object" && value !== null && "kind" in value) {
              this.collectExprDeps(value as ExprNode, deps);
            }
          }
        }
        break;
      // halt, fail, noop have no deps
    }
  }

  /**
   * Collect dependencies from an ExprNode
   */
  private collectExprDeps(expr: ExprNode, deps: Set<string>): void {
    switch (expr.kind) {
      case "get":
        deps.add(expr.path);
        break;
      case "lit":
        // No deps
        break;
      case "eq":
      case "neq":
      case "gt":
      case "gte":
      case "lt":
      case "lte":
      case "add":
      case "sub":
      case "mul":
      case "div":
      case "mod":
        this.collectExprDeps((expr as { left: ExprNode }).left, deps);
        this.collectExprDeps((expr as { right: ExprNode }).right, deps);
        break;
      case "and":
      case "or":
      case "concat":
        for (const arg of (expr as { args: ExprNode[] }).args) {
          this.collectExprDeps(arg, deps);
        }
        break;
      case "not":
      case "isNull":
      case "len":
      case "typeof":
        this.collectExprDeps((expr as { arg: ExprNode }).arg, deps);
        break;
      case "if":
        this.collectExprDeps((expr as { cond: ExprNode }).cond, deps);
        this.collectExprDeps((expr as { then: ExprNode }).then, deps);
        if ((expr as { else?: ExprNode }).else) {
          this.collectExprDeps((expr as { else: ExprNode }).else, deps);
        }
        break;
      case "coalesce":
        for (const arg of (expr as { args: ExprNode[] }).args) {
          this.collectExprDeps(arg, deps);
        }
        break;
    }
  }

  /**
   * Normalize availability to ExprNode
   * Defaults to always available (true) if not specified
   */
  private normalizeAvailable(
    available: Expr<boolean> | ComputedRef<boolean> | undefined
  ): ExprNode {
    if (!available) {
      // Default: always available
      return { kind: "lit", value: true };
    }

    if (isComputedRef(available)) {
      // Reference to computed
      return { kind: "get", path: available.path };
    }

    if (isExpr(available)) {
      return available.compile();
    }

    // Should not reach here, but fallback to always available
    return { kind: "lit", value: true };
  }
}

/**
 * Create a new ActionsBuilder instance
 */
export function createActionsBuilder(): ActionsBuilder {
  return new ActionsBuilder();
}
