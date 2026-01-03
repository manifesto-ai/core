import type { ExprNode } from "../schema/expr.js";
import type { ErrorValue } from "../schema/snapshot.js";
import type { Result } from "../schema/common.js";
import { ok, err } from "../schema/common.js";
import { createError } from "../errors.js";
import { getByPath } from "../utils/path.js";
import { type EvalContext, withCollectionContext } from "./context.js";

export type ExprResult = Result<unknown, ErrorValue>;

/**
 * Evaluate an expression node
 * All expressions are pure and total (always return a value or error)
 */
export function evaluateExpr(expr: ExprNode, ctx: EvalContext): ExprResult {
  switch (expr.kind) {
    // Literals
    case "lit":
      return ok(expr.value);

    case "get":
      return evaluateGet(expr.path, ctx);

    // Comparison
    case "eq":
      return evaluateBinary(expr.left, expr.right, ctx, (a, b) => a === b);
    case "neq":
      return evaluateBinary(expr.left, expr.right, ctx, (a, b) => a !== b);
    case "gt":
      return evaluateBinary(expr.left, expr.right, ctx, (a, b) => toNumber(a) > toNumber(b));
    case "gte":
      return evaluateBinary(expr.left, expr.right, ctx, (a, b) => toNumber(a) >= toNumber(b));
    case "lt":
      return evaluateBinary(expr.left, expr.right, ctx, (a, b) => toNumber(a) < toNumber(b));
    case "lte":
      return evaluateBinary(expr.left, expr.right, ctx, (a, b) => toNumber(a) <= toNumber(b));

    // Logical
    case "and":
      return evaluateAnd(expr.args, ctx);
    case "or":
      return evaluateOr(expr.args, ctx);
    case "not":
      return evaluateNot(expr.arg, ctx);

    // Conditional
    case "if":
      return evaluateIf(expr, ctx);

    // Arithmetic
    case "add":
      return evaluateBinary(expr.left, expr.right, ctx, (a, b) => toNumber(a) + toNumber(b));
    case "sub":
      return evaluateBinary(expr.left, expr.right, ctx, (a, b) => toNumber(a) - toNumber(b));
    case "mul":
      return evaluateBinary(expr.left, expr.right, ctx, (a, b) => toNumber(a) * toNumber(b));
    case "div":
      return evaluateDiv(expr.left, expr.right, ctx);
    case "mod":
      return evaluateMod(expr.left, expr.right, ctx);
    case "neg":
      return evaluateNeg(expr.arg, ctx);
    case "abs":
      return evaluateAbs(expr.arg, ctx);
    case "min":
      return evaluateMin(expr.args, ctx);
    case "max":
      return evaluateMax(expr.args, ctx);
    // v0.3.2: Array aggregation
    case "sumArray":
      return evaluateSumArray(expr.array, ctx);
    case "minArray":
      return evaluateMinArray(expr.array, ctx);
    case "maxArray":
      return evaluateMaxArray(expr.array, ctx);
    case "floor":
      return evaluateFloor(expr.arg, ctx);
    case "ceil":
      return evaluateCeil(expr.arg, ctx);
    case "round":
      return evaluateRound(expr.arg, ctx);
    case "sqrt":
      return evaluateSqrt(expr.arg, ctx);
    case "pow":
      return evaluatePow(expr.base, expr.exponent, ctx);

    // String
    case "concat":
      return evaluateConcat(expr.args, ctx);
    case "substring":
      return evaluateSubstring(expr, ctx);
    case "trim":
      return evaluateTrim(expr.str, ctx);
    case "toLowerCase":
      return evaluateToLower(expr.str, ctx);
    case "toUpperCase":
      return evaluateToUpper(expr.str, ctx);
    case "strLen":
      return evaluateStrLen(expr.str, ctx);

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
      return evaluateSlice(expr, ctx);
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

    // Conversion
    case "toString":
      return evaluateToStringExpr(expr.arg, ctx);

    default:
      return err(createError(
        "INTERNAL_ERROR",
        `Unknown expression kind: ${(expr as ExprNode).kind}`,
        ctx.currentAction ?? "",
        ctx.nodePath,
        ctx.trace.timestamp
      ));
  }
}

// ============ Helper Functions ============

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  return 0;
}

