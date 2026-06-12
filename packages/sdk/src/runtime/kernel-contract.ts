/**
 * Runtime kernel contract: the full kernel interface, its facet
 * decomposition, and the decorator-facing kernel aliases (#421).
 *
 * This file is the design home of the seam types. The facet aliases
 * (LineageRuntimeKernel, GovernanceRuntimeKernel,
 * WaitForProposalRuntimeKernel) are the primary dependency surfaces for
 * decorator and provider code; the broad RuntimeKernel aggregate exists
 * for kernel assembly and compatibility, not as the unit new code should
 * depend on. compat/internal re-exports everything here unchanged, so
 * the provider seam stays source-compatible.
 */
import {
	type ComputeStatus,
	type DomainSchema,
	type JsonValue,
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
import type { Context } from "@manifesto-ai/core";

import type {
	ActionAnnotation,
	CanonicalSnapshot,
	ContextUpdater,
	DispatchExecutionOutcome,
	DispatchBlocker,
	DomainExternalContext,
	ExternalContext,
	ExecutionDiagnostics,
	ExecutionFailureInfo,
	IntentAdmission,
	ManifestoDomainShape,
	ManifestoEvent,
	ManifestoEventPayloadMap,
	ProjectedSnapshot,
	SchemaGraph,
	SimulationDiagnostics,
	TypedCreateIntent,
	TypedDomainRefs,
	TypedGetActionMetadata,
	TypedGetIntentBlockers,
	TypedIntent,
	TypedIsIntentDispatchable,
	TypedMEL,
	TypedOn,
	TypedSimulate,
	TypedSimulateIntent,
	TypedSubscribe,
} from "../types.js";
import type { SnapshotProjectionPlan } from "../projection/snapshot-projection.js";
import type { IntentLegalityEvaluation } from "./facets.js";
import type { ManifestoError } from "../errors.js";
import type { ExtensionKernel } from "../extensions-types.js";
import { EXTENSION_KERNEL } from "../compat/runtime-symbols.js";

export type HostDispatchOptions = NonNullable<
	Parameters<ManifestoHost["dispatch"]>[1]
>;

export type SimulateResult<
	T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
	readonly snapshot: CanonicalSnapshot<T["state"]>;
	readonly patches: readonly Patch[];
	readonly systemDelta: Readonly<SystemDelta>;
	readonly status: ComputeStatus;
	readonly requirements: readonly Requirement[];
	readonly diagnostics?: SimulationDiagnostics;
};

export interface RuntimeKernel<T extends ManifestoDomainShape> {
	readonly schema: DomainSchema;
	readonly refs: TypedDomainRefs<T>;
	/** @deprecated Use refs. */
	readonly MEL: TypedMEL<T>;
	readonly createIntent: TypedCreateIntent<T>;
	readonly subscribe: TypedSubscribe<T>;
	readonly on: TypedOn<T>;
	readonly getSnapshot: () => ProjectedSnapshot<T>;
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
		options?: {
			readonly externalContext?: DomainExternalContext<T>;
			readonly context?: Context;
		},
	) => SimulateResult<T>;
	readonly simulate: TypedSimulate<T>;
	readonly simulateIntent: TypedSimulateIntent<T>;
	readonly dispose: () => void;
	readonly isDisposed: () => boolean;
	readonly getVisibleCoreSnapshot: () => CoreSnapshot;
	readonly setVisibleSnapshot: (
		snapshot: CoreSnapshot,
		options?: { readonly notify?: boolean },
	) => ProjectedSnapshot<T>;
	readonly rehydrateSnapshot: (snapshot: CoreSnapshot) => CoreSnapshot;
	readonly restoreVisibleSnapshot: () => void;
	readonly emitEvent: <K extends ManifestoEvent>(
		event: K,
		payload: ManifestoEventPayloadMap[K],
	) => void;
	readonly enqueue: <R>(task: () => Promise<R>) => Promise<R>;
	readonly ensureIntentId: (intent: TypedIntent<T>) => TypedIntent<T>;
	readonly executeHost: (
		intent: TypedIntent<T>,
		options?: HostDispatchOptions,
	) => Promise<HostResult>;
	readonly createComputeContext: (
		intent: TypedIntent<T>,
		externalContext?: ExternalContext,
	) => Context;
	readonly getExternalContext: () => DomainExternalContext<T>;
	readonly replaceExternalContext: (
		next: DomainExternalContext<T>,
	) => DomainExternalContext<T>;
	readonly updateExternalContext: (
		updater: ContextUpdater<DomainExternalContext<T>>,
	) => DomainExternalContext<T>;
	readonly captureExternalContext: (
		override?: ExternalContext,
	) => DomainExternalContext<T>;
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
	) => DispatchExecutionOutcome<T>;
	readonly classifyExecutionFailure: (
		error: unknown,
		stage: "host" | "seal",
	) => ExecutionFailureInfo;
	readonly createExecutionDiagnostics: (
		result: HostResult,
	) => ExecutionDiagnostics;
	readonly createUnavailableError: (intent: TypedIntent<T>) => ManifestoError;
	readonly createNotDispatchableError: (
		intent: TypedIntent<T>,
	) => ManifestoError;
	readonly rejectInvalidInput: (
		intent: TypedIntent<T>,
		message: string,
	) => never;
	readonly rejectUnavailable: (intent: TypedIntent<T>) => never;
	readonly rejectNotDispatchable: (intent: TypedIntent<T>) => never;
	readonly [EXTENSION_KERNEL]: ExtensionKernel<T>;
}

