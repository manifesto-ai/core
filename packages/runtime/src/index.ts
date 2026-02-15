/**
 * @manifesto-ai/runtime v0.1.0
 *
 * Internal execution orchestration engine for the Manifesto protocol stack.
 *
 * @see runtime-SPEC-v0.1.0.md
 * @packageDocumentation
 */
export type { RuntimeManifest } from './manifest.js';

// =============================================================================
// Types
// =============================================================================

export type {
  // App Status
  AppStatus,
  RuntimeKind,
  Unsubscribe,

  // Action Phase
  ActionPhase,

  // Action Results
  ActionResult,
  CompletedActionResult,
  RejectedActionResult,
  FailedActionResult,
  PreparationFailedActionResult,
  ExecutionStats,

  // Action Update
  ActionUpdate,
  ActionUpdateDetail,

  // Options
  ActorPolicyConfig,
  SystemActionsConfig,
  DisposeOptions,
  DoneOptions,
  ActOptions,
  ForkOptions,
  SessionOptions,
  SubscribeOptions,
  LineageOptions,

  // State
  AppState,
  SystemState,
  SnapshotMeta,

  // Memory
  MemoryHubConfig,
  BackfillConfig,
  RecallRequest,
  RecallResult,
  MemoryMaintenanceOptions,

  // Migration
  MigrationLink,
  MigrationContext,
  MigrationFn,

  // Interfaces
  App,
  ActionHandle,
  Branch,
  Session,
  MemoryFacade,
  SystemFacade,
  SystemMemoryFacade,
  Hookable,
  HookContext,
  EnqueueOptions,
  EnqueuedJob,

  // Plugins
  AppPlugin,

  // Hook Events
  AppHooks,

  // Memory Provider
  MemoryProvider,
  MemoryVerifier,
  MemoryIngestEntry,
  MemorySelectionView,
  ProveResult,

  // Requirement
  Requirement,

  // v2.0.0 Types
  AppConfig,
  AppRef,
  Proposal,
  ProposalResult,
  ExecutionKey,
  ExecutionKeyPolicy,
  ProposalId,
  ActorId,
  BranchId,
  ApprovedScope,
  AuthorityDecision,
  HostExecutor,
  HostExecutionOptions,
  HostExecutionResult,
  WorldStore,
  WorldDelta,
  PersistedBranchEntry,
  PersistedBranchState,
  PolicyService,
  ArtifactRef,
  Intent,
  Host,
  HostResult,
  HostEffectHandler,
  HostEffectContext,
  SchemaCompatibilityResult,
  MemoryStore,
  StoredMemoryRecord,
  MemoryRecordInput,
  MemoryFilter,
  World,
  WorldId,
  Snapshot,
  Patch,
  WorldHead,

  // v2.2.0 Effects-first API
  Effects,
  AppEffectContext,
  EffectHandler,

  // ErrorValue
  ErrorValue,

  // MelText
  MelText,

  // Internal types (exposed for app tests)
  ValidationResult,
  SelectionResult,
  SelectedMemory,
} from "./types/index.js";

// Additional types from sub-modules
export type {
  WorldEntry,
  WorldStoreOptions,
  CompactOptions,
  CompactResult,
  RestoreHostContext,
} from "./storage/world-store/index.js";

export type {
  AppHostExecutorOptions,
  ExecutionContext,
} from "./execution/host-executor/index.js";

export type {
  AuthorityHandler,
  ScopeValidator,
  ResultScopeValidator,
  DefaultPolicyServiceOptions,
} from "./policy/index.js";

export type {
  AppInputNamespace,
  AppExecutionContext,
} from "./memory/index.js";

export type {
  AppRefCallbacks,
} from "./hooks/index.js";

// =============================================================================
// Errors
// =============================================================================

