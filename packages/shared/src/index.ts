/**
 * @manifesto-ai/shared
 *
 * Contract types, errors, constants, and state utilities shared across
 * Runtime and SDK packages.
 *
 * @packageDocumentation
 * @module @manifesto-ai/shared
 * @version 0.1.0
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Effects
  Effects,
  EffectHandler,
  AppEffectContext,

  // Identifiers & Base Types
  Patch,
  Requirement,
  Snapshot,
  World,
  WorldId,
  WorldHead,
  AppStatus,
  ExecutionKey,
  SchemaHash,
  BranchId,
  MemoryId,
  ProposalId,
  ActorId,
  ArtifactRef,
  ProposalStatus,
  WorldOutcome,
  RuntimeKind,
  Unsubscribe,
  MelText,

  // State Types
  ErrorValue,
  SnapshotMeta,
  SystemState,
  AppState,

  // Authority Types
  AuthorityKind,
  AuthorityRef,
  ApprovedScope,
  AuthorityDecision,
  ValidationResult,
  Proposal,
  ExecutionKeyPolicy,
  ExecutionPolicyConfig,
  PolicyService,

  // Action Types
  ActionPhase,
  ExecutionStats,
  CompletedActionResult,
  RejectedActionResult,
  FailedActionResult,
  PreparationFailedActionResult,
  ActionResult,
  ActionUpdate,
  ActionUpdateDetail,
  SchemaCompatibilityResult,
  ActionResultV2,
  DoneOptions,
  ActionHandle,

  // WorldStore Types
  WorldDelta,
  CompactOptions,
  CompactResult,
  PersistedBranchEntry,
  PersistedBranchState,
  WorldStore,

  // Host/Executor Types
  HostExecutionOptions,
  HostExecutionResult,
  HostExecutor,
  Intent,
  ManifestoWorld,
  Host,
  HostEffectHandler,
  HostEffectContext,
  HostResult,

  // Memory Types
  MemoryRecordInput,
  StoredMemoryRecord,
  MemoryFilter,
  MemoryStore,
  VerificationProof,
  SelectionConstraints,
  SelectedMemory,
  MemoryTrace,
  SelectionResult,
  BackfillConfig,
  MemoryHubConfig,
  RecallRequest,
  RecallResult,
  MemorySelectionView,
  MemoryIngestEntry,
  ProveResult,
  MemoryVerifier,
  MemoryProvider,
  MemoryRef,
  MemoryMaintenanceOp,
  MemoryMaintenanceContext,
  MemoryMaintenanceResult,
  MemoryMaintenanceInput,
  MemoryMaintenanceOptions,
  MemoryMaintenanceOutput,
  MemoryHygieneTrace,

  // Migration Types
  MigrationContext,
  MigrationFn,
  MigrationLink,

  // Hook Types
  EnqueueOptions,
  EnqueuedJob,
  HookContext,
  Hookable,
  AppHooks,
  AppRef,

  // Config Types
  Compiler,
  CompileError,
  AppConfig,
  ActorPolicyConfig,
  SystemActionsConfig,
  SchedulerConfig,
  DevtoolsConfig,
  DisposeOptions,
  ActOptions,
  ForkOptions,
  SessionOptions,
  SubscribeOptions,
  LineageOptions,
  SystemRuntimeState,

  // Branch Types
  Branch,

  // Session Types
  Session,

  // Facade Types
  MemoryFacade,
  SystemMemoryFacade,
  SystemFacade,

  // App Types
  ProposalResult,
  AppPlugin,
  App,
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

  // Liveness
  LivenessError,

  // Resume & Recovery
  SchemaMismatchOnResumeError,
  BranchHeadNotFoundError,
} from "./errors/index.js";

// =============================================================================
// Constants
// =============================================================================

export {
  SYSTEM_ACTION_TYPES,
  RESERVED_EFFECT_TYPE,
  RESERVED_NAMESPACE_PREFIX,
} from "./constants.js";

export type { SystemActionType } from "./constants.js";

// =============================================================================
// State Utilities
// =============================================================================

export {
  toClientState,
  withDxAliases,
  snapshotToAppState,
  appStateToSnapshot,
  normalizeSnapshot,
  createInitialAppState,
} from "./core/state/index.js";
