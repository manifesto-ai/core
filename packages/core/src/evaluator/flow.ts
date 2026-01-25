import type { FlowNode } from "../schema/flow.js";
import type { Snapshot, Requirement, ErrorValue } from "../schema/snapshot.js";
import type { Patch } from "../schema/patch.js";
import type { TraceNode } from "../schema/trace.js";
import type { FieldSpec } from "../schema/field.js";
import { createTraceNode } from "../schema/trace.js";
import { createError } from "../errors.js";
import { setByPath, unsetByPath, mergeAtPath } from "../utils/path.js";
import { generateRequirementIdSync } from "../utils/hash.js";
import { type EvalContext, withSnapshot, withNodePath, withCollectionContext } from "./context.js";
import { evaluateExpr } from "./expr.js";
import { getFieldSpecAtPath, validateValueAgainstFieldSpec } from "../core/validation-utils.js";

/**
 * Flow execution status
 */
export type FlowStatus = "running" | "complete" | "pending" | "halted" | "error";

/**
 * Flow execution state
 */
export type FlowState = {
  readonly snapshot: Snapshot;
  readonly status: FlowStatus;
  readonly patches: readonly Patch[];
  readonly requirements: readonly Requirement[];
  readonly error: ErrorValue | null;
};

/**
 * Flow evaluation result
 */
export type FlowResult = {
  readonly state: FlowState;
  readonly trace: TraceNode;
};

const SYSTEM_FIELD_SPEC: FieldSpec = {
  type: "object",
  required: true,
  fields: {
    status: { type: { enum: ["idle", "computing", "pending", "error"] }, required: true },
    lastError: { type: "object", required: true },
    errors: { type: "array", required: true, items: { type: "object", required: true } },
    pendingRequirements: { type: "array", required: true, items: { type: "object", required: true } },
    currentAction: { type: "string", required: true },
  },
};

/**
 * Create initial flow state
 */
export function createFlowState(snapshot: Snapshot): FlowState {
  return {
    snapshot,
    status: "running",
    patches: [],
    requirements: [],
    error: null,
  };
}

/**
 * Apply a patch to flow state
 */
function applyPatchToState(state: FlowState, patch: Patch): FlowState {
  if (patch.path === "system" || patch.path.startsWith("system.")) {
    const subPath = patch.path === "system" ? "" : patch.path.slice(7);
    let newSystem = state.snapshot.system;

    switch (patch.op) {
      case "set":
        newSystem = setByPath(newSystem, subPath, patch.value) as typeof newSystem;
        break;
      case "unset":
        newSystem = unsetByPath(newSystem, subPath) as typeof newSystem;
        break;
      case "merge":
        newSystem = mergeAtPath(newSystem, subPath, patch.value) as typeof newSystem;
        break;
    }

    return {
      ...state,
      snapshot: {
        ...state.snapshot,
        system: newSystem,
      },
      patches: [...state.patches, patch],
    };
  }

  let newData = state.snapshot.data;

  switch (patch.op) {
    case "set":
      newData = setByPath(newData, patch.path, patch.value);
      break;
    case "unset":
      newData = unsetByPath(newData, patch.path);
      break;
    case "merge":
      newData = mergeAtPath(newData, patch.path, patch.value);
      break;
  }

  return {
    ...state,
    snapshot: {
      ...state.snapshot,
      data: newData,
    },
    patches: [...state.patches, patch],
  };
}

/**
 * Add a requirement to flow state
 */
function addRequirement(state: FlowState, requirement: Requirement): FlowState {
  return {
    ...state,
    status: "pending",
    requirements: [...state.requirements, requirement],
  };
}

/**
 * Set error on flow state
 */
function setError(state: FlowState, error: ErrorValue): FlowState {
  return {
    ...state,
    status: "error",
    error,
  };
}

/**
 * Evaluate a flow node
 */
