import type { MelExprNode } from "../lowering/lower-expr.js";
import {
  DEFAULT_ACTION_CONTEXT,
  DEFAULT_DISPATCHABLE_CONTEXT,
  DEFAULT_SCHEMA_CONTEXT,
  EFFECT_ARGS_CONTEXT,
  lowerExprNode,
} from "../lowering/index.js";
import {
  getBasePathExpr,
  getPathExpr,
  objExpr,
} from "../lowering/to-mel-expr.js";
import type {
  CanonicalDomainSchema,
  CompilerActionSpec,
  CompilerComputedFieldSpec,
  CompilerFlowNode,
  CoreExprNode,
  CoreFlowNode,
  DomainSchema,
} from "./ir.js";

const ENTITY_PRIMITIVES = new Set(["findById", "existsById", "updateById", "removeById"]);

export function lowerCanonicalSchema(schema: CanonicalDomainSchema): DomainSchema {
  return {
    ...schema,
    computed: {
      fields: Object.fromEntries(
        Object.entries(schema.computed.fields).map(([name, field]) => [
          name,
          lowerComputedField(field),
        ])
      ),
    },
    actions: Object.fromEntries(
      Object.entries(schema.actions).map(([name, action]) => [name, lowerAction(action)])
    ),
  };
}

function lowerComputedField(field: CompilerComputedFieldSpec): DomainSchema["computed"]["fields"][string] {
  return {
    ...field,
    expr: lowerSchemaExpr(field.expr),
  };
}

function lowerAction(action: CompilerActionSpec): DomainSchema["actions"][string] {
  return {
    ...action,
    flow: lowerFlow(action.flow),
    available: action.available ? lowerSchemaExpr(action.available) : undefined,
    dispatchable: action.dispatchable ? lowerDispatchableExpr(action.dispatchable) : undefined,
  };
}

function lowerFlow(flow: CompilerFlowNode): CoreFlowNode {
  switch (flow.kind) {
    case "seq":
      return {
        kind: "seq",
        steps: flow.steps.map((step) => lowerFlow(step)),
      };

    case "if":
      return {
        kind: "if",
        cond: lowerActionExpr(flow.cond),
        then: lowerFlow(flow.then),
        else: flow.else ? lowerFlow(flow.else) : undefined,
      };

    case "patch":
      return {
        kind: "patch",
        op: flow.op,
        path: flow.path,
        value: flow.value ? lowerActionExpr(flow.value) : undefined,
      };

    case "effect":
      return {
        kind: "effect",
        type: flow.type,
        params: Object.fromEntries(
          Object.entries(flow.params).map(([name, value]) => [name, lowerEffectExpr(value)])
        ),
      };

    case "fail":
      return {
        kind: "fail",
        code: flow.code,
        message: flow.message ? lowerActionExpr(flow.message) : undefined,
      };

    case "call":
    case "halt":
      return flow;
  }
}

function lowerSchemaExpr(expr: MelExprNode): CoreExprNode {
  return lowerExprNode(rewriteForRuntime(expr), DEFAULT_SCHEMA_CONTEXT);
}

function lowerActionExpr(expr: MelExprNode): CoreExprNode {
  return lowerExprNode(rewriteForRuntime(expr), DEFAULT_ACTION_CONTEXT);
}

function lowerDispatchableExpr(expr: MelExprNode): CoreExprNode {
  return lowerExprNode(rewriteForRuntime(expr), DEFAULT_DISPATCHABLE_CONTEXT);
}

function lowerEffectExpr(expr: MelExprNode): CoreExprNode {
  return lowerExprNode(rewriteForRuntime(expr), EFFECT_ARGS_CONTEXT);
}

function rewriteForRuntime(expr: MelExprNode): MelExprNode {
  switch (expr.kind) {
    case "lit":
    case "var":
      return expr;

    case "sys":
      if (expr.path[0] === "system") {
        return getPathExpr("$system", ...expr.path.slice(1));
      }
      return expr;

    case "get":
      return {
        kind: "get",
        ...(expr.base ? { base: rewriteForRuntime(expr.base) } : undefined),
        path: expr.path,
      };

    case "field":
      return {
        kind: "field",
        object: rewriteForRuntime(expr.object),
        property: expr.property,
      };

    case "obj":
      return {
        kind: "obj",
        fields: expr.fields.map((field) => ({
          key: field.key,
          value: rewriteForRuntime(field.value),
        })),
      };

    case "arr":
      return {
        kind: "arr",
        elements: expr.elements.map((element) => rewriteForRuntime(element)),
      };

    case "call":
      if (ENTITY_PRIMITIVES.has(expr.fn)) {
        return rewriteForRuntime(rewriteEntityPrimitive(expr.fn, expr.args));
      }
      return {
        kind: "call",
        fn: expr.fn,
        args: expr.args.map((arg) => rewriteForRuntime(arg)),
      };
  }
}

function rewriteEntityPrimitive(fn: string, args: MelExprNode[]): MelExprNode {
  const [collection, idArg, updatesArg] = args;
  const collectionExpr = rewriteForRuntime(collection);
  const idExpr = idArg ? rewriteForRuntime(idArg) : { kind: "lit", value: null } satisfies MelExprNode;
  const itemVar = { kind: "var", name: "item" } satisfies MelExprNode;
  const itemId = getBasePathExpr(itemVar, "id");

  switch (fn) {
    case "findById":
      return {
        kind: "call",
        fn: "find",
        args: [
          collectionExpr,
          {
            kind: "call",
            fn: "eq",
            args: [itemId, idExpr],
          },
        ],
      };

    case "existsById":
      return {
        kind: "call",
        fn: "not",
        args: [
          {
            kind: "call",
            fn: "isNull",
            args: [rewriteEntityPrimitive("findById", args)],
          },
        ],
      };

    case "updateById": {
      const updatesExpr = updatesArg ? rewriteForRuntime(updatesArg) : objExpr({});
      return {
        kind: "call",
        fn: "map",
        args: [
          collectionExpr,
          {
            kind: "call",
            fn: "cond",
            args: [
              {
                kind: "call",
                fn: "eq",
                args: [itemId, idExpr],
              },
              {
                kind: "call",
                fn: "merge",
                args: [itemVar, updatesExpr],
              },
              itemVar,
            ],
          },
        ],
      };
    }

    case "removeById":
      return {
        kind: "call",
        fn: "filter",
        args: [
          collectionExpr,
          {
            kind: "call",
            fn: "not",
            args: [
              {
                kind: "call",
                fn: "eq",
                args: [itemId, idExpr],
              },
            ],
          },
        ],
      };

    default:
      return {
        kind: "call",
        fn,
        args: args.map((arg) => rewriteForRuntime(arg)),
      };
  }
}
