/**
 * Manifesto App Type Definitions
 *
 * @see SPEC v0.4.9 Appendix A
 * @module
 */

import type { DomainSchema, Patch, Requirement, Snapshot } from "@manifesto-ai/core";

// Re-export Patch and Requirement from core
export type { Patch, Requirement };
import type {
  ActorRef,
  AuthorityPolicy,
  World,
} from "@manifesto-ai/world";
import type {
  MemoryTrace,
  SelectedMemory,
  SelectionConstraints,
  SelectionResult,
  VerificationProof,
} from "@manifesto-ai/memory";

// =============================================================================
// Base Types
// =============================================================================

/**
 * App lifecycle status.
 *
 * @see SPEC §6.1
 */
export type AppStatus = "created" | "ready" | "disposing" | "disposed";

/**
 * Runtime kind indicator.
 *
 * @see SPEC Appendix A.1
 */
export type RuntimeKind = "domain" | "system";

/**
 * Unsubscribe function returned by subscribe methods.
 */
export type Unsubscribe = () => void;

/**
 * MEL text (string) or compiled DomainSchema.
 */
export type MelText = string;

// =============================================================================
// Action Phase & Results
// =============================================================================

/**
 * Action lifecycle phase.
 *
 * @see SPEC §8.2
 */
export type ActionPhase =
  | "preparing" // Pre-submission async work (recall, trace composition)
  | "preparation_failed" // Preparation failed (recall error, validation error, etc.)
  | "submitted" // Proposal submitted to World Protocol
  | "evaluating" // Authority evaluation (optional)
  | "pending" // HITL approval required
  | "approved" // Approved, awaiting execution
  | "executing" // Host executing effects
  | "completed" // Success, World created
  | "rejected" // Authority rejected (NO World created)
  | "failed"; // Execution failed (World created with error state)

/**
 * Common execution statistics.
 *
 * @see SPEC §8.3
 */
export interface ExecutionStats {
  durationMs: number;
  effectCount: number;
  patchCount: number;
}

/**
 * Successful action completion result.
 *
 * @see SPEC §8.3
 */
export interface CompletedActionResult {
  readonly status: "completed";
  readonly worldId: string;
  readonly proposalId: string;
  readonly decisionId: string;
  readonly stats: ExecutionStats;
  readonly runtime: RuntimeKind;
}

/**
 * Action rejected by Authority.
 *
 * @see SPEC §8.3
 */
export interface RejectedActionResult {
  readonly status: "rejected";
  readonly proposalId: string;
  readonly decisionId: string;
  readonly reason?: string;
  readonly runtime: RuntimeKind;
  // Note: No worldId - rejected actions do not create Worlds
}

/**
 * Action execution failed.
 *
 * @see SPEC §8.3
 */
export interface FailedActionResult {
  readonly status: "failed";
  readonly proposalId: string;
  readonly decisionId: string;
  readonly error: ErrorValue;
  readonly worldId: string; // World created with error state
  readonly runtime: RuntimeKind;
}

/**
 * Action preparation failed before submission.
 *
 * @see SPEC §8.3
 */
export interface PreparationFailedActionResult {
  readonly status: "preparation_failed";
  readonly proposalId: string;
  readonly error: ErrorValue;
  readonly runtime: RuntimeKind;
}

/**
 * Union of all action result types.
 *
 * @see SPEC §8.3
 */
export type ActionResult =
  | CompletedActionResult
  | RejectedActionResult
  | FailedActionResult
  | PreparationFailedActionResult;

/**
 * Phase change notification.
 *
 * @see SPEC Appendix A.3
 */
export interface ActionUpdate {
  readonly phase: ActionPhase;
  readonly previousPhase: ActionPhase;
  readonly detail?: ActionUpdateDetail;
  readonly timestamp: number;
}

/**
 * Phase-specific details.
 *
 * @see SPEC Appendix A.3
 */
export type ActionUpdateDetail =
  | { kind: "pending"; approvers: readonly string[] }
  | { kind: "rejected"; reason?: string }
  | { kind: "failed"; error: ErrorValue }
  | { kind: "completed"; worldId: string }
  | { kind: "preparation_failed"; error: ErrorValue };