export function evaluateFlowSync(
  flow: FlowNode,
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): FlowResult {
  // Stop if already terminated
  if (state.status !== "running") {
    return {
      state,
      trace: createTraceNode(ctx.trace, "flow", nodePath, {}, null, []),
    };
  }

  switch (flow.kind) {
    case "seq":
      return evaluateSeq(flow.steps, ctx, state, nodePath);

    case "if":
      return evaluateIf(flow, ctx, state, nodePath);

    case "patch":
      return evaluatePatch(flow, ctx, state, nodePath);

    case "effect":
      return evaluateEffect(flow, ctx, state, nodePath);

    case "call":
      return evaluateCall(flow.flow, ctx, state, nodePath);

    case "halt":
      return evaluateHalt(flow.reason, ctx, state, nodePath);

    case "fail":
      return evaluateFail(flow, ctx, state, nodePath);

    default:
      return {
        state: setError(state, createError(
          "INTERNAL_ERROR",
          `Unknown flow kind: ${(flow as FlowNode).kind}`,
          ctx.currentAction ?? "",
          nodePath,
          ctx.trace.timestamp
        )),
        trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
      };
  }
}

export async function evaluateFlow(
  flow: FlowNode,
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): Promise<FlowResult> {
  return evaluateFlowSync(flow, ctx, state, nodePath);
}

// ============ Flow Node Handlers ============

function evaluateSeq(
  steps: readonly FlowNode[],
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): FlowResult {
  let currentState = state;
  const children: TraceNode[] = [];

  for (let i = 0; i < steps.length; i++) {
    const stepPath = `${nodePath}.steps[${i}]`;
    const stepCtx = withNodePath(withSnapshot(ctx, currentState.snapshot), stepPath);

    const result = evaluateFlowSync(steps[i], stepCtx, currentState, stepPath);
    children.push(result.trace);
    currentState = result.state;

    // Stop if status changed (effect, halt, error)
    if (currentState.status !== "running") {
      break;
    }
  }

  return {
    state: currentState,
    trace: createTraceNode(ctx.trace, "flow", nodePath, { kind: "seq" }, null, children),
  };
}

function evaluateIf(
  flow: { cond: import("../schema/expr.js").ExprNode; then: FlowNode; else?: FlowNode },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): FlowResult {
  const condResult = evaluateExpr(flow.cond, ctx);

  if (!condResult.ok) {
    return {
      state: setError(state, condResult.error),
      trace: createTraceNode(ctx.trace, "branch", nodePath, { cond: false }, null, []),
    };
  }

  const condValue = condResult.value;
  const isTruthy = condValue !== null && condValue !== undefined && condValue !== false;

  const branchPath = isTruthy ? `${nodePath}.then` : `${nodePath}.else`;
  const branchFlow = isTruthy ? flow.then : flow.else;

  if (!branchFlow) {
    return {
      state,
      trace: createTraceNode(ctx.trace, "branch", nodePath, { cond: isTruthy }, null, []),
    };
  }

  const branchCtx = withNodePath(ctx, branchPath);
  const result = evaluateFlowSync(branchFlow, branchCtx, state, branchPath);

  return {
    state: result.state,
    trace: createTraceNode(ctx.trace, "branch", nodePath, { cond: isTruthy }, null, [result.trace]),
  };
}

