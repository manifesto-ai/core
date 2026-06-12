import type { FlowNode, FlowPatchPath } from "../schema/flow.js";
import type { Snapshot, Requirement, ErrorValue } from "../schema/snapshot.js";
import type { Patch, PatchPath, PatchSegment } from "../schema/patch.js";
import type { NamespaceDelta } from "../schema/result.js";
import type { TraceNode } from "../schema/trace.js";
import type { FieldSpec } from "../schema/field.js";
import { createTraceNode } from "../schema/trace.js";
import { createError } from "../errors.js";
import {
  isSafePatchPath,
  mergeAtPatchPath,
  patchPathToDisplayString,
  semanticPathToPatchPath,
  setByPatchPath,
  unsetByPatchPath,
} from "../utils/patch-path.js";
import { generateRequirementIdSync } from "../utils/hash.js";
import { type EvalContext, withSnapshot, withNodePath, withCollectionContext } from "./context.js";
import { evaluateExpr } from "./expr.js";
import { getFieldSpecAtSegments, validateValueAgainstFieldSpec } from "../core/validation-utils.js";
import {
  getStateTypeDefinitionAtSegments,
  validateValueAgainstTypeDefinition,
} from "../core/type-definition-utils.js";

const CORE_NAMESPACE = "core";
const CORE_CAUSAL_GUARDS_KEY = "causalGuards";

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
  readonly namespaceDelta: readonly NamespaceDelta[];
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
    namespaceDelta: [],
    requirements: [],
    error: null,
  };
}

/**
 * Apply a patch to flow state
 */
function applyPatchToState(state: FlowState, patch: Patch): FlowState {
  let newSnapshotState = state.snapshot.state;

  switch (patch.op) {
    case "set":
      newSnapshotState = setByPatchPath(newSnapshotState, patch.path, patch.value);
      break;
    case "unset":
      newSnapshotState = unsetByPatchPath(newSnapshotState, patch.path);
      break;
    case "merge":
      newSnapshotState = mergeAtPatchPath(newSnapshotState, patch.path, patch.value);
      break;
  }

  return {
    ...state,
    snapshot: {
      ...state.snapshot,
      state: newSnapshotState,
    },
    patches: [...state.patches, patch],
  };
}

/**
 * Apply a namespace patch to flow state for same-cycle namespace reads.
 */
