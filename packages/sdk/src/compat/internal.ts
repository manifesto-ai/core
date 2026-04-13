import {
  type ComputeStatus,
  type DomainSchema,
  type Patch,
  type Requirement,
  type Snapshot as CoreSnapshot,
  type SystemDelta,
} from "@manifesto-ai/core";
import type {
  HostContextProvider,
  HostResult,
  ManifestoHost,
} from "@manifesto-ai/host";

import {
  AlreadyActivatedError,
  ManifestoError,
} from "../errors.js";
import type {
  BaseLaws,
  CanonicalSnapshot,
  ComposableManifesto,
  DispatchBlocker,
  ExecutionDiagnostics,
  ExecutionFailureInfo,
  ExecutionOutcome,
  IntentAdmission,
  ManifestoDomainShape,
  ManifestoEvent,
  ManifestoEventMap,
  SchemaGraph,
  SimulateResult as ProjectedSimulateResult,
  Snapshot,
  TypedActionMetadata,
  TypedCreateIntent,
  TypedGetActionMetadata,
  TypedGetIntentBlockers,
  TypedIntent,
  TypedIsIntentDispatchable,
  TypedMEL,
  TypedOn,
  TypedSimulate,
  TypedSubscribe,
} from "../types.js";
import type {
  SnapshotProjectionPlan,
} from "../projection/snapshot-projection.js";
import type {
  ExtensionKernel,
} from "../extensions-types.js";
import type {
  IntentLegalityEvaluation,
} from "../runtime/facets.js";
import {
  ACTION_PARAM_NAMES,
  ACTION_SINGLE_PARAM_OBJECT_VALUE,
  ACTIVATION_STATE,
  EXTENSION_KERNEL,
  RUNTIME_KERNEL_FACTORY,
  type ActivationState,
} from "./runtime-symbols.js";

export {
  ACTION_PARAM_NAMES,
  ACTION_SINGLE_PARAM_OBJECT_VALUE,
  ACTIVATION_STATE,
  EXTENSION_KERNEL,
  RUNTIME_KERNEL_FACTORY,
  type ActivationState,
} from "./runtime-symbols.js";

export type HostDispatchOptions = NonNullable<Parameters<ManifestoHost["dispatch"]>[1]>;

export type SimulateResult<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly snapshot: CanonicalSnapshot<T["state"]>;
  readonly patches: readonly Patch[];
  readonly systemDelta: Readonly<SystemDelta>;
  readonly status: ComputeStatus;
  readonly requirements: readonly Requirement[];
};

export interface RuntimeKernel<T extends ManifestoDomainShape> {
  readonly schema: DomainSchema;
  readonly MEL: TypedMEL<T>;
  readonly createIntent: TypedCreateIntent<T>;
  readonly subscribe: TypedSubscribe<T>;
  readonly on: TypedOn<T>;
  readonly getSnapshot: () => Snapshot<T["state"]>;
  readonly getCanonicalSnapshot: () => CanonicalSnapshot<T["state"]>;
  readonly getAvailableActionsFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
  ) => readonly (keyof T["actions"])[];
  readonly getAvailableActions: () => readonly (keyof T["actions"])[];
  readonly getIntentBlockersFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => readonly DispatchBlocker[];
  readonly getActionMetadata: TypedGetActionMetadata<T>;
  readonly isActionAvailableFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    name: keyof T["actions"],
  ) => boolean;
  readonly isActionAvailable: (name: keyof T["actions"]) => boolean;
  readonly isIntentDispatchableFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => boolean;
  readonly isIntentDispatchable: TypedIsIntentDispatchable<T>;
  readonly getIntentBlockers: TypedGetIntentBlockers<T>;
  readonly getSchemaGraph: () => SchemaGraph;
  readonly simulateSync: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => SimulateResult<T>;
  readonly simulate: TypedSimulate<T>;
  readonly dispose: () => void;
  readonly isDisposed: () => boolean;
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
  readonly ensureIntentId: (intent: TypedIntent<T>) => TypedIntent<T>;
  readonly executeHost: (
    intent: TypedIntent<T>,
    options?: HostDispatchOptions,
  ) => Promise<HostResult>;
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
  readonly deriveExecutionOutcome: (
    beforeSnapshot: CanonicalSnapshot<T["state"]>,
    afterSnapshot: CanonicalSnapshot<T["state"]>,
  ) => ExecutionOutcome<T>;
  readonly classifyExecutionFailure: (
    error: unknown,
    stage: "host" | "seal",
  ) => ExecutionFailureInfo;
  readonly createExecutionDiagnostics: (
    result: HostResult,
  ) => ExecutionDiagnostics;
  readonly createUnavailableError: (intent: TypedIntent<T>) => ManifestoError;
  readonly createNotDispatchableError: (intent: TypedIntent<T>) => ManifestoError;
  readonly rejectInvalidInput: (intent: TypedIntent<T>, message: string) => never;
  readonly rejectUnavailable: (intent: TypedIntent<T>) => never;
  readonly rejectNotDispatchable: (intent: TypedIntent<T>) => never;
  readonly [EXTENSION_KERNEL]: ExtensionKernel<T>;
}

