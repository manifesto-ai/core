import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot, SystemState } from "../schema/snapshot.js";
import type { Intent } from "../schema/patch.js";
import type { ComputeResult, ComputeStatus } from "../schema/result.js";
import type { TraceGraph } from "../schema/trace.js";
import type { FieldSpec } from "../schema/field.js";
import { createError } from "../errors.js";
import { createContext } from "../evaluator/context.js";
import { evaluateExpr } from "../evaluator/expr.js";
import { evaluateFlowSync, createFlowState, type FlowStatus } from "../evaluator/flow.js";
import { evaluateComputed } from "../evaluator/computed.js";
import { isOk, isErr } from "../schema/common.js";
import type { HostContext } from "../schema/host-context.js";

/**
 * Compute the result of dispatching an intent (synchronous).
 *
 * This is the canonical computation path. Each call is independent -
 * there is no suspended context.
 */
export function computeSync(
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent,
  context: HostContext
): ComputeResult {
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
      context
    );
  }

  // 1.5 Validate intentId (must be non-empty)
  if (!intent.intentId || intent.intentId === "") {
    return createErrorResult(
      currentSnapshot,
      intent,
      "INVALID_INPUT",
      "Intent must have a non-empty intentId",
      context
    );
  }

  // 1.6 Validate input against action's input schema
  if (action.input) {
    const inputError = validateInput(action.input, intent.input);
    if (inputError) {
      return createErrorResult(
        currentSnapshot,
        intent,
        "INVALID_INPUT",
        inputError,
        context
      );
    }
  }

  // 2. Check availability condition
  if (action.available) {
    const ctx = createContext(currentSnapshot, schema, intent.type, "available", intent.intentId);
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

    // Availability must return a boolean (A28: available conditions must be pure)
    if (typeof availResult.value !== "boolean") {
      return createErrorResult(
        currentSnapshot,
        intent,
        "TYPE_MISMATCH",
        `Availability condition must return boolean, got ${typeof availResult.value}`,
        context
      );
    }

    if (!availResult.value) {
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
  const ctx = createContext(preparedSnapshot, schema, intent.type, `actions.${intent.type}.flow`, intent.intentId);
  const flowState = createFlowState(preparedSnapshot);

  // 5. Evaluate the flow
  const flowResult = evaluateFlowSync(
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
      timestamp: context.now,
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
 * Compute the result of dispatching an intent (async wrapper).
 */
export async function compute(
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent,
  context: HostContext
): Promise<ComputeResult> {
  return computeSync(schema, snapshot, intent, context);
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
    context.now
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
    },
  };

  const trace: TraceGraph = {
    root: {
      id: `trace-error-${intent.intentId}`,
      kind: "error",
      sourcePath: "",
      inputs: {},
      output: error,
      children: [],
      timestamp: context.now,
    },
    nodes: {},
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

/**
 * Validate input against action's input schema
 * Returns error message if invalid, null if valid
 */
function validateInput(inputSpec: FieldSpec, input: unknown): string | null {
  // Check type
  if (inputSpec.type === "object") {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return `Expected object input, got ${typeof input}`;
    }

    const inputObj = input as Record<string, unknown>;
    const fields = inputSpec.fields ?? {};

    // Check for required fields
    for (const [fieldName, fieldSpec] of Object.entries(fields)) {
      if (fieldSpec.required && !(fieldName in inputObj)) {
        return `Missing required field: ${fieldName}`;
      }
    }

    // Check for unknown fields
    for (const key of Object.keys(inputObj)) {
      if (!(key in fields)) {
        return `Unknown field: ${key}`;
      }
    }

    // Recursively validate nested fields
    for (const [fieldName, fieldSpec] of Object.entries(fields)) {
      if (fieldName in inputObj) {
        const error = validateFieldValue(fieldSpec, inputObj[fieldName], fieldName);
        if (error) return error;
      }
    }
  }

  return null;
}

/**
 * Validate a field value against its spec
 */
function validateFieldValue(spec: FieldSpec, value: unknown, path: string): string | null {
  if (value === undefined || value === null) {
    if (spec.required) {
      return `Missing required field: ${path}`;
    }
    return null;
  }

  switch (spec.type) {
    case "string":
      if (typeof value !== "string") {
        return `Expected string for ${path}, got ${typeof value}`;
      }
      break;
    case "number":
      if (typeof value !== "number") {
        return `Expected number for ${path}, got ${typeof value}`;
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        return `Expected boolean for ${path}, got ${typeof value}`;
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        return `Expected array for ${path}, got ${typeof value}`;
      }
      break;
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) {
        return `Expected object for ${path}, got ${typeof value}`;
      }
      break;
  }

  return null;
}
