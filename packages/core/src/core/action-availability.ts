import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot } from "../schema/snapshot.js";
import type { Intent } from "../schema/patch.js";
import { createContext } from "../evaluator/context.js";
import { evaluateComputed } from "../evaluator/computed.js";
import { evaluateExpr } from "../evaluator/expr.js";
import { isErr } from "../schema/common.js";

export type ActionAvailabilityErrorCode = "UNKNOWN_ACTION" | "INTERNAL_ERROR" | "TYPE_MISMATCH";
export type ActionDispatchabilityErrorCode = "UNKNOWN_ACTION" | "INTERNAL_ERROR" | "TYPE_MISMATCH";

export type ActionAvailabilityEvaluation =
  | { kind: "ok"; available: boolean }
  | { kind: "error"; code: ActionAvailabilityErrorCode; message: string };

export type ActionDispatchabilityEvaluation =
  | { kind: "ok"; dispatchable: boolean }
  | { kind: "error"; code: ActionDispatchabilityErrorCode; message: string };

type PreparedQuerySnapshot =
  | { kind: "ok"; snapshot: Snapshot }
  | { kind: "error"; code: "INTERNAL_ERROR"; message: string };

function prepareQuerySnapshot(schema: DomainSchema, snapshot: Snapshot): PreparedQuerySnapshot {
  const computed = evaluateComputed(schema, snapshot);
  if (isErr(computed)) {
    return {
      kind: "error",
      code: "INTERNAL_ERROR",
      message: `Error evaluating computed values for legality query: ${computed.error.message}`,
    };
  }

  return {
    kind: "ok",
    snapshot: {
      ...snapshot,
      computed: computed.value,
    },
  };
}

function evaluateAvailabilityAgainstPreparedSnapshot(
  schema: DomainSchema,
  preparedSnapshot: Snapshot,
  actionName: string,
  timestamp: number,
): ActionAvailabilityEvaluation {
  const action = schema.actions[actionName];
  if (!action) {
    return {
      kind: "error",
      code: "UNKNOWN_ACTION",
      message: `Unknown action: ${actionName}`,
    };
  }

  if (!action.available) {
    return { kind: "ok", available: true };
  }

  const ctx = createContext(
    preparedSnapshot,
    schema,
    null,
    `actions.${actionName}.available`,
    undefined,
    timestamp,
    { phase: "availability" },
  );
  const result = evaluateExpr(action.available, ctx);

  if (isErr(result)) {
    return {
      kind: "error",
      code: "INTERNAL_ERROR",
      message: `Error evaluating availability: ${result.error.message}`,
    };
  }

  if (typeof result.value !== "boolean") {
    return {
      kind: "error",
      code: "TYPE_MISMATCH",
      message: `Availability condition must return boolean, got ${typeof result.value}`,
    };
  }

  return { kind: "ok", available: result.value };
}

/**
 * Evaluate an action's availability expression without re-entry semantics.
 *
 * This is the shared evaluator used by compute() initial invocation checks and
 * the public availability query API.
 */
export function evaluateActionAvailability(
  schema: DomainSchema,
  snapshot: Snapshot,
  actionName: string,
  timestamp: number = snapshot.meta.timestamp,
): ActionAvailabilityEvaluation {
  const prepared = prepareQuerySnapshot(schema, snapshot);
  if (prepared.kind === "error") {
    return prepared;
  }

  return evaluateAvailabilityAgainstPreparedSnapshot(
    schema,
    prepared.snapshot,
    actionName,
    timestamp,
  );
}

/**
 * Check whether an action is available for a new invocation.
 *
 * @deprecated Use {@link evaluateActionAvailability}: this wrapper throws on
 * evaluation errors, violating the errors-are-values contract. It will be
 * removed in the next major release.
 */
export function isActionAvailable(
  schema: DomainSchema,
  snapshot: Snapshot,
  actionName: string,
): boolean {
  const result = evaluateActionAvailability(schema, snapshot, actionName);
  if (result.kind === "error") {
    throw new Error(result.message);
  }
  return result.available;
}

/**
 * Evaluate whether a specific bound intent is dispatchable.
 */
