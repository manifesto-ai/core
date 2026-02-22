/**
 * Expression Evaluation
 *
 * Evaluates Core IR expressions against evaluation context.
 *
 * AXIOM A35: Expression evaluation is total; invalid operations return null, never throw.
 *
 * @see SPEC v0.4.0 §18
 */

import type { ExprNode } from "@manifesto-ai/core";
import type { EvaluationContext } from "./context.js";
import { parsePath } from "@manifesto-ai/core";

// ============ Main Evaluation Function ============

/**
 * Evaluate a Core IR expression.
 *
 * Total function: returns null on any error, never throws.
 *
 * @param expr - Core IR expression
 * @param ctx - Evaluation context
 * @returns Evaluated value or null on error
 *
 * @see SPEC v0.4.0 §18.4, A35
 */
export function evaluateExpr(expr: ExprNode, ctx: EvaluationContext): unknown {
  try {
    return evaluateNode(expr, ctx);
  } catch {
    // Total function: never throw
    return null;
  }
}

/**
 * Internal evaluation (may throw, caught by evaluateExpr).
 */
function evaluateNode(expr: ExprNode, ctx: EvaluationContext): unknown {
  switch (expr.kind) {
    // Literals
    case "lit":
      return expr.value;

    case "get":
      return resolvePath(expr.path, ctx);

    // Comparison
    case "eq":
      return evaluateEq(expr.left, expr.right, ctx);

    case "neq":
      return evaluateNeq(expr.left, expr.right, ctx);

    case "gt":
      return evaluateComparison(expr.left, expr.right, ctx, (a, b) => a > b);

    case "gte":
      return evaluateComparison(expr.left, expr.right, ctx, (a, b) => a >= b);

    case "lt":
      return evaluateComparison(expr.left, expr.right, ctx, (a, b) => a < b);

    case "lte":
      return evaluateComparison(expr.left, expr.right, ctx, (a, b) => a <= b);

    // Logical
    case "and":
      return evaluateAnd(expr.args, ctx);

    case "or":
      return evaluateOr(expr.args, ctx);

    case "not":
      return evaluateNot(expr.arg, ctx);

    // Conditional
    case "if":
      return evaluateIf(expr.cond, expr.then, expr.else, ctx);

    // Arithmetic
    case "add":
      return evaluateArithmetic(expr.left, expr.right, ctx, (a, b) => a + b);

    case "sub":
      return evaluateArithmetic(expr.left, expr.right, ctx, (a, b) => a - b);

    case "mul":
      return evaluateArithmetic(expr.left, expr.right, ctx, (a, b) => a * b);

    case "div":
      return evaluateDiv(expr.left, expr.right, ctx);

    case "mod":
      return evaluateMod(expr.left, expr.right, ctx);

    // String
    case "concat":
      return evaluateConcat(expr.args, ctx);

    case "substring":
      return evaluateSubstring(expr.str, expr.start, expr.end, ctx);

    case "trim":
      return evaluateTrim(expr.str, ctx);

    // Collection
    case "len":
      return evaluateLen(expr.arg, ctx);

    case "at":
      return evaluateAt(expr.array, expr.index, ctx);

    case "first":
      return evaluateFirst(expr.array, ctx);

    case "last":
      return evaluateLast(expr.array, ctx);

    case "slice":
      return evaluateSlice(expr.array, expr.start, expr.end, ctx);

    case "includes":
      return evaluateIncludes(expr.array, expr.item, ctx);

    case "filter":
      return evaluateFilter(expr.array, expr.predicate, ctx);

    case "map":
      return evaluateMap(expr.array, expr.mapper, ctx);

    case "find":
      return evaluateFind(expr.array, expr.predicate, ctx);

    case "every":
      return evaluateEvery(expr.array, expr.predicate, ctx);

    case "some":
      return evaluateSome(expr.array, expr.predicate, ctx);

    case "append":
      return evaluateAppend(expr.array, expr.items, ctx);

    // Object
    case "object":
      return evaluateObject(expr.fields, ctx);

    case "field":
      return evaluateFieldAccess(expr.object, expr.property, ctx);

    case "keys":
      return evaluateKeys(expr.obj, ctx);

    case "values":
      return evaluateValues(expr.obj, ctx);

    case "entries":
      return evaluateEntries(expr.obj, ctx);

    case "merge":
      return evaluateMerge(expr.objects, ctx);

    // Type
    case "typeof":
      return evaluateTypeof(expr.arg, ctx);

    case "isNull":
      return evaluateIsNull(expr.arg, ctx);

    case "coalesce":
      return evaluateCoalesce(expr.args, ctx);

    default:
      // Unknown kind → null
      return null;
  }
}

