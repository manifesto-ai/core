/**
 * Manifesto App Type Definitions
 *
 * @see SPEC v2.2.0
 * @module
 */

import type { DomainSchema, Patch, Requirement, Snapshot } from "@manifesto-ai/core";

// Re-export Patch, Requirement, and Snapshot from core
export type { Patch, Requirement, Snapshot };

// Re-export Effects types (v2.2.0)
export type { Effects, EffectHandler, AppEffectContext } from "./effects.js";
import type { Effects } from "./effects.js";
import type {
  ActorRef,
  AuthorityPolicy,
  ManifestoWorld,
  World,
  WorldId,
} from "@manifesto-ai/world";

// Re-export World and WorldId from world
export type { World, WorldId };

// =============================================================================
// Base Types
// =============================================================================

/**
 * App lifecycle status.
 *
 * Lifecycle transitions:
 * created → initializing → ready → disposing → disposed
 *
 * @see SPEC v2.0.0 §7.1
 * @see FDR-APP-RUNTIME-001 §2.3
 */
export type AppStatus =
  | "created" // Instance created, not yet initialized
  | "initializing" // Internal binding in progress (v2.0.0)
  | "ready" // External contract usable
  | "disposing" // Cleanup in progress, new ingress rejected
  | "disposed"; // Terminal state

// =============================================================================
// v2.0.0 Core Identifiers
// =============================================================================

/**
 * Execution key for mailbox routing.
 *
 * @see SPEC v2.0.0 §5.1
 */
export type ExecutionKey = string;

/**
 * Schema hash for referential identity.
 */
export type SchemaHash = string;

/**
 * Branch identifier.
 */
export type BranchId = string;

/**
 * Memory identifier.
 */
export type MemoryId = string;

/**
 * Proposal identifier.
 */
export type ProposalId = string;

/**
 * Actor identifier.
 */
export type ActorId = string;

/**
 * Opaque reference to Host-owned artifact.
 * World/App MAY store this reference but MUST NOT interpret its contents.
 * Only Host knows how to resolve ArtifactRef → actual data.
 *
 * Structure follows World SPEC v2.0.2 for cross-boundary compatibility.
 *
 * @see SPEC v2.0.0 §5.1
 */
export type ArtifactRef = {
  readonly uri: string;
  readonly hash: string;
};

/**
 * Proposal status.
 *
 * @see SPEC v2.0.0 §5.3
 */
export type ProposalStatus =
  | "submitted"
  | "evaluating"
  | "approved"
  | "rejected"
  | "executing"
  | "completed"
  | "failed";

/**
 * World outcome.
 *
 * @see SPEC v2.0.0 §5.5
 */
export type WorldOutcome = "completed" | "failed";

// =============================================================================
// v2.0.0 Authority Types
// =============================================================================

/**
 * Authority kind.
 *
 * @see SPEC v2.0.0 §5.6
 */
export type AuthorityKind = "auto" | "human" | "policy" | "tribunal";

/**
 * Authority reference.
 *
 * @see SPEC v2.0.0 §5.6
 */
export type AuthorityRef = {
  readonly kind: AuthorityKind;
  readonly id: string;
  readonly meta?: Record<string, unknown>;
};

/**
 * Approved scope for execution constraints.
 *
 * @see SPEC v2.0.0 §5.7
 */
export type ApprovedScope = {
  readonly allowedPaths: readonly string[];
  readonly maxPatchCount?: number;
  readonly constraints?: Record<string, unknown>;
};

/**
 * Authority decision result.
 *
 * @see SPEC v2.0.0 §5.6
 */
export type AuthorityDecision = {
  readonly approved: boolean;
  readonly reason?: string;
  readonly scope?: ApprovedScope;
  readonly timestamp: number;
};

/**
 * Validation result from policy service.
 */
export type ValidationResult = {
  readonly valid: boolean;
  readonly errors?: readonly string[];
};

// =============================================================================
// v2.0.0 Execution Policy
// =============================================================================

/**
 * Proposal for action execution.
 *
 * @see SPEC v2.0.0 §10
 */
