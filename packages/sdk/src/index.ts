/**
 * @manifesto-ai/sdk v2.0.0
 *
 * Protocol-first SDK — thin composition layer over the Manifesto protocol stack.
 * The SDK owns one concept: createManifesto() and exposes only a narrow
 * pass-through World surface for callers that opt into explicit governed
 * composition.
 *
 * @see sdk-SPEC-v2.0.0.md
 * @see ADR-010
 * @packageDocumentation
 */

export type { SdkManifest } from "./manifest.js";

// =============================================================================
// SDK-Owned Exports
// =============================================================================

export { createManifesto } from "./create-manifesto.js";
export { dispatchAsync, DispatchRejectedError } from "./dispatch-async.js";

export type {
  Snapshot,
  ManifestoInstance,
  ManifestoConfig,
  ManifestoEvent,
  ManifestoEventMap,
  ManifestoEventPayload,
  EffectContext,
  EffectHandler,
  Selector,
  Unsubscribe,
} from "./types.js";

export {
  ManifestoError,
  ReservedEffectError,
  DisposedError,
  CompileError,
} from "./errors.js";

export type { CompileDiagnostic } from "./errors.js";

// =============================================================================
// Typed Patch Operations (SDK-owned utility)
// =============================================================================

export { defineOps } from "./typed-ops.js";
export type { TypedOps, DataPaths, ValueAt, ObjectPaths } from "./typed-ops.js";

// =============================================================================
// Protocol Re-exports — @manifesto-ai/core (SDK-REEXPORT-1)
// =============================================================================

export type {
  DomainSchema,
  Snapshot as CoreSnapshot,
  Patch,
  SetPatch,
  UnsetPatch,
  MergePatch,
  Intent,
  ComputeResult,
  Requirement,
  ErrorValue,
  TraceGraph,
} from "@manifesto-ai/core";

export { createIntent, createSnapshot, createCore } from "@manifesto-ai/core";

// =============================================================================
// Protocol Re-exports — @manifesto-ai/host (SDK-REEXPORT-1)
// =============================================================================

export type { HostResult, HostOptions } from "@manifesto-ai/host";

// =============================================================================
// Protocol Re-exports — @manifesto-ai/world (SDK-REEXPORT-1)
// =============================================================================

export type {
  CoordinatorSealGenesisParams,
  CoordinatorSealNextParams,
  ExecuteApprovedProposalInput,
  GovernedWorldStore,
  GovernanceEventDispatcher,
  RecoveredWorldRuntimeCompletion,
  ResumeExecutingProposalInput,
  SealResult,
  SealedWorldRuntimeCompletion,
  WorldStoreTransaction,
  WorldConfig,
  WorldCoordinator,
  WorldExecutionOptions,
  WorldExecutionResult,
  WorldExecutor,
  WorldInstance,
  WorldRuntimeCompletion,
  WorldRuntime,
} from "@manifesto-ai/world";
export { createWorld } from "@manifesto-ai/world";
