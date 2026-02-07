/**
 * Manifesto App Type Definitions
 *
 * Re-export hub. All types are defined in domain-aligned sub-modules.
 * This file exists solely for backward compatibility.
 *
 * @see ADR-004 Phase 1
 * @module
 */

// Effects (unchanged, pre-existing separate file)
export type { Effects, EffectHandler, AppEffectContext } from "./effects.js";

// Identifiers & Base Types
export type {
  Patch,
  Requirement,
  Snapshot,
  World,
  WorldId,
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
} from "./identifiers.js";

// State Types
export type {
  ErrorValue,
  SnapshotMeta,
  SystemState,
  AppState,
} from "./state.js";

// Authority Types
export type {
  AuthorityKind,
  AuthorityRef,
  ApprovedScope,
  AuthorityDecision,
  ValidationResult,
  Proposal,
  ExecutionKeyPolicy,
  ExecutionPolicyConfig,
  PolicyService,
} from "./authority.js";

// Action Types
export type {
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
} from "./action.js";

// WorldStore Types
export type {
  WorldDelta,
  CompactOptions,
  CompactResult,
  WorldStore,
} from "./world-store.js";

// Host/Executor Types
export type {
  HostExecutionOptions,
  HostExecutionResult,
  HostExecutor,
  Intent,
  ManifestoWorld,
  Host,
  HostEffectHandler,
  HostEffectContext,
  HostResult,
} from "./host-executor.js";

// Memory Types
export type {
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
} from "./memory.js";

// Migration Types
export type {
  MigrationContext,
  MigrationFn,
  MigrationLink,
} from "./migration.js";

// Hook Types
export type {
  EnqueueOptions,
  EnqueuedJob,
  HookContext,
  Hookable,
  AppHooks,
  AppRef,
} from "./hooks.js";

// Config Types
export type {
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
} from "./config.js";

// Branch Types
export type { Branch } from "./branch.js";

// Session Types
export type { Session } from "./session.js";

// Facade Types
export type {
  MemoryFacade,
  SystemMemoryFacade,
  SystemFacade,
} from "./facades.js";

// App Types
export type {
  ProposalResult,
  AppPlugin,
  App,
} from "./app.js";