// =============================================================================
// State Types
// =============================================================================

/**
 * Error value representation.
 *
 * @see SPEC §7.2
 */
export interface ErrorValue {
  readonly code: string;
  readonly message: string;
  readonly source: {
    actionId: string;
    nodePath: string;
  };
  readonly timestamp: number;
  readonly context?: Record<string, unknown>;
}

/**
 * Snapshot metadata.
 *
 * @see SPEC §7.1
 */
export interface SnapshotMeta {
  readonly version: number;
  readonly timestamp: number;
  readonly randomSeed: string;
  readonly schemaHash: string;
}

/**
 * System state within snapshot.
 *
 * @see SPEC §7.1
 */
export interface SystemState {
  readonly status: "idle" | "computing" | "pending" | "error";
  readonly lastError: ErrorValue | null;
  readonly errors: readonly ErrorValue[];
  readonly pendingRequirements: readonly Requirement[];
  readonly currentAction: string | null;
}

// Note: Requirement is re-exported from @manifesto-ai/core

/**
 * Complete app state.
 *
 * @see SPEC §7.1
 */
export interface AppState<TData = unknown> {
  readonly data: TData;
  readonly computed: Record<string, unknown>;
  readonly system: SystemState;
  readonly meta: SnapshotMeta;
}

// =============================================================================
// Options Types
// =============================================================================

/**
 * Actor policy configuration.
 *
 * @see SPEC §5.3
 */
export interface ActorPolicyConfig {
  /**
   * Actor policy mode.
   * - 'anonymous': Create anonymous actor if defaultActor not provided
   * - 'require': defaultActor MUST be provided
   *
   * @default 'anonymous'
   */
  mode?: "anonymous" | "require";

  /** Default actor configuration */
  defaultActor?: {
    actorId: string;
    kind?: "human" | "agent" | "system";
    name?: string;
    meta?: Record<string, unknown>;
  };
}

/**
 * Validation configuration.
 *
 * @see SPEC §5.4
 */
export interface ValidationConfig {
  /**
   * Services validation mode.
   * - 'lazy': Validate at execution time
   * - 'strict': Validate at ready/fork time
   *
   * @default 'lazy'
   */
  services?: "lazy" | "strict";

  /**
   * Policy for dynamic effect types in strict mode.
   * @default 'warn'
   */
  dynamicEffectPolicy?: "warn" | "error";
}

/**
 * System Actions configuration.
 *
 * @see SPEC §5.5
 */
export interface SystemActionsConfig {
  /**
   * Enable System Actions.
   * @default true
   */
  enabled?: boolean;

  /**
   * Authority policy for System Actions.
   * - 'permissive': Allow all (development)
   * - 'admin-only': Require admin role
   * - AuthorityPolicy: Custom policy
   *
   * @default 'admin-only'
   */
  authorityPolicy?: "permissive" | "admin-only" | AuthorityPolicy;

  /** Disabled System Action types */
  disabled?: readonly string[];
}

/**
 * Scheduler configuration.
 *
 * @see SPEC §SCHED-1~4
 */
export interface SchedulerConfig {
  /** Maximum concurrent actions */
  maxConcurrent?: number;
  /** Action execution timeout in ms */
  defaultTimeoutMs?: number;

  /**
   * Serialize same-branch domain actions via FIFO queue.
   *
   * When true (default), actions on the same branch are executed
   * sequentially in submission order. This prevents version conflicts
   * from concurrent snapshot modifications.
   *
   * When false, actions may execute concurrently (use with caution).
   *
   * @default true
   * @see SPEC §SCHED-1
   */
  singleWriterPerBranch?: boolean;
}

/**
 * Devtools configuration.
 */
export interface DevtoolsConfig {
  /** Enable devtools integration */
  enabled?: boolean;
  /** Devtools name */
  name?: string;
}

/**
 * App creation options.
 *
 * @see SPEC §5.2
 */
export interface CreateAppOptions {
  /** Initial data for genesis snapshot */
  initialData?: unknown;

  /** Effect handler mappings */
  services?: ServiceMap;

  /** Memory configuration */
  memory?: false | MemoryHubConfig;