function toBoolean(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0;
  return true;
}

function toString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return String(value);
}

// ============ Get ============

function evaluateGet(path: string, ctx: EvalContext): ExprResult {
  // Handle collection context variables
  if (path.startsWith("$item")) {
    if (ctx.$item === undefined) {
      return ok(undefined);
    }
    if (path === "$item") {
      return ok(ctx.$item);
    }
    // e.g., $item.completed
    const subPath = path.slice(6); // Remove "$item."
    return ok(getByPath(ctx.$item, subPath));
  }

  if (path === "$index") {
    return ok(ctx.$index);
  }

  if (path === "$array") {
    return ok(ctx.$array);
  }

  // Handle input path
  if (path.startsWith("input.") || path === "input") {
    const subPath = path === "input" ? "" : path.slice(6);
    return ok(subPath ? getByPath(ctx.snapshot.input, subPath) : ctx.snapshot.input);
  }

  // Handle meta path (intent/action/timestamp)
  if (path.startsWith("meta.") || path === "meta") {
    const subPath = path === "meta" ? "" : path.slice(5);
    return ok(subPath ? getByPath(ctx.meta, subPath) : ctx.meta);
  }

  // Handle computed path
  if (path.startsWith("computed.")) {
    return ok(ctx.snapshot.computed[path]);
  }

  // Handle system path
  if (path.startsWith("system.")) {
    const subPath = path.slice(7);
    return ok(getByPath(ctx.snapshot.system, subPath));
  }

  // Default: get from data
  return ok(getByPath(ctx.snapshot.data, path));
}

// ============ Binary Operations ============

function evaluateBinary(
  left: ExprNode,
  right: ExprNode,
  ctx: EvalContext,
  op: (a: unknown, b: unknown) => unknown
): ExprResult {
  const leftResult = evaluateExpr(left, ctx);
  if (!leftResult.ok) return leftResult;

  const rightResult = evaluateExpr(right, ctx);
  if (!rightResult.ok) return rightResult;

  return ok(op(leftResult.value, rightResult.value));
}

// ============ Logical ============

function evaluateAnd(args: ExprNode[], ctx: EvalContext): ExprResult {
  for (const arg of args) {
    const result = evaluateExpr(arg, ctx);
    if (!result.ok) return result;
    if (!toBoolean(result.value)) return ok(false);
  }
  return ok(true);
}

function evaluateOr(args: ExprNode[], ctx: EvalContext): ExprResult {
  for (const arg of args) {
    const result = evaluateExpr(arg, ctx);
    if (!result.ok) return result;
    if (toBoolean(result.value)) return ok(true);
  }
  return ok(false);
}

function evaluateNot(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(!toBoolean(result.value));
}

// ============ Conditional ============

function evaluateIf(expr: { cond: ExprNode; then: ExprNode; else: ExprNode }, ctx: EvalContext): ExprResult {
  const condResult = evaluateExpr(expr.cond, ctx);
  if (!condResult.ok) return condResult;

  return evaluateExpr(toBoolean(condResult.value) ? expr.then : expr.else, ctx);
}

// ============ Arithmetic ============

function evaluateDiv(left: ExprNode, right: ExprNode, ctx: EvalContext): ExprResult {
  const leftResult = evaluateExpr(left, ctx);
  if (!leftResult.ok) return leftResult;

  const rightResult = evaluateExpr(right, ctx);
  if (!rightResult.ok) return rightResult;

  const divisor = toNumber(rightResult.value);
  if (divisor === 0) return ok(null); // Division by zero returns null, not error

  return ok(toNumber(leftResult.value) / divisor);
}

function evaluateMod(left: ExprNode, right: ExprNode, ctx: EvalContext): ExprResult {
  const leftResult = evaluateExpr(left, ctx);
  if (!leftResult.ok) return leftResult;

  const rightResult = evaluateExpr(right, ctx);
  if (!rightResult.ok) return rightResult;

  const divisor = toNumber(rightResult.value);
  if (divisor === 0) return ok(null);

  return ok(toNumber(leftResult.value) % divisor);
}

function evaluateNeg(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(-toNumber(result.value));
}

function evaluateAbs(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(Math.abs(toNumber(result.value)));
}