export type RuntimePublicReadFacet<T extends ManifestoDomainShape> = Pick<
	RuntimeKernel<T>,
	| "schema"
	| "MEL"
	| "createIntent"
	| "subscribe"
	| "on"
	| "getSnapshot"
	| "getCanonicalSnapshot"
	| "getAvailableActionsFor"
	| "getAvailableActions"
	| "isIntentDispatchable"
	| "getIntentBlockers"
	| "getActionMetadata"
	| "isActionAvailable"
	| "getSchemaGraph"
	| "simulateSync"
	| "simulate"
	| "simulateIntent"
	| "getExternalContext"
	| "replaceExternalContext"
	| "updateExternalContext"
	| "captureExternalContext"
>;

export type RuntimeLifecycleFacet<T extends ManifestoDomainShape> = Pick<
	RuntimeKernel<T>,
	"dispose" | "isDisposed" | "enqueue"
>;

export type RuntimeExecutionFacet<T extends ManifestoDomainShape> = Pick<
	RuntimeKernel<T>,
	| "ensureIntentId"
	| "executeHost"
	| "createComputeContext"
	| "captureExternalContext"
>;

export type RuntimeSealAdmissionFacet<T extends ManifestoDomainShape> = Pick<
	RuntimeKernel<T>,
	| "isActionAvailable"
	| "isActionAvailableFor"
	| "validateIntentInputFor"
	| "isIntentDispatchableFor"
	| "rejectUnavailable"
	| "rejectInvalidInput"
	| "rejectNotDispatchable"
>;

export type RuntimeReportAdmissionFacet<T extends ManifestoDomainShape> = Pick<
	RuntimeKernel<T>,
	| "evaluateIntentLegalityFor"
	| "deriveIntentAdmission"
	| "createUnavailableError"
	| "createNotDispatchableError"
>;

export type RuntimePublicationFacet<T extends ManifestoDomainShape> = Pick<
	RuntimeKernel<T>,
	| "getVisibleCoreSnapshot"
	| "setVisibleSnapshot"
	| "rehydrateSnapshot"
	| "restoreVisibleSnapshot"
>;

export type RuntimeReportingFacet<T extends ManifestoDomainShape> = Pick<
	RuntimeKernel<T>,
	| "deriveExecutionOutcome"
	| "classifyExecutionFailure"
	| "createExecutionDiagnostics"
>;

export type RuntimeDispatchEventsFacet<T extends ManifestoDomainShape> = Pick<
	RuntimeKernel<T>,
	"emitEvent"
>;

export type RuntimeExtensionFacet<T extends ManifestoDomainShape> = Pick<
	RuntimeKernel<T>,
	typeof EXTENSION_KERNEL
>;

export type LineageRuntimeKernel<T extends ManifestoDomainShape> =
	RuntimePublicReadFacet<T> &
		RuntimeLifecycleFacet<T> &
		RuntimeExecutionFacet<T> &
		RuntimeSealAdmissionFacet<T> &
		RuntimeReportAdmissionFacet<T> &
		RuntimePublicationFacet<T> &
		RuntimeReportingFacet<T> &
		RuntimeDispatchEventsFacet<T> &
		RuntimeExtensionFacet<T>;

export type LineageRuntimeKernelFactory<T extends ManifestoDomainShape> =
	() => LineageRuntimeKernel<T>;

export type GovernanceRuntimeKernel<T extends ManifestoDomainShape> =
	RuntimePublicReadFacet<T> &
		RuntimeLifecycleFacet<T> &
		RuntimeExecutionFacet<T> &
		RuntimeSealAdmissionFacet<T> &
		RuntimeReportAdmissionFacet<T> &
		RuntimePublicationFacet<T> &
		Pick<RuntimeKernel<T>, "deriveExecutionOutcome"> &
		RuntimeDispatchEventsFacet<T> &
		RuntimeExtensionFacet<T>;

export type GovernanceRuntimeKernelFactory<T extends ManifestoDomainShape> =
	() => GovernanceRuntimeKernel<T>;

export type WaitForProposalRuntimeKernel<T extends ManifestoDomainShape> = Pick<
	RuntimeKernel<T>,
	"isDisposed" | "deriveExecutionOutcome"
>;

export type RuntimeKernelFactory<T extends ManifestoDomainShape> =
	() => RuntimeKernel<T>;

export type RuntimeKernelOptions<T extends ManifestoDomainShape> = {
	readonly schema: DomainSchema;
	readonly projectionPlan: SnapshotProjectionPlan;
	readonly actionAnnotations: Readonly<Record<string, ActionAnnotation>>;
	readonly host: ManifestoHost;
	readonly hostContextProvider: HostContextProvider;
	readonly MEL: TypedMEL<T>;
	readonly createIntent: TypedCreateIntent<T>;
	readonly initialContext?: Record<string, JsonValue>;
};