// ============ Path Resolution ============

/**
 * Resolve a path in the evaluation context.
 *
 * Path prefixes:
 * - meta.* → ctx.meta
 * - input.* → ctx.input
 * - $item.* → ctx.item
 * - computed.* → ctx.snapshot.computed
 * - (other) → ctx.snapshot.data
 *
 * @see SPEC v0.4.0 §18.7
 */
function resolvePath(path: string, ctx: EvaluationContext): unknown {
  const parts = parsePath(path);

  // Special prefixes
  if (parts[0] === "meta") {
    return getValueAtPath(ctx.meta, parts.slice(1));
  }

  if (parts[0] === "input") {
    return getValueAtPath(ctx.input, parts.slice(1));
  }

  if (parts[0] === "$item") {
    if (ctx.item === undefined) {
      return null;
    }
    if (parts.length === 1) {
      return ctx.item;
    }
    return getValueAtPath(ctx.item, parts.slice(1));
  }

  if (parts[0] === "computed") {
    return getValueAtPath(ctx.snapshot.computed, parts.slice(1));
  }

  // Default: resolve in snapshot.data
  return getValueAtPath(ctx.snapshot.data, parts);
}

/**
 * Get value at a path in an object.
 */
function getValueAtPath(obj: unknown, parts: string[]): unknown {
  if (parts.length === 0) {
    return obj;
  }

  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== "object") {
    return null;
  }

  const [head, ...rest] = parts;
  const next = (obj as Record<string, unknown>)[head];

  if (rest.length === 0) {
    return next === undefined ? null : next;
  }

  return getValueAtPath(next, rest);
}

// ============ Comparison Operators ============

function evaluateEq(left: ExprNode, right: ExprNode, ctx: EvaluationContext): boolean | null {
  const l = evaluateNode(left, ctx);
  const r = evaluateNode(right, ctx);
  return deepEqual(l, r);
}

function evaluateNeq(left: ExprNode, right: ExprNode, ctx: EvaluationContext): boolean | null {
  const result = evaluateEq(left, right, ctx);
  if (result === null) return null;
  return !result;
}

function evaluateComparison(
  left: ExprNode,
  right: ExprNode,
  ctx: EvaluationContext,
  compare: (a: number, b: number) => boolean
): boolean | null {
  const l = evaluateNode(left, ctx);
  const r = evaluateNode(right, ctx);

  if (typeof l !== "number" || typeof r !== "number") {
    return null;
  }

  return compare(l, r);
}

