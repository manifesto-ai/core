import type { FlowNode } from "../schema/flow.js";
import type { Snapshot, Requirement, ErrorValue } from "../schema/snapshot.js";
import type { Patch } from "../schema/patch.js";
import type { TraceNode } from "../schema/trace.js";
import { createTraceNode } from "../schema/trace.js";
import { createError } from "../errors.js";
import { setByPath, unsetByPath, mergeAtPath } from "../utils/path.js";
import { generateRequirementId } from "../utils/hash.js";
import { type EvalContext, withSnapshot, withNodePath } from "./context.js";
import { evaluateExpr } from "./expr.js";

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
export async function evaluateFlow(
  flow: FlowNode,
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): Promise<FlowResult> {
  // Stop if already terminated
  if (state.status !== "running") {
    return {
      state,
      trace: createTraceNode("flow", nodePath, {}, null, []),
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
      return evaluateHalt(flow.reason, state, nodePath);

    case "fail":
      return evaluateFail(flow, ctx, state, nodePath);

    default:
      return {
        state: setError(state, createError(
          "INTERNAL_ERROR",
          `Unknown flow kind: ${(flow as FlowNode).kind}`,
          ctx.currentAction ?? "",
          nodePath
        )),
        trace: createTraceNode("error", nodePath, {}, null, []),
      };
  }
}

// ============ Flow Node Handlers ============

async function evaluateSeq(
  steps: readonly FlowNode[],
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): Promise<FlowResult> {
  let currentState = state;
  const children: TraceNode[] = [];

  for (let i = 0; i < steps.length; i++) {
    const stepPath = `${nodePath}.steps[${i}]`;
    const stepCtx = withNodePath(withSnapshot(ctx, currentState.snapshot), stepPath);

    const result = await evaluateFlow(steps[i], stepCtx, currentState, stepPath);
    children.push(result.trace);
    currentState = result.state;

    // Stop if status changed (effect, halt, error)
    if (currentState.status !== "running") {
      break;
    }
  }

  return {
    state: currentState,
    trace: createTraceNode("flow", nodePath, { kind: "seq" }, null, children),
  };
}

async function evaluateIf(
  flow: { cond: import("../schema/expr.js").ExprNode; then: FlowNode; else?: FlowNode },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): Promise<FlowResult> {
  const condResult = evaluateExpr(flow.cond, ctx);

  if (!condResult.ok) {
    return {
      state: setError(state, condResult.error),
      trace: createTraceNode("branch", nodePath, { cond: false }, null, []),
    };
  }

  const condValue = condResult.value;
  const isTruthy = condValue !== null && condValue !== undefined && condValue !== false;

  const branchPath = isTruthy ? `${nodePath}.then` : `${nodePath}.else`;
  const branchFlow = isTruthy ? flow.then : flow.else;

  if (!branchFlow) {
    return {
      state,
      trace: createTraceNode("branch", nodePath, { cond: isTruthy }, null, []),
    };
  }

  const branchCtx = withNodePath(ctx, branchPath);
  const result = await evaluateFlow(branchFlow, branchCtx, state, branchPath);

  return {
    state: result.state,
    trace: createTraceNode("branch", nodePath, { cond: isTruthy }, null, [result.trace]),
  };
}

async function evaluatePatch(
  flow: { op: "set" | "unset" | "merge"; path: string; value?: import("../schema/expr.js").ExprNode },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): Promise<FlowResult> {
  let patchValue: unknown = undefined;

  if (flow.op !== "unset" && flow.value) {
    const valueResult = evaluateExpr(flow.value, ctx);
    if (!valueResult.ok) {
      return {
        state: setError(state, valueResult.error),
        trace: createTraceNode("error", nodePath, {}, null, []),
      };
    }
    patchValue = valueResult.value;
  }

  const patch: Patch = flow.op === "unset"
    ? { op: "unset", path: flow.path }
    : flow.op === "merge"
      ? { op: "merge", path: flow.path, value: patchValue as Record<string, unknown> }
      : { op: "set", path: flow.path, value: patchValue };

  const newState = applyPatchToState(state, patch);

  return {
    state: newState,
    trace: createTraceNode("patch", nodePath, { op: flow.op, path: flow.path }, patchValue, []),
  };
}

async function evaluateEffect(
  flow: { type: string; params: Record<string, import("../schema/expr.js").ExprNode> },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): Promise<FlowResult> {
  // Evaluate params
  const params: Record<string, unknown> = {};
  for (const [key, expr] of Object.entries(flow.params)) {
    const result = evaluateExpr(expr, ctx);
    if (!result.ok) {
      return {
        state: setError(state, result.error),
        trace: createTraceNode("error", nodePath, {}, null, []),
      };
    }
    params[key] = result.value;
  }

  // Generate deterministic requirement ID
  const requirementId = await generateRequirementId(
    ctx.snapshot.meta.schemaHash,
    (ctx.snapshot.input as { intentId?: string })?.intentId ?? "",
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
    createdAt: Date.now(),
  };

  const newState = addRequirement(state, requirement);

  return {
    state: newState,
    trace: createTraceNode("effect", nodePath, { type: flow.type }, params, []),
  };
}

async function evaluateCall(
  flowName: string,
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): Promise<FlowResult> {
  // Look up the flow in the schema
  const action = ctx.schema.actions[flowName];
  if (!action) {
    return {
      state: setError(state, createError(
        "UNKNOWN_FLOW",
        `Unknown flow: ${flowName}`,
        ctx.currentAction ?? "",
        nodePath
      )),
      trace: createTraceNode("error", nodePath, {}, null, []),
    };
  }

  const callPath = `${nodePath}.call(${flowName})`;
  const callCtx = withNodePath(ctx, callPath);

  const result = await evaluateFlow(action.flow, callCtx, state, callPath);

  return {
    state: result.state,
    trace: createTraceNode("call", nodePath, { flow: flowName }, null, [result.trace]),
  };
}

async function evaluateHalt(
  reason: string | undefined,
  state: FlowState,
  nodePath: string
): Promise<FlowResult> {
  return {
    state: { ...state, status: "halted" },
    trace: createTraceNode("halt", nodePath, { reason }, null, []),
  };
}

async function evaluateFail(
  flow: { code: string; message?: import("../schema/expr.js").ExprNode },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string
): Promise<FlowResult> {
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
    { code: flow.code }
  );

  return {
    state: setError(state, error),
    trace: createTraceNode("error", nodePath, { code: flow.code }, message, []),
  };
}
