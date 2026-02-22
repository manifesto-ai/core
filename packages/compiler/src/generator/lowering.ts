/**
 * System Value Lowering
 * Transforms $system.* references into effect-based acquisition
 * Based on MEL SPEC v0.3.1 Section 5.4
 */

import { hashSchemaSync, type DomainSchema as CoreDomainSchema } from "@manifesto-ai/core";
import { parsePath } from "@manifesto-ai/core";
import type { DomainSchema, ActionSpec, CoreFlowNode, CoreExprNode, FieldSpec } from "./ir.js";

// ============ Types ============

/**
 * System value slot information
 */
interface SystemSlot {
  key: string; // e.g., "uuid"
  valuePath: string; // e.g., "__sys__addTask_uuid_value"
  intentPath: string; // e.g., "__sys__addTask_uuid_intent"
}

/**
 * Lowering context for an action
 */
interface LoweringContext {
  actionName: string;
  slots: Map<string, SystemSlot>; // key -> slot
}

// ============ Main Lowering Function ============

/**
 * Apply system value lowering to a domain schema
 */
export function lowerSystemValues(schema: DomainSchema): DomainSchema {
  // Clone schema
  const result = structuredClone(schema);
  let lowered = false;

  // Process each action
  for (const [actionName, action] of Object.entries(result.actions)) {
    const ctx = createContext(actionName);

    // Collect all $system.* references
    collectSystemRefs(action.flow, ctx);

    if (ctx.slots.size === 0) {
      continue; // No system values to lower
    }
    lowered = true;

    // Add state slots
    for (const slot of ctx.slots.values()) {
      result.state.fields[slotName(slot.valuePath)] = {
        type: systemValueType(slot.key),
        required: true,
        default: null,
      };
      result.state.fields[slotName(slot.intentPath)] = {
        type: "string",
        required: true,
        default: null,
      };
    }

    // Transform the flow
    result.actions[actionName] = {
      ...action,
      flow: lowerFlow(action.flow, ctx),
    };
  }

  if (!lowered) {
    return result;
  }

  const { hash: _hash, ...schemaWithoutHash } = result;
  const nextHash = hashSchemaSync(schemaWithoutHash as Omit<CoreDomainSchema, "hash">);
  return {
    ...schemaWithoutHash,
    hash: nextHash,
  };
}

function slotName(path: string): string {
  // Extract field name from path like "__sys__addTask_uuid_value"
  const parts = parsePath(path);
  return parts[parts.length - 1] ?? "";
}

function createContext(actionName: string): LoweringContext {
  return {
    actionName,
    slots: new Map(),
  };
}

function systemValueType(key: string): FieldSpec["type"] {
  switch (key) {
    case "timestamp":
    case "time.now":
      return "number";
    default:
      return "string";
  }
}

// ============ Collection Phase ============

/**
 * Collect all $system.* references in a flow
 */
function collectSystemRefs(flow: CoreFlowNode, ctx: LoweringContext): void {
  switch (flow.kind) {
    case "seq":
      for (const step of flow.steps) {
        collectSystemRefs(step, ctx);
      }
      break;

    case "if":
      collectSystemRefsFromExpr(flow.cond, ctx);
      collectSystemRefs(flow.then, ctx);
      if (flow.else) {
        collectSystemRefs(flow.else, ctx);
      }
      break;

    case "patch":
      if (flow.value) {
        collectSystemRefsFromExpr(flow.value, ctx);
      }
      break;

    case "effect":
      for (const param of Object.values(flow.params)) {
        collectSystemRefsFromExpr(param, ctx);
      }
      break;

    case "fail":
      if (flow.message) {
        collectSystemRefsFromExpr(flow.message, ctx);
      }
      break;
  }
}

/**
 * Collect $system.* references from an expression
 */
function collectSystemRefsFromExpr(expr: CoreExprNode, ctx: LoweringContext): void {
  if (expr.kind === "get" && expr.path.startsWith("$system.")) {
    const key = expr.path.slice("$system.".length);
    if (!ctx.slots.has(key)) {
      ctx.slots.set(key, {
        key,
        valuePath: `__sys__${ctx.actionName}_${key}_value`,
        intentPath: `__sys__${ctx.actionName}_${key}_intent`,
      });
    }
    return;
  }

  // Recursively process nested expressions
  for (const value of Object.values(expr)) {
    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "object" && item !== null && "kind" in item) {
            collectSystemRefsFromExpr(item as CoreExprNode, ctx);
          }
        }
      } else if ("kind" in value) {
        collectSystemRefsFromExpr(value as CoreExprNode, ctx);
      }
    }
  }
}

// ============ Transformation Phase ============

/**
 * Lower a flow with system value acquisition
 */
