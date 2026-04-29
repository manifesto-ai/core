/**
 * @manifesto-ai/sdk
 *
 * Activation-first SDK package surface.
 *
 * @see sdk-SPEC.md
 * @see ADR-017
 * @packageDocumentation
 */

export type { SdkManifest } from "./manifest.js";

export { createManifesto } from "./create-manifesto.js";

export type {
  ActivatedInstance,
  ActionAnnotation,
  ActionArgs,
  ActionHandle,
  ActionInfo,
  ActionInput,
  ActionName,
  ActionParameterInfo,
  ActionSurface,
  Admission,
  AdmissionFailure,
  AdmissionOk,
  CreateIntentArgs,
  CreateManifestoOptions,
  BaseManifestoApp,
  BaseSubmissionResult,
  DispatchReport,
  DispatchExecutionOutcome,
  DispatchProjectedDiff,
  DispatchCanonicalOutcome,
  ActionObjectBindingArgs,
  Blocker,
  BoundAction,
  DispatchBlocker,
  AvailableActionDelta,
  TypedActionMetadata,
  TypedGetActionMetadata,
  TypedGetIntentBlockers,
  TypedIsIntentDispatchable,
  BaseLaws,
  BaseComposableLaws,
  CanonicalNamespaces,
  CanonicalSnapshot,
  ComposableManifesto,
  ComputedRef,
  EffectContext,
  EffectHandler,
  ExecutionDiagnostics,
  ExecutionFailureInfo,
  ExecutionOutcome,
  FieldRef,
  GovernedComposableLaws,
  GovernanceLaws,
  GovernanceSettlementResult,
  GovernanceSettlementSurface,
  GovernanceSubmissionResult,
  IntentAdmission,
  IntentAdmissionFailure,
  IntentExplanation,
  InvalidInputInfo,
  LineageComposableLaws,
  LineageLaws,
  LineageSubmissionResult,
  ManifestoBaseInstance,
  ManifestoApp,
  ManifestoDispatchRuntime,
  ManifestoDecoratedRuntimeByLaws,
  ManifestoDomainShape,
  ManifestoEvent,
  ManifestoEventName,
  ManifestoEventMap,
  ManifestoEventPayload,
  ManifestoEventPayloadMap,
  ManifestoLegalityRuntime,
  ManifestoRuntimeByLaws,
  Selector,
  SimulationDiagnostics,
  SimulateResult,
  ProjectedDiff,
  ProjectedSnapshot,
  PreviewOptions,
  PreviewResult,
  CanonicalOutcome,
  RuntimeMode,
  SchemaGraph,
  SchemaGraphEdge,
  SchemaGraphEdgeRelation,
  SchemaGraphNode,
  SchemaGraphNodeId,
  SchemaGraphNodeKind,
  SchemaGraphNodeRef,
  Snapshot,
  SubmissionResult,
  SubmitOptions,
  SubmitResultFor,
  TypedActionRef,
  TypedCommitAsync,
  TypedCreateIntent,
  TypedDispatchAsync,
  TypedIntent,
  TypedMEL,
  TypedOn,
  TypedSimulate,
  TypedSimulateIntent,
  TypedSubscribe,
  Unsubscribe,
} from "./types.js";

export {
  AlreadyActivatedError,
  CompileError,
  DisposedError,
  ManifestoError,
  ReservedEffectError,
  SubmissionFailedError,
} from "./errors.js";

export type { CompileDiagnostic } from "./errors.js";

export type {
  DomainSchema,
  Intent,
  Patch,
  Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";

export { createSnapshot } from "@manifesto-ai/core";