function evaluateMin(args: ExprNode[], ctx: EvalContext): ExprResult {
  if (args.length === 0) return ok(null);
  const values: number[] = [];
  for (const arg of args) {
    const result = evaluateExpr(arg, ctx);
    if (!result.ok) return result;
    values.push(toNumber(result.value));
  }
  return ok(Math.min(...values));
}

function evaluateMax(args: ExprNode[], ctx: EvalContext): ExprResult {
  if (args.length === 0) return ok(null);
  const values: number[] = [];
  for (const arg of args) {
    const result = evaluateExpr(arg, ctx);
    if (!result.ok) return result;
    values.push(toNumber(result.value));
  }
  return ok(Math.max(...values));
}

// v0.3.2: Array aggregation functions

function evaluateSumArray(array: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(array, ctx);
  if (!result.ok) return result;

  const arr = result.value;
  if (!Array.isArray(arr)) return ok(0);
  if (arr.length === 0) return ok(0);

  let sum = 0;
  for (const item of arr) {
    sum += toNumber(item);
  }
  return ok(sum);
}

function evaluateMinArray(array: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(array, ctx);
  if (!result.ok) return result;

  const arr = result.value;
  if (!Array.isArray(arr)) return ok(null);
  if (arr.length === 0) return ok(null);

  let min = toNumber(arr[0]);
  for (let i = 1; i < arr.length; i++) {
    const val = toNumber(arr[i]);
    if (val < min) min = val;
  }
  return ok(min);
}

function evaluateMaxArray(array: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(array, ctx);
  if (!result.ok) return result;

  const arr = result.value;
  if (!Array.isArray(arr)) return ok(null);
  if (arr.length === 0) return ok(null);

  let max = toNumber(arr[0]);
  for (let i = 1; i < arr.length; i++) {
    const val = toNumber(arr[i]);
    if (val > max) max = val;
  }
  return ok(max);
}

function evaluateFloor(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(Math.floor(toNumber(result.value)));
}

function evaluateCeil(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(Math.ceil(toNumber(result.value)));
}

function evaluateRound(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(Math.round(toNumber(result.value)));
}

function evaluateSqrt(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  const num = toNumber(result.value);
  if (num < 0) return ok(null); // Totality: return null for negative
  return ok(Math.sqrt(num));
}

function evaluatePow(base: ExprNode, exponent: ExprNode, ctx: EvalContext): ExprResult {
  const baseResult = evaluateExpr(base, ctx);
  if (!baseResult.ok) return baseResult;
  const expResult = evaluateExpr(exponent, ctx);
  if (!expResult.ok) return expResult;
  return ok(Math.pow(toNumber(baseResult.value), toNumber(expResult.value)));
}

// ============ String ============

function evaluateConcat(args: ExprNode[], ctx: EvalContext): ExprResult {
  const parts: string[] = [];
  for (const arg of args) {
    const result = evaluateExpr(arg, ctx);
    if (!result.ok) return result;
    parts.push(toString(result.value));
  }
  return ok(parts.join(""));
}

function evaluateSubstring(
  expr: { str: ExprNode; start: ExprNode; end?: ExprNode },
  ctx: EvalContext
): ExprResult {
  const strResult = evaluateExpr(expr.str, ctx);
  if (!strResult.ok) return strResult;

  const startResult = evaluateExpr(expr.start, ctx);
  if (!startResult.ok) return startResult;

  const str = toString(strResult.value);
  const start = toNumber(startResult.value);

  if (expr.end) {
    const endResult = evaluateExpr(expr.end, ctx);
    if (!endResult.ok) return endResult;
    return ok(str.substring(start, toNumber(endResult.value)));
  }

  return ok(str.substring(start));
}

function evaluateTrim(str: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(str, ctx);
  if (!result.ok) return result;
  return ok(toString(result.value).trim());
}

function evaluateToLower(str: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(str, ctx);
  if (!result.ok) return result;
  return ok(toString(result.value).toLowerCase());
}

function evaluateToUpper(str: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(str, ctx);
  if (!result.ok) return result;
  return ok(toString(result.value).toUpperCase());
}

function evaluateStrLen(str: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(str, ctx);
  if (!result.ok) return result;
  return ok(toString(result.value).length);
}

// ============ Collection ============