  /** Plugin array */
  plugins?: readonly AppPlugin[];

  /** Validation settings */
  validation?: ValidationConfig;

  /** Actor policy */
  actorPolicy?: ActorPolicyConfig;

  /** System Action settings */
  systemActions?: SystemActionsConfig;

  /** Scheduler configuration */
  scheduler?: SchedulerConfig;

  /** Development tools */
  devtools?: DevtoolsConfig;
}

/**
 * Dispose options.
 *
 * @see SPEC §5.7
 */
export interface DisposeOptions {
  /** Force immediate termination */
  force?: boolean;
  /** Graceful shutdown timeout in ms */
  timeoutMs?: number;
}

/**
 * Done/result wait options.
 *
 * @see SPEC §8.1
 */
export interface DoneOptions {
  /** Maximum wait time in ms. @default Infinity */
  timeoutMs?: number;
}

/**
 * Action execution options.
 *
 * @see SPEC §8.4
 */
export interface ActOptions {
  /** Actor override */
  actorId?: string;

  /**
   * Branch context.
   *
   * - Domain Actions: Execution branch override (action runs against this branch's head)
   * - System Actions: Domain anchor for recall ONLY (MEM-SYS-2); does NOT affect System Runtime execution
   */
  branchId?: string;

  /**
   * Memory recall to attach to proposal.
   *
   * For Domain Actions: atWorldId = branch.head()
   * For System Actions: atWorldId = Domain anchor (see §14.8)
   *
   * IMPORTANT: If memory is disabled (memory: false), recall MUST NOT be used.
   * Providing recall when memory is disabled results in preparation_failed.
   *
   * @see §14.8 for System Runtime recall rules
   * @see §14.9 for memory disabled behavior
   */
  recall?: false | RecallRequest | readonly RecallRequest[];

  /** Trace options */
  trace?: {
    enabled?: boolean;
    level?: "minimal" | "standard" | "verbose";
  };
}

/**
 * Fork options.
 *
 * @see SPEC §9.3
 */
export interface ForkOptions {
  name?: string;

  /** New domain triggers new Runtime creation */
  domain?: MelText | DomainSchema;

  /** Services for new Runtime */
  services?: ServiceMap;

  /** Migration strategy for schema changes */
  migrate?: "auto" | MigrationFn;

  /** Switch to new branch after fork. @default true */
  switchTo?: boolean;

  /** Migration metadata */
  migrationMeta?: {
    reason?: string;
  };
}

/**
 * Session options.
 *
 * @see SPEC §10.1
 */
export interface SessionOptions {
  branchId?: string;
  kind?: "human" | "agent" | "system";
  name?: string;
  meta?: Record<string, unknown>;
}

/**
 * Subscribe options.
 *
 * @see SPEC §12.2
 */
export interface SubscribeOptions<TSelected> {
  /**
   * Equality function for change detection.
   * @default Object.is
   */
  equalityFn?: (a: TSelected, b: TSelected) => boolean;

  /**
   * Batch mode for listener invocation.
   * - 'immediate': Every snapshot change
   * - 'transaction': Once per act() completion (default)
   * - { debounce: number }: Debounce in ms
   *
   * @default 'transaction'
   */
  batchMode?: "immediate" | "transaction" | { debounce: number };

  /**
   * Invoke listener immediately with current value.
   * @default false
   */
  fireImmediately?: boolean;
}

/**
 * Lineage query options.
 *
 * @see SPEC §9.1
 */
export interface LineageOptions {
  limit?: number;
  untilWorldId?: string;
}

// =============================================================================
// Migration Types
// =============================================================================

/**
 * Migration context for custom migration functions.
 *
 * @see SPEC §9.3
 */
export interface MigrationContext {
  from: {
    schemaHash: string;
    worldId: string;
    state: AppState<unknown>;
  };
  to: {
    schemaHash: string;
    schema: DomainSchema;
  };
}

/**
 * Custom migration function type.
 *
 * @see SPEC §9.3
 */
export type MigrationFn = (ctx: MigrationContext) => unknown;

/**
 * Schema-changing fork audit record.
 *
 * @see SPEC §9.4
 */
export interface MigrationLink {
  readonly linkId: string;

