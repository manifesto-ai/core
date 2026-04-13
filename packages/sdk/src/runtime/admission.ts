import {
  validateIntentInput as queryIntentInputValidation,
  type DomainSchema,
  type Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";

import {
  ManifestoError,
} from "../errors.js";
import type {
  CanonicalSnapshot,
  DispatchBlocker,
  IntentExplanation,
  ManifestoDomainShape,
  ManifestoEventMap,
  Snapshot,
  TypedIntent,
} from "../types.js";
import {
  emitDispatchRejectedEvent,
} from "./events.js";
import type {
  IntentLegalityEvaluation,
  RuntimeAdmission,
  RuntimeSimulateSync,
} from "./facets.js";
import {
  diffProjectedPaths,
} from "./reports.js";

type RuntimeAdmissionOptions<T extends ManifestoDomainShape> = {
  readonly schema: DomainSchema;
  readonly ensureIntentId: (intent: TypedIntent<T>) => TypedIntent<T>;
  readonly getAvailableActionsFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
  ) => readonly (keyof T["actions"])[];
  readonly isActionAvailableFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    name: keyof T["actions"],
  ) => boolean;
  readonly isIntentDispatchableFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => boolean;
  readonly projectSnapshotFromCanonical: (
    snapshot: CoreSnapshot,
  ) => Snapshot<T["state"]>;
  readonly getSimulateSync: () => RuntimeSimulateSync<T>;
  readonly emitEvent: <K extends keyof ManifestoEventMap<T>>(
    event: K,
    payload: ManifestoEventMap<T>[K],
  ) => void;
};

