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
    case "min":
      return evaluateMin(expr.args, ctx);
    case "max":
      return evaluateMax(expr.args, ctx);
    case "abs":
      return evaluateAbs(expr.arg, ctx);
    case "neg":
      return evaluateNeg(expr.arg, ctx);
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
    case "sumArray":
      return evaluateSumArray(expr.array, ctx);
    case "minArray":
      return evaluateMinArray(expr.array, ctx);
    case "maxArray":
      return evaluateMaxArray(expr.array, ctx);

    // String
    case "concat":
      return evaluateConcat(expr.args, ctx);
    case "substring":
      return evaluateSubstring(expr, ctx);
    case "trim":
      return evaluateTrim(expr.str, ctx);
    case "toLowerCase":
      return evaluateToLowerCase(expr.str, ctx);
    case "toUpperCase":
      return evaluateToUpperCase(expr.str, ctx);
    case "strLen":
      return evaluateStrLen(expr.str, ctx);
    case "startsWith":
      return evaluateStartsWith(expr.str, expr.prefix, ctx);
    case "endsWith":
      return evaluateEndsWith(expr.str, expr.suffix, ctx);
    case "strIncludes":
      return evaluateStrIncludes(expr.str, expr.search, ctx);
    case "indexOf":
      return evaluateIndexOf(expr.str, expr.search, ctx);
    case "replace":
      return evaluateReplace(expr.str, expr.search, expr.replacement, ctx);
    case "split":
      return evaluateSplit(expr.str, expr.delimiter, ctx);

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
    case "reverse":
      return evaluateReverse(expr.array, ctx);
    case "unique":
      return evaluateUnique(expr.array, ctx);
    case "flat":
      return evaluateFlat(expr.array, ctx);

    // Object
    case "object":
      return evaluateObject(expr.fields, ctx);
    case "field":
      return evaluateField(expr.object, expr.property, ctx);
    case "keys":
      return evaluateKeys(expr.obj, ctx);
    case "values":
      return evaluateValues(expr.obj, ctx);
    case "entries":
      return evaluateEntries(expr.obj, ctx);
    case "merge":
      return evaluateMerge(expr.objects, ctx);
    case "hasKey":
      return evaluateHasKey(expr.obj, expr.key, ctx);
    case "pick":
      return evaluatePick(expr.obj, expr.keys, ctx);
    case "omit":
      return evaluateOmit(expr.obj, expr.keys, ctx);
    case "fromEntries":
      return evaluateFromEntries(expr.entries, ctx);

    // Type
    case "typeof":
      return evaluateTypeof(expr.arg, ctx);
    case "isNull":
      return evaluateIsNull(expr.arg, ctx);
    case "coalesce":
      return evaluateCoalesce(expr.args, ctx);

    // Conversion
    case "toString":
      return evaluateToString(expr.arg, ctx);
    case "toNumber":
      return evaluateToNumber(expr.arg, ctx);
    case "toBoolean":
      return evaluateToBoolean(expr.arg, ctx);

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

/**
 * Generate a deterministic UUID from intentId and counter
 * Uses a simple hash to create reproducible UUIDs
 */