function applyNamespacePatchToState(
  state: FlowState,
  namespace: string,
  namespaceRoot: unknown,
  patch: Patch,
): FlowState {
  return {
    ...state,
    snapshot: {
      ...state.snapshot,
      namespaces: {
        ...state.snapshot.namespaces,
        [namespace]: namespaceRoot,
      },
    },
    namespaceDelta: [
      ...state.namespaceDelta,
      {
        namespace,
        patches: [patch],
      },
    ],
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
  nodePath: string,
): FlowResult {
  const flowCtx = ctx.phase === "flow" ? ctx : { ...ctx, phase: "flow" as const };
  // Stop if already terminated
  if (state.status !== "running") {
    return {
      state,
      trace: createTraceNode(flowCtx.trace, "flow", nodePath, {}, null, []),
    };
  }

  switch (flow.kind) {
    case "seq":
      return evaluateSeq(flow.steps, flowCtx, state, nodePath);

    case "if":
      return evaluateIf(flow, flowCtx, state, nodePath);

    case "patch":
      return evaluatePatch(flow, flowCtx, state, nodePath);

    case "causalGuard":
      return evaluateCausalGuard(flow, flowCtx, state, nodePath);

    case "effect":
      return evaluateEffect(flow, flowCtx, state, nodePath);

    case "call":
      return evaluateCall(flow.flow, flowCtx, state, nodePath);

    case "halt":
      return evaluateHalt(flow.reason, flowCtx, state, nodePath);

    case "fail":
      return evaluateFail(flow, flowCtx, state, nodePath);

    default:
      return {
        state: setError(
          state,
          createError(
            "INTERNAL_ERROR",
            `Unknown flow kind: ${(flow as FlowNode).kind}`,
            flowCtx.currentAction ?? "",
            nodePath,
            flowCtx.trace.timestamp,
          ),
        ),
        trace: createTraceNode(flowCtx.trace, "error", nodePath, {}, null, []),
      };
  }
}

export async function evaluateFlow(
  flow: FlowNode,
  ctx: EvalContext,
  state: FlowState,
  nodePath: string,
): Promise<FlowResult> {
  return evaluateFlowSync(flow, ctx, state, nodePath);
}

// ============ Flow Node Handlers ============

function evaluateSeq(
  steps: readonly FlowNode[],
  ctx: EvalContext,
  state: FlowState,
  nodePath: string,
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
  nodePath: string,
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
  flow: {
    op: "set" | "unset" | "merge";
    path: FlowPatchPath;
    value?: import("../schema/expr.js").ExprNode;
  },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string,
): FlowResult {
  const currentCtx = withSnapshot(ctx, state.snapshot);
  const pathResult = resolveFlowPatchPath(flow.path, currentCtx, nodePath);
  if (!pathResult.ok) {
    return {
      state: setError(state, pathResult.error),
      trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
    };
  }

  const resolvedPath = pathResult.path;
  const displayPath = patchPathToDisplayString(resolvedPath);
  const rootSpec: FieldSpec = { type: "object", required: true, fields: ctx.schema.state.fields };
  const typeDefinition = getStateTypeDefinitionAtSegments(
    ctx.schema.state,
    ctx.schema.types,
    resolvedPath,
  );
  const fieldSpec = typeDefinition ? null : getFieldSpecAtSegments(rootSpec, resolvedPath);
  if (!typeDefinition && !fieldSpec) {
    return {
      state: setError(
        state,
        createError(
          "PATH_NOT_FOUND",
          `Unknown patch path: ${displayPath}`,
          ctx.currentAction ?? "",
          nodePath,
          ctx.trace.timestamp,
        ),
      ),
      trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
    };
  }

  if (flow.op === "merge" && !isMergeTargetCompatible(state.snapshot.state, resolvedPath)) {
    return {
      state: setError(
        state,
        createError(
          "TYPE_MISMATCH",
          `Invalid merge target at ${displayPath}: target path must be an object or absent`,
          ctx.currentAction ?? "",
          nodePath,
          ctx.trace.timestamp,
        ),
      ),
      trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
    };
  }

  let patchValue: unknown = undefined;

  if (flow.value) {
    const valueResult = evaluateExpr(flow.value, withNodePath(currentCtx, `${nodePath}.value`));
    if (!valueResult.ok) {
      return {
        state: setError(state, valueResult.error),
        trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
      };
    }
    patchValue = valueResult.value;
  }

  if (flow.op !== "unset") {
    const validation = typeDefinition
      ? validateValueAgainstTypeDefinition(patchValue, typeDefinition, ctx.schema.types, {
          allowPartial: flow.op === "merge",
          allowUndefined: false,
        })
      : validateValueAgainstFieldSpec(patchValue, fieldSpec as FieldSpec, {
          allowPartial: flow.op === "merge",
          allowUndefined: false,
        });
    if (!validation.ok) {
      return {
        state: setError(
          state,
          createError(
            "TYPE_MISMATCH",
            `Invalid patch value at ${displayPath}: ${validation.message ?? "type mismatch"}`,
            ctx.currentAction ?? "",
            nodePath,
            ctx.trace.timestamp,
          ),
        ),
        trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
      };
    }
  }

  const patch: Patch =
    flow.op === "unset"
      ? { op: "unset", path: resolvedPath }
      : flow.op === "merge"
        ? { op: "merge", path: resolvedPath, value: patchValue as Record<string, unknown> }
        : { op: "set", path: resolvedPath, value: patchValue };

  const newState = applyPatchToState(state, patch);

  return {
    state: newState,
    trace: createTraceNode(
      ctx.trace,
      "patch",
      nodePath,
      { op: flow.op, path: displayPath },
      patchValue,
      [],
    ),
  };
}

function resolveFlowPatchPath(
  path: FlowPatchPath,
  ctx: EvalContext,
  nodePath: string,
): { ok: true; path: PatchPath } | { ok: false; error: ErrorValue } {
  const resolved: PatchSegment[] = [];

  for (const [index, segment] of path.entries()) {
    if (segment.kind === "prop" || segment.kind === "index") {
      const safety = validateResolvedPatchSegment([...resolved, segment], ctx, nodePath, index);
      if (!safety.ok) {
        return safety;
      }
      resolved.push(segment);
      continue;
    }

    const exprCtx = withNodePath(ctx, `${nodePath}.path[${index}]`);
    const result = evaluateExpr(segment.expr, exprCtx);
    if (!result.ok) {
      return result;
    }

    const value = result.value;
    if (typeof value === "string" && value.length > 0) {
      const resolvedSegment: PatchSegment = { kind: "prop", name: value };
      const safety = validateResolvedPatchSegment(
        [...resolved, resolvedSegment],
        ctx,
        nodePath,
        index,
      );
      if (!safety.ok) {
        return safety;
      }
      resolved.push(resolvedSegment);
      continue;
    }

    if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
      const resolvedSegment: PatchSegment = { kind: "index", index: value };
      const safety = validateResolvedPatchSegment(
        [...resolved, resolvedSegment],
        ctx,
        nodePath,
        index,
      );
      if (!safety.ok) {
        return safety;
      }
      resolved.push(resolvedSegment);
      continue;
    }

    return {
      ok: false,
      error: createError(
        "INVALID_PATCH_PATH",
        `Invalid dynamic patch path segment at index ${index}: expected non-empty string or non-negative integer, got ${describeDynamicPathValue(value)}`,
        ctx.currentAction ?? "",
        `${nodePath}.path[${index}]`,
        ctx.trace.timestamp,
        { segmentIndex: index, resolvedType: describeDynamicPathValue(value) },
      ),
    };
  }

  return { ok: true, path: resolved };
}