  readonly from: {
    readonly schemaHash: string;
    readonly worldId: string;
    readonly branchId: string;
  };

  readonly to: {
    readonly schemaHash: string;
    readonly worldId: string;
    readonly branchId: string;
  };

  readonly migration: {
    readonly strategy: "auto" | "custom";
    readonly migratedAt: number;
    readonly migratedBy: ActorRef;
    readonly reason?: string;
  };
}

// =============================================================================
// Memory Types
// =============================================================================

/**
 * Backfill configuration.
 *
 * @see SPEC §14.2
 */
export interface BackfillConfig {
  /**
   * Backfill mode.
   * - 'off': No backfill
   * - 'onCheckout': Backfill on checkout
   * - 'onRecall': Backfill when needed for recall
   *
   * @default 'off'
   */
  mode?: "off" | "onCheckout" | "onRecall";

  /** Maximum backfill depth (number of Worlds). @default 100 */
  maxDepth?: number;
}

/**
 * Memory hub configuration.
 *
 * @see SPEC §14.2
 */
export interface MemoryHubConfig {
  providers: Record<string, MemoryProvider>;
  defaultProvider: string;

  routing?: {
    /** Determine target providers for ingest. Default: all providers */
    ingestTo?: (event: { worldId: string; schemaHash: string }) => readonly string[];
  };

  backfill?: BackfillConfig;
}

/**
 * Recall request.
 *
 * @see SPEC §14.5
 */
export type RecallRequest =
  | string
  | {
      query: string;
      provider?: string;
      constraints?: SelectionConstraints;
    };

/**
 * Recall result.
 *
 * @see SPEC §14.5
 */
export interface RecallResult {
  readonly attachments: readonly {
    provider: string;
    trace: MemoryTrace;
  }[];
  readonly selected: readonly SelectedMemory[];
  readonly views: readonly MemorySelectionView[];
}

/**
 * Projected memory content for UI/display.
 *
 * @see SPEC Appendix A.3
 */
export interface MemorySelectionView {
  readonly ref: { readonly worldId: string };
  readonly summary: string;
  readonly relevance: number;
}

/**
 * World event for memory ingestion.
 *
 * @see SPEC Appendix A.3
 */
export interface MemoryIngestEntry {
  readonly worldId: string;
  readonly schemaHash: string;
  readonly snapshot: Readonly<AppState<unknown>>;
  readonly parentWorldId?: string;
  readonly createdAt: number;
  readonly createdBy: ActorRef;
}

/**
 * Prove result from verifier.
 *
 * @see SPEC §14.3
 */
export interface ProveResult {
  readonly valid: boolean;
  readonly proof?: VerificationProof;
  readonly error?: string;
}

/**
 * Memory verifier interface.
 *
 * @see SPEC §14.3
 */
export interface MemoryVerifier {
  /** PURE: Generate proof for memory */
  prove(
    memory: { readonly worldId: string },
    world: World
  ): ProveResult;

  /** PURE: Verify proof */
  verifyProof(proof: VerificationProof): boolean;
}

/**
 * Memory provider interface.
 *
 * @see SPEC §14.3
 */
export interface MemoryProvider {
  /** Ingest World events (optional) */
  ingest?: (entry: MemoryIngestEntry) => Promise<void>;

  /** Select memories (REQUIRED) */
  select: (req: {
    readonly query: string;
    readonly atWorldId: string;
    readonly selector: ActorRef;
    readonly constraints?: SelectionConstraints;
  }) => Promise<SelectionResult>;

  /** Verifier (optional; NoneVerifier used if absent) */
  verifier?: MemoryVerifier;

  /**
   * Maintain memories (optional).
   *
   * @see SPEC §17.5 MEM-MAINT-1~10
   * @since v0.4.8
   */
  maintain?: (
    op: MemoryMaintenanceOp,
    ctx: MemoryMaintenanceContext
  ) => Promise<MemoryMaintenanceResult>;

  meta?: {
    name?: string;
    version?: string;
    capabilities?: readonly ("ingest" | "select" | "verify" | "maintain")[];
  };
}

// =============================================================================
// Memory Maintenance Types (v0.4.8+)
// =============================================================================

