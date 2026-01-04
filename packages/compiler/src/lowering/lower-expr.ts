/**
 * Expression Lowering
 *
 * Transforms MEL Canonical IR (7 kinds) to Core Runtime IR (30+ kinds).
 *
 * @see SPEC v0.4.0 §17
 */

import type { ExprNode as CoreExprNode } from "@manifesto-ai/core";
import type { ExprLoweringContext } from "./context.js";
import {
  invalidKindForContext,
  invalidSysPath,
  unknownCallFn,
  unknownNodeKind,
  unsupportedBase,
} from "./errors.js";

// ============ MEL IR Types (Input) ============

/**
 * MEL primitive value.
 */
export type MelPrimitive = null | boolean | number | string;

/**
 * MEL path segment.
 */
export type MelPathSegment = { kind: "prop"; name: string };

/**
 * MEL path node array.
 */
export type MelPathNode = MelPathSegment[];

/**
 * MEL system path as segment array.
 */
export type MelSystemPath = string[];

/**
 * MEL object field.
 */
export type MelObjField = { key: string; value: MelExprNode };

/**
 * MEL Canonical IR (7 kinds).
 *
 * @see SPEC v0.4.0 §17.1.1
 */
export type MelExprNode =
  | { kind: "lit"; value: MelPrimitive }
  | { kind: "var"; name: "item" }
  | { kind: "sys"; path: MelSystemPath }
  | { kind: "get"; base?: MelExprNode; path: MelPathNode }
  | { kind: "call"; fn: string; args: MelExprNode[] }
  | { kind: "obj"; fields: MelObjField[] }
  | { kind: "arr"; elements: MelExprNode[] };

// ============ Lowering Function ============

/**
 * Lower MEL expression to Core expression.
 *
 * @param input - MEL canonical IR expression
 * @param ctx - Lowering context
 * @returns Core runtime IR expression
 * @throws LoweringError if expression cannot be lowered
 *
 * @see SPEC v0.4.0 §17.3
 */
export function lowerExprNode(
  input: MelExprNode,
  ctx: ExprLoweringContext
): CoreExprNode {
  switch (input.kind) {
    case "lit":
      return lowerLit(input);

    case "var":
      return lowerVar(input, ctx);

    case "sys":
      return lowerSys(input, ctx);

    case "get":
      return lowerGet(input, ctx);

    case "call":
      return lowerCall(input, ctx);

    case "obj":
      return lowerObj(input, ctx);

    case "arr":
      return lowerArr(input, ctx);

    default:
      throw unknownNodeKind((input as { kind: string }).kind);
  }
}

// ============ Individual Kind Lowering ============

/**
 * Lower lit node.
 * Pass through - Core lit accepts any value.
 */
function lowerLit(input: { kind: "lit"; value: MelPrimitive }): CoreExprNode {
  return { kind: "lit", value: input.value };
}

/**
 * Lower var node.
 *
 * var(item) → get("$item")
 *
 * Only allowed in effect.args context (allowItem: true).
 *
 * @see FDR-MEL-068, SPEC §17.3.2
 */
function lowerVar(
  input: { kind: "var"; name: "item" },
  ctx: ExprLoweringContext
): CoreExprNode {
  if (!ctx.allowItem) {
    throw invalidKindForContext("var", ctx.mode);
  }
  return { kind: "get", path: "$item" };
}

/**
 * Lower sys node.
 *
 * sys(["meta", "intentId"]) → get("meta.intentId")
 * sys(["input", "title"]) → get("input.title")
 * sys(["system", ...]) → LoweringError (forbidden in Translator path)
 *
 * @see FDR-MEL-067, FDR-MEL-071, SPEC §17.3.1
 */
function lowerSys(
  input: { kind: "sys"; path: MelSystemPath },
  ctx: ExprLoweringContext
): CoreExprNode {
  if (input.path.length === 0) {
    throw invalidSysPath(input.path);
  }

  const prefix = input.path[0];
  const allowedPrefixes = ctx.allowSysPaths?.prefixes ?? ["meta", "input"];

  if (!allowedPrefixes.includes(prefix as "meta" | "input")) {
    throw invalidSysPath(input.path);
  }

  // Core convention: no $ prefix for meta/input
  const path = input.path.join(".");
  return { kind: "get", path };
}

