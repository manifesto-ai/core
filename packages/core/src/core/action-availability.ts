import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot } from "../schema/snapshot.js";
import { createContext } from "../evaluator/context.js";
import { evaluateExpr } from "../evaluator/expr.js";
import { isErr } from "../schema/common.js";

type ActionAvailabilityErrorCode = "UNKNOWN_ACTION" | "INTERNAL_ERROR" | "TYPE_MISMATCH";

export type ActionAvailabilityEvaluation =
  | { kind: "ok"; available: boolean }
  | { kind: "error"; code: ActionAvailabilityErrorCode; message: string };

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
  timestamp: number = snapshot.meta.timestamp
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
    snapshot,
    schema,
    null,
    `actions.${actionName}.available`,
    undefined,
    timestamp
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
 * Check whether an action is available for a new invocation.
 */
export function isActionAvailable(
  schema: DomainSchema,
  snapshot: Snapshot,
  actionName: string
): boolean {
  const result = evaluateActionAvailability(schema, snapshot, actionName);
  if (result.kind === "error") {
    throw new Error(result.message);
  }
  return result.available;
}

/**
 * Return all currently available actions in schema key order.
 */
export function getAvailableActions(
  schema: DomainSchema,
  snapshot: Snapshot
): readonly string[] {
  return Object.keys(schema.actions).filter((actionName) =>
    isActionAvailable(schema, snapshot, actionName)
  );
}
