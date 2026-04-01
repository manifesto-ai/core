/**
 * @manifesto-ai/sdk v3.0.0
 *
 * SDK hard cut around the activation boundary.
 *
 * @see sdk-SPEC-v3.0.0-draft.md
 * @see ADR-017
 * @packageDocumentation
 */

export type { SdkManifest } from "./manifest.js";

export { createManifesto } from "./create-manifesto.js";

export type {
  ActivatedInstance,
  ActionArgs,
  BaseLaws,
  ComposableManifesto,
  ComputedRef,
  EffectContext,
  EffectHandler,
  FieldRef,
  GovernanceInstance,
  GovernanceLaws,
  LineageInstance,
  LineageLaws,
  ManifestoBaseInstance,
  ManifestoDomainShape,
  ManifestoEvent,
  ManifestoEventMap,
  ManifestoEventPayload,
  Selector,
  Snapshot,
  TypedActionRef,
  TypedCreateIntent,
  TypedDispatchAsync,
  TypedMEL,
  TypedOn,
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
