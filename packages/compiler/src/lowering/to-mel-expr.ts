import type { BinaryOperator, ExprNode, SystemIdentExprNode } from "../parser/ast.js";
import type { MelExprNode, MelPathNode } from "./lower-expr.js";

export interface ToMelExprOptions {
  resolveIdentifier?: (name: string) => MelExprNode;
  resolveSystemIdent?: (path: string[]) => MelExprNode;
}

export function toMelExpr(
  input: ExprNode,
  options: ToMelExprOptions = {}
): MelExprNode {
  switch (input.kind) {
    case "literal":
      return { kind: "lit", value: toMelPrimitive(input.value, input.literalType) };

    case "identifier":
      return options.resolveIdentifier?.(input.name) ?? getPathExpr(input.name);

    case "systemIdent":
      return resolveSystemIdent(input, options);

    case "iterationVar":
      return { kind: "var", name: input.name };

    case "propertyAccess":
      return toMelPropertyAccess(input.object, input.property, options);

    case "indexAccess":
      return {
        kind: "call",
        fn: "at",
        args: [toMelExpr(input.object, options), toMelExpr(input.index, options)],
      };

    case "functionCall":
      return {
        kind: "call",
        fn: input.name,
        args: input.args.map((arg) => toMelExpr(arg, options)),
      };

    case "unary":
      return {
        kind: "call",
        fn: input.operator === "!" ? "not" : "neg",
        args: [toMelExpr(input.operand, options)],
      };

    case "binary":
      return {
        kind: "call",
        fn: toMelBinaryOp(input.operator),
        args: [toMelExpr(input.left, options), toMelExpr(input.right, options)],
      };

    case "ternary":
      return {
        kind: "call",
        fn: "cond",
        args: [
          toMelExpr(input.condition, options),
          toMelExpr(input.consequent, options),
          toMelExpr(input.alternate, options),
        ],
      };

    case "objectLiteral":
      return lowerObjectLiteral(input, options);

    case "arrayLiteral":
      return {
        kind: "arr",
        elements: input.elements.map((element) => toMelExpr(element, options)),
      };
  }
}

function lowerObjectLiteral(
  input: Extract<ExprNode, { kind: "objectLiteral" }>,
  options: ToMelExprOptions
): MelExprNode {
  const hasSpread = input.properties.some((property) => property.kind === "objectSpread");
  if (!hasSpread) {
    return {
      kind: "obj",
      fields: input.properties.map((property) => {
        if (property.kind !== "objectProperty") {
          throw new Error("Unexpected non-property in non-spread object literal");
        }

        return {
          key: property.key,
          value: toMelExpr(property.value, options),
        };
      }),
    };
  }

  const contributors: MelExprNode[] = [];
  let bufferedFields: Array<{ key: string; value: MelExprNode }> = [];

  const flushBufferedFields = () => {
    if (bufferedFields.length === 0) {
      return;
    }

    contributors.push({
      kind: "obj",
      fields: bufferedFields,
    });
    bufferedFields = [];
  };

  for (const property of input.properties) {
    if (property.kind === "objectProperty") {
      bufferedFields.push({
        key: property.key,
        value: toMelExpr(property.value, options),
      });
      continue;
    }

    flushBufferedFields();
    contributors.push(toMelExpr(property.expr, options));
  }

  flushBufferedFields();

  return {
    kind: "call",
    fn: "merge",
    args: contributors,
  };
}

export function getPathExpr(...segments: string[]): MelExprNode {
  return {
    kind: "get",
    path: toMelPath(...segments),
  };
}

export function getBasePathExpr(base: MelExprNode, ...segments: string[]): MelExprNode {
  return {
    kind: "get",
    base,
    path: toMelPath(...segments),
  };
}

export function sysPathExpr(...segments: string[]): MelExprNode {
  return {
    kind: "sys",
    path: segments,
  };
}

export function objExpr(fields: Record<string, MelExprNode>): MelExprNode {
  return {
    kind: "obj",
    fields: Object.entries(fields).map(([key, value]) => ({ key, value })),
  };
}

export function toMelPath(...segments: string[]): MelPathNode {
  return segments.map((name) => ({ kind: "prop", name }));
}

function resolveSystemIdent(
  input: SystemIdentExprNode,
  options: ToMelExprOptions
): MelExprNode {
  return options.resolveSystemIdent?.(input.path) ?? sysPathExpr(...input.path);
}

function toMelPropertyAccess(
  object: ExprNode,
  property: string,
  options: ToMelExprOptions
): MelExprNode {
  const base = toMelExpr(object, options);

  if (base.kind === "get") {
    return {
      kind: "get",
      ...(base.base ? { base: base.base } : undefined),
      path: [...base.path, { kind: "prop", name: property }],
    };
  }

  if (base.kind === "var" && base.name === "item") {
    return getBasePathExpr(base, property);
  }

  return {
    kind: "field",
    object: base,
    property,
  };
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
  }
}