function evaluateLen(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;

  const value = result.value;
  if (Array.isArray(value)) return ok(value.length);
  if (typeof value === "string") return ok(value.length);
  if (typeof value === "object" && value !== null) return ok(Object.keys(value).length);
  return ok(0);
}

function evaluateAt(array: ExprNode, index: ExprNode, ctx: EvalContext): ExprResult {
  const arrayResult = evaluateExpr(array, ctx);
  if (!arrayResult.ok) return arrayResult;

  const indexResult = evaluateExpr(index, ctx);
  if (!indexResult.ok) return indexResult;

  const arr = arrayResult.value;
  if (!Array.isArray(arr)) return ok(null);

  const idx = toNumber(indexResult.value);
  if (idx < 0 || idx >= arr.length) return ok(null); // Out of bounds returns null

  return ok(arr[idx]);
}

function evaluateFirst(array: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(array, ctx);
  if (!result.ok) return result;

  const arr = result.value;
  if (!Array.isArray(arr) || arr.length === 0) return ok(null);
  return ok(arr[0]);
}

function evaluateLast(array: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(array, ctx);
  if (!result.ok) return result;

  const arr = result.value;
  if (!Array.isArray(arr) || arr.length === 0) return ok(null);
  return ok(arr[arr.length - 1]);
}

function evaluateSlice(
  expr: { array: ExprNode; start: ExprNode; end?: ExprNode },
  ctx: EvalContext
): ExprResult {
  const arrayResult = evaluateExpr(expr.array, ctx);
  if (!arrayResult.ok) return arrayResult;

  const startResult = evaluateExpr(expr.start, ctx);
  if (!startResult.ok) return startResult;

  const arr = arrayResult.value;
  if (!Array.isArray(arr)) return ok([]);

  const start = toNumber(startResult.value);

  if (expr.end) {
    const endResult = evaluateExpr(expr.end, ctx);
    if (!endResult.ok) return endResult;
    return ok(arr.slice(start, toNumber(endResult.value)));
  }

  return ok(arr.slice(start));
}

function evaluateIncludes(array: ExprNode, item: ExprNode, ctx: EvalContext): ExprResult {
  const arrayResult = evaluateExpr(array, ctx);
  if (!arrayResult.ok) return arrayResult;

  const itemResult = evaluateExpr(item, ctx);
  if (!itemResult.ok) return itemResult;

  const arr = arrayResult.value;
  if (!Array.isArray(arr)) return ok(false);

  return ok(arr.includes(itemResult.value));
}

function evaluateFilter(array: ExprNode, predicate: ExprNode, ctx: EvalContext): ExprResult {
  const arrayResult = evaluateExpr(array, ctx);
  if (!arrayResult.ok) return arrayResult;

  const arr = arrayResult.value;
  if (!Array.isArray(arr)) return ok([]);

  const filtered: unknown[] = [];
  for (let i = 0; i < arr.length; i++) {
    const itemCtx = withCollectionContext(ctx, arr[i], i, arr);
    const predicateResult = evaluateExpr(predicate, itemCtx);
    if (!predicateResult.ok) return predicateResult;
    if (toBoolean(predicateResult.value)) {
      filtered.push(arr[i]);
    }
  }

  return ok(filtered);
}

function evaluateMap(array: ExprNode, mapper: ExprNode, ctx: EvalContext): ExprResult {
  const arrayResult = evaluateExpr(array, ctx);
  if (!arrayResult.ok) return arrayResult;

  const arr = arrayResult.value;
  if (!Array.isArray(arr)) return ok([]);

  const mapped: unknown[] = [];
  for (let i = 0; i < arr.length; i++) {
    const itemCtx = withCollectionContext(ctx, arr[i], i, arr);
    const mapResult = evaluateExpr(mapper, itemCtx);
    if (!mapResult.ok) return mapResult;
    mapped.push(mapResult.value);
  }

  return ok(mapped);
}

function evaluateFind(array: ExprNode, predicate: ExprNode, ctx: EvalContext): ExprResult {
  const arrayResult = evaluateExpr(array, ctx);
  if (!arrayResult.ok) return arrayResult;

  const arr = arrayResult.value;
  if (!Array.isArray(arr)) return ok(null);

  for (let i = 0; i < arr.length; i++) {
    const itemCtx = withCollectionContext(ctx, arr[i], i, arr);
    const predicateResult = evaluateExpr(predicate, itemCtx);
    if (!predicateResult.ok) return predicateResult;
    if (toBoolean(predicateResult.value)) {
      return ok(arr[i]);
    }
  }

  return ok(null);
}

