import type { ExprNode } from "@manifesto-ai/core";

/**
 * Expr<T> - Typed expression wrapper
 *
 * Carries the output type T as a phantom type and holds the underlying ExprNode IR.
 * Provides compile() to get the raw IR and deps() to get referenced paths.
 */
export interface Expr<T = unknown> {
  readonly __brand: "Expr";
  readonly __type?: T; // Phantom type (never used at runtime)

  /**
   * Compile to ExprNode IR
   */
  compile(): ExprNode;

  /**
   * Get dependencies (paths referenced by this expression)
   */
  deps(): string[];
}

/**
 * Internal implementation class for Expr<T>
 */
export class ExprImpl<T> implements Expr<T> {
  readonly __brand = "Expr" as const;
  declare readonly __type?: T;

  constructor(
    private readonly node: ExprNode,
    private readonly _deps: string[] = []
  ) {}

  compile(): ExprNode {
    return this.node;
  }

  deps(): string[] {
    return this._deps;
  }
}

/**
 * Type guard for Expr
 */
export function isExpr(value: unknown): value is Expr<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Expr<unknown>).__brand === "Expr"
  );
}

/**
 * Type for values that can be used as expressions
 * Allows raw values to be auto-wrapped as literals
 */
export type ExprLike<T> = Expr<T> | T;
