import type {
  ComputeStatus,
  Patch,
  Requirement,
  Snapshot as CoreSnapshot,
  SystemDelta,
} from "@manifesto-ai/core";
import type { HostResult } from "@manifesto-ai/host";

import type {
  DispatchBlocker,
  CanonicalSnapshot,
  DispatchExecutionOutcome,
  ExecutionDiagnostics,
  ExecutionFailureInfo,
  IntentAdmission,
  IntentExplanation,
  ManifestoDomainShape,
  ManifestoEvent,
  ManifestoEventMap,
  SimulationDiagnostics,
  Snapshot,
  TypedIntent,
  TypedOn,
  TypedSubscribe,
} from "../types.js";
import type { ManifestoError } from "../errors.js";

export interface RuntimeStateStore<T extends ManifestoDomainShape> {
  readonly subscribe: TypedSubscribe<T>;
  readonly on: TypedOn<T>;
  readonly getSnapshot: () => Snapshot<T["state"]>;
  readonly getCanonicalSnapshot: () => CanonicalSnapshot<T["state"]>;
  readonly getVisibleCoreSnapshot: () => CoreSnapshot;
  readonly setVisibleSnapshot: (
    snapshot: CoreSnapshot,
    options?: { readonly notify?: boolean },
  ) => Snapshot<T["state"]>;
  readonly restoreVisibleSnapshot: () => void;
  readonly emitEvent: <K extends ManifestoEvent>(
    event: K,
    payload: ManifestoEventMap<T>[K],
  ) => void;
  readonly enqueue: <R>(task: () => Promise<R>) => Promise<R>;
  readonly dispose: () => void;
  readonly isDisposed: () => boolean;
}

export interface RuntimeReportHelpers<T extends ManifestoDomainShape> {
  readonly deriveExecutionOutcome: (
    beforeSnapshot: CanonicalSnapshot<T["state"]>,
    afterSnapshot: CanonicalSnapshot<T["state"]>,
  ) => DispatchExecutionOutcome<T>;
  readonly classifyExecutionFailure: (
    error: unknown,
    stage: "host" | "seal",
  ) => ExecutionFailureInfo;
  readonly createExecutionDiagnostics: (
    result: HostResult,
  ) => ExecutionDiagnostics;
}

export type IntentLegalityEvaluation<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> =
  | {
      readonly kind: "unavailable";
      readonly intent: TypedIntent<T>;
      readonly actionName: keyof T["actions"] & string;
    }
  | {
      readonly kind: "invalid-input";
      readonly intent: TypedIntent<T>;
      readonly actionName: keyof T["actions"] & string;
      readonly error: ManifestoError;
    }
  | {
      readonly kind: "not-dispatchable";
      readonly intent: TypedIntent<T>;
      readonly actionName: keyof T["actions"] & string;
      readonly blockers: readonly DispatchBlocker[];
    }
  | {
      readonly kind: "admitted";
      readonly intent: TypedIntent<T>;
      readonly actionName: keyof T["actions"] & string;
    };

export type RuntimeSimulationResult<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly snapshot: CanonicalSnapshot<T["state"]>;
  readonly patches: readonly Patch[];
  readonly systemDelta: Readonly<SystemDelta>;
  readonly status: ComputeStatus;
  readonly requirements: readonly Requirement[];
  readonly diagnostics?: SimulationDiagnostics;
};

export type RuntimeSimulateSync<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = (
  snapshot: CanonicalSnapshot<T["state"]>,
  intent: TypedIntent<T>,
) => RuntimeSimulationResult<T>;

export interface RuntimeAdmission<T extends ManifestoDomainShape> {
  readonly getIntentBlockersFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => readonly DispatchBlocker[];
  readonly validateIntentInputFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => ManifestoError | null;
  readonly evaluateIntentLegalityFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => IntentLegalityEvaluation<T>;
  readonly deriveIntentAdmission: (
    snapshot: CanonicalSnapshot<T["state"]>,
    legality: IntentLegalityEvaluation<T>,
  ) => IntentAdmission<T>;
  readonly explainIntentFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => IntentExplanation<T>;
  readonly createUnavailableError: (intent: TypedIntent<T>) => ManifestoError;
  readonly createNotDispatchableError: (intent: TypedIntent<T>) => ManifestoError;
  readonly rejectInvalidInput: (intent: TypedIntent<T>, message: string) => never;
  readonly rejectUnavailable: (intent: TypedIntent<T>) => never;
  readonly rejectNotDispatchable: (intent: TypedIntent<T>) => never;
}

export type PublishedRuntimeSnapshot<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly publishedSnapshot: Snapshot<T["state"]>;
  readonly publishedCanonicalSnapshot: CanonicalSnapshot<T["state"]>;
};

export interface RuntimePublicationHelpers<T extends ManifestoDomainShape> {
  readonly replaceVisibleSnapshot: RuntimeStateStore<T>["setVisibleSnapshot"];
  readonly restoreVisibleSnapshot: RuntimeStateStore<T>["restoreVisibleSnapshot"];
  readonly publishCompletedHostResult: (
    intent: TypedIntent<T>,
    snapshot: CoreSnapshot,
  ) => PublishedRuntimeSnapshot<T>;
  readonly publishFailedHostResult: (
    intent: TypedIntent<T>,
    error: Error,
    snapshot: CoreSnapshot,
  ) => PublishedRuntimeSnapshot<T>;
}