export {
  // Base
  ManifestoAppError,

  // Lifecycle
  AppNotReadyError,
  AppDisposedError,

  // Action
  ActionRejectedError,
  ActionFailedError,
  ActionPreparationError,
  ActionTimeoutError,
  ActionNotFoundError,
  HandleDetachedError,

  // Hook
  HookMutationError,

  // Effects
  ReservedEffectTypeError,

  // System
  SystemActionDisabledError,
  SystemActionRoutingError,

  // Memory
  MemoryDisabledError,

  // Branch/World
  BranchNotFoundError,
  WorldNotFoundError,
  WorldSchemaHashMismatchError,
  WorldNotInLineageError,

  // Other
  ReservedNamespaceError,
  MissingDefaultActorError,
  DomainCompileError,
  PluginInitError,

  // Resume & Recovery
  SchemaMismatchOnResumeError,
  BranchHeadNotFoundError,
} from "./errors/index.js";

// =============================================================================
// Schema Utilities
// =============================================================================

export { withPlatformNamespaces } from "./schema/index.js";

// =============================================================================
// State Utilities
// =============================================================================

export {
  normalizeSnapshot,
  withDxAliases,
  createInitialAppState,
  snapshotToAppState,
  appStateToSnapshot,
} from "./state/index.js";

// =============================================================================
// Memory
// =============================================================================

export {
  NoneVerifier,
  MemoryHub,
  createMemoryHub,
  EnabledMemoryFacade,
  DisabledMemoryFacade,
  createMemoryFacade,
} from "./memory/index.js";

// Memory Context Freezing
export {
  freezeMemoryContext,
  markMemoryRecallFailed,
  getMemoryContext,
  wasMemoryRecallFailed,
  hasMemoryContext,
  freezeRecallResult,
  getFrozenRecallResult,
  clearAppNamespace,
} from "./memory/index.js";

// =============================================================================
// Constants
// =============================================================================

export { SYSTEM_ACTION_TYPES } from "./constants.js";

// =============================================================================
// WorldStore
// =============================================================================

export {
  InMemoryWorldStore,
  WorldNotFoundError as WorldStoreNotFoundError,
  createInMemoryWorldStore,
  RESTORE_CONTEXT,
} from "./storage/world-store/index.js";

// =============================================================================
// HostExecutor
// =============================================================================

export {
  AppHostExecutor,
  ExecutionTimeoutError,
  ExecutionAbortedError,
  createAppHostExecutor,
} from "./execution/host-executor/index.js";

// =============================================================================
// PolicyService
// =============================================================================

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
} from "./policy/index.js";

// =============================================================================
// Schema Compatibility
// =============================================================================

export {
  validateSchemaCompatibility,
  validateSchemaCompatibilityWithEffects,
  extractEffectTypes,
  SchemaIncompatibleError,
} from "./storage/branch/index.js";

// =============================================================================
// Hooks
// =============================================================================

export {
  AppRefImpl,
  createAppRef,
} from "./hooks/index.js";

// =============================================================================
// Internal Components (for SDK)
// =============================================================================

export { AppRuntime } from "./app-runtime.js";
export type { AppRuntimeDeps } from "./app-runtime.js";
export { AppBootstrap } from "./bootstrap/index.js";
export type { AppBootstrapDeps } from "./bootstrap/index.js";
export { SubscriptionStore } from "./subscription/index.js";
export { BranchManager } from "./storage/branch/index.js";
export { createSchemaManager } from "./schema/index.js";
export type { SchemaManager } from "./schema/index.js";
export { createLifecycleManager } from "./lifecycle/index.js";
export type { LifecycleManager } from "./lifecycle/index.js";
export { createWorldHeadTracker } from "./storage/world/index.js";
export type { WorldHeadTracker } from "./storage/world/index.js";
export {
  createActionQueue,
  createLivenessGuard,
  createProposalManager,
} from "./execution/index.js";
export type {
  ActionQueue,
  LivenessGuard,
  ProposalManager,
} from "./execution/index.js";
export { SystemRuntime, createSystemFacade } from "./system/index.js";
export { SessionImpl } from "./session/index.js";
export { RESERVED_EFFECT_TYPE, RESERVED_NAMESPACE_PREFIX } from "./constants.js";
export { executeSystemGet } from "./execution/system-get.js";