/**
 * Memory reference for maintenance operations.
 *
 * @see SPEC §17.5.1
 * @since v0.4.8
 */
export interface MemoryRef {
  readonly worldId: string;
}

/**
 * Memory maintenance operation.
 *
 * @see SPEC §17.5.1 MEM-MAINT-2~5
 * @since v0.4.8
 */
export interface MemoryMaintenanceOp {
  /**
   * Operation kind. Currently only 'forget' is supported.
   *
   * MEM-MAINT-2: Forget MUST NOT modify Cold Store
   * MEM-MAINT-3: Forget applies tombstone markers to indexes
   */
  readonly kind: "forget";

  /** Reference to the memory to operate on */
  readonly ref: MemoryRef;

  /**
   * Scope of the operation.
   * - 'actor': Only affects current actor's view (MEM-MAINT-8)
   * - 'global': Affects all actors (MEM-MAINT-9, requires elevated Authority)
   *
   * @default 'actor'
   */
  readonly scope?: "actor" | "global";

  /** Human-readable reason for the operation */
  readonly reason?: string;

  /**
   * Tombstone expiry in milliseconds.
   * If provided, the tombstone will be removed after this duration.
   */
  readonly ttl?: number;
}

/**
 * Context for memory maintenance operations.
 *
 * CRITICAL: actor MUST come from Proposal.actorId, NOT from user input.
 *
 * @see SPEC §17.5.1 MEM-MAINT-10
 * @since v0.4.9
 */
export interface MemoryMaintenanceContext {
  /**
   * Actor performing the operation.
   *
   * MEM-MAINT-10: This MUST be derived from Proposal.actorId,
   * NOT from user-provided input.
   */
  readonly actor: ActorRef;

  /**
   * Effective scope of the operation.
   */
  readonly scope: "actor" | "global";
}

/**
 * Result of a single memory maintenance operation.
 *
 * @see SPEC §17.5.1
 * @since v0.4.8
 */
export interface MemoryMaintenanceResult {
  readonly success: boolean;
  readonly op: MemoryMaintenanceOp;
  readonly tombstoneId?: string;
  readonly error?: string;
}

/**
 * Input for system.memory.maintain action.
 *
 * @see SPEC §17.5
 * @since v0.4.8
 */
export interface MemoryMaintenanceInput {
  readonly ops: readonly MemoryMaintenanceOp[];
}

/**
 * Output for system.memory.maintain action.
 *
 * @see SPEC §17.5
 * @since v0.4.8
 */
export interface MemoryMaintenanceOutput {
  readonly results: readonly MemoryMaintenanceResult[];
  readonly trace?: MemoryHygieneTrace;
}

/**
 * Trace for memory hygiene operations.
 *
 * @see SPEC §17.5.1 MEM-MAINT-6
 * @since v0.4.8
 */
export interface MemoryHygieneTrace {
  readonly traceId: string;
  readonly timestamp: number;
  readonly actor: ActorRef;
  readonly ops: readonly MemoryMaintenanceOp[];
  readonly results: readonly MemoryMaintenanceResult[];
  readonly durationMs: number;
}

// =============================================================================
// Service Types
// =============================================================================

/**
 * Patch helpers for service handlers.
 *
 * @see SPEC §13.2
 */
export interface PatchHelpers {
  set(path: string, value: unknown): Patch;
  merge(path: string, value: Record<string, unknown>): Patch;
  unset(path: string): Patch;
  many(...patches: readonly (Patch | readonly Patch[])[]): Patch[];
  from(record: Record<string, unknown>, opts?: { basePath?: string }): Patch[];
}

/**
 * Service handler context.
 *
 * @see SPEC §13.1
 */
export interface ServiceContext {
  snapshot: Readonly<AppState<unknown>>;
  actorId: string;
  worldId: string;
  branchId: string;
  patch: PatchHelpers;

  /** AbortSignal (best-effort; handler MAY ignore) */
  signal: AbortSignal;
}

/**
 * Service handler return type.
 *
 * @see SPEC §13.1
 */
export type ServiceReturn =
  | void
  | Patch
  | readonly Patch[]
  | { patches: readonly Patch[] };

