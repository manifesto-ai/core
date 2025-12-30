import type { ExprNode } from "@manifesto-ai/core";
import { type Expr, isExpr, ExprImpl } from "../expr/expr-node.js";
import { createComputedRef, type ComputedRef, isComputedRef } from "../refs/computed-ref.js";
import { isFieldRef, type FieldRef } from "../refs/field-ref.js";

/**
 * ComputedDef - Internal representation of a computed definition
 */
export interface ComputedDef {
  readonly name: string;
  readonly expr: Expr<unknown>;
  readonly description?: string;
}

/**
 * ComputedSpec entry for schema generation
 */
export interface ComputedSpecEntry {
  readonly deps: string[];
  readonly expr: ExprNode;
  readonly description?: string;
}

/**
 * Type helper to infer result type from expression
 */
type ExprResultType<E> = E extends Expr<infer T> ? T : E extends { expr: Expr<infer T> } ? T : unknown;

/**
 * Definition input - can be:
 * - An Expr<T>
 * - A ComputedRef<T> (will be converted to Expr)
 * - A FieldRef<T> (will be converted to Expr)
 * - An object { expr, description } where expr is any of the above
 */
type ComputedDefInput<T> = Expr<T> | ComputedRef<T> | FieldRef<T> | { expr: Expr<T> | ComputedRef<T> | FieldRef<T>; description?: string };

/**
 * Helper to convert any ref or expression to an Expr
 */
function toExpr<T>(value: Expr<T> | ComputedRef<T> | FieldRef<T>): Expr<T> {
  if (isExpr(value)) {
    return value;
  }
  if (isComputedRef(value)) {
    return new ExprImpl<T>({ kind: "get", path: value.path }, [value.path]);
  }
  if (isFieldRef(value)) {
    return new ExprImpl<T>({ kind: "get", path: value.path }, [value.path]);
  }
  // Should never reach here in well-typed code
  throw new Error("Invalid expression input");
}

/**
 * ComputedBuilder - Builder for computed values
 *
 * Per FDR-B002, computed values MUST be named facts for explainability.
 * This builder creates ComputedRefs that compile to `['get', 'computed.<name>']`.
 */
export class ComputedBuilder {
  private readonly definitions: Map<string, ComputedDef> = new Map();

  /**
   * Define computed values as named facts
   *
   * @example
   * ```ts
   * const { isClosed, canReceive } = computed.define({
   *   isClosed: expr.eq(state.status, 'closed'),
   *   canReceive: {
   *     expr: expr.and(expr.not(isClosed), expr.isNull(state.receivedAt)),
   *     description: "Whether the event can receive",
   *   },
   * });
   * ```
   */
  define<T extends Record<string, ComputedDefInput<unknown>>>(
    definitions: T
  ): { [K in keyof T]: ComputedRef<ExprResultType<T[K]>> } {
    const result: Record<string, ComputedRef<unknown>> = {};

    for (const [name, defInput] of Object.entries(definitions)) {
      // Create the ComputedRef first so it can be referenced by later definitions
      const ref = createComputedRef<unknown>(name);
      result[name] = ref;

      // Handle both direct expr/ref and { expr, description } forms
      if (isExpr(defInput) || isComputedRef(defInput) || isFieldRef(defInput)) {
        this.definitions.set(name, {
          name,
          expr: toExpr(defInput as Expr<unknown> | ComputedRef<unknown> | FieldRef<unknown>),
        });
      } else {
        const { expr: exprValue, description } = defInput as { expr: Expr<unknown> | ComputedRef<unknown> | FieldRef<unknown>; description?: string };
        this.definitions.set(name, {
          name,
          expr: toExpr(exprValue),
          description,
        });
      }
    }

    return result as { [K in keyof T]: ComputedRef<ExprResultType<T[K]>> };
  }

  /**
   * Define a single computed value with optional description
   */
  defineOne<T>(
    name: string,
    expr: Expr<T>,
    description?: string
  ): ComputedRef<T> {
    const ref = createComputedRef<T>(name);

    this.definitions.set(name, {
      name,
      expr,
      description,
    });

    return ref;
  }

  /**
   * Get all computed definitions
   */
  getDefinitions(): Map<string, ComputedDef> {
    return new Map(this.definitions);
  }

  /**
   * Build ComputedSpec for schema generation
   */
  buildSpec(): Record<string, ComputedSpecEntry> {
    const spec: Record<string, ComputedSpecEntry> = {};

    for (const [name, def] of this.definitions) {
      // Use full path as key (e.g., "computed.isIdle") to match Core evaluation
      const fullPath = `computed.${name}`;
      spec[fullPath] = {
        deps: def.expr.deps(),
        expr: def.expr.compile(),
        description: def.description,
      };
    }

    return spec;
  }

  /**
   * Get all defined computed names
   */
  getNames(): Set<string> {
    return new Set(this.definitions.keys());
  }

  /**
   * Get all dependencies from all computed definitions
   */
  getAllDeps(): Set<string> {
    const deps = new Set<string>();
    for (const def of this.definitions.values()) {
      for (const dep of def.expr.deps()) {
        deps.add(dep);
      }
    }
    return deps;
  }
}

/**
 * Create a new ComputedBuilder instance
 */
export function createComputedBuilder(): ComputedBuilder {
  return new ComputedBuilder();
}

/**
 * Utility to wrap a ComputedRef as an Expr for use in other expressions
 *
 * This is automatically handled by expr.get(), but this helper is provided
 * for clarity when explicitly converting refs to expressions.
 */
export function computedToExpr<T>(ref: ComputedRef<T>): Expr<T> {
  return new ExprImpl<T>({ kind: "get", path: ref.path }, [ref.path]);
}
