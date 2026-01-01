import type { ExprNode } from "@manifesto-ai/core";
import { ExprImpl, type Expr, type ExprLike, isExpr } from "./expr-node.js";
import { type FieldRef, isFieldRef } from "../refs/field-ref.js";
import { type ComputedRef, isComputedRef } from "../refs/computed-ref.js";
import {
  type ItemProxy,
  type IndexProxy,
  type ArrayProxy,
  extractPredicate,
  extractMapper,
  collectPredicateDeps,
} from "./item-proxy.js";

/**
 * Normalize ExprLike to Expr - wraps raw values as literals
 */
function toExpr<T>(value: ExprLike<T>): Expr<T> {
  if (isExpr(value)) {
    return value as Expr<T>;
  }
  return new ExprImpl<T>({ kind: "lit", value });
}

/**
 * Normalize a reference (FieldRef or ComputedRef) to Expr
 */
function refToExpr<T>(ref: FieldRef<T> | ComputedRef<T>): Expr<T> {
  const path = ref.path;
  return new ExprImpl<T>({ kind: "get", path }, [path]);
}

/**
 * ExprBuilder - Expression DSL API
 *
 * Provides type-safe expression building that compiles to ExprNode IR.
 */
export const expr = {
  // ============ Literals ============

  /**
   * Create a literal expression
   */
  lit<T>(value: T): Expr<T> {
    return new ExprImpl<T>({ kind: "lit", value });
  },

  /**
   * Reference a field (from FieldRef or ComputedRef)
   */
  get<T>(ref: FieldRef<T> | ComputedRef<T>): Expr<T> {
    return refToExpr(ref);
  },

  /**
   * Reference action input field
   * Used within action flow definitions
   */
  input<T = unknown>(field?: string): Expr<T> {
    const path = field ? `input.${field}` : "input";
    return new ExprImpl<T>({ kind: "get", path }, [path]);
  },

  // ============ Comparison ============

  /**
   * Equal comparison
   */
  eq<T>(left: ExprLike<T> | FieldRef<T> | ComputedRef<T>, right: ExprLike<T> | FieldRef<T> | ComputedRef<T>): Expr<boolean> {
    const l = normalizeOperand(left);
    const r = normalizeOperand(right);
    return new ExprImpl<boolean>(
      { kind: "eq", left: l.compile(), right: r.compile() },
      [...l.deps(), ...r.deps()]
    );
  },

  /**
   * Not equal comparison
   */
  neq<T>(left: ExprLike<T> | FieldRef<T> | ComputedRef<T>, right: ExprLike<T> | FieldRef<T> | ComputedRef<T>): Expr<boolean> {
    const l = normalizeOperand(left);
    const r = normalizeOperand(right);
    return new ExprImpl<boolean>(
      { kind: "neq", left: l.compile(), right: r.compile() },
      [...l.deps(), ...r.deps()]
    );
  },

  /**
   * Greater than comparison
   * Accepts nullable operands for convenience (null comparisons return false at runtime)
   */
  gt(
    left: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>,
    right: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<boolean> {
    const l = normalizeOperand(left);
    const r = normalizeOperand(right);
    return new ExprImpl<boolean>(
      { kind: "gt", left: l.compile(), right: r.compile() },
      [...l.deps(), ...r.deps()]
    );
  },

  /**
   * Greater than or equal comparison
   * Accepts nullable operands for convenience (null comparisons return false at runtime)
   */
  gte(
    left: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>,
    right: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<boolean> {
    const l = normalizeOperand(left);
    const r = normalizeOperand(right);
    return new ExprImpl<boolean>(
      { kind: "gte", left: l.compile(), right: r.compile() },
      [...l.deps(), ...r.deps()]
    );
  },

  /**
   * Less than comparison
   * Accepts nullable operands for convenience (null comparisons return false at runtime)
   */
  lt(
    left: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>,
    right: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<boolean> {
    const l = normalizeOperand(left);
    const r = normalizeOperand(right);
    return new ExprImpl<boolean>(
      { kind: "lt", left: l.compile(), right: r.compile() },
      [...l.deps(), ...r.deps()]
    );
  },

  /**
   * Less than or equal comparison
   * Accepts nullable operands for convenience (null comparisons return false at runtime)
   */
  lte(
    left: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>,
    right: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<boolean> {
    const l = normalizeOperand(left);
    const r = normalizeOperand(right);
    return new ExprImpl<boolean>(
      { kind: "lte", left: l.compile(), right: r.compile() },
      [...l.deps(), ...r.deps()]
    );
  },

  // ============ Logical ============

  /**
   * Logical AND
   */
  and(...args: Array<ExprLike<boolean> | FieldRef<boolean> | ComputedRef<boolean>>): Expr<boolean> {
    const normalized = args.map((a) => normalizeOperand(a));
    return new ExprImpl<boolean>(
      { kind: "and", args: normalized.map((a) => a.compile()) },
      normalized.flatMap((a) => a.deps())
    );
  },

  /**
   * Logical OR
   */
  or(...args: Array<ExprLike<boolean> | FieldRef<boolean> | ComputedRef<boolean>>): Expr<boolean> {
    const normalized = args.map((a) => normalizeOperand(a));
    return new ExprImpl<boolean>(
      { kind: "or", args: normalized.map((a) => a.compile()) },
      normalized.flatMap((a) => a.deps())
    );
  },

  /**
   * Logical NOT
   */
  not(arg: ExprLike<boolean> | FieldRef<boolean> | ComputedRef<boolean>): Expr<boolean> {
    const a = normalizeOperand(arg);
    return new ExprImpl<boolean>({ kind: "not", arg: a.compile() }, a.deps());
  },

  // ============ Conditional ============

  /**
   * Conditional (ternary) expression
   */
  if<T>(
    cond: ExprLike<boolean> | FieldRef<boolean> | ComputedRef<boolean>,
    then: ExprLike<T> | FieldRef<T> | ComputedRef<T>,
    else_: ExprLike<T> | FieldRef<T> | ComputedRef<T>
  ): Expr<T> {
    const c = normalizeOperand(cond);
    const t = normalizeOperand(then);
    const e = normalizeOperand(else_);
    return new ExprImpl<T>(
      { kind: "if", cond: c.compile(), then: t.compile(), else: e.compile() },
      [...c.deps(), ...t.deps(), ...e.deps()]
    );
  },

  /**
   * Conditional expression (alias for if)
   * Note: Uses same IR structure as if() - kind: "if"
   */
  cond<T>(
    condition: ExprLike<boolean> | FieldRef<boolean> | ComputedRef<boolean>,
    then: ExprLike<T> | FieldRef<T> | ComputedRef<T>,
    else_: ExprLike<T> | FieldRef<T> | ComputedRef<T>
  ): Expr<T> {
    const c = normalizeOperand(condition);
    const t = normalizeOperand(then);
    const e = normalizeOperand(else_);
    return new ExprImpl<T>(
      { kind: "if", cond: c.compile(), then: t.compile(), else: e.compile() },
      [...c.deps(), ...t.deps(), ...e.deps()]
    );
  },

  // ============ Null Handling ============

  /**
   * Check if value is null or undefined
   */
  isNull<T>(arg: ExprLike<T | null | undefined> | FieldRef<T | null | undefined> | ComputedRef<T | null | undefined>): Expr<boolean> {
    const a = normalizeOperand(arg);
    return new ExprImpl<boolean>({ kind: "isNull", arg: a.compile() }, a.deps());
  },

  /**
   * Check if value is not null and not undefined
   * Note: Compiles to not(isNull(arg)) since Core only has isNull
   */
  isNotNull<T>(arg: ExprLike<T | null | undefined> | FieldRef<T | null | undefined> | ComputedRef<T | null | undefined>): Expr<boolean> {
    const a = normalizeOperand(arg);
    return new ExprImpl<boolean>(
      { kind: "not", arg: { kind: "isNull", arg: a.compile() } },
      a.deps()
    );
  },

  /**
   * Check if value is set (not undefined)
   * Note: In JavaScript null !== undefined, but for Core we treat this as isNotNull
   */
  isSet<T>(arg: ExprLike<T | undefined> | FieldRef<T | undefined> | ComputedRef<T | undefined>): Expr<boolean> {
    const a = normalizeOperand(arg);
    return new ExprImpl<boolean>(
      { kind: "not", arg: { kind: "isNull", arg: a.compile() } },
      a.deps()
    );
  },

  /**
   * Check if value is not set (is undefined)
   * Note: Compiles to isNull since Core treats null and undefined the same
   */
  isNotSet<T>(arg: ExprLike<T | undefined> | FieldRef<T | undefined> | ComputedRef<T | undefined>): Expr<boolean> {
    const a = normalizeOperand(arg);
    return new ExprImpl<boolean>({ kind: "isNull", arg: a.compile() }, a.deps());
  },

  /**
   * Return fallback if value is null/undefined
   * Note: Core uses args array format for coalesce
   */
  coalesce<T>(
    value: ExprLike<T | null | undefined> | FieldRef<T | null | undefined> | ComputedRef<T | null | undefined>,
    fallback: ExprLike<T> | FieldRef<T> | ComputedRef<T>
  ): Expr<T> {
    const v = normalizeOperand(value);
    const f = normalizeOperand(fallback);
    return new ExprImpl<T>(
      { kind: "coalesce", args: [v.compile(), f.compile()] },
      [...v.deps(), ...f.deps()]
    );
  },

  // ============ Arithmetic ============

  /**
   * Addition
   * Accepts nullable operands for convenience
   */
  add(
    left: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>,
    right: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number> {
    const l = normalizeOperand(left);
    const r = normalizeOperand(right);
    return new ExprImpl<number>(
      { kind: "add", left: l.compile(), right: r.compile() },
      [...l.deps(), ...r.deps()]
    );
  },

  /**
   * Subtraction
   * Accepts nullable operands for convenience
   */
  sub(
    left: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>,
    right: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number> {
    const l = normalizeOperand(left);
    const r = normalizeOperand(right);
    return new ExprImpl<number>(
      { kind: "sub", left: l.compile(), right: r.compile() },
      [...l.deps(), ...r.deps()]
    );
  },

  /**
   * Multiplication
   * Accepts nullable operands for convenience
   */
  mul(
    left: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>,
    right: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number> {
    const l = normalizeOperand(left);
    const r = normalizeOperand(right);
    return new ExprImpl<number>(
      { kind: "mul", left: l.compile(), right: r.compile() },
      [...l.deps(), ...r.deps()]
    );
  },

  /**
   * Division
   * Accepts nullable operands for convenience
   */
  div(
    left: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>,
    right: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number> {
    const l = normalizeOperand(left);
    const r = normalizeOperand(right);
    return new ExprImpl<number>(
      { kind: "div", left: l.compile(), right: r.compile() },
      [...l.deps(), ...r.deps()]
    );
  },

  /**
   * Modulo
   * Accepts nullable operands for convenience
   */
  mod(
    left: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>,
    right: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number> {
    const l = normalizeOperand(left);
    const r = normalizeOperand(right);
    return new ExprImpl<number>(
      { kind: "mod", left: l.compile(), right: r.compile() },
      [...l.deps(), ...r.deps()]
    );
  },

  /**
   * Negate a number
   * @example expr.neg(5) // -5
   */
  neg(
    arg: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number> {
    const a = normalizeOperand(arg);
    return new ExprImpl<number>({ kind: "neg", arg: a.compile() }, a.deps());
  },

  /**
   * Absolute value
   * @example expr.abs(-5) // 5
   */
  abs(
    arg: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number> {
    const a = normalizeOperand(arg);
    return new ExprImpl<number>({ kind: "abs", arg: a.compile() }, a.deps());
  },

  /**
   * Minimum of multiple numbers
   * @example expr.min(5, 3, 8) // 3
   */
  min(
    ...args: Array<ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>>
  ): Expr<number | null> {
    const normalized = args.map((a) => normalizeOperand(a));
    return new ExprImpl<number | null>(
      { kind: "min", args: normalized.map((a) => a.compile()) },
      normalized.flatMap((a) => a.deps())
    );
  },

  /**
   * Maximum of multiple numbers
   * @example expr.max(5, 3, 8) // 8
   */
  max(
    ...args: Array<ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>>
  ): Expr<number | null> {
    const normalized = args.map((a) => normalizeOperand(a));
    return new ExprImpl<number | null>(
      { kind: "max", args: normalized.map((a) => a.compile()) },
      normalized.flatMap((a) => a.deps())
    );
  },

  /**
   * Floor (round down)
   * @example expr.floor(3.7) // 3
   */
  floor(
    arg: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number> {
    const a = normalizeOperand(arg);
    return new ExprImpl<number>({ kind: "floor", arg: a.compile() }, a.deps());
  },

  /**
   * Ceiling (round up)
   * @example expr.ceil(3.2) // 4
   */
  ceil(
    arg: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number> {
    const a = normalizeOperand(arg);
    return new ExprImpl<number>({ kind: "ceil", arg: a.compile() }, a.deps());
  },

  /**
   * Round to nearest integer
   * @example expr.round(3.5) // 4
   */
  round(
    arg: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number> {
    const a = normalizeOperand(arg);
    return new ExprImpl<number>({ kind: "round", arg: a.compile() }, a.deps());
  },

  /**
   * Square root (returns null for negative numbers)
   * @example expr.sqrt(9) // 3
   */
  sqrt(
    arg: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number | null> {
    const a = normalizeOperand(arg);
    return new ExprImpl<number | null>({ kind: "sqrt", arg: a.compile() }, a.deps());
  },

  /**
   * Power (base^exponent)
   * @example expr.pow(2, 3) // 8
   */
  pow(
    base: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>,
    exponent: ExprLike<number | null | undefined> | FieldRef<number | null | undefined> | ComputedRef<number | null | undefined>
  ): Expr<number> {
    const b = normalizeOperand(base);
    const e = normalizeOperand(exponent);
    return new ExprImpl<number>(
      { kind: "pow", base: b.compile(), exponent: e.compile() },
      [...b.deps(), ...e.deps()]
    );
  },

  // ============ String ============

  /**
   * String concatenation
   */
  concat(...args: Array<ExprLike<string> | FieldRef<string> | ComputedRef<string>>): Expr<string> {
    const normalized = args.map((a) => normalizeOperand(a));
    return new ExprImpl<string>(
      { kind: "concat", args: normalized.map((a) => a.compile()) },
      normalized.flatMap((a) => a.deps())
    );
  },

  /**
   * Trim whitespace from string
   * @example expr.trim("  hello  ") // "hello"
   */
  trim(
    str: ExprLike<string | null | undefined> | FieldRef<string | null | undefined> | ComputedRef<string | null | undefined>
  ): Expr<string> {
    const s = normalizeOperand(str);
    return new ExprImpl<string>({ kind: "trim", str: s.compile() }, s.deps());
  },

  /**
   * Convert to lowercase
   * @example expr.toLowerCase("HELLO") // "hello"
   */
  toLowerCase(
    str: ExprLike<string | null | undefined> | FieldRef<string | null | undefined> | ComputedRef<string | null | undefined>
  ): Expr<string> {
    const s = normalizeOperand(str);
    return new ExprImpl<string>({ kind: "toLowerCase", str: s.compile() }, s.deps());
  },

  /**
   * Convert to uppercase
   * @example expr.toUpperCase("hello") // "HELLO"
   */
  toUpperCase(
    str: ExprLike<string | null | undefined> | FieldRef<string | null | undefined> | ComputedRef<string | null | undefined>
  ): Expr<string> {
    const s = normalizeOperand(str);
    return new ExprImpl<string>({ kind: "toUpperCase", str: s.compile() }, s.deps());
  },

  /**
   * Get string length
   * @example expr.strLen("hello") // 5
   */
  strLen(
    str: ExprLike<string | null | undefined> | FieldRef<string | null | undefined> | ComputedRef<string | null | undefined>
  ): Expr<number> {
    const s = normalizeOperand(str);
    return new ExprImpl<number>({ kind: "strLen", str: s.compile() }, s.deps());
  },

  // ============ Conversion ============

  /**
   * Convert value to string
   * @example expr.toString(42) // "42"
   * @example expr.toString(true) // "true"
   */
  toString(
    arg: ExprLike<unknown> | FieldRef<unknown> | ComputedRef<unknown>
  ): Expr<string> {
    const a = normalizeOperand(arg);
    return new ExprImpl<string>({ kind: "toString", arg: a.compile() }, a.deps());
  },

  // ============ Collection ============

  /**
   * Get length of string, array, or object keys
   */
  len<T extends string | unknown[] | Record<string, unknown>>(
    arg: ExprLike<T> | FieldRef<T> | ComputedRef<T>
  ): Expr<number> {
    const a = normalizeOperand(arg);
    return new ExprImpl<number>({ kind: "len", arg: a.compile() }, a.deps());
  },

  // ============ Type ============

  /**
   * Get the type of a value as a string
   */
  typeOf<T>(arg: ExprLike<T> | FieldRef<T> | ComputedRef<T>): Expr<string> {
    const a = normalizeOperand(arg);
    return new ExprImpl<string>({ kind: "typeof", arg: a.compile() }, a.deps());
  },

  // ============ Collection Operations (Phase 1: Critical) ============

  /**
   * Filter array elements matching a predicate
   *
   * @example
   * ```ts
   * expr.filter(state.todos, item => expr.not(item.completed))
   * ```
   */
  filter<T = unknown>(
    array: ExprLike<T[]> | FieldRef<T[]> | FieldRef<unknown>,
    predicate: (item: ItemProxy<T>, index?: IndexProxy, array?: ArrayProxy<T>) => Expr<boolean>
  ): Expr<T[]> {
    const arr = normalizeOperand(array);
    const predicateNode = extractPredicate(predicate);
    const arrayPath = getPathFromExpr(arr.compile());

    return new ExprImpl<T[]>(
      { kind: "filter", array: arr.compile(), predicate: predicateNode },
      [...arr.deps(), ...collectPredicateDeps(predicateNode, arrayPath)]
    );
  },

  /**
   * Transform array elements with a mapper function
   *
   * @example
   * ```ts
   * expr.map(state.todos, item => expr.merge(item, { done: expr.lit(true) }))
   * ```
   */
  map<T = unknown, R = unknown>(
    array: ExprLike<T[]> | FieldRef<T[]> | FieldRef<unknown>,
    mapper: (item: ItemProxy<T>, index?: IndexProxy, array?: ArrayProxy<T>) => Expr<R>
  ): Expr<R[]> {
    const arr = normalizeOperand(array);
    const mapperNode = extractMapper(mapper);
    const arrayPath = getPathFromExpr(arr.compile());

    return new ExprImpl<R[]>(
      { kind: "map", array: arr.compile(), mapper: mapperNode },
      [...arr.deps(), ...collectPredicateDeps(mapperNode, arrayPath)]
    );
  },

  /**
   * Create an object with dynamic field values
   *
   * @example
   * ```ts
   * expr.object({
   *   id: expr.input("id"),
   *   title: expr.input("title"),
   *   completed: expr.lit(false),
   * })
   * ```
   */
  object<T = unknown>(
    fields: Record<string, ExprLike<unknown> | FieldRef<unknown> | ComputedRef<unknown>>
  ): Expr<T> {
    const compiledFields: Record<string, import("@manifesto-ai/core").ExprNode> = {};
    const allDeps: string[] = [];

    for (const [key, value] of Object.entries(fields)) {
      const normalized = normalizeOperand(value);
      compiledFields[key] = normalized.compile();
      allDeps.push(...normalized.deps());
    }

    return new ExprImpl<T>(
      { kind: "object", fields: compiledFields },
      allDeps
    );
  },

  /**
   * Merge multiple objects into one (later objects override earlier ones)
   *
   * @example
   * ```ts
   * expr.merge(item, { completed: expr.lit(true) })
   * ```
   */
  merge<T = unknown>(
    ...objects: Array<ExprLike<Partial<T>> | FieldRef<unknown> | ComputedRef<unknown>>
  ): Expr<T> {
    const normalized = objects.map((o) => normalizeOperand(o));
    return new ExprImpl<T>(
      { kind: "merge", objects: normalized.map((o) => o.compile()) },
      normalized.flatMap((o) => o.deps())
    );
  },

  // ============ Collection Operations (Phase 2: Element Access) ============

  /**
   * Get array element at index
   *
   * @example
   * ```ts
   * expr.at(state.items, 0)  // First item
   * expr.at(state.items, -1) // Last item
   * ```
   */
  at<T = unknown>(
    array: ExprLike<T[]> | FieldRef<T[]> | FieldRef<unknown>,
    index: ExprLike<number> | FieldRef<number> | ComputedRef<number>
  ): Expr<T | null> {
    const arr = normalizeOperand(array);
    const idx = normalizeOperand(index);
    return new ExprImpl<T | null>(
      { kind: "at", array: arr.compile(), index: idx.compile() },
      [...arr.deps(), ...idx.deps()]
    );
  },

  /**
   * Get first element of array (null if empty)
   */
  first<T = unknown>(
    array: ExprLike<T[]> | FieldRef<T[]> | FieldRef<unknown>
  ): Expr<T | null> {
    const arr = normalizeOperand(array);
    return new ExprImpl<T | null>(
      { kind: "first", array: arr.compile() },
      arr.deps()
    );
  },

  /**
   * Get last element of array (null if empty)
   */
  last<T = unknown>(
    array: ExprLike<T[]> | FieldRef<T[]> | FieldRef<unknown>
  ): Expr<T | null> {
    const arr = normalizeOperand(array);
    return new ExprImpl<T | null>(
      { kind: "last", array: arr.compile() },
      arr.deps()
    );
  },

  /**
   * Find first element matching predicate (null if not found)
   *
   * @example
   * ```ts
   * expr.find(state.todos, item => expr.eq(item.id, targetId))
   * ```
   */
  find<T = unknown>(
    array: ExprLike<T[]> | FieldRef<T[]> | FieldRef<unknown>,
    predicate: (item: ItemProxy<T>, index?: IndexProxy, array?: ArrayProxy<T>) => Expr<boolean>
  ): Expr<T | null> {
    const arr = normalizeOperand(array);
    const predicateNode = extractPredicate(predicate);
    const arrayPath = getPathFromExpr(arr.compile());

    return new ExprImpl<T | null>(
      { kind: "find", array: arr.compile(), predicate: predicateNode },
      [...arr.deps(), ...collectPredicateDeps(predicateNode, arrayPath)]
    );
  },

  // ============ Collection Operations (Phase 3: Predicates) ============

  /**
   * Check if every element matches predicate
   *
   * @example
   * ```ts
   * expr.every(state.todos, item => item.completed)
   * ```
   */
  every<T = unknown>(
    array: ExprLike<T[]> | FieldRef<T[]> | FieldRef<unknown>,
    predicate: (item: ItemProxy<T>, index?: IndexProxy, array?: ArrayProxy<T>) => Expr<boolean>
  ): Expr<boolean> {
    const arr = normalizeOperand(array);
    const predicateNode = extractPredicate(predicate);
    const arrayPath = getPathFromExpr(arr.compile());

    return new ExprImpl<boolean>(
      { kind: "every", array: arr.compile(), predicate: predicateNode },
      [...arr.deps(), ...collectPredicateDeps(predicateNode, arrayPath)]
    );
  },

  /**
   * Check if any element matches predicate
   *
   * @example
   * ```ts
   * expr.some(state.todos, item => item.completed)
   * ```
   */
  some<T = unknown>(
    array: ExprLike<T[]> | FieldRef<T[]> | FieldRef<unknown>,
    predicate: (item: ItemProxy<T>, index?: IndexProxy, array?: ArrayProxy<T>) => Expr<boolean>
  ): Expr<boolean> {
    const arr = normalizeOperand(array);
    const predicateNode = extractPredicate(predicate);
    const arrayPath = getPathFromExpr(arr.compile());

    return new ExprImpl<boolean>(
      { kind: "some", array: arr.compile(), predicate: predicateNode },
      [...arr.deps(), ...collectPredicateDeps(predicateNode, arrayPath)]
    );
  },

  /**
   * Check if array includes an item
   *
   * @example
   * ```ts
   * expr.includes(state.tags, "important")
   * ```
   */
  includes<T = unknown>(
    array: ExprLike<T[]> | FieldRef<T[]> | FieldRef<unknown>,
    item: ExprLike<T> | FieldRef<T> | ComputedRef<T>
  ): Expr<boolean> {
    const arr = normalizeOperand(array);
    const itm = normalizeOperand(item);
    return new ExprImpl<boolean>(
      { kind: "includes", array: arr.compile(), item: itm.compile() },
      [...arr.deps(), ...itm.deps()]
    );
  },

  // ============ Collection Operations (Phase 4: Slicing) ============

  /**
   * Extract a portion of array
   *
   * @example
   * ```ts
   * expr.slice(state.items, 0, 10)  // First 10 items
   * expr.slice(state.items, -5)     // Last 5 items
   * ```
   */
  slice<T = unknown>(
    array: ExprLike<T[]> | FieldRef<T[]> | FieldRef<unknown>,
    start: ExprLike<number> | FieldRef<number> | ComputedRef<number>,
    end?: ExprLike<number> | FieldRef<number> | ComputedRef<number>
  ): Expr<T[]> {
    const arr = normalizeOperand(array);
    const s = normalizeOperand(start);
    const deps = [...arr.deps(), ...s.deps()];

    const node: Record<string, unknown> = {
      kind: "slice",
      array: arr.compile(),
      start: s.compile(),
    };

    if (end !== undefined) {
      const e = normalizeOperand(end);
      node.end = e.compile();
      deps.push(...e.deps());
    }

    return new ExprImpl<T[]>(node as ExprNode, deps);
  },

  /**
   * Extract a portion of string
   *
   * @example
   * ```ts
   * expr.substring(state.name, 0, 10)  // First 10 characters
   * ```
   */
  substring(
    str: ExprLike<string> | FieldRef<string> | ComputedRef<string>,
    start: ExprLike<number> | FieldRef<number> | ComputedRef<number>,
    end?: ExprLike<number> | FieldRef<number> | ComputedRef<number>
  ): Expr<string> {
    const s = normalizeOperand(str);
    const st = normalizeOperand(start);
    const deps = [...s.deps(), ...st.deps()];

    const node: Record<string, unknown> = {
      kind: "substring",
      str: s.compile(),
      start: st.compile(),
    };

    if (end !== undefined) {
      const e = normalizeOperand(end);
      node.end = e.compile();
      deps.push(...e.deps());
    }

    return new ExprImpl<string>(node as ExprNode, deps);
  },

  /**
   * Append items to array (returns new array)
   *
   * @example
   * ```ts
   * expr.append(state.todos, newTodo)
   * ```
   */
  append<T = unknown>(
    array: ExprLike<T[]> | FieldRef<T[]> | FieldRef<unknown>,
    ...items: Array<ExprLike<T> | FieldRef<T> | ComputedRef<T>>
  ): Expr<T[]> {
    const arr = normalizeOperand(array);
    const itemNodes = items.map((i) => normalizeOperand(i));

    // Use append for array append (not concat which is for strings)
    return new ExprImpl<T[]>(
      { kind: "append", array: arr.compile(), items: itemNodes.map((i) => i.compile()) },
      [...arr.deps(), ...itemNodes.flatMap((i) => i.deps())]
    );
  },

  // ============ Object Operations (Phase 5) ============

  /**
   * Get all keys of an object as array
   *
   * @example
   * ```ts
   * expr.keys(state.settings)  // ["theme", "language", ...]
   * ```
   */
  keys<T extends Record<string, unknown>>(
    obj: ExprLike<T> | FieldRef<T> | ComputedRef<T> | FieldRef<unknown>
  ): Expr<string[]> {
    const o = normalizeOperand(obj);
    return new ExprImpl<string[]>(
      { kind: "keys", obj: o.compile() },
      o.deps()
    );
  },

  /**
   * Get all values of an object as array
   *
   * @example
   * ```ts
   * expr.values(state.scores)  // [100, 85, 92, ...]
   * ```
   */
  values<T extends Record<string, unknown>>(
    obj: ExprLike<T> | FieldRef<T> | ComputedRef<T> | FieldRef<unknown>
  ): Expr<T[keyof T][]> {
    const o = normalizeOperand(obj);
    return new ExprImpl<T[keyof T][]>(
      { kind: "values", obj: o.compile() },
      o.deps()
    );
  },

  /**
   * Get all [key, value] pairs of an object as array
   *
   * @example
   * ```ts
   * expr.entries(state.settings)  // [["theme", "dark"], ["language", "en"]]
   * ```
   */
  entries<T extends Record<string, unknown>>(
    obj: ExprLike<T> | FieldRef<T> | ComputedRef<T> | FieldRef<unknown>
  ): Expr<[string, T[keyof T]][]> {
    const o = normalizeOperand(obj);
    return new ExprImpl<[string, T[keyof T]][]>(
      { kind: "entries", obj: o.compile() },
      o.deps()
    );
  },
};

/**
 * Helper to extract path from an ExprNode (for dependency tracking)
 */
function getPathFromExpr(node: ExprNode): string {
  if (node.kind === "get") {
    return (node as { path: string }).path;
  }
  return "";
}

/**
 * Normalize any operand to Expr
 */
function normalizeOperand<T>(value: ExprLike<T> | FieldRef<T> | ComputedRef<T>): Expr<T> {
  if (isFieldRef(value) || isComputedRef(value)) {
    return refToExpr(value);
  }
  return toExpr(value);
}

export type ExprBuilder = typeof expr;