function evaluateEvery(array: ExprNode, predicate: ExprNode, ctx: EvalContext): ExprResult {
  const arrayResult = evaluateExpr(array, ctx);
  if (!arrayResult.ok) return arrayResult;

  const arr = arrayResult.value;
  if (!Array.isArray(arr)) return ok(true);

  for (let i = 0; i < arr.length; i++) {
    const itemCtx = withCollectionContext(ctx, arr[i], i, arr);
    const predicateResult = evaluateExpr(predicate, itemCtx);
    if (!predicateResult.ok) return predicateResult;
    if (!toBoolean(predicateResult.value)) {
      return ok(false);
    }
  }

  return ok(true);
}

function evaluateSome(array: ExprNode, predicate: ExprNode, ctx: EvalContext): ExprResult {
  const arrayResult = evaluateExpr(array, ctx);
  if (!arrayResult.ok) return arrayResult;

  const arr = arrayResult.value;
  if (!Array.isArray(arr)) return ok(false);

  for (let i = 0; i < arr.length; i++) {
    const itemCtx = withCollectionContext(ctx, arr[i], i, arr);
    const predicateResult = evaluateExpr(predicate, itemCtx);
    if (!predicateResult.ok) return predicateResult;
    if (toBoolean(predicateResult.value)) {
      return ok(true);
    }
  }

  return ok(false);
}

function evaluateAppend(array: ExprNode, items: ExprNode[], ctx: EvalContext): ExprResult {
  const arrayResult = evaluateExpr(array, ctx);
  if (!arrayResult.ok) return arrayResult;

  const arr = arrayResult.value;
  if (!Array.isArray(arr)) return ok([]);

  const result = [...arr];
  for (const itemExpr of items) {
    const itemResult = evaluateExpr(itemExpr, ctx);
    if (!itemResult.ok) return itemResult;
    result.push(itemResult.value);
  }

  return ok(result);
}

// ============ Object ============

function evaluateObject(fields: Record<string, ExprNode>, ctx: EvalContext): ExprResult {
  const result: Record<string, unknown> = {};

  for (const [key, fieldExpr] of Object.entries(fields)) {
    const fieldResult = evaluateExpr(fieldExpr, ctx);
    if (!fieldResult.ok) return fieldResult;
    result[key] = fieldResult.value;
  }

  return ok(result);
}

function evaluateKeys(obj: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(obj, ctx);
  if (!result.ok) return result;

  const value = result.value;
  if (typeof value !== "object" || value === null) return ok([]);
  return ok(Object.keys(value));
}

function evaluateValues(obj: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(obj, ctx);
  if (!result.ok) return result;

  const value = result.value;
  if (typeof value !== "object" || value === null) return ok([]);
  return ok(Object.values(value));
}

function evaluateEntries(obj: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(obj, ctx);
  if (!result.ok) return result;

  const value = result.value;
  if (typeof value !== "object" || value === null) return ok([]);
  return ok(Object.entries(value));
}

function evaluateMerge(objects: ExprNode[], ctx: EvalContext): ExprResult {
  const merged: Record<string, unknown> = {};

  for (const objExpr of objects) {
    const result = evaluateExpr(objExpr, ctx);
    if (!result.ok) return result;

    const value = result.value;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(merged, value);
    }
  }

  return ok(merged);
}

// ============ Type ============

function evaluateTypeof(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;

  const value = result.value;
  if (value === null) return ok("null");
  if (Array.isArray(value)) return ok("array");
  return ok(typeof value);
}

function evaluateIsNull(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(result.value === null || result.value === undefined);
}

function evaluateCoalesce(args: ExprNode[], ctx: EvalContext): ExprResult {
  for (const arg of args) {
    const result = evaluateExpr(arg, ctx);
    if (!result.ok) return result;
    if (result.value !== null && result.value !== undefined) {
      return result;
    }
  }
  return ok(null);
}

// ============ Conversion ============

function evaluateToStringExpr(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(toString(result.value));
}