function evaluatePatch(
  flow: { op: "set" | "unset" | "merge"; path: string; value?: import("../schema/expr.js").ExprNode },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): FlowResult {
  let patchValue: unknown = undefined;

  if (flow.op !== "unset" && flow.value) {
    const valueResult = evaluateExpr(flow.value, ctx);
    if (!valueResult.ok) {
      return {
        state: setError(state, valueResult.error),
        trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
      };
    }
    patchValue = valueResult.value;
  }

  const rootSpec: FieldSpec = {
    type: "object",
    required: true,
    fields: {
      ...ctx.schema.state.fields,
      system: SYSTEM_FIELD_SPEC,
    },
  };
  const fieldSpec = getFieldSpecAtPath(rootSpec, flow.path);
  if (!fieldSpec) {
    return {
      state: setError(state, createError(
        "PATH_NOT_FOUND",
        `Unknown patch path: ${flow.path}`,
        ctx.currentAction ?? "",
        nodePath,
        ctx.trace.timestamp
      )),
      trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
    };
  }

  if (flow.op !== "unset") {
    const validation = validateValueAgainstFieldSpec(patchValue, fieldSpec, {
      allowPartial: flow.op === "merge",
      allowUndefined: false,
    });
    if (!validation.ok) {
      return {
        state: setError(state, createError(
          "TYPE_MISMATCH",
          `Invalid patch value at ${flow.path}: ${validation.message ?? "type mismatch"}`,
          ctx.currentAction ?? "",
          nodePath,
          ctx.trace.timestamp
        )),
        trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
      };
    }
  }

  const patch: Patch = flow.op === "unset"
    ? { op: "unset", path: flow.path }
    : flow.op === "merge"
      ? { op: "merge", path: flow.path, value: patchValue as Record<string, unknown> }
      : { op: "set", path: flow.path, value: patchValue };

  const newState = applyPatchToState(state, patch);

  return {
    state: newState,
    trace: createTraceNode(ctx.trace, "patch", nodePath, { op: flow.op, path: flow.path }, patchValue, []),
  };
}

function evaluateEffect(
  flow: { type: string; params: Record<string, import("../schema/expr.js").ExprNode> },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): FlowResult {
  // Handle pure array operations inline (no IO needed)
  if (flow.type === "array.map" || flow.type === "array.filter") {
    return evaluateArrayOperation(flow, ctx, state, nodePath);
  }

  // Evaluate params
  const params: Record<string, unknown> = {};
  for (const [key, expr] of Object.entries(flow.params)) {
    const result = evaluateExpr(expr, ctx);
    if (!result.ok) {
      return {
        state: setError(state, result.error),
        trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
      };
    }
    params[key] = result.value;
  }

  // Generate deterministic requirement ID
  const requirementId = generateRequirementIdSync(
    ctx.snapshot.meta.schemaHash,
    ctx.intentId ?? "",
    ctx.currentAction ?? "",
    nodePath
  );

  const requirement: Requirement = {
    id: requirementId,
    type: flow.type,
    params,
    actionId: ctx.currentAction ?? "",
    flowPosition: {
      nodePath,
      snapshotVersion: ctx.snapshot.meta.version,
    },
    createdAt: ctx.trace.timestamp,
  };

  const newState = addRequirement(state, requirement);

  return {
    state: newState,
    trace: createTraceNode(ctx.trace, "effect", nodePath, { type: flow.type }, params, []),
  };
}

/**
 * Evaluate pure array operations (map/filter) inline
 * These are pure transformations that don't need Host effect handlers
 */