/**
 * Deep equality check.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
    );
  }

  return false;
}

// ============ Logical Operators ============

function evaluateAnd(args: ExprNode[], ctx: EvaluationContext): boolean | null {
  for (const arg of args) {
    const result = evaluateNode(arg, ctx);
    if (result !== true) {
      return result === false ? false : null;
    }
  }
  return true;
}

function evaluateOr(args: ExprNode[], ctx: EvaluationContext): boolean | null {
  for (const arg of args) {
    const result = evaluateNode(arg, ctx);
    if (result === true) {
      return true;
    }
    if (result !== false) {
      return null;
    }
  }
  return false;
}

function evaluateNot(arg: ExprNode, ctx: EvaluationContext): boolean | null {
  const result = evaluateNode(arg, ctx);
  if (typeof result !== "boolean") {
    return null;
  }
  return !result;
}

// ============ Conditional ============

function evaluateIf(
  cond: ExprNode,
  thenExpr: ExprNode,
  elseExpr: ExprNode,
  ctx: EvaluationContext
): unknown {
  const condResult = evaluateNode(cond, ctx);
  if (condResult === true) {
    return evaluateNode(thenExpr, ctx);
  }
  if (condResult === false) {
    return evaluateNode(elseExpr, ctx);
  }
  // Non-boolean condition → null
  return null;
}

// ============ Arithmetic Operators ============

function evaluateArithmetic(
  left: ExprNode,
  right: ExprNode,
  ctx: EvaluationContext,
  op: (a: number, b: number) => number
): number | null {
  const l = evaluateNode(left, ctx);
  const r = evaluateNode(right, ctx);

  if (typeof l !== "number" || typeof r !== "number") {
    return null;
  }

  const result = op(l, r);
  if (!Number.isFinite(result)) {
    return null;
  }

  return result;
}

function evaluateDiv(left: ExprNode, right: ExprNode, ctx: EvaluationContext): number | null {
  const l = evaluateNode(left, ctx);
  const r = evaluateNode(right, ctx);

  if (typeof l !== "number" || typeof r !== "number") {
    return null;
  }

  // Division by zero → null
  if (r === 0) {
    return null;
  }

  return l / r;
}

function evaluateMod(left: ExprNode, right: ExprNode, ctx: EvaluationContext): number | null {
  const l = evaluateNode(left, ctx);
  const r = evaluateNode(right, ctx);

  if (typeof l !== "number" || typeof r !== "number") {
    return null;
  }

  // Modulo by zero → null
  if (r === 0) {
    return null;
  }

  return l % r;
}

// ============ String Operators ============

function evaluateConcat(args: ExprNode[], ctx: EvaluationContext): string | null {
  const values: string[] = [];
  for (const arg of args) {
    const val = evaluateNode(arg, ctx);
    if (typeof val !== "string") {
      return null;
    }
    values.push(val);
  }
  return values.join("");
}

function evaluateSubstring(
  str: ExprNode,
  start: ExprNode,
  end: ExprNode | undefined,
  ctx: EvaluationContext
): string | null {
  const s = evaluateNode(str, ctx);
  const startIdx = evaluateNode(start, ctx);

  if (typeof s !== "string" || typeof startIdx !== "number") {
    return null;
  }

  if (end === undefined) {
    return s.substring(startIdx);
  }

  const endIdx = evaluateNode(end, ctx);
  if (typeof endIdx !== "number") {
    return null;
  }

  return s.substring(startIdx, endIdx);
}

function evaluateTrim(str: ExprNode, ctx: EvaluationContext): string | null {
  const s = evaluateNode(str, ctx);
  if (typeof s !== "string") {
    return null;
  }
  return s.trim();
}

// ============ Collection Operators ============

function evaluateLen(arg: ExprNode, ctx: EvaluationContext): number | null {
  const val = evaluateNode(arg, ctx);

  if (Array.isArray(val)) {
    return val.length;
  }

  if (typeof val === "string") {
    return val.length;
  }

  if (val !== null && typeof val === "object") {
    return Object.keys(val).length;
  }

  return null;
}

function evaluateAt(array: ExprNode, index: ExprNode, ctx: EvaluationContext): unknown {
  const base = evaluateNode(array, ctx);
  const key = evaluateNode(index, ctx);

  // Array indexing: at(array, numericIndex)
  if (Array.isArray(base) && typeof key === "number") {
    if (key < 0 || key >= base.length) {
      return null;
    }
    return base[key];
  }

  // Record lookup: at(record, stringKey) — exclude arrays
  if (typeof base === "object" && base !== null && !Array.isArray(base) && typeof key === "string") {
    return (base as Record<string, unknown>)[key] ?? null;
  }

  return null;
}

function evaluateFirst(array: ExprNode, ctx: EvaluationContext): unknown {
  const arr = evaluateNode(array, ctx);

  if (!Array.isArray(arr) || arr.length === 0) {
    return null;
  }

  return arr[0];
}

function evaluateLast(array: ExprNode, ctx: EvaluationContext): unknown {
  const arr = evaluateNode(array, ctx);

  if (!Array.isArray(arr) || arr.length === 0) {
    return null;
  }

  return arr[arr.length - 1];
}

function evaluateSlice(
  array: ExprNode,
  start: ExprNode,
  end: ExprNode | undefined,
  ctx: EvaluationContext
): unknown[] | null {
  const arr = evaluateNode(array, ctx);
  const startIdx = evaluateNode(start, ctx);

  if (!Array.isArray(arr) || typeof startIdx !== "number") {
    return null;
  }

  if (end === undefined) {
    return arr.slice(startIdx);
  }

  const endIdx = evaluateNode(end, ctx);
  if (typeof endIdx !== "number") {
    return null;
  }

  return arr.slice(startIdx, endIdx);
}

function evaluateIncludes(array: ExprNode, item: ExprNode, ctx: EvaluationContext): boolean | null {
  const arr = evaluateNode(array, ctx);
  const val = evaluateNode(item, ctx);

  if (!Array.isArray(arr)) {
    return null;
  }

  return arr.some((el) => deepEqual(el, val));
}

function evaluateFilter(
  array: ExprNode,
  predicate: ExprNode,
  ctx: EvaluationContext
): unknown[] | null {
  const arr = evaluateNode(array, ctx);

  if (!Array.isArray(arr)) {
    return null;
  }

  const result: unknown[] = [];
  for (const item of arr) {
    const itemCtx = { ...ctx, item };
    const keep = evaluateNode(predicate, itemCtx);
    if (keep === true) {
      result.push(item);
    } else if (keep !== false) {
      // Non-boolean predicate → null
      return null;
    }
  }

  return result;
}

function evaluateMap(
  array: ExprNode,
  mapper: ExprNode,
  ctx: EvaluationContext
): unknown[] | null {
  const arr = evaluateNode(array, ctx);

  if (!Array.isArray(arr)) {
    return null;
  }

  const result: unknown[] = [];
  for (const item of arr) {
    const itemCtx = { ...ctx, item };
    const mapped = evaluateNode(mapper, itemCtx);
    result.push(mapped);
  }

  return result;
}

function evaluateFind(
  array: ExprNode,
  predicate: ExprNode,
  ctx: EvaluationContext
): unknown {
  const arr = evaluateNode(array, ctx);

  if (!Array.isArray(arr)) {
    return null;
  }

  for (const item of arr) {
    const itemCtx = { ...ctx, item };
    const match = evaluateNode(predicate, itemCtx);
    if (match === true) {
      return item;
    }
    if (match !== false) {
      // Non-boolean predicate → null
      return null;
    }
  }

  return null;
}

function evaluateEvery(
  array: ExprNode,
  predicate: ExprNode,
  ctx: EvaluationContext
): boolean | null {
  const arr = evaluateNode(array, ctx);

  if (!Array.isArray(arr)) {
    return null;
  }

  for (const item of arr) {
    const itemCtx = { ...ctx, item };
    const result = evaluateNode(predicate, itemCtx);
    if (result === false) {
      return false;
    }
    if (result !== true) {
      // Non-boolean predicate → null
      return null;
    }
  }

  return true;
}

function evaluateSome(
  array: ExprNode,
  predicate: ExprNode,
  ctx: EvaluationContext
): boolean | null {
  const arr = evaluateNode(array, ctx);

  if (!Array.isArray(arr)) {
    return null;
  }

  for (const item of arr) {
    const itemCtx = { ...ctx, item };
    const result = evaluateNode(predicate, itemCtx);
    if (result === true) {
      return true;
    }
    if (result !== false) {
      // Non-boolean predicate → null
      return null;
    }
  }

  return false;
}

function evaluateAppend(
  array: ExprNode,
  items: ExprNode[],
  ctx: EvaluationContext
): unknown[] | null {
  const arr = evaluateNode(array, ctx);

  if (!Array.isArray(arr)) {
    return null;
  }

  const itemValues = items.map((item) => evaluateNode(item, ctx));
  return [...arr, ...itemValues];
}

// ============ Object Operators ============

function evaluateObject(
  fields: Record<string, ExprNode>,
  ctx: EvaluationContext
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = evaluateNode(value, ctx);
  }
  return result;
}

function evaluateFieldAccess(
  objectExpr: ExprNode,
  property: string,
  ctx: EvaluationContext
): unknown {
  const obj = evaluateNode(objectExpr, ctx);

  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return null;
  }

  return (obj as Record<string, unknown>)[property] ?? null;
}

function evaluateKeys(obj: ExprNode, ctx: EvaluationContext): string[] | null {
  const o = evaluateNode(obj, ctx);

  if (o === null || typeof o !== "object" || Array.isArray(o)) {
    return null;
  }

  return Object.keys(o);
}

function evaluateValues(obj: ExprNode, ctx: EvaluationContext): unknown[] | null {
  const o = evaluateNode(obj, ctx);

  if (o === null || typeof o !== "object" || Array.isArray(o)) {
    return null;
  }

  return Object.values(o);
}

function evaluateEntries(obj: ExprNode, ctx: EvaluationContext): [string, unknown][] | null {
  const o = evaluateNode(obj, ctx);

  if (o === null || typeof o !== "object" || Array.isArray(o)) {
    return null;
  }

  return Object.entries(o);
}

function evaluateMerge(
  objects: ExprNode[],
  ctx: EvaluationContext
): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};

  for (const objExpr of objects) {
    const o = evaluateNode(objExpr, ctx);

    if (o === null || typeof o !== "object" || Array.isArray(o)) {
      return null;
    }

    Object.assign(result, o);
  }

  return result;
}

// ============ Type Operators ============

function evaluateTypeof(arg: ExprNode, ctx: EvaluationContext): string {
  const val = evaluateNode(arg, ctx);

  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  return typeof val;
}

function evaluateIsNull(arg: ExprNode, ctx: EvaluationContext): boolean {
  const val = evaluateNode(arg, ctx);
  return val === null;
}

function evaluateCoalesce(args: ExprNode[], ctx: EvaluationContext): unknown {
  for (const arg of args) {
    const val = evaluateNode(arg, ctx);
    if (val !== null && val !== undefined) {
      return val;
    }
  }
  return null;
}