export type Proposal = {
  readonly proposalId: ProposalId;
  readonly actorId: ActorId;
  readonly intentType: string;
  readonly intentBody: unknown;
  readonly baseWorld: WorldId;
  readonly branchId?: BranchId;
  readonly createdAt: number;
};

/**
 * Execution key derivation policy.
 *
 * @see SPEC v2.0.0 §5.8
 */
export type ExecutionKeyPolicy = (proposal: Proposal) => ExecutionKey;

/**
 * Execution policy configuration.
 *
 * @see SPEC v2.0.0 §5.8
 */
export type ExecutionPolicyConfig = {
  readonly executionKeyPolicy: ExecutionKeyPolicy;
  readonly intentTypeOverrides?: Record<string, ExecutionKeyPolicy>;
  readonly actorKindOverrides?: Record<string, ExecutionKeyPolicy>;
};

// =============================================================================
// v2.0.0 HostExecutor Interface
// =============================================================================

/**
 * Host execution options. Defined by World SPEC.
 * App MUST NOT extend this type.
 *
 * @see SPEC v2.0.0 §8.2
 */
export type HostExecutionOptions = {
  readonly approvedScope?: unknown;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};

/**
 * Host execution result.
 *
 * @see SPEC v2.0.0 §8.3
 */
export type HostExecutionResult = {
  readonly outcome: WorldOutcome;
  readonly terminalSnapshot: Snapshot;
  readonly error?: ErrorValue;
  readonly traceRef?: ArtifactRef;
};

/**
 * HostExecutor: App's adapter for Host execution.
 *
 * World interacts with execution ONLY through this interface.
 * App implements this, wrapping the actual Host.
 *
 * @see SPEC v2.0.0 §8.1
 */
export interface HostExecutor {
  /**
   * Execute an intent against a snapshot.
   *
   * @param key - ExecutionKey for mailbox routing
   * @param baseSnapshot - Starting snapshot
   * @param intent - Intent to execute
   * @param opts - Execution options (World SPEC defined, optional)
   * @returns Terminal snapshot and outcome
   */
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult>;

  /**
   * Abort execution for a key (best-effort).
   */
  abort?(key: ExecutionKey): void;
}

/**
 * Intent for execution (from core).
 */
export type Intent = {
  readonly type: string;
  readonly body: unknown;
  readonly intentId: string;
};

// =============================================================================
// v2.0.0 WorldStore Interface
// =============================================================================

/**
 * World delta for persistence.
 *
 * @see SPEC v2.0.0 §9.2
 */
export type WorldDelta = {
  readonly fromWorld: WorldId;
  readonly toWorld: WorldId;
  readonly patches: readonly Patch[];
  readonly createdAt: number;
};

/**
 * Compact options for WorldStore maintenance.
 */
export type CompactOptions = {
  readonly olderThan?: number;
  readonly maxWorlds?: number;
};

/**
 * Compact result from WorldStore maintenance.
 */
export type CompactResult = {
  readonly compactedCount: number;
  readonly freedBytes?: number;
};

/**
 * WorldStore: Persistence abstraction for Worlds.
 *
 * @see SPEC v2.0.0 §9.1
 */
export interface WorldStore {
  // Core Operations
  /**
   * Store a World and its delta.
   */
  store(world: World, delta: WorldDelta): Promise<void>;

  /**
   * Initialize a genesis World with a full Snapshot.
   *
   * Optional hook for stores that need explicit seeding.
   */
  initializeGenesis?(world: World, snapshot: Snapshot): Promise<void>;

  /**
   * Restore a Snapshot for a World.
   * MAY involve delta reconstruction.
   */
  restore(worldId: WorldId): Promise<Snapshot>;

  /**
   * Get World metadata.
   */
  getWorld(worldId: WorldId): Promise<World | null>;

  /**
   * Check if World exists.
   */
  has(worldId: WorldId): Promise<boolean>;

  // Query
  /**
   * Get children of a World.
   */
  getChildren(worldId: WorldId): Promise<readonly WorldId[]>;

  /**
   * Get lineage path to Genesis.
   */
  getLineage(worldId: WorldId): Promise<readonly WorldId[]>;

  // Maintenance (Optional)
  /**
   * Compact old Worlds (delta-only storage).
   */
  compact?(options: CompactOptions): Promise<CompactResult>;