export function evaluateIntentDispatchability(
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent,
  timestamp: number = snapshot.meta.timestamp,
): ActionDispatchabilityEvaluation {
  const action = schema.actions[intent.type];
  if (!action) {
    return {
      kind: "error",
      code: "UNKNOWN_ACTION",
      message: `Unknown action: ${intent.type}`,
    };
  }

  const prepared = prepareQuerySnapshot(schema, snapshot);
  if (prepared.kind === "error") {
    return prepared;
  }

  const availability = evaluateAvailabilityAgainstPreparedSnapshot(
    schema,
    prepared.snapshot,
    intent.type,
    timestamp,
  );
  if (availability.kind === "error") {
    return availability;
  }

  if (!availability.available) {
    return { kind: "ok", dispatchable: false };
  }

  if (!action.dispatchable) {
    return { kind: "ok", dispatchable: true };
  }

  const ctx = createContext(
    {
      ...prepared.snapshot,
      input: intent.input,
    },
    schema,
    intent.type,
    `actions.${intent.type}.dispatchable`,
    intent.intentId,
    timestamp,
    { phase: "dispatchability" },
  );
  const result = evaluateExpr(action.dispatchable, ctx);

  if (isErr(result)) {
    return {
      kind: "error",
      code: "INTERNAL_ERROR",
      message: `Error evaluating dispatchability: ${result.error.message}`,
    };
  }

  if (typeof result.value !== "boolean") {
    return {
      kind: "error",
      code: "TYPE_MISMATCH",
      message: `Dispatchability condition must return boolean, got ${typeof result.value}`,
    };
  }

  return { kind: "ok", dispatchable: result.value };
}

/**
 * Check whether a specific bound intent is dispatchable.
 *
 * @deprecated Use {@link evaluateIntentDispatchability}: this wrapper throws
 * on evaluation errors, violating the errors-are-values contract. It will be
 * removed in the next major release.
 */
export function isIntentDispatchable(
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent,
): boolean {
  const result = evaluateIntentDispatchability(schema, snapshot, intent);
  if (result.kind === "error") {
    throw new Error(result.message);
  }
  return result.dispatchable;
}

export type AvailableActionError = {
  readonly actionName: string;
  readonly code: ActionAvailabilityErrorCode;
  readonly message: string;
};

export type AvailableActionsEvaluation =
  | {
      kind: "ok";
      /** Action names whose availability evaluated to true, in schema key order. */
      actions: readonly string[];
      /**
       * Actions whose availability expression failed to evaluate. They are
       * excluded from `actions` (an action whose legality cannot be evaluated
       * is not available), but the failure stays observable as a value so one
       * broken expression cannot poison the whole legality query.
       */
      errors: readonly AvailableActionError[];
    }
  | { kind: "error"; code: "INTERNAL_ERROR"; message: string };

/**
 * Evaluate availability for every action without re-entry semantics.
 *
 * Per-action evaluation failures are reported as values alongside the
 * available list; only a snapshot-level preparation failure (computed
 * evaluation) makes the whole query fail.
 */
export function evaluateAvailableActions(
  schema: DomainSchema,
  snapshot: Snapshot,
): AvailableActionsEvaluation {
  const prepared = prepareQuerySnapshot(schema, snapshot);
  if (prepared.kind === "error") {
    return prepared;
  }

  const actions: string[] = [];
  const errors: AvailableActionError[] = [];

  for (const actionName of Object.keys(schema.actions)) {
    const result = evaluateAvailabilityAgainstPreparedSnapshot(
      schema,
      prepared.snapshot,
      actionName,
      snapshot.meta.timestamp,
    );
    if (result.kind === "error") {
      errors.push({ actionName, code: result.code, message: result.message });
      continue;
    }
    if (result.available) {
      actions.push(actionName);
    }
  }

  return { kind: "ok", actions, errors };
}

/**
 * Return all currently available actions in schema key order.
 *
 * @deprecated Use {@link evaluateAvailableActions}: this wrapper throws on
 * evaluation errors, violating the errors-are-values contract. It will be
 * removed in the next major release.
 */
export function getAvailableActions(schema: DomainSchema, snapshot: Snapshot): readonly string[] {
  const prepared = prepareQuerySnapshot(schema, snapshot);
  if (prepared.kind === "error") {
    throw new Error(prepared.message);
  }

  return Object.keys(schema.actions).filter((actionName) => {
    const result = evaluateAvailabilityAgainstPreparedSnapshot(
      schema,
      prepared.snapshot,
      actionName,
      snapshot.meta.timestamp,
    );
    if (result.kind === "error") {
      throw new Error(result.message);
    }
    return result.available;
  });
}
