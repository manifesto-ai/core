/**
 * @manifesto-ai/sdk
 *
 * Developer-facing SDK for the Manifesto protocol stack.
 * Provides the `createClient()` entry point and the `ManifestoApp` facade.
 *
 * @packageDocumentation
 * @module @manifesto-ai/sdk
 * @version 0.1.0
 */

// =============================================================================
// Re-exports from @manifesto-ai/shared (types, errors, constants, state)
// =============================================================================

export * from "@manifesto-ai/shared";

// =============================================================================
// Re-exports from @manifesto-ai/runtime (execution, storage, hooks, etc.)
// =============================================================================

// Schema Utilities
export { withPlatformNamespaces } from "@manifesto-ai/runtime";

// State Utilities
export { normalizeSnapshot } from "@manifesto-ai/runtime";

// Memory
export {
  NoneVerifier,
  MemoryHub,
  createMemoryHub,
  EnabledMemoryFacade,
  DisabledMemoryFacade,
  createMemoryFacade,
  freezeMemoryContext,
  markMemoryRecallFailed,
  getMemoryContext,
  wasMemoryRecallFailed,
  hasMemoryContext,
  freezeRecallResult,
  getFrozenRecallResult,
  clearAppNamespace,
} from "@manifesto-ai/runtime";
export type {
  AppInputNamespace,
  AppExecutionContext,
} from "@manifesto-ai/runtime";

// WorldStore
// NOTE: CompactOptions, CompactResult, WorldDelta, PersistedBranchEntry,
// PersistedBranchState 등 계약 타입은 위의 @manifesto-ai/shared blanket re-export로 제공됨.
export {
  InMemoryWorldStore,
  WorldStoreNotFoundError,
  createInMemoryWorldStore,
  RESTORE_CONTEXT,
} from "@manifesto-ai/runtime";
export type {
  WorldEntry,
  WorldStoreOptions,
  RestoreHostContext,
} from "@manifesto-ai/runtime";

// HostExecutor
export {
  AppHostExecutor,
  ExecutionTimeoutError,
  ExecutionAbortedError,
  createAppHostExecutor,
} from "@manifesto-ai/runtime";
export type {
  AppHostExecutorOptions,
  ExecutionContext,
} from "@manifesto-ai/runtime";

// PolicyService
export {
  DefaultPolicyService,
  createDefaultPolicyService,
  createSilentPolicyService,
  createStrictPolicyService,
  defaultPolicy,
  actorSerialPolicy,
  baseSerialPolicy,
  globalSerialPolicy,
  branchSerialPolicy,
  intentTypePolicy,
  builtInPolicies,
  getBuiltInPolicy,
  validateProposalScope,
  validateResultScope,
  createPermissiveScope,
  createRestrictedScope,
} from "@manifesto-ai/runtime";
export type {
  AuthorityHandler,
  ScopeValidator,
  ResultScopeValidator,
  DefaultPolicyServiceOptions,
} from "@manifesto-ai/runtime";

// AppRef (Hook Enhancement)
export {
  AppRefImpl,
  createAppRef,
} from "@manifesto-ai/runtime";
export type {
  AppRefCallbacks,
} from "@manifesto-ai/runtime";

// Schema Compatibility
export {
  validateSchemaCompatibility,
  validateSchemaCompatibilityWithEffects,
  extractEffectTypes,
  SchemaIncompatibleError,
} from "@manifesto-ai/runtime";

// Subscription
export {
  SubscriptionStore,
  createSubscriptionStore,
} from "@manifesto-ai/runtime";

// =============================================================================
// SDK-owned: Factory & Facade
// =============================================================================

export { ManifestoApp } from "./app.js";
export { createApp, createClient, createTestApp } from "./create-app.js";