/**
 * Service handler function.
 *
 * @see SPEC §13.1
 */
export type ServiceHandler = (
  params: Record<string, unknown>,
  ctx: ServiceContext
) => ServiceReturn | Promise<ServiceReturn>;

/**
 * Service map.
 *
 * @see SPEC §13.1
 */
export type ServiceMap = Record<string, ServiceHandler>;

// =============================================================================
// Plugin Type
// =============================================================================

/**
 * App plugin.
 *
 * @see SPEC §15.1
 */
export type AppPlugin = (app: App) => void | Promise<void>;

// =============================================================================
// Hook Types
// =============================================================================

/**
 * Enqueue options for hook context.
 *
 * @see SPEC §11.2
 */
export interface EnqueueOptions {
  /**
   * Priority level.
   * - 'immediate': Before other pending jobs
   * - 'normal': FIFO (default)
   * - 'defer': After all normal jobs
   *
   * @default 'normal'
   */
  priority?: "immediate" | "normal" | "defer";

  /** Job identifier for debugging */
  label?: string;
}

/**
 * Enqueued job function.
 */
export type EnqueuedJob = () => void | Promise<void>;

/**
 * Hook context.
 *
 * @see SPEC §11.2
 */
export interface HookContext {
  /**
   * Safe mutation scheduling.
   * Direct mutations in hooks are FORBIDDEN.
   */
  enqueue(job: EnqueuedJob, opts?: EnqueueOptions): void;

  actorId?: string;
  branchId?: string;
  worldId?: string;
}

/**
 * Hookable interface.
 *
 * @see SPEC §11.1
 */
export interface Hookable<TEvents> {
  on<K extends keyof TEvents>(name: K, fn: TEvents[K]): Unsubscribe;
  once<K extends keyof TEvents>(name: K, fn: TEvents[K]): Unsubscribe;
}

/**
 * App hook events.
 *
 * @see SPEC §11.5
 */
export interface AppHooks {
  // Lifecycle
  "app:created": (ctx: HookContext) => void | Promise<void>;
  "app:ready:before": (ctx: HookContext) => void | Promise<void>;
  "app:ready": (ctx: HookContext) => void | Promise<void>;
  "app:dispose:before": (ctx: HookContext) => void | Promise<void>;
  "app:dispose": (ctx: HookContext) => void | Promise<void>;

  // Domain/Runtime
  /**
   * Emitted when DomainSchema is resolved during ready().
   *
   * This hook emits BEFORE plugins execute (per READY-6).
   * Plugins should use app.getDomainSchema() for reliable access
   * rather than capturing schema from this hook payload.
   *
   * @see SCHEMA-1~6 for getDomainSchema() API
   */
  "domain:resolved": (
    payload: { schemaHash: string; schema: DomainSchema },
    ctx: HookContext
  ) => void | Promise<void>;
  /**
   * Emitted when a new schema is resolved (e.g., schema-changing fork).
   * Only emits for schemas not previously seen in this App instance.
   *
   * @since v0.4.10
   */
  "domain:schema:added": (
    payload: { schemaHash: string; schema: DomainSchema },
    ctx: HookContext
  ) => void | Promise<void>;
  "runtime:created": (
    payload: { schemaHash: string; kind: RuntimeKind },
    ctx: HookContext
  ) => void | Promise<void>;

  // Branch
  "branch:created": (
    payload: { branchId: string; schemaHash: string; head: string },
    ctx: HookContext
  ) => void | Promise<void>;
  "branch:checkout": (
    payload: { branchId: string; from: string; to: string },
    ctx: HookContext
  ) => void | Promise<void>;
  "branch:switched": (
    payload: { from: string; to: string },
    ctx: HookContext
  ) => void | Promise<void>;

  // Action Lifecycle
  "action:preparing": (
    payload: {
      proposalId: string;
      actorId: string;
      branchId?: string;
      type: string;
      runtime: RuntimeKind;
    },
    ctx: HookContext
  ) => void | Promise<void>;
  "action:submitted": (
    payload: {
      proposalId: string;
      actorId: string;
      branchId?: string;
      type: string;
      input: unknown;
      runtime: RuntimeKind;
    },
    ctx: HookContext
  ) => void | Promise<void>;
  "action:phase": (
    payload: {
      proposalId: string;
      phase: ActionPhase;
      detail?: ActionUpdateDetail;
    },
    ctx: HookContext
  ) => void | Promise<void>;
  "action:completed": (
    payload: { proposalId: string; result: ActionResult },
    ctx: HookContext
  ) => void | Promise<void>;