  /**
   * Archive cold Worlds.
   */
  archive?(worldIds: readonly WorldId[]): Promise<void>;
}

// =============================================================================
// v2.0.0 PolicyService Interface
// =============================================================================

/**
 * PolicyService: Policy decisions for execution.
 *
 * @see SPEC v2.0.0 §10.1
 */
export interface PolicyService {
  /**
   * Derive ExecutionKey for a Proposal.
   */
  deriveExecutionKey(proposal: Proposal): ExecutionKey;

  /**
   * Route Proposal to Authority and get decision.
   */
  requestApproval(proposal: Proposal): Promise<AuthorityDecision>;

  /**
   * Validate Proposal against ApprovedScope (pre-execution).
   */
  validateScope(proposal: Proposal, scope: ApprovedScope): ValidationResult;

  /**
   * Validate execution result against ApprovedScope (post-execution).
   */
  validateResultScope?(
    baseSnapshot: Snapshot,
    terminalSnapshot: Snapshot,
    scope: ApprovedScope
  ): ValidationResult;
}

// =============================================================================
// v2.0.0 AppConfig
// =============================================================================

/**
 * Host interface for v2 injection.
 * This is a minimal interface that App requires from Host.
 */
export interface Host {
  /**
   * Execute an intent and return result.
   */
  dispatch(intent: Intent): Promise<HostResult>;

  /**
   * Register an effect handler.
   */
  registerEffect(type: string, handler: HostEffectHandler): void;

  /**
   * Get list of registered effect types.
   */
  getRegisteredEffectTypes?(): readonly string[];

  /**
   * Reset host state.
   */
  reset?(data: unknown): Promise<void>;
}

/**
 * Host effect handler signature (internal).
 *
 * @deprecated For user-facing API, use EffectHandler from effects.ts (v2.2.0).
 * This type remains for Host interface compatibility.
 */
export type HostEffectHandler = (
  type: string,
  params: Record<string, unknown>,
  ctx: HostEffectContext
) => Promise<readonly Patch[]>;

/**
 * Host effect context (internal).
 *
 * @deprecated For user-facing API, use AppEffectContext from effects.ts (v2.2.0).
 */
export type HostEffectContext = {
  readonly snapshot: Snapshot;
  readonly signal?: AbortSignal;
};

/**
 * Host result from dispatch.
 */
export type HostResult = {
  /** Note: Real Host returns "complete"/"pending"/"error", not "completed"/"failed" */
  readonly status: "complete" | "pending" | "error";
  readonly snapshot: Snapshot;
  readonly error?: ErrorValue;
};

/**
 * MEL Compiler interface.
 */
export interface Compiler {
  compile(source: string): Promise<{ schema: DomainSchema; errors: readonly CompileError[] }>;
}

/**
 * Compile error.
 */
export type CompileError = {
  readonly code: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
};

/**
 * v2.3.0 App Configuration.
 *
 * Simplified public API per ADR-APP-002 and ADR-003:
 * - `effects` is REQUIRED (replaces `services`)
 * - `host` is removed (App creates Host internally)
 * - `world` is OPTIONAL (App creates internal World with InMemoryWorldStore)
 * - `worldStore` is REMOVED — World owns persistence per ADR-003
 * - `compiler` is removed (internal)
 *
 * @see SPEC v2.3.0 §6.1
 * @see ADR-APP-002
 * @see ADR-003
 */
