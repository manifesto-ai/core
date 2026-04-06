/**
 * @manifesto-ai/sdk v3.0.0
 *
 * SDK hard cut around the activation boundary.
 *
 * @see sdk-SPEC.md
 * @see ADR-017
 * @packageDocumentation
 */

export type { SdkManifest } from "./manifest.js";

export { createManifesto } from "./create-manifesto.js";

export type {
  ActivatedInstance,
  ActionArgs,
  CreateIntentArgs,
  ActionObjectBindingArgs,
  TypedActionMetadata,
  TypedGetActionMetadata,
  BaseLaws,
  BaseComposableLaws,
  CanonicalPlatformNamespaces,
  CanonicalSnapshot,
  ComposableManifesto,
  ComputedRef,
  EffectContext,
  EffectHandler,
  FieldRef,
  GovernedComposableLaws,
  GovernanceLaws,
  LineageComposableLaws,
  LineageLaws,
  ManifestoBaseInstance,
  ManifestoDecoratedRuntimeByLaws,
  ManifestoDomainShape,
  ManifestoEvent,
  ManifestoEventMap,
  ManifestoEventPayload,
  ManifestoRuntimeByLaws,
  Selector,
  SimulateResult,
  SchemaGraph,
  SchemaGraphEdge,
  SchemaGraphEdgeRelation,
  SchemaGraphNode,
  SchemaGraphNodeId,
  SchemaGraphNodeKind,
  SchemaGraphNodeRef,
  Snapshot,
  TypedActionRef,
  TypedCommitAsync,
  TypedCreateIntent,
  TypedDispatchAsync,
  TypedIntent,
  TypedMEL,
  TypedOn,
  TypedSimulate,
  TypedSubscribe,
  Unsubscribe,
} from "./types.js";

export {
  AlreadyActivatedError,
  CompileError,
  DisposedError,
  ManifestoError,
  ReservedEffectError,
} from "./errors.js";

export type { CompileDiagnostic } from "./errors.js";

export type {
  DomainSchema,
  Intent,
  Patch,
  Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";

export { createSnapshot } from "@manifesto-ai/core";