  // System
  "system:world": (
    payload: {
      type: string;
      proposalId: string;
      actorId: string;
      systemWorldId: string;
      status: "completed" | "failed";
    },
    ctx: HookContext
  ) => void | Promise<void>;

  // Memory
  "memory:ingested": (
    payload: { provider: string; worldId: string },
    ctx: HookContext
  ) => void | Promise<void>;
  "memory:recalled": (
    payload: {
      provider: string;
      query: string;
      atWorldId: string;
      trace: MemoryTrace;
    },
    ctx: HookContext
  ) => void | Promise<void>;

  // Migration
  "migration:created": (
    payload: { link: MigrationLink },
    ctx: HookContext
  ) => void | Promise<void>;

  // Job Queue
  "job:error": (
    payload: { error: unknown; label?: string },
    ctx: HookContext
  ) => void | Promise<void>;

  // Audit
  "audit:rejected": (
    payload: { operation: string; reason?: string; proposalId: string },
    ctx: HookContext
  ) => void | Promise<void>;
  "audit:failed": (
    payload: { operation: string; error: ErrorValue; proposalId: string },
    ctx: HookContext
  ) => void | Promise<void>;
}

// =============================================================================
// System Runtime Types
// =============================================================================

/**
 * System Runtime state.
 *
 * @see SPEC §16.3
 */
export interface SystemRuntimeState {
  /** Registered actors */
  actors: Record<
    string,
    {
      actorId: string;
      kind: "human" | "agent" | "system";
      name?: string;
      meta?: Record<string, unknown>;
      enabled: boolean;
      authorityBindings?: string[];
    }
  >;

  /** Registered services */
  services: Record<
    string,
    {
      effectType: string;
      handlerRef: string;
      registeredAt: number;
      registeredBy: string;
    }
  >;

  /** Memory configuration */
  memoryConfig: {
    providers: string[];
    defaultProvider: string;
    routing?: unknown;
    backfill?: unknown;
  };

  /** Workflow states */
  workflows: Record<
    string,
    {
      workflowId: string;
      enabled: boolean;
      policy?: unknown;
    }
  >;

  /** Branch pointers (for audit, not actual state) */
  branchPointers: Record<
    string,
    {
      branchId: string;
      headWorldId: string;
      updatedAt: number;
      updatedBy: string;
    }
  >;

  /** Audit log entries */
  auditLog: Array<{
    timestamp: number;
    actorId: string;
    actionType: string;
    proposalId: string;
    worldId: string;
    summary: string;
  }>;
}

// =============================================================================
// Interface Definitions
// =============================================================================

/**
 * ActionHandle interface.
 *
 * @see SPEC §8.1
 */
export interface ActionHandle {
  /**
   * Proposal ID.
   *
   * This ID is stable throughout the action lifecycle, including the `preparing` phase.
   * It can be used for reattachment via `app.getActionHandle(proposalId)` at any point.
   */
  readonly proposalId: string;

  /** Current phase snapshot */
  readonly phase: ActionPhase;

  /**
   * Target runtime.
   * 'domain' for user actions, 'system' for System Actions.
   */
  readonly runtime: RuntimeKind;

  /**
   * Wait for successful completion.
   * @throws ActionRejectedError - Authority rejected
   * @throws ActionFailedError - Execution failed
   * @throws ActionPreparationError - Preparation failed
   * @throws ActionTimeoutError - Timeout exceeded
   */
  done(opts?: DoneOptions): Promise<CompletedActionResult>;

  /**
   * Wait for any result (no throw except timeout).
   * @throws ActionTimeoutError - Timeout exceeded
   */
  result(opts?: DoneOptions): Promise<ActionResult>;

  /** Subscribe to phase changes */
  subscribe(listener: (update: ActionUpdate) => void): Unsubscribe;