export type AppConfig = {
  // ─────────────────────────────────────────
  // Required
  // ─────────────────────────────────────────

  /** Domain schema or MEL source text */
  readonly schema: DomainSchema | string;

  /** Effect handlers (REQUIRED) */
  readonly effects: Effects;

  // ─────────────────────────────────────────
  // Optional: World (ADR-003)
  // ─────────────────────────────────────────

  /**
   * ManifestoWorld instance (optional).
   * If not provided, App creates an internal World with InMemoryWorldStore.
   * World owns persistence — App does NOT receive WorldStore directly.
   */
  readonly world?: ManifestoWorld;

  // ─────────────────────────────────────────
  // Optional: Policy
  // ─────────────────────────────────────────

  /** Policy service (default: auto-approve, unique key) */
  readonly policyService?: PolicyService;

  /** Execution key policy shorthand */
  readonly executionKeyPolicy?: ExecutionKeyPolicy;

  // ─────────────────────────────────────────
  // Optional: Memory
  // ─────────────────────────────────────────

  /** External memory store */
  readonly memoryStore?: MemoryStore;

  /** Memory provider for execution integration */
  readonly memoryProvider?: MemoryProvider;

  // ─────────────────────────────────────────
  // Optional: Extensibility
  // ─────────────────────────────────────────

  /** Plugins to install */
  readonly plugins?: readonly AppPlugin[];

  /** Pre-configured hooks */
  readonly hooks?: Partial<AppHooks>;

  // ─────────────────────────────────────────
  // Optional: Validation
  // ─────────────────────────────────────────

  readonly validation?: {
    /** Validate effects match schema requirements */
    readonly effects?: "strict" | "warn" | "off";
  };

  // ─────────────────────────────────────────
  // Optional: Initial data
  // ─────────────────────────────────────────

  readonly initialData?: unknown;

  // ─────────────────────────────────────────
  // Optional: Actor policy
  // ─────────────────────────────────────────

  readonly actorPolicy?: ActorPolicyConfig;

  // ─────────────────────────────────────────
  // Optional: Scheduler
  // ─────────────────────────────────────────

  readonly scheduler?: SchedulerConfig;

  // ─────────────────────────────────────────
  // Optional: System actions
  // ─────────────────────────────────────────

  readonly systemActions?: SystemActionsConfig;

  // ─────────────────────────────────────────
  // Optional: Devtools
  // ─────────────────────────────────────────

  readonly devtools?: DevtoolsConfig;
};

/**
 * Legacy v2.0.0 App Configuration (deprecated).
 *
 * @deprecated Use AppConfig (v2.2.0) with `effects` instead of `host`/`services`.
 * This type will be removed in v3.0.0.
 */
export type LegacyAppConfig = {
  readonly schema: DomainSchema | string;
  readonly host: Host;
  readonly worldStore: WorldStore;
  readonly policyService?: PolicyService;
  readonly executionKeyPolicy?: ExecutionKeyPolicy;
  readonly memoryStore?: MemoryStore;
  readonly memoryProvider?: MemoryProvider;
  readonly compiler?: Compiler;
  readonly services?: ServiceMap;
  readonly plugins?: readonly AppPlugin[];
  readonly hooks?: Partial<AppHooks>;
  readonly validation?: {
    readonly services?: "strict" | "warn" | "off";
  };
  readonly initialData?: unknown;
  readonly actorPolicy?: ActorPolicyConfig;
  readonly scheduler?: SchedulerConfig;
  readonly systemActions?: SystemActionsConfig;
  readonly devtools?: DevtoolsConfig;

  // Optional: Memory (from CreateAppOptions)
  readonly memory?: false | MemoryHubConfig;
};

// =============================================================================
// v2.0.0 AppRef (Read-only facade for hooks)
// =============================================================================

/**
 * AppRef: Read-only facade for hooks.
 * Prevents re-entrant mutations and infinite trigger loops.
 *
 * @see SPEC v2.0.0 §17.2
 */
export interface AppRef {
  readonly status: AppStatus;
  getState<T = unknown>(): AppState<T>;
  getDomainSchema(): DomainSchema;
  getCurrentHead(): WorldId;
  currentBranch(): Branch;

  /**
   * Enqueue an action for execution after current hook completes.
   * NOT synchronous execution — prevents re-entrancy.
   */
  enqueueAction(type: string, input?: unknown, opts?: ActOptions): ProposalId;
}

// =============================================================================
// v2.0.0 ProposalResult
// =============================================================================

/**
 * Result from submitProposal().
 *
 * @see SPEC v2.0.0 §6.5
 */
export type ProposalResult =
  | { readonly status: "completed"; readonly world: World }
  | { readonly status: "failed"; readonly world: World; readonly error?: ErrorValue }
  | { readonly status: "rejected"; readonly reason: string };

// =============================================================================
// v2.0.0 MemoryStore Interface
// =============================================================================

/**
 * Memory record input for create operations.
 *
 * @see SPEC v2.0.0 §11.2
 */
