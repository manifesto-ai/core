/**
 * @manifesto-ai/app
 *
 * Facade and orchestration layer over the Manifesto protocol stack.
 *
 * @packageDocumentation
 * @module @manifesto-ai/app
 * @version 2.0.0
 */

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
  ApprovedScope,
  AuthorityDecision,
  HostExecutor,
  HostExecutionOptions,
  HostExecutionResult,
  WorldStore,
  WorldDelta,
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

  // v2.2.0 Effects-first API
  Effects,
  AppEffectContext,
  EffectHandler as AppEffectHandler,
} from "./core/types/index.js";

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
} from "./errors/index.js";

// =============================================================================
// Factory
// =============================================================================

export { createApp } from "./create-app.js";

// =============================================================================
// Schema Utilities
// =============================================================================

export { withPlatformNamespaces } from "./core/schema/index.js";

// =============================================================================
// State Utilities
// =============================================================================

export { normalizeSnapshot } from "./core/state/index.js";

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
} from "./runtime/memory/index.js";

// =============================================================================
// Constants
// =============================================================================

export { SYSTEM_ACTION_TYPES } from "./constants.js";

// =============================================================================
// v2.0.0 Components
// =============================================================================

// WorldStore
export {
  InMemoryWorldStore,
  WorldNotFoundError as WorldStoreNotFoundError,
  createInMemoryWorldStore,
  RESTORE_CONTEXT,
} from "./storage/world-store/index.js";
export type {
  WorldEntry,
  WorldStoreOptions,
  CompactOptions,
  CompactResult,
  RestoreHostContext,
} from "./storage/world-store/index.js";

// HostExecutor
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
} from "./runtime/policy/index.js";
export type {
  AuthorityHandler,
  ScopeValidator,
  ResultScopeValidator,
  DefaultPolicyServiceOptions,
} from "./runtime/policy/index.js";

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
} from "./runtime/memory/index.js";
export type {
  AppInputNamespace,
  AppExecutionContext,
} from "./runtime/memory/index.js";

// AppRef (Hook Enhancement)
export {
  AppRefImpl,
  createAppRef,
} from "./hooks/index.js";
export type {
  AppRefCallbacks,
} from "./hooks/index.js";

// Schema Compatibility
export {
  validateSchemaCompatibility,
  validateSchemaCompatibilityWithEffects,
  extractEffectTypes,
  SchemaIncompatibleError,
} from "./storage/branch/index.js";

// Test Helper
export { createTestApp } from "./create-app.js";
