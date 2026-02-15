/**
 * @manifesto-ai/app
 *
 * Facade and orchestration layer over the Manifesto protocol stack.
 * Re-exports from @manifesto-ai/runtime and @manifesto-ai/sdk.
 *
 * @packageDocumentation
 * @module @manifesto-ai/app
 * @version 2.0.0
 */

// =============================================================================
// Types (from @manifesto-ai/runtime)
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
  EffectHandler as AppEffectHandler,

  // Internal types (exposed for tests)
  ValidationResult,
  SelectionResult,
  SelectedMemory,
} from "@manifesto-ai/runtime";

// =============================================================================
// Errors (from @manifesto-ai/runtime)
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

  // Resume & Recovery (SPEC v2.0.5)
  SchemaMismatchOnResumeError,
  BranchHeadNotFoundError,
} from "@manifesto-ai/runtime";

// =============================================================================
// Factory (from @manifesto-ai/sdk)
// =============================================================================

export { createApp } from "@manifesto-ai/sdk";

// =============================================================================
// Schema Utilities (from @manifesto-ai/runtime)
// =============================================================================

export { withPlatformNamespaces } from "@manifesto-ai/runtime";

// =============================================================================
// State Utilities (from @manifesto-ai/runtime)
// =============================================================================

export {
  normalizeSnapshot,
  withDxAliases,
  createInitialAppState,
  snapshotToAppState,
  appStateToSnapshot,
} from "@manifesto-ai/runtime";

// =============================================================================
// Memory (from @manifesto-ai/runtime)
// =============================================================================

export {
  NoneVerifier,
  MemoryHub,
  createMemoryHub,
  EnabledMemoryFacade,
  DisabledMemoryFacade,
  createMemoryFacade,
} from "@manifesto-ai/runtime";

// =============================================================================
// Constants (from @manifesto-ai/runtime)
// =============================================================================

export {
  SYSTEM_ACTION_TYPES,
  RESERVED_EFFECT_TYPE,
  RESERVED_NAMESPACE_PREFIX,
  executeSystemGet,
} from "@manifesto-ai/runtime";

// =============================================================================
// v2.0.0 Components (from @manifesto-ai/runtime)
// =============================================================================

// WorldStore
export {
  InMemoryWorldStore,
  WorldNotFoundError as WorldStoreNotFoundError,
  createInMemoryWorldStore,
  RESTORE_CONTEXT,
} from "@manifesto-ai/runtime";
export type {
  WorldEntry,
  WorldStoreOptions,
  CompactOptions,
  CompactResult,
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
} from "@manifesto-ai/runtime";
export type {
  AppInputNamespace,
  AppExecutionContext,
} from "@manifesto-ai/runtime";

// AppRef (Hook Enhancement) - from @manifesto-ai/sdk
export {
  AppRefImpl,
  createAppRef,
} from "@manifesto-ai/sdk";
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

// Test Helper (from @manifesto-ai/sdk)
export { createTestApp } from "@manifesto-ai/sdk";