function validateResolvedPatchSegment(
  path: PatchPath,
  ctx: EvalContext,
  nodePath: string,
  index: number,
): { ok: true } | { ok: false; error: ErrorValue } {
  if (isSafePatchPath(path)) {
    return { ok: true };
  }

  return {
    ok: false,
    error: createError(
      "INVALID_PATCH_PATH",
      `Unsafe patch path segment at index ${index}: ${patchPathToDisplayString(path)}`,
      ctx.currentAction ?? "",
      `${nodePath}.path[${index}]`,
      ctx.trace.timestamp,
      { segmentIndex: index, path: patchPathToDisplayString(path) },
    ),
  };
}

function describeDynamicPathValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function isMergeTargetCompatible(root: unknown, path: PatchPath): boolean {
  let current: unknown = root;

  for (const segment of path) {
    if (current === undefined) {
      return true;
    }

    if (segment.kind === "prop") {
      if (!isObjectRecord(current)) {
        return false;
      }
      current = current[segment.name];
      continue;
    }

    if (!Array.isArray(current)) {
      return false;
    }
    current = current[segment.index];
  }

  if (current === undefined) {
    return true;
  }
  return isObjectRecord(current);
}

function evaluateCausalGuard(
  flow: { guardId: string; body: FlowNode },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string,
): FlowResult {
  const intentId = ctx.intentId;
  if (!intentId) {
    return {
      state: setError(
        state,
        createError(
          "INVALID_INPUT",
          "causalGuard requires a current intent id",
          ctx.currentAction ?? "",
          nodePath,
          ctx.trace.timestamp,
        ),
      ),
      trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
    };
  }
  const coreRootResult = getCoreNamespaceRoot(state.snapshot, ctx, nodePath);
  if (!coreRootResult.ok) {
    return {
      state: setError(state, coreRootResult.error),
      trace: createTraceNode(ctx.trace, "error", nodePath, {}, null, []),
    };
  }

  const guards = getCoreCausalGuards(coreRootResult.value);
  if (guards[flow.guardId] === intentId) {
    return {
      state,
      trace: createTraceNode(
        ctx.trace,
        "flow",
        nodePath,
        { kind: "causalGuard", guardId: flow.guardId, skipped: true },
        null,
        [],
      ),
    };
  }

  const nextCoreRoot = {
    ...coreRootResult.value,
    [CORE_CAUSAL_GUARDS_KEY]: {
      ...guards,
      [flow.guardId]: intentId,
    },
  };
  const patch: Patch = {
    op: "merge",
    path: [{ kind: "prop", name: CORE_CAUSAL_GUARDS_KEY }],
    value: { [flow.guardId]: intentId },
  };

  const guardedState = applyNamespacePatchToState(state, CORE_NAMESPACE, nextCoreRoot, patch);
  const namespaceTrace = createTraceNode(
    ctx.trace,
    "namespaceDelta",
    `${nodePath}.namespaceDelta`,
    {
      namespace: CORE_NAMESPACE,
      patchCount: 1,
    },
    {
      namespace: CORE_NAMESPACE,
      patches: [patch],
    },
    [],
  );
  const bodyPath = `${nodePath}.body`;
  const bodyCtx = withNodePath(withSnapshot(ctx, guardedState.snapshot), bodyPath);
  const bodyResult = evaluateFlowSync(flow.body, bodyCtx, guardedState, bodyPath);

  return {
    state: bodyResult.state,
    trace: createTraceNode(
      ctx.trace,
      "flow",
      nodePath,
      { kind: "causalGuard", guardId: flow.guardId, skipped: false },
      null,
      [namespaceTrace, bodyResult.trace],
    ),
  };
}