function generateDeterministicUuid(intentId: string, counter: number): string {
  // Create a simple hash-based UUID from intentId and counter
  // This ensures the same intentId + counter always produces the same UUID
  const seed = `${intentId}-${counter}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert hash to hex string and format as UUID
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash * 31).toString(16).padStart(4, '0');
  const hex3 = Math.abs(hash * 37).toString(16).padStart(4, '0');
  const hex4 = Math.abs(hash * 41).toString(16).padStart(4, '0');
  const hex5 = Math.abs(hash * 43).toString(16).padStart(12, '0');

  return `${hex.slice(0, 8)}-${hex2.slice(0, 4)}-4${hex3.slice(1, 4)}-${hex4.slice(0, 4)}-${hex5.slice(0, 12)}`;
}

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

  // Handle $system paths (special runtime values)
  if (path.startsWith("$system.")) {
    const systemPath = path.slice(8); // Remove "$system."

    if (systemPath === "uuid") {
      // Generate deterministic UUID from intentId + counter
      const intentId = ctx.intentId ?? "no-intent";
      const counter = ctx.uuidCounter ?? 0;
      // Increment counter for next uuid call (mutable on purpose for determinism across calls)
      if (ctx.uuidCounter !== undefined) {
        ctx.uuidCounter = counter + 1;
      }
      return ok(generateDeterministicUuid(intentId, counter));
    }

    if (systemPath === "timestamp") {
      // Return the snapshot's timestamp (set by Host)
      return ok(new Date(ctx.snapshot.meta.timestamp).toISOString());
    }

    // Unknown $system path
    return ok(undefined);
  }

  // Handle meta path (snapshot metadata)
  if (path.startsWith("meta.")) {
    const metaPath = path.slice(5); // Remove "meta."

    if (metaPath === "intentId") {
      return ok(ctx.intentId);
    }

    if (metaPath === "actionName") {
      return ok(ctx.currentAction);
    }

    return ok(getByPath(ctx.snapshot.meta, metaPath));
  }

  // Handle input path
  if (path.startsWith("input.") || path === "input") {
    const subPath = path === "input" ? "" : path.slice(6);
    return ok(subPath ? getByPath(ctx.snapshot.input, subPath) : ctx.snapshot.input);
  }

  // Handle computed path
  if (path.startsWith("computed.")) {
    return ok(ctx.snapshot.computed[path]);
  }

  // Handle system path (snapshot.system, not $system)
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

function evaluateAbs(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(Math.abs(toNumber(result.value)));
}

function evaluateNeg(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(-toNumber(result.value));
}

// ============ String ============

function evaluateConcat(args: ExprNode[], ctx: EvalContext): ExprResult {
  // First, evaluate all arguments to determine if this is array or string concat
  const values: unknown[] = [];
  for (const arg of args) {
    const result = evaluateExpr(arg, ctx);
    if (!result.ok) return result;
    values.push(result.value);
  }

  // If any argument is an array, treat as array concatenation
  const hasArray = values.some(v => Array.isArray(v));
  if (hasArray) {
    const result: unknown[] = [];
    for (const value of values) {
      if (Array.isArray(value)) {
        result.push(...value);
      } else if (value !== null && value !== undefined) {
        // Single value gets added as element
        result.push(value);
      }
    }
    return ok(result);
  }

  // Otherwise, string concatenation
  const parts = values.map(v => toString(v));
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

  const base = arrayResult.value;
  const key = indexResult.value;

  // Array indexing: at(array, numericIndex)
  if (Array.isArray(base)) {
    const idx = toNumber(key);
    if (idx < 0 || idx >= base.length) return ok(null);
    return ok(base[idx]);
  }

  // Record lookup: at(record, stringKey)
  if (typeof base === "object" && base !== null && typeof key === "string") {
    return ok((base as Record<string, unknown>)[key] ?? null);
  }

  return ok(null);
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
  const baseArray = Array.isArray(arr) ? [...arr] : [];

  for (const itemExpr of items) {
    const itemResult = evaluateExpr(itemExpr, ctx);
    if (!itemResult.ok) return itemResult;
    baseArray.push(itemResult.value);
  }

  return ok(baseArray);
}

// ============ Object ============

function evaluateObject(fields: Record<string, ExprNode>, ctx: EvalContext): ExprResult {
  const result: Record<string, unknown> = {};

  for (const [key, valueExpr] of Object.entries(fields)) {
    const valueResult = evaluateExpr(valueExpr, ctx);
    if (!valueResult.ok) return valueResult;
    result[key] = valueResult.value;
  }

  return ok(result);
}

function evaluateField(objectExpr: ExprNode, property: string, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(objectExpr, ctx);
  if (!result.ok) return result;

  const obj = result.value;
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return ok(null);

  return ok((obj as Record<string, unknown>)[property] ?? null);
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

// ============ Arithmetic Extended (SPEC v2.0.0) ============

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
  const n = toNumber(result.value);
  if (n < 0) return ok(null);
  return ok(Math.sqrt(n));
}

function evaluatePow(base: ExprNode, exponent: ExprNode, ctx: EvalContext): ExprResult {
  const baseResult = evaluateExpr(base, ctx);
  if (!baseResult.ok) return baseResult;
  const expResult = evaluateExpr(exponent, ctx);
  if (!expResult.ok) return expResult;
  const result = Math.pow(toNumber(baseResult.value), toNumber(expResult.value));
  if (!Number.isFinite(result)) return ok(null);
  return ok(result);
}

// ============ Array Aggregation (SPEC v2.0.0) ============

function evaluateSumArray(array: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(array, ctx);
  if (!result.ok) return result;
  const arr = result.value;
  if (!Array.isArray(arr)) return ok(0);
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
  if (!Array.isArray(arr) || arr.length === 0) return ok(null);
  let min = toNumber(arr[0]);
  for (let i = 1; i < arr.length; i++) {
    const n = toNumber(arr[i]);
    if (n < min) min = n;
  }
  return ok(min);
}

function evaluateMaxArray(array: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(array, ctx);
  if (!result.ok) return result;
  const arr = result.value;
  if (!Array.isArray(arr) || arr.length === 0) return ok(null);
  let max = toNumber(arr[0]);
  for (let i = 1; i < arr.length; i++) {
    const n = toNumber(arr[i]);
    if (n > max) max = n;
  }
  return ok(max);
}

// ============ String Extended (SPEC v2.0.0 + v2.0.3) ============

function evaluateToLowerCase(str: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(str, ctx);
  if (!result.ok) return result;
  return ok(toString(result.value).toLowerCase());
}

function evaluateToUpperCase(str: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(str, ctx);
  if (!result.ok) return result;
  return ok(toString(result.value).toUpperCase());
}

function evaluateStrLen(str: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(str, ctx);
  if (!result.ok) return result;
  return ok(toString(result.value).length);
}

function evaluateStartsWith(str: ExprNode, prefix: ExprNode, ctx: EvalContext): ExprResult {
  const strResult = evaluateExpr(str, ctx);
  if (!strResult.ok) return strResult;
  const prefixResult = evaluateExpr(prefix, ctx);
  if (!prefixResult.ok) return prefixResult;
  return ok(toString(strResult.value).startsWith(toString(prefixResult.value)));
}

function evaluateEndsWith(str: ExprNode, suffix: ExprNode, ctx: EvalContext): ExprResult {
  const strResult = evaluateExpr(str, ctx);
  if (!strResult.ok) return strResult;
  const suffixResult = evaluateExpr(suffix, ctx);
  if (!suffixResult.ok) return suffixResult;
  return ok(toString(strResult.value).endsWith(toString(suffixResult.value)));
}

function evaluateStrIncludes(str: ExprNode, search: ExprNode, ctx: EvalContext): ExprResult {
  const strResult = evaluateExpr(str, ctx);
  if (!strResult.ok) return strResult;
  const searchResult = evaluateExpr(search, ctx);
  if (!searchResult.ok) return searchResult;
  return ok(toString(strResult.value).includes(toString(searchResult.value)));
}

function evaluateIndexOf(str: ExprNode, search: ExprNode, ctx: EvalContext): ExprResult {
  const strResult = evaluateExpr(str, ctx);
  if (!strResult.ok) return strResult;
  const searchResult = evaluateExpr(search, ctx);
  if (!searchResult.ok) return searchResult;
  return ok(toString(strResult.value).indexOf(toString(searchResult.value)));
}

function evaluateReplace(str: ExprNode, search: ExprNode, replacement: ExprNode, ctx: EvalContext): ExprResult {
  const strResult = evaluateExpr(str, ctx);
  if (!strResult.ok) return strResult;
  const searchResult = evaluateExpr(search, ctx);
  if (!searchResult.ok) return searchResult;
  const replacementResult = evaluateExpr(replacement, ctx);
  if (!replacementResult.ok) return replacementResult;
  // String.prototype.replace with string arg replaces only the first occurrence
  return ok(toString(strResult.value).replace(toString(searchResult.value), toString(replacementResult.value)));
}

function evaluateSplit(str: ExprNode, delimiter: ExprNode, ctx: EvalContext): ExprResult {
  const strResult = evaluateExpr(str, ctx);
  if (!strResult.ok) return strResult;
  const delimiterResult = evaluateExpr(delimiter, ctx);
  if (!delimiterResult.ok) return delimiterResult;
  return ok(toString(strResult.value).split(toString(delimiterResult.value)));
}

// ============ Collection Extended (SPEC v2.0.3) ============

function evaluateReverse(array: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(array, ctx);
  if (!result.ok) return result;
  const arr = result.value;
  if (!Array.isArray(arr)) return ok([]);
  return ok([...arr].reverse());
}

function evaluateUnique(array: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(array, ctx);
  if (!result.ok) return result;
  const arr = result.value;
  if (!Array.isArray(arr)) return ok([]);
  // SPEC: strict equality (===), preserve first-occurrence order
  const seen: unknown[] = [];
  const unique: unknown[] = [];
  for (const item of arr) {
    if (!seen.some(s => s === item)) {
      seen.push(item);
      unique.push(item);
    }
  }
  return ok(unique);
}

function evaluateFlat(array: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(array, ctx);
  if (!result.ok) return result;
  const arr = result.value;
  if (!Array.isArray(arr)) return ok([]);
  // SPEC: flatten exactly one level
  const flattened: unknown[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      flattened.push(...item);
    } else {
      flattened.push(item);
    }
  }
  return ok(flattened);
}

// ============ Object Extended (SPEC v2.0.3) ============

function evaluateHasKey(obj: ExprNode, key: ExprNode, ctx: EvalContext): ExprResult {
  const objResult = evaluateExpr(obj, ctx);
  if (!objResult.ok) return objResult;
  const keyResult = evaluateExpr(key, ctx);
  if (!keyResult.ok) return keyResult;
  const value = objResult.value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return ok(false);
  const k = keyResult.value;
  if (typeof k !== "string") return ok(false);
  return ok(Object.prototype.hasOwnProperty.call(value, k));
}

function evaluatePick(obj: ExprNode, keys: ExprNode, ctx: EvalContext): ExprResult {
  const objResult = evaluateExpr(obj, ctx);
  if (!objResult.ok) return objResult;
  const keysResult = evaluateExpr(keys, ctx);
  if (!keysResult.ok) return keysResult;
  const value = objResult.value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return ok({});
  const keyList = keysResult.value;
  if (!Array.isArray(keyList)) return ok({});
  const result: Record<string, unknown> = {};
  for (const k of keyList) {
    if (typeof k === "string" && Object.prototype.hasOwnProperty.call(value, k)) {
      result[k] = (value as Record<string, unknown>)[k];
    }
  }
  return ok(result);
}

function evaluateOmit(obj: ExprNode, keys: ExprNode, ctx: EvalContext): ExprResult {
  const objResult = evaluateExpr(obj, ctx);
  if (!objResult.ok) return objResult;
  const keysResult = evaluateExpr(keys, ctx);
  if (!keysResult.ok) return keysResult;
  const value = objResult.value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return ok({});
  const keyList = keysResult.value;
  const excludeSet = new Set<string>();
  if (Array.isArray(keyList)) {
    for (const k of keyList) {
      if (typeof k === "string") excludeSet.add(k);
    }
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!excludeSet.has(k)) {
      result[k] = v;
    }
  }
  return ok(result);
}

function evaluateFromEntries(entries: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(entries, ctx);
  if (!result.ok) return result;
  const arr = result.value;
  if (!Array.isArray(arr)) return ok({});
  const obj: Record<string, unknown> = {};
  for (const entry of arr) {
    // SPEC: skip entries that are not 2-element arrays with string key
    if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string") {
      obj[entry[0]] = entry[1];
    }
  }
  return ok(obj);
}

// ============ Conversion (SPEC v2.0.0 + v2.0.3) ============

function evaluateToString(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(toString(result.value));
}

function evaluateToNumber(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(toNumber(result.value));
}

function evaluateToBoolean(arg: ExprNode, ctx: EvalContext): ExprResult {
  const result = evaluateExpr(arg, ctx);
  if (!result.ok) return result;
  return ok(toBoolean(result.value));
}
