import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot, SystemState } from "../schema/snapshot.js";
import type { Intent } from "../schema/patch.js";
import type { ComputeResult, ComputeStatus } from "../schema/result.js";
import type { TraceGraph } from "../schema/trace.js";
import { createError } from "../errors.js";
import { createContext } from "../evaluator/context.js";
import { evaluateExpr } from "../evaluator/expr.js";
import { evaluateFlow, createFlowState, type FlowStatus } from "../evaluator/flow.js";
import { evaluateComputed } from "../evaluator/computed.js";
import { isOk, isErr } from "../schema/common.js";

/**
 * Compute the result of dispatching an intent
 *
 * This is the ONLY entry point for computation.
 * Each call is independent - there is no suspended context.
 *
 * @param schema - The domain schema
 * @param snapshot - Current snapshot state
 * @param intent - The intent to process
 * @returns ComputeResult with new snapshot, trace, and status
 */
export async function compute(
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent
): Promise<ComputeResult> {
  const startTime = Date.now();

  // 0. Ensure computed values are up-to-date before availability check
  let currentSnapshot = snapshot;
  const initialComputedResult = evaluateComputed(schema, snapshot);
  if (isOk(initialComputedResult)) {
    currentSnapshot = {
      ...snapshot,
      computed: initialComputedResult.value,
    };
  }

  // 1. Look up the action
  const action = schema.actions[intent.type];
  if (!action) {
    return createErrorResult(
      currentSnapshot,
      intent,
      "UNKNOWN_ACTION",
      `Unknown action: ${intent.type}`,
      startTime
    );
  }

  // 2. Check availability condition
  if (action.available) {
    const ctx = createContext(currentSnapshot, schema, intent.type, "available");
    const availResult = evaluateExpr(action.available, ctx);

    if (isErr(availResult)) {
      return createErrorResult(
        currentSnapshot,
        intent,
        "INTERNAL_ERROR",
        `Error evaluating availability: ${availResult.error.message}`,
        startTime
      );
    }

    const isAvailable = availResult.value !== false && availResult.value !== null && availResult.value !== undefined;
    if (!isAvailable) {
      return createErrorResult(
        currentSnapshot,
        intent,
        "ACTION_UNAVAILABLE",
        `Action "${intent.type}" is not available`,
        startTime
      );
    }
  }

  // 3. Prepare snapshot with input and system state
  const preparedSnapshot: Snapshot = {
    ...currentSnapshot,
    input: intent.input,
    system: {
      ...currentSnapshot.system,
      status: "computing",
      currentAction: intent.type,
    },
  };

  // 4. Create evaluation context and flow state
  const ctx = createContext(preparedSnapshot, schema, intent.type, `actions.${intent.type}.flow`);
  const flowState = createFlowState(preparedSnapshot);

  // 5. Evaluate the flow
  const flowResult = await evaluateFlow(
    action.flow,
    ctx,
    flowState,
    `actions.${intent.type}.flow`
  );

  // 6. Get final snapshot from flow state
  let finalSnapshot = flowResult.state.snapshot;

  // 7. Recompute all computed values
  const computedResult = evaluateComputed(schema, finalSnapshot);
  if (isOk(computedResult)) {
    finalSnapshot = {
      ...finalSnapshot,
      computed: computedResult.value,
    };
  }

  // 8. Update system state based on flow result
  const systemStatus = mapFlowStatus(flowResult.state.status);
  const systemState: SystemState = {
    status: systemStatus === "complete" || systemStatus === "halted" ? "idle" : systemStatus,
    lastError: flowResult.state.error,
    errors: flowResult.state.error
      ? [...finalSnapshot.system.errors, flowResult.state.error]
      : finalSnapshot.system.errors,
    pendingRequirements: [...flowResult.state.requirements],
    currentAction: systemStatus === "pending" ? intent.type : null,
  };

  finalSnapshot = {
    ...finalSnapshot,
    system: systemState,
    meta: {
      ...finalSnapshot.meta,
      version: finalSnapshot.meta.version + 1,
      timestamp: Date.now(),
    },
  };

  // 9. Build trace graph
  const trace: TraceGraph = {
    root: flowResult.trace,
    nodes: collectTraceNodes(flowResult.trace),
    intent: { type: intent.type, input: intent.input },
    baseVersion: currentSnapshot.meta.version,
    resultVersion: finalSnapshot.meta.version,
    duration: Date.now() - startTime,
    terminatedBy: mapFlowStatusToTermination(flowResult.state.status),
  };

  return {
    snapshot: finalSnapshot,
    trace,
    status: systemStatus,
  };
}

/**
 * Map flow status to compute status
 */
function mapFlowStatus(status: FlowStatus): ComputeStatus {
  switch (status) {
    case "running":
    case "complete":
      return "complete";
    case "pending":
      return "pending";
    case "halted":
      return "halted";
    case "error":
      return "error";
  }
}

/**
 * Map flow status to trace termination
 */
function mapFlowStatusToTermination(status: FlowStatus): TraceGraph["terminatedBy"] {
  switch (status) {
    case "running":
    case "complete":
      return "complete";
    case "pending":
      return "effect";
    case "halted":
      return "halt";
    case "error":
      return "error";
  }
}

/**
 * Collect all trace nodes into a flat map
 */
function collectTraceNodes(root: import("../schema/trace.js").TraceNode): Record<string, import("../schema/trace.js").TraceNode> {
  const nodes: Record<string, import("../schema/trace.js").TraceNode> = {};

  function collect(node: import("../schema/trace.js").TraceNode) {
    nodes[node.id] = node;
    for (const child of node.children) {
      collect(child);
    }
  }

  collect(root);
  return nodes;
}

/**
 * Create an error result
 */
function createErrorResult(
  snapshot: Snapshot,
  intent: Intent,
  code: string,
  message: string,
  startTime: number
): ComputeResult {
  const error = createError(
    code as import("../errors.js").CoreErrorCode,
    message,
    intent.type,
    ""
  );

  const errorSnapshot: Snapshot = {
    ...snapshot,
    input: intent.input,
    system: {
      ...snapshot.system,
      status: "error",
      lastError: error,
      errors: [...snapshot.system.errors, error],
      currentAction: null,
    },
    meta: {
      ...snapshot.meta,
      version: snapshot.meta.version + 1,
      timestamp: Date.now(),
    },
  };

  const trace: TraceGraph = {
    root: {
      id: `trace-error-${Date.now()}`,
      kind: "error",
      sourcePath: "",
      inputs: {},
      output: error,
      children: [],
      timestamp: Date.now(),
    },
    nodes: {},
    intent: { type: intent.type, input: intent.input },
    baseVersion: snapshot.meta.version,
    resultVersion: errorSnapshot.meta.version,
    duration: Date.now() - startTime,
    terminatedBy: "error",
  };

  return {
    snapshot: errorSnapshot,
    trace,
    status: "error",
  };
}
