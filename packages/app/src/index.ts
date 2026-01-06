/**
 * @manifesto-ai/app
 *
 * Facade and orchestration layer over the Manifesto protocol stack.
 *
 * @packageDocumentation
 * @module @manifesto-ai/app
 * @version 0.4.7
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
  CreateAppOptions,
  ActorPolicyConfig,
  ValidationConfig,
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
  Hookable,
  HookContext,
  EnqueueOptions,

  // Services
  ServiceMap,
  ServiceHandler,
  ServiceContext,
  ServiceReturn,
  PatchHelpers,

  // Plugins
  AppPlugin,

  // Hook Events
  AppHooks,

  // System Runtime
  SystemRuntimeState,

  // Memory Provider
  MemoryProvider,
  MemoryVerifier,
  MemoryIngestEntry,
  MemorySelectionView,
  ProveResult,

  // Requirement
  Requirement,
} from "./types/index.js";

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

  // Service
  MissingServiceError,
  DynamicEffectTypeError,
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
  ForkMigrationError,
  DomainCompileError,
  PluginInitError,
} from "./errors/index.js";

// =============================================================================
// Factory
// =============================================================================

export { createApp } from "./create-app.js";

// =============================================================================
// Services
// =============================================================================

export {
  ServiceRegistry,
  createServiceRegistry,
  createServiceContext,
  createPatchHelpers,
} from "./services/index.js";

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

// =============================================================================
// Constants
// =============================================================================

export { SYSTEM_ACTION_TYPES } from "./constants.js";