/**
 * Lower get node.
 *
 * PathNode[] → dot-notation string
 * get.base only supports var(item)
 *
 * @see FDR-MEL-066, SPEC §17.3.3, §17.3.4
 */
function lowerGet(
  input: { kind: "get"; base?: MelExprNode; path: MelPathNode },
  ctx: ExprLoweringContext
): CoreExprNode {
  const pathStr = input.path.map((seg) => seg.name).join(".");

  if (input.base === undefined) {
    return { kind: "get", path: pathStr };
  }

  // base must be var(item)
  if (input.base.kind === "var" && input.base.name === "item") {
    if (!ctx.allowItem) {
      throw invalidKindForContext("var", ctx.mode);
    }
    return { kind: "get", path: `$item.${pathStr}` };
  }

  throw unsupportedBase(input.base.kind);
}

/**
 * Lower call node.
 *
 * call(fn, args) → specialized Core node
 *
 * @see SPEC §17.3.5
 */
function lowerCall(
  input: { kind: "call"; fn: string; args: MelExprNode[] },
  ctx: ExprLoweringContext
): CoreExprNode {
  const { fn, args } = input;

  // Binary operators: left, right
  if (isBinaryOp(fn)) {
    if (args.length !== 2) {
      throw unknownCallFn(fn);
    }
    const [left, right] = args;
    return {
      kind: fn as CoreExprNode["kind"],
      left: lowerExprNode(left, ctx),
      right: lowerExprNode(right, ctx),
    } as CoreExprNode;
  }

  // Unary operators: arg
  if (isUnaryArgOp(fn)) {
    if (args.length !== 1) {
      throw unknownCallFn(fn);
    }
    return {
      kind: fn,
      arg: lowerExprNode(args[0], ctx),
    } as CoreExprNode;
  }

  // Unary operators: str
  if (fn === "trim") {
    if (args.length !== 1) {
      throw unknownCallFn(fn);
    }
    return {
      kind: "trim",
      str: lowerExprNode(args[0], ctx),
    };
  }

  // Variadic operators: args
  if (isArgsOp(fn)) {
    return {
      kind: fn,
      args: args.map((a) => lowerExprNode(a, ctx)),
    } as CoreExprNode;
  }

  // Conditional: if(cond, then, else)
  if (fn === "if") {
    if (args.length !== 3) {
      throw unknownCallFn(fn);
    }
    return {
      kind: "if",
      cond: lowerExprNode(args[0], ctx),
      then: lowerExprNode(args[1], ctx),
      else: lowerExprNode(args[2], ctx),
    };
  }

  // Array operators: array
  if (isArrayArgOp(fn)) {
    if (args.length !== 1) {
      throw unknownCallFn(fn);
    }
    return {
      kind: fn,
      array: lowerExprNode(args[0], ctx),
    } as CoreExprNode;
  }

  // Object operators: obj
  if (isObjArgOp(fn)) {
    if (args.length !== 1) {
      throw unknownCallFn(fn);
    }
    return {
      kind: fn,
      obj: lowerExprNode(args[0], ctx),
    } as CoreExprNode;
  }

  // at(array, index)
  if (fn === "at") {
    if (args.length !== 2) {
      throw unknownCallFn(fn);
    }
    return {
      kind: "at",
      array: lowerExprNode(args[0], ctx),
      index: lowerExprNode(args[1], ctx),
    };
  }

  // includes(array, item)
  if (fn === "includes") {
    if (args.length !== 2) {
      throw unknownCallFn(fn);
    }
    return {
      kind: "includes",
      array: lowerExprNode(args[0], ctx),
      item: lowerExprNode(args[1], ctx),
    };
  }

  // filter, map, find, every, some: array, predicate/mapper
  if (isPredicateOp(fn)) {
    if (args.length !== 2) {
      throw unknownCallFn(fn);
    }
    const predicateCtx: ExprLoweringContext = { ...ctx, allowItem: true };
    if (fn === "map") {
      return {
        kind: "map",
        array: lowerExprNode(args[0], ctx),
        mapper: lowerExprNode(args[1], predicateCtx),
      };
    }
    return {
      kind: fn,
      array: lowerExprNode(args[0], ctx),
      predicate: lowerExprNode(args[1], predicateCtx),
    } as CoreExprNode;
  }

  // slice(array, start, end?)
  if (fn === "slice") {
    if (args.length < 2 || args.length > 3) {
      throw unknownCallFn(fn);
    }
    const result: { kind: "slice"; array: CoreExprNode; start: CoreExprNode; end?: CoreExprNode } = {
      kind: "slice",
      array: lowerExprNode(args[0], ctx),
      start: lowerExprNode(args[1], ctx),
    };
    if (args.length === 3) {
      result.end = lowerExprNode(args[2], ctx);
    }
    return result;
  }

  // substring(str, start, end?)
  if (fn === "substring") {
    if (args.length < 2 || args.length > 3) {
      throw unknownCallFn(fn);
    }
    const result: { kind: "substring"; str: CoreExprNode; start: CoreExprNode; end?: CoreExprNode } = {
      kind: "substring",
      str: lowerExprNode(args[0], ctx),
      start: lowerExprNode(args[1], ctx),
    };
    if (args.length === 3) {
      result.end = lowerExprNode(args[2], ctx);
    }
    return result;
  }

  // append(array, ...items)
  if (fn === "append") {
    if (args.length < 1) {
      throw unknownCallFn(fn);
    }
    return {
      kind: "append",
      array: lowerExprNode(args[0], ctx),
      items: args.slice(1).map((a) => lowerExprNode(a, ctx)),
    };
  }

  // merge(...objects)
  if (fn === "merge") {
    return {
      kind: "merge",
      objects: args.map((a) => lowerExprNode(a, ctx)),
    };
  }

  throw unknownCallFn(fn);
}

