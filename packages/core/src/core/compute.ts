import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot, SystemState, ErrorValue } from "../schema/snapshot.js";
import type { Intent } from "../schema/patch.js";
import type { ComputeResult, ComputeStatus } from "../schema/result.js";
import type { TraceGraph } from "../schema/trace.js";
import type { HostContext } from "../schema/host-context.js";
import { createTraceContext, createTraceNode } from "../schema/trace.js";
import { createError } from "../errors.js";
import { createContext } from "../evaluator/context.js";
import { evaluateExpr } from "../evaluator/expr.js";
import { evaluateFlow, createFlowState, type FlowStatus } from "../evaluator/flow.js";
import { evaluateComputed } from "../evaluator/computed.js";
import { isOk, isErr } from "../schema/common.js";
import { validate } from "./validate.js";
import { validateValueAgainstFieldSpec } from "./validation-utils.js";

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
  intent: Intent,
  context: HostContext
): Promise<ComputeResult> {
  const traceContext = createTraceContext(context.now);

  const schemaValidation = validate(schema);
  if (!schemaValidation.valid) {
    const message = schemaValidation.errors[0]?.message ?? "Schema validation failed";
    return createErrorResult(
      snapshot,
      intent,
      "VALIDATION_ERROR",
      message,
      context
    );
  }

  if (!intent.intentId) {
    return createErrorResult(
      snapshot,
      intent,
      "INVALID_INPUT",
      "Intent must have intentId",
      context
    );
  }

  // 0. Ensure computed values are up-to-date before availability check
  let currentSnapshot = snapshot;
  const initialComputedResult = evaluateComputed(schema, snapshot);
  if (isErr(initialComputedResult)) {
    return createErrorResultFromValue(snapshot, intent, initialComputedResult.error, context);
  }
  currentSnapshot = {
    ...snapshot,
    computed: initialComputedResult.value,
  };

  // 1. Look up the action
  const action = schema.actions[intent.type];
  if (!action) {
    return createErrorResult(
      currentSnapshot,
      intent,
      "UNKNOWN_ACTION",
      `Unknown action: ${intent.type}`,
      context
    );
  }

  if (action.input) {
    const inputValidation = validateValueAgainstFieldSpec(intent.input, action.input, {
      allowPartial: false,
      allowUndefined: true,
    });
    if (!inputValidation.ok) {
      return createErrorResult(
        currentSnapshot,
        intent,
        "INVALID_INPUT",
        `Invalid input: ${inputValidation.message ?? "type mismatch"}`,
        context
      );
    }
  }

  // 2. Check availability condition
  if (action.available) {
    const meta = { intentId: intent.intentId, actionName: intent.type, timestamp: context.now };
    const ctx = createContext(currentSnapshot, schema, intent.type, "available", traceContext, meta);
    const availResult = evaluateExpr(action.available, ctx);

    if (isErr(availResult)) {
      return createErrorResult(
        currentSnapshot,
        intent,
        "INTERNAL_ERROR",
        `Error evaluating availability: ${availResult.error.message}`,
        context
      );
    }

    if (typeof availResult.value !== "boolean") {
      return createErrorResult(
        currentSnapshot,
        intent,
        "TYPE_MISMATCH",
        "Action availability must return boolean",
        context
      );
    }

    const isAvailable = availResult.value;
    if (!isAvailable) {
      return createErrorResult(
        currentSnapshot,
        intent,
        "ACTION_UNAVAILABLE",
        `Action "${intent.type}" is not available`,
        context
      );
    }
  }

  // 3. Prepare snapshot with input and system state
  const inputValue = intent.input;
  const preparedSnapshot: Snapshot = {
    ...currentSnapshot,
    input: inputValue,
    system: {
      ...currentSnapshot.system,
      status: "computing",
      currentAction: intent.type,
    },
  };

  // 4. Create evaluation context and flow state
  const meta = { intentId: intent.intentId, actionName: intent.type, timestamp: context.now };
  const ctx = createContext(
    preparedSnapshot,
    schema,
    intent.type,
    `actions.${intent.type}.flow`,
    traceContext,
    meta
  );
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
  let computedError: ErrorValue | null = null;
  let computedValues = finalSnapshot.computed;
  if (isOk(computedResult)) {
    computedValues = computedResult.value;
  } else {
    computedError = computedResult.error;
    computedValues = {};
  }
  finalSnapshot = {
    ...finalSnapshot,
    computed: computedValues,
  };

  // 8. Update system state based on flow result
  const flowStatus = mapFlowStatus(flowResult.state.status);
  const systemStatus = computedError ? "error" : flowStatus;
  const errors = [...finalSnapshot.system.errors];
  if (flowResult.state.error) {
    errors.push(flowResult.state.error);
  }
  if (computedError) {
    errors.push(computedError);
  }
  const systemState: SystemState = {
    status: systemStatus === "complete" || systemStatus === "halted" ? "idle" : systemStatus,
    lastError: computedError ?? flowResult.state.error,
    errors,
    pendingRequirements: computedError ? [] : [...flowResult.state.requirements],
    currentAction: systemStatus === "pending" ? intent.type : null,
  };

  finalSnapshot = {
    ...finalSnapshot,
    system: systemState,
    meta: {
      ...finalSnapshot.meta,
      version: finalSnapshot.meta.version + 1,
      timestamp: context.now,
      randomSeed: context.randomSeed,
    },
  };

  // 9. Build trace graph
  const trace: TraceGraph = {
    root: flowResult.trace,
    nodes: collectTraceNodes(flowResult.trace),
    intent: { type: intent.type, input: intent.input },
    baseVersion: currentSnapshot.meta.version,
    resultVersion: finalSnapshot.meta.version,
    duration: context.durationMs ?? 0,
    terminatedBy: mapFlowStatusToTermination(flowResult.state.status),
  };

  return {
    snapshot: finalSnapshot,
    requirements: [...flowResult.state.requirements],
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
  context: HostContext
): ComputeResult {
  const error = createError(
    code as import("../errors.js").CoreErrorCode,
    message,
    intent.type,
    "",
    context.now,
    { intent }
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
      timestamp: context.now,
      randomSeed: context.randomSeed,
    },
  };

  const traceContext = createTraceContext(context.now);
  const root = createTraceNode(traceContext, "error", "", {}, error, []);
  const trace: TraceGraph = {
    root,
    nodes: collectTraceNodes(root),
    intent: { type: intent.type, input: intent.input },
    baseVersion: snapshot.meta.version,
    resultVersion: errorSnapshot.meta.version,
    duration: context.durationMs ?? 0,
    terminatedBy: "error",
  };

  return {
    snapshot: errorSnapshot,
    requirements: [],
    trace,
    status: "error",
  };
}

function createErrorResultFromValue(
  snapshot: Snapshot,
  intent: Intent,
  error: ErrorValue,
  context: HostContext
): ComputeResult {
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
      timestamp: context.now,
      randomSeed: context.randomSeed,
    },
  };

  const traceContext = createTraceContext(context.now);
  const root = createTraceNode(traceContext, "error", "", {}, error, []);
  const trace: TraceGraph = {
    root,
    nodes: collectTraceNodes(root),
    intent: { type: intent.type, input: intent.input },
    baseVersion: snapshot.meta.version,
    resultVersion: errorSnapshot.meta.version,
    duration: context.durationMs ?? 0,
    terminatedBy: "error",
  };

  return {
    snapshot: errorSnapshot,
    requirements: [],
    trace,
    status: "error",
  };
}