function lowerFlow(flow: CoreFlowNode, ctx: LoweringContext): CoreFlowNode {
  if (ctx.slots.size === 0) {
    return flow;
  }

  // Generate acquisition effects
  const acquisitionSteps: CoreFlowNode[] = [];

  for (const slot of ctx.slots.values()) {
    // once(__sys__action_key_intent) {
    //   patch __sys__action_key_intent = $meta.intentId
    //   effect system.get({ key: "uuid", into: __sys__action_key_value })
    // }
    const acquisitionFlow: CoreFlowNode = {
      kind: "if",
      cond: {
        kind: "neq",
        left: { kind: "get", path: slot.intentPath },
        right: { kind: "get", path: "meta.intentId" },
      },
      then: {
        kind: "seq",
        steps: [
          {
            kind: "patch",
            op: "set",
            path: slot.intentPath,
            value: { kind: "get", path: "meta.intentId" },
          },
          {
            kind: "effect",
            type: "system.get",
            params: {
              key: { kind: "lit", value: slot.key },
              into: { kind: "lit", value: slot.valuePath },
            },
          },
        ],
      },
    };
    acquisitionSteps.push(acquisitionFlow);
  }

  // Generate readiness condition
  // eq(__sys__action_key_intent, $meta.intentId) for all slots
  const readinessConditions: CoreExprNode[] = [];
  for (const slot of ctx.slots.values()) {
    readinessConditions.push({
      kind: "eq",
      left: { kind: "get", path: slot.intentPath },
      right: { kind: "get", path: "meta.intentId" },
    });
  }

  const readinessCond: CoreExprNode = readinessConditions.length === 1
    ? readinessConditions[0]
    : { kind: "and", args: readinessConditions };

  // Transform the original flow
  const transformedFlow = transformFlow(flow, ctx);

  // Wrap with readiness guard
  const guardedFlow: CoreFlowNode = {
    kind: "if",
    cond: readinessCond,
    then: transformedFlow,
  };

  // Combine: acquisitions + guarded flow
  return {
    kind: "seq",
    steps: [...acquisitionSteps, guardedFlow],
  };
}

/**
 * Transform a flow, replacing $system.* references with slot accesses
 */
function transformFlow(flow: CoreFlowNode, ctx: LoweringContext): CoreFlowNode {
  switch (flow.kind) {
    case "seq":
      return {
        kind: "seq",
        steps: flow.steps.map(s => transformFlow(s, ctx)),
      };

    case "if":
      return {
        kind: "if",
        cond: transformExpr(flow.cond, ctx),
        then: transformFlow(flow.then, ctx),
        else: flow.else ? transformFlow(flow.else, ctx) : undefined,
      };

    case "patch":
      return {
        kind: "patch",
        op: flow.op,
        path: flow.path,
        value: flow.value ? transformExpr(flow.value, ctx) : undefined,
      };

    case "effect":
      const params: Record<string, CoreExprNode> = {};
      for (const [key, value] of Object.entries(flow.params)) {
        params[key] = transformExpr(value, ctx);
      }
      return {
        kind: "effect",
        type: flow.type,
        params,
      };

    case "fail":
      return {
        kind: "fail",
        code: flow.code,
        message: flow.message ? transformExpr(flow.message, ctx) : undefined,
      };

    default:
      return flow;
  }
}

/**
 * Transform an expression, replacing $system.* with slot accesses
 */
function transformExpr(expr: CoreExprNode, ctx: LoweringContext): CoreExprNode {
  // Replace $system.* with slot value path
  if (expr.kind === "get" && expr.path.startsWith("$system.")) {
    const key = expr.path.slice("$system.".length);
    const slot = ctx.slots.get(key);
    if (slot) {
      return { kind: "get", path: slot.valuePath };
    }
  }

  // Recursively transform nested expressions
  switch (expr.kind) {
    case "eq":
    case "neq":
    case "gt":
    case "gte":
    case "lt":
    case "lte":
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "mod":
      return {
        kind: expr.kind,
        left: transformExpr((expr as any).left, ctx),
        right: transformExpr((expr as any).right, ctx),
      } as CoreExprNode;

    case "and":
    case "or":
    case "coalesce":
    case "concat":
    case "min":
    case "max":
    case "merge":
      return {
        kind: expr.kind,
        args: (expr as any).args.map((a: CoreExprNode) => transformExpr(a, ctx)),
      } as CoreExprNode;

    case "not":
    case "neg":
    case "abs":
    case "floor":
    case "ceil":
    case "round":
    case "isNull":
    case "typeof":
    case "toString":
    case "len":
    case "keys":
    case "values":
    case "entries":
    case "first":
    case "last":
      return {
        kind: expr.kind,
        arg: transformExpr((expr as any).arg, ctx),
      } as CoreExprNode;

    case "trim":
    case "toLowerCase":
    case "toUpperCase":
    case "strLen":
      return {
        kind: expr.kind,
        str: transformExpr((expr as any).str, ctx),
      } as CoreExprNode;

    case "at":
    case "includes":
      return {
        kind: expr.kind,
        array: transformExpr((expr as any).array, ctx),
        index: transformExpr((expr as any).index ?? (expr as any).item, ctx),
      } as CoreExprNode;

    case "filter":
    case "map":
    case "find":
    case "every":
    case "some":
      return {
        kind: expr.kind,
        array: transformExpr((expr as any).array, ctx),
        predicate: transformExpr((expr as any).predicate ?? (expr as any).mapper, ctx),
      } as CoreExprNode;

    case "if":
      return {
        kind: "if",
        cond: transformExpr((expr as any).cond, ctx),
        then: transformExpr((expr as any).then, ctx),
        else: transformExpr((expr as any).else, ctx),
      };

    case "field":
      return {
        kind: "field",
        object: transformExpr((expr as any).object, ctx),
        property: (expr as any).property,
      };

    case "object":
      const fields: Record<string, CoreExprNode> = {};
      for (const [key, value] of Object.entries((expr as any).fields)) {
        fields[key] = transformExpr(value as CoreExprNode, ctx);
      }
      return { kind: "object", fields };

    case "append":
      return {
        kind: "append",
        array: transformExpr((expr as any).array, ctx),
        items: (expr as any).items.map((i: CoreExprNode) => transformExpr(i, ctx)),
      };

    default:
      return expr;
  }
}
