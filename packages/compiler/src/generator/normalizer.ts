/**
 * Expression Normalizer
 * Converts MEL operators and function calls to Core ExprNode format
 * Based on MEL SPEC v0.3.1 Section 4 and FDR-MEL-038
 */

import type { CoreExprNode } from "./ir.js";
import type { BinaryOperator } from "../parser/ast.js";

/**
 * Normalize a binary operator to Core ExprNode
 */
export function normalizeExpr(
  op: BinaryOperator,
  left: CoreExprNode,
  right: CoreExprNode
): CoreExprNode {
  switch (op) {
    // Arithmetic
    case "+": return { kind: "add", left, right };
    case "-": return { kind: "sub", left, right };
    case "*": return { kind: "mul", left, right };
    case "/": return { kind: "div", left, right };
    case "%": return { kind: "mod", left, right };

    // Comparison
    case "==": return { kind: "eq", left, right };
    case "!=": return { kind: "neq", left, right };
    case "<": return { kind: "lt", left, right };
    case "<=": return { kind: "lte", left, right };
    case ">": return { kind: "gt", left, right };
    case ">=": return { kind: "gte", left, right };

    // Logical
    case "&&": return { kind: "and", args: [left, right] };
    case "||": return { kind: "or", args: [left, right] };

    // Nullish coalescing
    case "??": return { kind: "coalesce", args: [left, right] };
  }
}

/**
 * Function name to Core ExprNode mapping
 */
export function normalizeFunctionCall(
  name: string,
  args: CoreExprNode[]
): CoreExprNode {
  switch (name) {
    // ============ Arithmetic ============
    case "add":
      return { kind: "add", left: args[0], right: args[1] };
    case "sub":
      return { kind: "sub", left: args[0], right: args[1] };
    case "mul":
      return { kind: "mul", left: args[0], right: args[1] };
    case "div":
      return { kind: "div", left: args[0], right: args[1] };
    case "mod":
      return { kind: "mod", left: args[0], right: args[1] };
    case "neg":
      return { kind: "neg", arg: args[0] };
    case "abs":
      return { kind: "abs", arg: args[0] };
    case "min":
      // v0.3.2: single arg = array aggregation, multiple args = value comparison
      if (args.length === 1) {
        return { kind: "minArray", array: args[0] };
      }
      return { kind: "min", args };
    case "max":
      // v0.3.2: single arg = array aggregation, multiple args = value comparison
      if (args.length === 1) {
        return { kind: "maxArray", array: args[0] };
      }
      return { kind: "max", args };
    // v0.3.2: sum array aggregation
    case "sum":
      return { kind: "sumArray", array: args[0] };
    case "floor":
      return { kind: "floor", arg: args[0] };
    case "ceil":
      return { kind: "ceil", arg: args[0] };
    case "round":
      return { kind: "round", arg: args[0] };
    case "sqrt":
      return { kind: "sqrt", arg: args[0] };
    case "pow":
      return { kind: "pow", base: args[0], exponent: args[1] };

    // ============ Comparison ============
    case "eq":
      return { kind: "eq", left: args[0], right: args[1] };
    case "neq":
      return { kind: "neq", left: args[0], right: args[1] };
    case "gt":
      return { kind: "gt", left: args[0], right: args[1] };
    case "gte":
      return { kind: "gte", left: args[0], right: args[1] };
    case "lt":
      return { kind: "lt", left: args[0], right: args[1] };
    case "lte":
      return { kind: "lte", left: args[0], right: args[1] };

    // ============ Logical ============
    case "and":
      return { kind: "and", args };
    case "or":
      return { kind: "or", args };
    case "not":
      return { kind: "not", arg: args[0] };

    // ============ Type Checking ============
    case "isNull":
      return { kind: "isNull", arg: args[0] };
    case "isNotNull":
      // isNotNull(x) -> not(isNull(x))
      return { kind: "not", arg: { kind: "isNull", arg: args[0] } };
    case "typeof":
      return { kind: "typeof", arg: args[0] };
    case "coalesce":
      return { kind: "coalesce", args };

    // ============ String ============
    case "concat":
      return { kind: "concat", args };
    case "trim":
      return { kind: "trim", str: args[0] };
    case "lower":
    case "toLowerCase":
      return { kind: "toLowerCase", str: args[0] };
    case "upper":
    case "toUpperCase":
      return { kind: "toUpperCase", str: args[0] };
    case "strlen":
    case "strLen":
      return { kind: "strLen", str: args[0] };
    case "substr":
    case "substring":
      return args[2]
        ? { kind: "substring", str: args[0], start: args[1], end: args[2] }
        : { kind: "substring", str: args[0], start: args[1] };
    case "toString":
      return { kind: "toString", arg: args[0] };

    // ============ Collection ============
    case "len":
    case "length":
      return { kind: "len", arg: args[0] };
    case "at":
      return { kind: "at", array: args[0], index: args[1] };
    case "first":
      return { kind: "first", array: args[0] };
    case "last":
      return { kind: "last", array: args[0] };
    case "slice":
      return args[2]
        ? { kind: "slice", array: args[0], start: args[1], end: args[2] }
        : { kind: "slice", array: args[0], start: args[1] };
    case "includes":
      return { kind: "includes", array: args[0], item: args[1] };
    case "filter":
      return { kind: "filter", array: args[0], predicate: args[1] };
    case "map":
      return { kind: "map", array: args[0], mapper: args[1] };
    case "find":
      return { kind: "find", array: args[0], predicate: args[1] };
    case "every":
      return { kind: "every", array: args[0], predicate: args[1] };
    case "some":
      return { kind: "some", array: args[0], predicate: args[1] };
    case "append":
      return { kind: "append", array: args[0], items: args.slice(1) };

    // ============ Object ============
    case "keys":
      return { kind: "keys", obj: args[0] };
    case "values":
      return { kind: "values", obj: args[0] };
    case "entries":
      return { kind: "entries", obj: args[0] };
    case "merge":
      return { kind: "merge", objects: args };

    // ============ Conditional ============
    case "if":
    case "cond":
      return { kind: "if", cond: args[0], then: args[1], else: args[2] };

    // ============ Unknown Function ============
    default:
      // For unknown functions, create a generic call representation
      // This will be caught during semantic analysis
      return {
        kind: "object",
        fields: {
          __call: { kind: "lit", value: name },
          __args: { kind: "lit", value: args },
        },
      };
  }
}