export function createRuntimeAdmission<T extends ManifestoDomainShape>({
  schema,
  ensureIntentId,
  getAvailableActionsFor,
  isActionAvailableFor,
  isIntentDispatchableFor,
  projectSnapshotFromCanonical,
  getSimulateSync,
  emitEvent,
}: RuntimeAdmissionOptions<T>): RuntimeAdmission<T> {
  function buildDispatchBlocker(
    layer: DispatchBlocker["layer"],
    expression: DispatchBlocker["expression"],
    description?: string,
  ): DispatchBlocker {
    return Object.freeze({
      layer,
      expression,
      evaluatedResult: false,
      ...(description !== undefined ? { description } : {}),
    }) as DispatchBlocker;
  }

  function getIntentBlockersFor(
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ): readonly DispatchBlocker[] {
    const actionName = intent.type as keyof T["actions"] & string;
    const action = schema.actions[actionName];
    if (!action) {
      return Object.freeze([]);
    }

    if (!isActionAvailableFor(snapshot, actionName)) {
      return Object.freeze(
        action.available
          ? [buildDispatchBlocker("available", action.available, action.description)]
          : [],
      );
    }

    if (!isIntentDispatchableFor(snapshot, intent)) {
      return Object.freeze(
        action.dispatchable
          ? [buildDispatchBlocker("dispatchable", action.dispatchable, action.description)]
          : [],
      );
    }

    return Object.freeze([]);
  }

  function createUnavailableError(intent: TypedIntent<T>): ManifestoError {
    return new ManifestoError(
      "ACTION_UNAVAILABLE",
      `Action "${intent.type}" is unavailable against the current visible snapshot`,
    );
  }

  function createNotDispatchableError(intent: TypedIntent<T>): ManifestoError {
    return new ManifestoError(
      "INTENT_NOT_DISPATCHABLE",
      `Action "${intent.type}" is available, but the bound intent is not dispatchable against the current visible snapshot`,
    );
  }

  function createInvalidInputError(message: string): ManifestoError {
    return new ManifestoError("INVALID_INPUT", message);
  }

  function validateIntentInputFor(
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ): ManifestoError | null {
    void snapshot;
    const message = queryIntentInputValidation(schema, intent);
    return message ? createInvalidInputError(message) : null;
  }

  function evaluateIntentLegalityFor(
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ): IntentLegalityEvaluation<T> {
    const enrichedIntent = ensureIntentId(intent);
    const actionName = enrichedIntent.type as keyof T["actions"] & string;

    if (!isActionAvailableFor(snapshot, actionName)) {
      return { kind: "unavailable", intent: enrichedIntent, actionName };
    }

    const invalidInput = validateIntentInputFor(snapshot, enrichedIntent);
    if (invalidInput) {
      return {
        kind: "invalid-input",
        intent: enrichedIntent,
        actionName,
        error: invalidInput,
      };
    }

    const blockers = getIntentBlockersFor(snapshot, enrichedIntent);
    if (blockers.length > 0) {
      return {
        kind: "not-dispatchable",
        intent: enrichedIntent,
        actionName,
        blockers,
      };
    }

    return { kind: "admitted", intent: enrichedIntent, actionName };
  }

  function deriveIntentAdmission(
    snapshot: CanonicalSnapshot<T["state"]>,
    legality: IntentLegalityEvaluation<T>,
  ) {
    if (legality.kind === "unavailable") {
      return Object.freeze({
        kind: "blocked",
        actionName: legality.actionName,
        failure: {
          kind: "unavailable",
          blockers: getIntentBlockersFor(snapshot, legality.intent),
        },
      });
    }

    if (legality.kind === "invalid-input") {
      return Object.freeze({
        kind: "blocked",
        actionName: legality.actionName,
        failure: {
          kind: "invalid_input",
          error: {
            code: "INVALID_INPUT",
            message: legality.error.message,
          },
        },
      });
    }

    if (legality.kind === "not-dispatchable") {
      return Object.freeze({
        kind: "blocked",
        actionName: legality.actionName,
        failure: {
          kind: "not_dispatchable",
          blockers: legality.blockers,
        },
      });
    }

    return Object.freeze({
      kind: "admitted",
      actionName: legality.actionName,
    });
  }

  function explainIntentFor(
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ): IntentExplanation<T> {
    const legality = evaluateIntentLegalityFor(snapshot, intent);

    if (legality.kind === "unavailable") {
      return Object.freeze({
        kind: "blocked",
        actionName: legality.actionName,
        available: false,
        dispatchable: false,
        blockers: getIntentBlockersFor(snapshot, legality.intent),
      }) as IntentExplanation<T>;
    }

    if (legality.kind === "invalid-input") {
      throw legality.error;
    }

    if (legality.kind === "not-dispatchable") {
      return Object.freeze({
        kind: "blocked",
        actionName: legality.actionName,
        available: true,
        dispatchable: false,
        blockers: legality.blockers,
      }) as IntentExplanation<T>;
    }

    const simulated = getSimulateSync()(snapshot, legality.intent);
    const projectedBefore = projectSnapshotFromCanonical(snapshot as CoreSnapshot);
    const projectedAfter = projectSnapshotFromCanonical(simulated.snapshot as CoreSnapshot);

    return Object.freeze({
      kind: "admitted",
      actionName: legality.actionName,
      available: true,
      dispatchable: true,
      status: simulated.status,
      requirements: simulated.requirements,
      canonicalSnapshot: simulated.snapshot,
      snapshot: projectedAfter,
      newAvailableActions: getAvailableActionsFor(simulated.snapshot),
      changedPaths: diffProjectedPaths(projectedBefore, projectedAfter),
    }) as IntentExplanation<T>;
  }

  function rejectRejectedIntent(intent: TypedIntent<T>, error: ManifestoError): never {
    emitDispatchRejectedEvent(emitEvent, intent, error);
    throw error;
  }

  function rejectUnavailable(intent: TypedIntent<T>): never {
    return rejectRejectedIntent(intent, createUnavailableError(intent));
  }

  function rejectInvalidInput(intent: TypedIntent<T>, message: string): never {
    return rejectRejectedIntent(intent, createInvalidInputError(message));
  }

  function rejectNotDispatchable(intent: TypedIntent<T>): never {
    return rejectRejectedIntent(intent, createNotDispatchableError(intent));
  }

  return Object.freeze({
    getIntentBlockersFor,
    validateIntentInputFor,
    evaluateIntentLegalityFor,
    deriveIntentAdmission,
    explainIntentFor,
    createUnavailableError,
    createNotDispatchableError,
    rejectInvalidInput,
    rejectUnavailable,
    rejectNotDispatchable,
  }) as RuntimeAdmission<T>;
}