/**
 * Lower obj node.
 *
 * obj({ fields: [{key, value}] }) → object({ fields: Record })
 *
 * @see SPEC §17
 */
function lowerObj(
  input: { kind: "obj"; fields: MelObjField[] },
  ctx: ExprLoweringContext
): CoreExprNode {
  const fields: Record<string, CoreExprNode> = {};
  for (const field of input.fields) {
    fields[field.key] = lowerExprNode(field.value, ctx);
  }
  return { kind: "object", fields };
}

/**
 * Lower arr node.
 *
 * arr({ elements: [...] }) → lit([...evaluated])
 *
 * Note: Core doesn't have an "arr" kind, so we evaluate to lit
 * if all elements are literals, otherwise use concat/append pattern.
 * For simplicity, we'll create an evaluated array literal.
 *
 * @see SPEC §17
 */
function lowerArr(
  input: { kind: "arr"; elements: MelExprNode[] },
  ctx: ExprLoweringContext
): CoreExprNode {
  // If all elements are literals, we can create a lit array
  const allLiterals = input.elements.every((e) => e.kind === "lit");
  if (allLiterals) {
    const values = input.elements.map(
      (e) => (e as { kind: "lit"; value: MelPrimitive }).value
    );
    return { kind: "lit", value: values };
  }

  // Otherwise, we need to build the array using concat
  // Start with empty array and append each element
  const loweredElements = input.elements.map((e) => lowerExprNode(e, ctx));

  if (loweredElements.length === 0) {
    return { kind: "lit", value: [] };
  }

  // Use append pattern: append([], e1, e2, ...)
  return {
    kind: "append",
    array: { kind: "lit", value: [] },
    items: loweredElements,
  };
}

// ============ Operator Classification ============

/** Binary operators: eq, neq, gt, gte, lt, lte, add, sub, mul, div, mod */
function isBinaryOp(fn: string): boolean {
  return [
    "eq", "neq", "gt", "gte", "lt", "lte",
    "add", "sub", "mul", "div", "mod",
  ].includes(fn);
}

/** Unary operators with 'arg' field: not, len, typeof, isNull */
function isUnaryArgOp(fn: string): boolean {
  return ["not", "len", "typeof", "isNull"].includes(fn);
}

/** Variadic operators with 'args' field: and, or, concat, coalesce */
function isArgsOp(fn: string): boolean {
  return ["and", "or", "concat", "coalesce"].includes(fn);
}

/** Array operators with 'array' field: first, last */
function isArrayArgOp(fn: string): boolean {
  return ["first", "last"].includes(fn);
}

/** Object operators with 'obj' field: keys, values, entries */
function isObjArgOp(fn: string): boolean {
  return ["keys", "values", "entries"].includes(fn);
}

/** Predicate operators: filter, find, every, some, map */
function isPredicateOp(fn: string): boolean {
  return ["filter", "find", "every", "some", "map"].includes(fn);
}