export type MemoryRecordInput<T = unknown> = {
  readonly id?: MemoryId;
  readonly data: T;
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly tags?: readonly string[];
  readonly meta?: Record<string, unknown>;
};

/**
 * Stored memory record.
 *
 * @see SPEC v2.0.0 §11.2
 */
export type StoredMemoryRecord<T = unknown> = {
  readonly id: MemoryId;
  readonly data: T;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly tags?: readonly string[];
  readonly meta?: Record<string, unknown>;
};

/**
 * Memory filter for queries.
 */
export type MemoryFilter = {
  readonly tags?: readonly string[];
  readonly createdAfter?: number;
  readonly createdBefore?: number;
  readonly limit?: number;
};

/**
 * MemoryStore: External mutable storage.
 * Separate from World (immutable history).
 *
 * @see SPEC v2.0.0 §11.1
 */
export interface MemoryStore<T = unknown> {
  // CRUD (Required)
  create(record: MemoryRecordInput<T>): Promise<MemoryId>;
  get(id: MemoryId): Promise<StoredMemoryRecord<T> | null>;
  update(id: MemoryId, patch: Partial<T>): Promise<void>;
  delete(id: MemoryId): Promise<void>;
  query(filter: MemoryFilter): Promise<StoredMemoryRecord<T>[]>;

  // Batch (Optional)
  createMany?(records: MemoryRecordInput<T>[]): Promise<MemoryId[]>;
  deleteMany?(ids: MemoryId[]): Promise<void>;

  // Maintenance (Optional)
  consolidate?(): Promise<void>;
  clear?(): Promise<void>;
}

// =============================================================================
// v2.0.0 Schema Compatibility
// =============================================================================

/**
 * Schema compatibility validation result.
 *
 * @see SPEC v2.0.0 §12.4
 */
export type SchemaCompatibilityResult =
  | { readonly compatible: true }
  | { readonly compatible: false; readonly missingEffects: readonly string[] };

// =============================================================================
// v2.0.0 ActionResult (extended)
// =============================================================================

/**
 * v2.0.0 Action Result (extended).
 *
 * @see SPEC v2.0.0 §5.10
 */
export type ActionResultV2 =
  | { readonly status: "completed"; readonly world: World; readonly snapshot: Snapshot }
  | { readonly status: "failed"; readonly world: World; readonly error: ErrorValue }
  | { readonly status: "rejected"; readonly reason: string; readonly decision: AuthorityDecision }
  | { readonly status: "preparation_failed"; readonly reason: string; readonly error?: ErrorValue };

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
 * App creation options (legacy v0.4.x API).
 *
 * @see SPEC §5.2
 * @deprecated Use AppConfig for v2.0.0 API
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

  /** Pre-configured hooks */
  hooks?: Partial<AppHooks>;

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

  /**
   * Internal v2 config (set by createApp when using AppConfig).
   * @internal
   */
  _v2Config?: InternalV2Config;
}

/**
 * Internal v2 configuration with implementation details.
 * Includes worldStore extracted from World for internal use.
 *
 * @internal
 */
export type InternalV2Config = AppConfig & {
  /** @internal WorldStore extracted from World.store */
  readonly worldStore: WorldStore;
};

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
 * Verification proof for memory selection.
 */
export type VerificationProof = Record<string, unknown>;

/**
 * Memory selection constraints.
 */
export interface SelectionConstraints {
  readonly requireVerified?: boolean;
  readonly limit?: number;
  readonly minConfidence?: number;
}

/**
 * Selected memory entry.
 */
export interface SelectedMemory {
  readonly ref: { readonly worldId: string };
  readonly reason: string;
  readonly confidence: number;
  readonly verified: boolean;
  readonly proof?: VerificationProof;
}

/**
 * Memory trace for recall.
 */
export interface MemoryTrace {
  readonly query: string;
  readonly atWorldId: WorldId;
  readonly selector: ActorRef;
  readonly selectedAt: number;
  readonly selected: readonly SelectedMemory[];
}

/**
 * Memory selection result.
 */