type RuntimePublicReadFacet<T extends ManifestoDomainShape> = Pick<
  RuntimeKernel<T>,
  | "schema"
  | "MEL"
  | "createIntent"
  | "subscribe"
  | "on"
  | "getSnapshot"
  | "getCanonicalSnapshot"
  | "getAvailableActions"
  | "isIntentDispatchable"
  | "getIntentBlockers"
  | "getActionMetadata"
  | "isActionAvailable"
  | "getSchemaGraph"
  | "simulate"
>;

type RuntimeLifecycleFacet<T extends ManifestoDomainShape> = Pick<
  RuntimeKernel<T>,
  "dispose" | "isDisposed" | "enqueue"
>;

type RuntimeExecutionFacet<T extends ManifestoDomainShape> = Pick<
  RuntimeKernel<T>,
  "ensureIntentId" | "executeHost"
>;

type RuntimeSealAdmissionFacet<T extends ManifestoDomainShape> = Pick<
  RuntimeKernel<T>,
  | "isActionAvailable"
  | "validateIntentInputFor"
  | "isIntentDispatchableFor"
  | "rejectUnavailable"
  | "rejectInvalidInput"
  | "rejectNotDispatchable"
>;

type RuntimeReportAdmissionFacet<T extends ManifestoDomainShape> = Pick<
  RuntimeKernel<T>,
  | "evaluateIntentLegalityFor"
  | "deriveIntentAdmission"
  | "createUnavailableError"
  | "createNotDispatchableError"
>;

type RuntimePublicationFacet<T extends ManifestoDomainShape> = Pick<
  RuntimeKernel<T>,
  "getVisibleCoreSnapshot" | "setVisibleSnapshot" | "restoreVisibleSnapshot"
>;

type RuntimeReportingFacet<T extends ManifestoDomainShape> = Pick<
  RuntimeKernel<T>,
  | "deriveExecutionOutcome"
  | "classifyExecutionFailure"
  | "createExecutionDiagnostics"
>;

type RuntimeDispatchEventsFacet<T extends ManifestoDomainShape> = Pick<
  RuntimeKernel<T>,
  "emitEvent"
>;

type RuntimeExtensionFacet<T extends ManifestoDomainShape> = Pick<
  RuntimeKernel<T>,
  typeof EXTENSION_KERNEL
>;

export type LineageRuntimeKernel<T extends ManifestoDomainShape> =
  & RuntimePublicReadFacet<T>
  & RuntimeLifecycleFacet<T>
  & RuntimeExecutionFacet<T>
  & RuntimeSealAdmissionFacet<T>
  & RuntimeReportAdmissionFacet<T>
  & RuntimePublicationFacet<T>
  & RuntimeReportingFacet<T>
  & RuntimeDispatchEventsFacet<T>
  & RuntimeExtensionFacet<T>;

export type LineageRuntimeKernelFactory<T extends ManifestoDomainShape> =
  () => LineageRuntimeKernel<T>;

