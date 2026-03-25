import type {
  CanonicalDomainSchema,
  CompilerActionSpec,
  CompilerExprNode,
  CompilerFlowNode,
  CoreExprNode,
  CoreFlowNode,
  DomainSchema,
  EntityCallExprNode,
} from "./ir.js";

export function lowerEntityPrimitivesInSchema(schema: CanonicalDomainSchema): DomainSchema {
  return {
    ...schema,
    computed: {
      fields: Object.fromEntries(
        Object.entries(schema.computed.fields).map(([name, field]) => [
          name,
          {
            ...field,
            expr: lowerCompilerExpr(field.expr),
          },
        ])
      ),
    },
    actions: Object.fromEntries(
      Object.entries(schema.actions).map(([name, action]) => [
        name,
        lowerAction(action),
      ])
    ),
  };
}

function lowerAction(action: CompilerActionSpec): DomainSchema["actions"][string] {
  return {
    ...action,
    flow: lowerCompilerFlow(action.flow),
    available: action.available ? lowerCompilerExpr(action.available) : undefined,
  };
}

function lowerCompilerFlow(flow: CompilerFlowNode): CoreFlowNode {
  switch (flow.kind) {
    case "seq":
      return {
        kind: "seq",
        steps: flow.steps.map((step) => lowerCompilerFlow(step)),
      };

    case "if":
      return {
        kind: "if",
        cond: lowerCompilerExpr(flow.cond),
        then: lowerCompilerFlow(flow.then),
        else: flow.else ? lowerCompilerFlow(flow.else) : undefined,
      };

    case "patch":
      return {
        kind: "patch",
        op: flow.op,
        path: flow.path,
        value: flow.value ? lowerCompilerExpr(flow.value) : undefined,
      };

    case "effect":
      return {
        kind: "effect",
        type: flow.type,
        params: Object.fromEntries(
          Object.entries(flow.params).map(([name, value]) => [name, lowerCompilerExpr(value)])
        ),
      };

    case "fail":
      return {
        kind: "fail",
        code: flow.code,
        message: flow.message ? lowerCompilerExpr(flow.message) : undefined,
      };

    case "call":
      return flow;

    case "halt":
      return flow;
  }
}

function lowerCompilerExpr(expr: CompilerExprNode): CoreExprNode {
  if (expr.kind === "call") {
    return lowerEntityCall(expr);
  }

  if (expr.kind === "object") {
    return {
      kind: "object",
      fields: Object.fromEntries(
        Object.entries(expr.fields).map(([key, value]) => [key, lowerCompilerExpr(value as CompilerExprNode)])
      ),
    };
  }

  const result: Record<string, unknown> = { kind: expr.kind };

  for (const [key, value] of Object.entries(expr)) {
    if (key === "kind") {
      continue;
    }
    result[key] = lowerExprValue(value);
  }

  return result as CoreExprNode;
}

function lowerExprValue(value: unknown): unknown {
  if (isCompilerExprNode(value)) {
    return lowerCompilerExpr(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => (isCompilerExprNode(item) ? lowerCompilerExpr(item) : item));
  }

  return value;
}

function lowerEntityCall(expr: EntityCallExprNode): CoreExprNode {
  const [collectionArg, idArg, updateArg] = expr.args;
  const collection = lowerCompilerExpr(collectionArg);
  const id = idArg ? lowerCompilerExpr(idArg) : { kind: "lit", value: null };
  const item = currentItem();
  const itemId = currentItemId();

  switch (expr.fn) {
    case "findById":
      return {
        kind: "find",
        array: collection,
        predicate: {
          kind: "eq",
          left: itemId,
          right: id,
        },
      };

    case "existsById":
      return {
        kind: "not",
        arg: {
          kind: "isNull",
          arg: lowerEntityCall({
            kind: "call",
            fn: "findById",
            args: expr.args,
          }),
        },
      };

    case "updateById": {
      const updates = updateArg ? lowerCompilerExpr(updateArg) : { kind: "object", fields: {} };
      return {
        kind: "map",
        array: collection,
        mapper: {
          kind: "if",
          cond: {
            kind: "eq",
            left: itemId,
            right: id,
          },
          then: {
            kind: "merge",
            objects: [item, updates],
          },
          else: item,
        },
      };
    }

    case "removeById":
      return {
        kind: "filter",
        array: collection,
        predicate: {
          kind: "not",
          arg: {
            kind: "eq",
            left: itemId,
            right: id,
          },
        },
      };
  }
}

function currentItem(): CoreExprNode {
  return { kind: "get", path: "$item" };
}

function currentItemId(): CoreExprNode {
  return {
    kind: "field",
    object: currentItem(),
    property: "id",
  };
}

function isCompilerExprNode(value: unknown): value is CompilerExprNode {
  return typeof value === "object" && value !== null && "kind" in value;
}
