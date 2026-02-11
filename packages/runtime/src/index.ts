/**
 * @manifesto-ai/runtime
 *
 * Execution integration layer: Host ↔ World pipeline, publish boundary,
 * policy, telemetry, hooks, sessions, memory, and storage.
 *
 * @packageDocumentation
 * @module @manifesto-ai/runtime
 * @version 0.1.0
 */

// =============================================================================
// Bootstrap
// =============================================================================

export { AppBootstrap } from "./bootstrap/index.js";
export type { AppBootstrapDeps } from "./bootstrap/index.js";
export { assembleComponents } from "./bootstrap/component-assembler.js";
export type {
  AssemblyInput,
  RuntimeBinder,
  AssembledComponents,
} from "./bootstrap/component-assembler.js";

// =============================================================================
// Core — Lifecycle & Schema
// =============================================================================

export {
  LifecycleManagerImpl,
  createLifecycleManager,
} from "./core/lifecycle/index.js";
export type {
  LifecycleManager,
  ContextInfo,
} from "./core/lifecycle/index.js";

export {
  SchemaManagerImpl,
  createSchemaManager,
  withPlatformNamespaces,
} from "./core/schema/index.js";
export type { SchemaManager } from "./core/schema/index.js";

// =============================================================================
// Execution
// =============================================================================

export {
  mapHostResultToActionResult,
  hostErrorToErrorValue,
  errorToErrorValue,
  calculateStats,
  extractSnapshotError,
  snapshotToAppState,
  appStateToSnapshot,
  computePatches,
  computeSnapshotHash,
  ActionQueueImpl,
  createActionQueue,
  LivenessGuardImpl,
  createLivenessGuard,
  AppExecutorImpl,
  createAppExecutor,
  SystemActionExecutorImpl,
  createSystemActionExecutor,
  executeSystemGet,
} from "./execution/index.js";
export { normalizeSnapshot } from "./execution/state-converter.js";
export type {
  MapResultOptions,
  ActionJob,
  ActionQueue,
  LivenessGuard,
  AppExecutorDependencies,
  AppExecutor,
  SystemActionExecutorDeps,
  SystemActionExecutor,
} from "./execution/index.js";

// Action
export * from "./execution/action/index.js";

// Host Executor
export {
  AppHostExecutor,
  ExecutionTimeoutError,
  ExecutionAbortedError,
  createAppHostExecutor,
} from "./execution/host-executor/index.js";
export type {
  AppHostExecutorOptions,
  ExecutionContext,
} from "./execution/host-executor/index.js";

// Initializer
export * from "./execution/initializer/index.js";

// Pipeline
export * from "./execution/pipeline/index.js";

// Proposal
export * from "./execution/proposal/index.js";

// =============================================================================
// Hooks
// =============================================================================

export {
  HookableImpl,
  JobQueue,
  AppRefImpl,
  createAppRef,
  HookContextImpl,
  createHookContext,
} from "./hooks/index.js";
export type { AppRefCallbacks } from "./hooks/index.js";

// =============================================================================
// Runtime Services
// =============================================================================

// AppRuntime
export { AppRuntime } from "./runtime/app-runtime.js";

// Memory
export {
  NoneVerifier,
  computeVerified,
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
} from "./runtime/memory/index.js";
export type {
  MemoryFacadeContext,
  AppInputNamespace,
  AppExecutionContext,
} from "./runtime/memory/index.js";

// Policy
export {
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
  pathMatches,
  createPermissiveScope,
  createRestrictedScope,
  DefaultPolicyService,
  createDefaultPolicyService,
  createSilentPolicyService,
  createStrictPolicyService,
} from "./runtime/policy/index.js";
export type {
  AuthorityHandler,
  ScopeValidator,
  ResultScopeValidator,
  DefaultPolicyServiceOptions,
} from "./runtime/policy/index.js";

// Session
export { SessionImpl } from "./runtime/session/index.js";
export type { SessionCallbacks } from "./runtime/session/index.js";

// Subscription
export {
  SubscriptionStore,
  createSubscriptionStore,
} from "./runtime/subscription/index.js";

// System
export {
  createSystemSchema,
  createInitialSystemState,
  SystemRuntime,
  SystemFacadeImpl,
  createSystemFacade,
} from "./runtime/system/index.js";
export type {
  SystemRuntimeConfig,
  SystemExecutionContext,
} from "./runtime/system/index.js";

// =============================================================================
// Storage
// =============================================================================

export * from "./storage/index.js";

// Re-export convenience aliases
export {
  InMemoryWorldStore,
  WorldNotFoundError as WorldStoreNotFoundError,
  createInMemoryWorldStore,
  RESTORE_CONTEXT,
} from "./storage/world-store/index.js";
export type {
  WorldEntry,
  WorldStoreOptions,
  RestoreHostContext,
} from "./storage/world-store/index.js";

export {
  validateSchemaCompatibility,
  validateSchemaCompatibilityWithEffects,
  extractEffectTypes,
  SchemaIncompatibleError,
} from "./storage/branch/index.js";