export type GovernanceRuntimeKernel<T extends ManifestoDomainShape> =
  & RuntimePublicReadFacet<T>
  & RuntimeLifecycleFacet<T>
  & RuntimeExecutionFacet<T>
  & RuntimeSealAdmissionFacet<T>
  & RuntimePublicationFacet<T>
  & Pick<RuntimeKernel<T>, "deriveExecutionOutcome">
  & RuntimeDispatchEventsFacet<T>
  & RuntimeExtensionFacet<T>;

export type GovernanceRuntimeKernelFactory<T extends ManifestoDomainShape> =
  () => GovernanceRuntimeKernel<T>;

export type WaitForProposalRuntimeKernel<T extends ManifestoDomainShape> = Pick<
  RuntimeKernel<T>,
  "isDisposed" | "deriveExecutionOutcome"
>;

export type RuntimeKernelFactory<T extends ManifestoDomainShape> = () => RuntimeKernel<T>;

export type InternalComposableManifesto<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
> = ComposableManifesto<T, Laws> & {
  readonly [RUNTIME_KERNEL_FACTORY]: RuntimeKernelFactory<T>;
  readonly [ACTIVATION_STATE]: ActivationState;
};

type ExtensionKernelCarrier<T extends ManifestoDomainShape> = {
  readonly [EXTENSION_KERNEL]: ExtensionKernel<T>;
};

export type RuntimeKernelOptions<T extends ManifestoDomainShape> = {
  readonly schema: DomainSchema;
  readonly projectionPlan: SnapshotProjectionPlan;
  readonly host: ManifestoHost;
  readonly hostContextProvider: HostContextProvider;
  readonly MEL: TypedMEL<T>;
  readonly createIntent: TypedCreateIntent<T>;
};

export function attachRuntimeKernelFactory<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
  factory: RuntimeKernelFactory<T>,
  activationState?: ActivationState,
): InternalComposableManifesto<T, Laws> {
  Object.defineProperty(manifesto, RUNTIME_KERNEL_FACTORY, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: factory,
  });

  const state = activationState ?? getExistingActivationState(manifesto) ?? {
    activated: false,
  };

  if (!getExistingActivationState(manifesto)) {
    Object.defineProperty(manifesto, ACTIVATION_STATE, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: state,
    });
  }

  return manifesto as InternalComposableManifesto<T, Laws>;
}

export function getRuntimeKernelFactory<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
): RuntimeKernelFactory<T> {
  const internal = manifesto as Partial<InternalComposableManifesto<T, Laws>>;
  const factory = internal[RUNTIME_KERNEL_FACTORY];

  if (typeof factory !== "function") {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "ComposableManifesto is missing its runtime kernel factory",
    );
  }

  return factory;
}

export function attachExtensionKernel<
  T extends ManifestoDomainShape,
  TInstance extends object,
>(
  runtime: TInstance,
  kernel: RuntimeExtensionFacet<T>,
): TInstance {
  Object.defineProperty(runtime, EXTENSION_KERNEL, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: kernel[EXTENSION_KERNEL],
  });

  return runtime;
}

export function getAttachedExtensionKernel<T extends ManifestoDomainShape>(
  runtime: object,
): ExtensionKernel<T> {
  const internal = runtime as Partial<ExtensionKernelCarrier<T>>;
  const kernel = internal[EXTENSION_KERNEL];

  if (!kernel) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "Activated runtime is missing its extension kernel",
    );
  }

  return kernel;
}

export function getActivationState<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
): ActivationState {
  const internal = manifesto as Partial<InternalComposableManifesto<T, Laws>>;
  const state = internal[ACTIVATION_STATE];

  if (!state) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "ComposableManifesto is missing its activation state",
    );
  }

  return state;
}

export function assertComposableNotActivated<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
): void {
  if (getActivationState(manifesto).activated) {
    throw new AlreadyActivatedError();
  }
}

export function activateComposable<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
): void {
  const state = getActivationState(manifesto);
  if (state.activated) {
    throw new AlreadyActivatedError();
  }
  state.activated = true;
}

function getExistingActivationState<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
): ActivationState | null {
  const internal = manifesto as Partial<InternalComposableManifesto<T, Laws>>;
  return internal[ACTIVATION_STATE] ?? null;
}

export { createRuntimeKernel } from "../runtime/kernel.js";
