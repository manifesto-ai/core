import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot } from "../schema/snapshot.js";
import type { ErrorValue, Requirement } from "../schema/snapshot.js";
import type { Intent, Patch } from "../schema/patch.js";
import type { ComputeResult, ComputeStatus, SystemDelta } from "../schema/result.js";
import type { TraceGraph } from "../schema/trace.js";
import type { FieldSpec } from "../schema/field.js";
import { createError } from "../errors.js";
import { createContext } from "../evaluator/context.js";
import { evaluateFlowSync, createFlowState, type FlowStatus } from "../evaluator/flow.js";
import { evaluateComputed } from "../evaluator/computed.js";
import { isOk } from "../schema/common.js";
import type { HostContext } from "../schema/host-context.js";
import { evaluateActionAvailability } from "./action-availability.js";
import { applySystemDelta } from "./system-delta.js";
import { validateValueAgainstTypeDefinition } from "./type-definition-utils.js";

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
  let currentSnapshot = snapshot;
  const initialComputedResult = evaluateComputed(schema, snapshot);
  if (isOk(initialComputedResult)) {
    currentSnapshot = {
      ...snapshot,
      computed: initialComputedResult.value,
    };
  }

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

  const inputError = validateIntentInput(schema, intent);
  if (inputError) {
    return createErrorResult(
      currentSnapshot,
      intent,
      "INVALID_INPUT",
      inputError,
      context
    );
  }

  const isReEntry = currentSnapshot.system.currentAction === intent.type;

  if (action.available && !isReEntry) {
    const availability = evaluateActionAvailability(schema, currentSnapshot, intent.type, context.now);
    if (availability.kind === "error") {
      return createErrorResult(
        currentSnapshot,
        intent,
        availability.code,
        availability.message,
        context
      );
    }

    if (!availability.available) {
      return createErrorResult(
        currentSnapshot,
        intent,
        "ACTION_UNAVAILABLE",
        `Action "${intent.type}" is not available`,
        context
      );
    }
  }

  const preparedSnapshot: Snapshot = {
    ...currentSnapshot,
    input: intent.input,
    system: {
      ...currentSnapshot.system,
      status: "computing",
      currentAction: intent.type,
    },
  };

  const ctx = createContext(preparedSnapshot, schema, intent.type, `actions.${intent.type}.flow`, intent.intentId, context.now);
  const flowState = createFlowState(preparedSnapshot);

  const flowResult = evaluateFlowSync(
    action.flow,
    ctx,
    flowState,
    `actions.${intent.type}.flow`
  );

  const status = mapFlowStatus(flowResult.state.status);
  const systemDelta = createSystemDeltaForFlow(currentSnapshot, intent, status, flowResult.state.error, flowResult.state.requirements);
  const patches = [...flowResult.state.patches];

  const trace: TraceGraph = {
    root: flowResult.trace,
    nodes: collectTraceNodes(flowResult.trace),
    intent: { type: intent.type, input: intent.input },
    baseVersion: currentSnapshot.meta.version,
    resultVersion: estimateResultVersion(currentSnapshot, patches, systemDelta),
    duration: context.durationMs ?? 0,
    terminatedBy: mapFlowStatusToTermination(flowResult.state.status),
  };

  return {
    patches,
    systemDelta,
    trace,
    status,
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
 * Validate only the caller-provided input portion of an intent.
 * Returns an error message when the intent is malformed, or null when valid.
 */
export function validateIntentInput(
  schema: DomainSchema,
  intent: Intent,
): string | null {
  if (!intent.intentId || intent.intentId === "") {
    return "Intent must have a non-empty intentId";
  }

  const action = schema.actions[intent.type];
  if (!action) {
    return null;
  }

  if (!action.input && !action.inputType) {
    return null;
  }

  return validateInput(schema, action.inputType, action.input, intent.input);
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

  const systemDelta: SystemDelta = {
    status: "error",
    currentAction: null,
    lastError: error,
    addRequirements: [],
    removeRequirementIds: [],
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
    resultVersion: estimateResultVersion(snapshot, [], systemDelta),
    duration: context.durationMs ?? 0,
    terminatedBy: "error",
  };

  return {
    patches: [],
    systemDelta,
    trace,
    status: "error",
  };
}

function createSystemDeltaForFlow(
  snapshot: Snapshot,
  intent: Intent,
  status: ComputeStatus,
  flowError: ErrorValue | null,
  requirements: readonly Requirement[]
): SystemDelta {
  const isError = status === "error";
  const systemStatus = status === "pending"
    ? "pending"
    : status === "error"
      ? "error"
      : "idle";

  return {
    status: systemStatus,
    currentAction: status === "pending" ? intent.type : null,
    lastError: flowError,
    addRequirements: [...requirements],
    removeRequirementIds: snapshot.system.pendingRequirements.map((requirement) => requirement.id),
  };
}

function estimateResultVersion(snapshot: Snapshot, patches: readonly Patch[], delta: SystemDelta): number {
  let version = snapshot.meta.version;

  // Host interlock always executes core.apply() first, even for empty patch arrays.
  // apply() increments snapshot version by exactly 1.
  version += 1;

  const applied = applySystemDelta(snapshot, delta);
  if (applied !== snapshot) {
    version += 1;
  }

  return version;
}

/**
 * Validate input against action's input schema
 * Returns error message if invalid, null if valid
 */
function validateInput(
  schema: DomainSchema,
  inputType: import("../schema/type-spec.js").TypeDefinition | undefined,
  inputSpec: FieldSpec | undefined,
  input: unknown,
): string | null {
  if (inputType) {
    const result = validateValueAgainstTypeDefinition(input, inputType, schema.types);
    return result.ok ? null : result.message ?? "Invalid input";
  }

  if (!inputSpec) {
    return null;
  }

  if (inputSpec.type === "object") {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return `Expected object input, got ${typeof input}`;
    }

    const inputObj = input as Record<string, unknown>;
    const fields = inputSpec.fields ?? {};

    for (const [fieldName, fieldSpec] of Object.entries(fields)) {
      if (fieldSpec.required && !(fieldName in inputObj)) {
        return `Missing required field: ${fieldName}`;
      }
    }

    for (const key of Object.keys(inputObj)) {
      if (!(key in fields)) {
        return `Unknown field: ${key}`;
      }
    }

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
