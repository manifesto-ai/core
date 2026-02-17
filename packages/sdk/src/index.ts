/**
 * @manifesto-ai/sdk v1.0.0
 *
 * Public developer API layer for the Manifesto protocol stack.
 * Canonical entry point since Phase 2 (ADR-008).
 *
 * @see sdk-SPEC-v0.1.0.md
 * @packageDocumentation
 */

export type { SdkManifest } from './manifest.js';

// =============================================================================
// Public Types (re-exported from Runtime)
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

  // Core Public Types
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
  PolicyService,
  ArtifactRef,
  Intent,
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

  // Effects API
  Effects,
  AppEffectContext,
  EffectHandler,

  // Error value
  ErrorValue,

  // MEL text alias
  MelText,
} from '@manifesto-ai/runtime';

// =============================================================================
// Public Errors (re-exported from Runtime)
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
} from '@manifesto-ai/runtime';

// =============================================================================
// App Factory
// =============================================================================

export { createApp, createTestApp } from './create-app.js';

// =============================================================================
// ManifestoApp
// =============================================================================

export { ManifestoApp } from './app.js';

// =============================================================================
// Hook Internals (public for advanced integrations)
// =============================================================================

export { AppRefImpl, createAppRef } from './hooks/index.js';
export type { AppRefCallbacks } from './hooks/index.js';
export { HookableImpl } from './hooks/index.js';
export type { HookState } from './hooks/index.js';
export { JobQueue } from './hooks/index.js';
export { HookContextImpl, createHookContext } from './hooks/index.js';