  /**
   * Detach from this handle.
   * The proposal continues in World Protocol.
   */
  detach(): void;
}

/**
 * Branch interface.
 *
 * @see SPEC §9.1
 */
export interface Branch {
  readonly id: string;
  readonly name?: string;
  readonly schemaHash: string;

  head(): string;
  checkout(worldId: string): Promise<void>;
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;
  fork(opts?: ForkOptions): Promise<Branch>;
  getState<T = unknown>(): AppState<T>;
  lineage(opts?: LineageOptions): readonly string[];
}

/**
 * Session interface.
 *
 * @see SPEC §10.1
 */
export interface Session {
  readonly actorId: string;
  readonly branchId: string;

  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;
  recall(req: RecallRequest | readonly RecallRequest[]): Promise<RecallResult>;
  getState<T = unknown>(): AppState<T>;
}

/**
 * Memory facade interface.
 *
 * @see SPEC §14.5
 */
export interface MemoryFacade {
  enabled(): boolean;
  recall(
    req: RecallRequest | readonly RecallRequest[],
    ctx?: { actorId?: string; branchId?: string }
  ): Promise<RecallResult>;
  providers(): readonly string[];
  backfill(opts: { worldId: string; depth?: number }): Promise<void>;

  /**
   * Perform memory maintenance operations.
   *
   * @see SPEC §17.5 MEM-MAINT-1~10
   * @since v0.4.8
   */
  maintain(
    ops: readonly MemoryMaintenanceOp[],
    ctx: MemoryMaintenanceContext
  ): Promise<MemoryMaintenanceOutput>;
}

/**
 * System facade interface.
 *
 * @see SPEC §16.5
 */
export interface SystemFacade {
  /**
   * Get current System Runtime state.
   */
  getState(): SystemRuntimeState;

  /**
   * Get System Runtime's current head worldId.
   */
  head(): string;

  /**
   * Get System Runtime's worldline (audit trail).
   */
  lineage(opts?: LineageOptions): readonly string[];

  /**
   * Subscribe to System Runtime state changes.
   */
  subscribe(listener: (state: SystemRuntimeState) => void): Unsubscribe;
}

/**
 * App interface.
 *
 * @see SPEC §6.1
 */
export interface App {
  // Lifecycle
  readonly status: AppStatus;
  readonly hooks: Hookable<AppHooks>;
  ready(): Promise<void>;
  dispose(opts?: DisposeOptions): Promise<void>;

  // Domain Schema Access (v0.4.10)
  /**
   * Returns the DomainSchema for the current branch's schemaHash.
   *
   * This provides synchronous pull-based access to the domain schema,
   * enabling plugins and user code to reliably obtain schema without
   * timing dependencies on the 'domain:resolved' hook.
   *
   * NOTE: In multi-schema scenarios (schema-changing fork), this returns
   * the schema for the CURRENT branch's schemaHash, which may differ from
   * the initial domain's schema.
   *
   * @throws AppNotReadyError if called before schema is resolved (READY-6)
   * @throws AppDisposedError if called after dispose()
   * @returns DomainSchema for current branch's schemaHash
   * @see SPEC §6.2 SCHEMA-1~6
   * @since v0.4.10
   */
  getDomainSchema(): DomainSchema;

  // Branch Management (Domain Runtime)
  currentBranch(): Branch;
  listBranches(): readonly Branch[];
  switchBranch(branchId: string): Promise<Branch>;
  fork(opts?: ForkOptions): Promise<Branch>;

  // Action Execution
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;

  /**
   * Get an existing ActionHandle by proposalId.
   *
   * @throws ActionNotFoundError if proposalId is unknown
   */
  getActionHandle(proposalId: string): ActionHandle;
  session(actorId: string, opts?: SessionOptions): Session;

  // State Access (Domain Runtime)
  getState<T = unknown>(): AppState<T>;
  subscribe<TSelected>(
    selector: (state: AppState<unknown>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe;

  // System Runtime Access
  readonly system: SystemFacade;

  // Memory
  readonly memory: MemoryFacade;

  // Audit
  getMigrationLinks(): readonly MigrationLink[];
}
