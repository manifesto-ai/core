import type {
  ComputeStatus,
  DomainSchema,
  Patch,
  Requirement,
} from "@manifesto-ai/core";

import type {
  CanonicalSnapshot,
  CreateIntentArgs,
  IntentExplanation,
  ManifestoDomainShape,
  SimulationDiagnostics,
  Snapshot,
  TypedActionRef,
  TypedCreateIntent,
  TypedIntent,
  TypedMEL,
} from "./types.js";

export type ExtensionSimulateResult<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly snapshot: CanonicalSnapshot<T["state"]>;
  readonly patches: readonly Patch[];
  readonly requirements: readonly Requirement[];
  readonly status: ComputeStatus;
  readonly diagnostics?: SimulationDiagnostics;
};

export interface ExtensionKernel<T extends ManifestoDomainShape> {
  readonly MEL: TypedMEL<T>;
  readonly schema: DomainSchema;

  readonly createIntent: TypedCreateIntent<T>;
  readonly getCanonicalSnapshot: () => CanonicalSnapshot<T["state"]>;

  readonly projectSnapshot: (
    snapshot: CanonicalSnapshot<T["state"]>,
  ) => Snapshot<T["state"]>;

  readonly simulateSync: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => ExtensionSimulateResult<T>;

  readonly getAvailableActionsFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
  ) => readonly (keyof T["actions"])[];

  readonly isActionAvailableFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    actionName: keyof T["actions"],
  ) => boolean;

  readonly isIntentDispatchableFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => boolean;

  readonly explainIntentFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => IntentExplanation<T>;
}

export type SimulationSessionStatus = ComputeStatus | "idle" | "computing";

export type SimulationActionRef<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = TypedActionRef<T, keyof T["actions"]>;

export type SimulationSessionStep<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly intent: TypedIntent<T>;
  readonly snapshot: Snapshot<T["state"]>;
  readonly canonicalSnapshot: CanonicalSnapshot<T["state"]>;
  readonly availableActions: readonly SimulationActionRef<T>[];
  readonly requirements: readonly Requirement[];
  readonly status: ComputeStatus;
  readonly isTerminal: boolean;
};

export type SimulationSessionResult<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly snapshot: Snapshot<T["state"]>;
  readonly canonicalSnapshot: CanonicalSnapshot<T["state"]>;
  readonly depth: number;
  readonly trajectory: readonly SimulationSessionStep<T>[];
  readonly availableActions: readonly SimulationActionRef<T>[];
  readonly requirements: readonly Requirement[];
  readonly status: SimulationSessionStatus;
  readonly isTerminal: boolean;
};

export interface SimulationSession<T extends ManifestoDomainShape> {
  readonly snapshot: Snapshot<T["state"]>;
  readonly canonicalSnapshot: CanonicalSnapshot<T["state"]>;
  readonly depth: number;
  readonly trajectory: readonly SimulationSessionStep<T>[];
  readonly availableActions: readonly SimulationActionRef<T>[];
  readonly requirements: readonly Requirement[];
  readonly status: SimulationSessionStatus;
  readonly isTerminal: boolean;

  next<K extends keyof T["actions"]>(
    action: TypedActionRef<T, K>,
    ...args: CreateIntentArgs<T, K>
  ): SimulationSession<T>;

  next(intent: TypedIntent<T>): SimulationSession<T>;

  finish(): SimulationSessionResult<T>;
}