export interface SelectionResult {
  readonly selected: readonly SelectedMemory[];
  readonly trace?: MemoryTrace;
}

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
   * Read-only facade for safe access during hooks.
   */
  readonly app: AppRef;

  /**
   * Emission timestamp (epoch ms).
   */
  readonly timestamp: number;
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

  // State
  "state:publish": (
    payload: { snapshot: Snapshot; worldId: string },
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
 * @see SPEC v2.0.0 §6.2
 */
export interface App {
  // ═══════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════

  /** Current app status */
  readonly status: AppStatus;

  /** Hook registry */
  readonly hooks: Hookable<AppHooks>;

  /**
   * Initialize the App.
   *
   * MUST be called before any mutation/read APIs.
   * Compiles MEL if schema is string, initializes plugins.
   */
  ready(): Promise<void>;

  /**
   * Dispose the App.
   *
   * Drains executing actions, cleans up resources.
   */
  dispose(opts?: DisposeOptions): Promise<void>;

  // ═══════════════════════════════════════════════════════════════════
  // Schema Access
  // ═══════════════════════════════════════════════════════════════════

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
   * @see SPEC v2.0.0 §13 SCHEMA-1~6
   */
  getDomainSchema(): DomainSchema;

  // ═══════════════════════════════════════════════════════════════════
  // State Access
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get current state.
   */
  getState<T = unknown>(): AppState<T>;

  /**
   * Subscribe to state changes.
   */
  subscribe<TSelected>(
    selector: (state: AppState<unknown>) => TSelected,
    listener: (selected: TSelected) => void,
    opts?: SubscribeOptions<TSelected>
  ): Unsubscribe;

  // ═══════════════════════════════════════════════════════════════════
  // Action Execution (High-Level API)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Execute an action.
   *
   * This is the primary API for action execution.
   * Returns an ActionHandle for tracking.
   *
   * @param type - Action type (e.g., 'todo:add')
   * @param input - Action input payload
   * @param opts - Execution options
   */
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle;

  /**
   * Get an existing ActionHandle by proposalId.
   *
   * @throws ActionNotFoundError if proposalId is unknown
   */
  getActionHandle(proposalId: string): ActionHandle;

  // ═══════════════════════════════════════════════════════════════════
  // Proposal Execution (Low-Level API) - v2.0.0
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Submit a proposal for execution.
   *
   * Low-level API. Prefer act() for most use cases.
   *
   * @see SPEC v2.0.0 §6.2 APP-API-4
   */
  submitProposal(proposal: Proposal): Promise<ProposalResult>;

  // ═══════════════════════════════════════════════════════════════════
  // Session
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create a session for an actor.
   *
   * Session provides actor-scoped action execution.
   */
  session(actorId: string, opts?: SessionOptions): Session;

  // ═══════════════════════════════════════════════════════════════════
  // Branch Management
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get current branch.
   */
  currentBranch(): Branch;

  /**
   * List all branches.
   */
  listBranches(): readonly Branch[];

  /**
   * Switch to a different branch.
   */
  switchBranch(branchId: string): Promise<Branch>;

  /**
   * Create a new branch (fork).
   */
  fork(opts?: ForkOptions): Promise<Branch>;

  // ═══════════════════════════════════════════════════════════════════
  // System Runtime
  // ═══════════════════════════════════════════════════════════════════

  /** System operations facade */
  readonly system: SystemFacade;

  // ═══════════════════════════════════════════════════════════════════
  // Memory
  // ═══════════════════════════════════════════════════════════════════

  /** Memory operations facade */
  readonly memory: MemoryFacade;

  // ═══════════════════════════════════════════════════════════════════
  // World Query (v2.0.0)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get current head WorldId.
   *
   * @see SPEC v2.0.0 §6.2
   */
  getCurrentHead?(): WorldId;

  /**
   * Get snapshot for a World.
   *
   * @see SPEC v2.0.0 §6.2
   */
  getSnapshot?(worldId: WorldId): Promise<Snapshot>;

  /**
   * Get World metadata.
   *
   * @see SPEC v2.0.0 §6.2
   */
  getWorld?(worldId: WorldId): Promise<World>;

  // ═══════════════════════════════════════════════════════════════════
  // Audit
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get migration links (schema migrations).
   */
  getMigrationLinks(): readonly MigrationLink[];
}
