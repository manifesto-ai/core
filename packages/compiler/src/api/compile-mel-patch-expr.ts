import type { BinaryOperator, ExprNode } from "../parser/ast.js";
import type { MelExprNode } from "../lowering/lower-expr.js";

export function isSyntheticPatchCondition(
  condition: ExprNode
): condition is (ExprNode & { kind: "literal"; literalType: "boolean"; value: true }) {
  return (
    condition.kind === "literal" &&
    condition.literalType === "boolean" &&
    condition.value === true
  );
}

export function toMelExpr(input: ExprNode): MelExprNode {
  switch (input.kind) {
    case "literal":
      return { kind: "lit", value: toMelPrimitive(input.value, input.literalType) };

    case "identifier":
      return {
        kind: "get",
        path: [{ kind: "prop", name: input.name }],
      };

    case "systemIdent":
      return { kind: "sys", path: input.path };

    case "iterationVar":
      return { kind: "var", name: input.name };

    case "propertyAccess": {
      const path = collectStaticMelExpr(input);
      if (path) {
        return path;
      }
      return {
        kind: "call",
        fn: "field",
        args: [toMelExpr(input.object), { kind: "lit", value: input.property }],
      };
    }

    case "indexAccess": {
      return {
        kind: "call",
        fn: "at",
        args: [toMelExpr(input.object), toMelExpr(input.index)],
      };
    }

    case "functionCall":
      return {
        kind: "call",
        fn: input.name,
        args: input.args.map(toMelExpr),
      };

    case "unary":
      if (input.operator === "!") {
        return {
          kind: "call",
          fn: "not",
          args: [toMelExpr(input.operand)],
        };
      }
      return {
        kind: "call",
        fn: "sub",
        args: [{ kind: "lit", value: 0 }, toMelExpr(input.operand)],
      };

    case "binary":
      return {
        kind: "call",
        fn: toMelBinaryOp(input.operator),
        args: [toMelExpr(input.left), toMelExpr(input.right)],
      };

    case "ternary":
      return {
        kind: "call",
        fn: "if",
        args: [
          toMelExpr(input.condition),
          toMelExpr(input.consequent),
          toMelExpr(input.alternate),
        ],
      };

    case "objectLiteral":
      return {
        kind: "obj",
        fields: input.properties.map((property) => ({
          key: property.key,
          value: toMelExpr(property.value),
        })),
      };

    case "arrayLiteral":
      return {
        kind: "arr",
        elements: input.elements.map(toMelExpr),
      };

    default:
      throw new Error(`Unsupported expression kind '${(input as ExprNode).kind}'`);
  }
}

function toMelPrimitive(
  value: unknown,
  literalType: "number" | "string" | "boolean" | "null"
): null | boolean | number | string {
  if (literalType === "null") {
    return null;
  }

  if (literalType === "number") {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "bigint") {
      return Number(value);
    }
    if (typeof value === "string" && value.length > 0) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    throw new Error("Invalid number literal");
  }

  if (literalType === "string") {
    if (typeof value === "string") {
      return value;
    }
    throw new Error("Invalid string literal");
  }

  if (literalType === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }
    throw new Error("Invalid boolean literal");
  }

  throw new Error("Unsupported literal type");
}

function collectStaticMelExpr(expr: ExprNode): MelExprNode | null {
  if (expr.kind === "identifier") {
    return { kind: "get", path: [{ kind: "prop", name: expr.name }] };
  }

  if (expr.kind === "iterationVar") {
    if (expr.name !== "item") {
      return null;
    }
    return { kind: "var", name: "item" };
  }

  if (expr.kind === "propertyAccess") {
    const basePath = collectStaticMelExpr(expr.object);
    if (!basePath) {
      return null;
    }
    return {
      kind: "call",
      fn: "field",
      args: [basePath, { kind: "lit", value: expr.property }],
    };
  }

  return null;
}

function toMelBinaryOp(op: BinaryOperator): string {
  switch (op) {
    case "+":
      return "add";
    case "-":
      return "sub";
    case "*":
      return "mul";
    case "/":
      return "div";
    case "%":
      return "mod";
    case "==":
      return "eq";
    case "!=":
      return "neq";
    case "<":
      return "lt";
    case "<=":
      return "lte";
    case ">":
      return "gt";
    case ">=":
      return "gte";
    case "&&":
      return "and";
    case "||":
      return "or";
    case "??":
      return "coalesce";
    default:
      throw new Error(`Unsupported binary operator '${op}'`);
  }
}