function evaluateArrayOperation(
  flow: { type: string; params: Record<string, import("../schema/expr.js").ExprNode> },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): FlowResult {
  const { params } = flow;

  // Use the current state's snapshot (which reflects patches applied so far)
  const currentCtx = withSnapshot(ctx, state.snapshot);

  // Get source array
  const sourceExpr = params.source;
  if (!sourceExpr) {
    return {
      state: setError(state, createError(
        "INVALID_INPUT",
        `${flow.type} requires 'source' parameter`,
        ctx.currentAction ?? "",
        nodePath,
        ctx.trace.timestamp
      )),
      trace: createTraceNode(currentCtx.trace, "error", nodePath, {}, null, []),
    };
  }

  const sourceResult = evaluateExpr(sourceExpr, currentCtx);
  if (!sourceResult.ok) {
    return {
      state: setError(state, sourceResult.error),
      trace: createTraceNode(currentCtx.trace, "error", nodePath, {}, null, []),
    };
  }

  const sourceArray = sourceResult.value;
  if (!Array.isArray(sourceArray)) {
    return {
      state: setError(state, createError(
        "TYPE_MISMATCH",
        `${flow.type} source must be an array`,
        currentCtx.currentAction ?? "",
        nodePath,
        currentCtx.trace.timestamp
      )),
      trace: createTraceNode(currentCtx.trace, "error", nodePath, {}, null, []),
    };
  }

  // Get target path
  const intoExpr = params.into;
  if (!intoExpr) {
    return {
      state: setError(state, createError(
        "INVALID_INPUT",
        `${flow.type} requires 'into' parameter`,
        currentCtx.currentAction ?? "",
        nodePath,
        currentCtx.trace.timestamp
      )),
      trace: createTraceNode(currentCtx.trace, "error", nodePath, {}, null, []),
    };
  }

  const intoResult = evaluateExpr(intoExpr, currentCtx);
  if (!intoResult.ok) {
    return {
      state: setError(state, intoResult.error),
      trace: createTraceNode(currentCtx.trace, "error", nodePath, {}, null, []),
    };
  }

  const targetPath = String(intoResult.value);

  // Get the transformation expression
  const transformExpr = flow.type === "array.map" ? params.select : params.where;
  if (!transformExpr) {
    return {
      state: setError(state, createError(
        "INVALID_INPUT",
        `${flow.type} requires '${flow.type === "array.map" ? "select" : "where"}' parameter`,
        currentCtx.currentAction ?? "",
        nodePath,
        currentCtx.trace.timestamp
      )),
      trace: createTraceNode(currentCtx.trace, "error", nodePath, {}, null, []),
    };
  }

  // Process the array
  const resultArray: unknown[] = [];

  for (let index = 0; index < sourceArray.length; index++) {
    const item = sourceArray[index];

    // Create context with $item, $index, $array
    const itemCtx = withCollectionContext(currentCtx, item, index, sourceArray);

    const itemResult = evaluateExpr(transformExpr, itemCtx);
    if (!itemResult.ok) {
      return {
        state: setError(state, itemResult.error),
        trace: createTraceNode(currentCtx.trace, "error", nodePath, {}, null, []),
      };
    }

    if (flow.type === "array.map") {
      // For map, add the transformed value
      resultArray.push(itemResult.value);
    } else {
      // For filter, add original item if predicate is truthy
      const predicate = itemResult.value;
      if (predicate !== null && predicate !== undefined && predicate !== false) {
        resultArray.push(item);
      }
    }
  }

  // Create patch to set the result
  const patch: Patch = { op: "set", path: targetPath, value: resultArray };
  const newState = applyPatchToState(state, patch);

  return {
    state: newState,
    trace: createTraceNode(currentCtx.trace, "effect", nodePath, { type: flow.type, target: targetPath }, { count: resultArray.length }, []),
  };
}

function evaluateCall(
  flowName: string,
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): FlowResult {
  // Look up the flow in the schema
  const action = ctx.schema.actions[flowName];
  if (!action) {
    return {
      state: setError(state, createError(
        "UNKNOWN_FLOW",
        `Unknown flow: ${flowName}`,
        ctx.currentAction ?? "",
        nodePath,
        ctx.trace.timestamp
      )),
      trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
    };
  }

  const callPath = `${nodePath}.call(${flowName})`;
  const callCtx = withNodePath(ctx, callPath);

  const result = evaluateFlowSync(action.flow, callCtx, state, callPath);

  return {
    state: result.state,
    trace: createTraceNode(ctx.trace, "call", nodePath, { flow: flowName }, null, [result.trace]),
  };
}

function evaluateHalt(
  reason: string | undefined,
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): FlowResult {
  return {
    state: { ...state, status: "halted" },
    trace: createTraceNode(ctx.trace, "halt", nodePath, { reason }, null, []),
  };
}

function evaluateFail(
  flow: { code: string; message?: import("../schema/expr.js").ExprNode },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): FlowResult {
  let message = flow.code;

  if (flow.message) {
    const messageResult = evaluateExpr(flow.message, ctx);
    if (messageResult.ok) {
      message = String(messageResult.value);
    }
  }

  const error = createError(
    "VALIDATION_ERROR",
    message,
    ctx.currentAction ?? "",
    nodePath,
    ctx.trace.timestamp,
    { code: flow.code }
  );

  return {
    state: setError(state, error),
    trace: createTraceNode(ctx.trace, "error", nodePath, { code: flow.code }, message, []),
  };
}