function getCoreNamespaceRoot(
  snapshot: Snapshot,
  ctx: EvalContext,
  nodePath: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: ErrorValue } {
  const root = snapshot.namespaces[CORE_NAMESPACE];
  if (root === undefined) {
    return { ok: true, value: {} };
  }

  if (!isObjectRecord(root)) {
    return {
      ok: false,
      error: createError(
        "TYPE_MISMATCH",
        "Invalid core namespace root: expected object",
        ctx.currentAction ?? "",
        nodePath,
        ctx.trace.timestamp,
      ),
    };
  }

  return { ok: true, value: root };
}

function getCoreCausalGuards(root: Record<string, unknown>): Record<string, string> {
  const guards = root[CORE_CAUSAL_GUARDS_KEY];
  if (!isObjectRecord(guards)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(guards).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function evaluateEffect(
  flow: { type: string; params: Record<string, import("../schema/expr.js").ExprNode> },
  ctx: EvalContext,
  state: FlowState,
  nodePath: string,
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
    nodePath,
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
  nodePath: string,
): FlowResult {
  const { params } = flow;

  // Use the current state's snapshot (which reflects patches applied so far)
  const currentCtx = withSnapshot(ctx, state.snapshot);

  // Get source array
  const sourceExpr = params.source;
  if (!sourceExpr) {
    return {
      state: setError(
        state,
        createError(
          "INVALID_INPUT",
          `${flow.type} requires 'source' parameter`,
          ctx.currentAction ?? "",
          nodePath,
          ctx.trace.timestamp,
        ),
      ),
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
      state: setError(
        state,
        createError(
          "TYPE_MISMATCH",
          `${flow.type} source must be an array`,
          currentCtx.currentAction ?? "",
          nodePath,
          currentCtx.trace.timestamp,
        ),
      ),
      trace: createTraceNode(currentCtx.trace, "error", nodePath, {}, null, []),
    };
  }

  // Get target path
  const intoExpr = params.into;
  if (!intoExpr) {
    return {
      state: setError(
        state,
        createError(
          "INVALID_INPUT",
          `${flow.type} requires 'into' parameter`,
          currentCtx.currentAction ?? "",
          nodePath,
          currentCtx.trace.timestamp,
        ),
      ),
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

  const targetPath = toPatchPath(intoResult.value);
  if (!targetPath) {
    return {
      state: setError(
        state,
        createError(
          "INVALID_INPUT",
          `${flow.type} into must resolve to PatchPath segments or semantic string path`,
          currentCtx.currentAction ?? "",
          nodePath,
          currentCtx.trace.timestamp,
        ),
      ),
      trace: createTraceNode(currentCtx.trace, "error", nodePath, {}, null, []),
    };
  }

  // Get the transformation expression
  const transformExpr = flow.type === "array.map" ? params.select : params.where;
  if (!transformExpr) {
    return {
      state: setError(
        state,
        createError(
          "INVALID_INPUT",
          `${flow.type} requires '${flow.type === "array.map" ? "select" : "where"}' parameter`,
          currentCtx.currentAction ?? "",
          nodePath,
          currentCtx.trace.timestamp,
        ),
      ),
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
    trace: createTraceNode(
      currentCtx.trace,
      "effect",
      nodePath,
      { type: flow.type, target: targetPath },
      { count: resultArray.length },
      [],
    ),
  };
}

function toPatchPath(value: unknown): PatchPath | null {
  if (typeof value === "string") {
    return semanticPathToPatchPath(value);
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const segments: PatchSegment[] = [];
  for (const segment of value) {
    if (!segment || typeof segment !== "object") {
      return null;
    }

    const kind = (segment as { kind?: unknown }).kind;
    if (kind === "prop") {
      const name = (segment as { name?: unknown }).name;
      if (typeof name !== "string" || name.length === 0) {
        return null;
      }
      segments.push({ kind: "prop", name });
      continue;
    }

    if (kind === "index") {
      const index = (segment as { index?: unknown }).index;
      if (!Number.isInteger(index) || (index as number) < 0) {
        return null;
      }
      segments.push({ kind: "index", index: index as number });
      continue;
    }

    return null;
  }

  return segments.length > 0 ? segments : null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function evaluateCall(
  flowName: string,
  ctx: EvalContext,
  state: FlowState,
  nodePath: string,
): FlowResult {
  // Look up the flow in the schema
  const action = ctx.schema.actions[flowName];
  if (!action) {
    return {
      state: setError(
        state,
        createError(
          "UNKNOWN_FLOW",
          `Unknown flow: ${flowName}`,
          ctx.currentAction ?? "",
          nodePath,
          ctx.trace.timestamp,
        ),
      ),
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
  nodePath: string,
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
  nodePath: string,
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
    { code: flow.code },
  );

  return {
    state: setError(state, error),
    trace: createTraceNode(ctx.trace, "error", nodePath, { code: flow.code }, message, []),
  };
}
