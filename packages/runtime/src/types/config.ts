/**
 * Manifesto App — Configuration Types
 *
 * @see SPEC v2.0.0 §5, §6.1
 * @see ADR-004 Phase 1
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type { WorldId } from "@manifesto-ai/world";
import type { AuthorityPolicy } from "@manifesto-ai/world";
import type { ExecutionKey, MelText } from "./identifiers.js";
import type { ExecutionKeyPolicy, PolicyService } from "./authority.js";
import type { MemoryStore, MemoryProvider, MemoryHubConfig, RecallRequest } from "./memory.js";
import type { ManifestoWorld } from "./host-executor.js";
// TYPE-ONLY circular imports (safe: erased at compile time)
import type { AppHooks } from "./hooks.js";
import type { AppPlugin } from "./app.js";

// =============================================================================
// Compiler Types
// =============================================================================

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

// =============================================================================
// v2.3.0 App Configuration
// =============================================================================

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

  /** Memory hub configuration */
  readonly memory?: false | MemoryHubConfig;

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

// Need to import Effects from effects.ts (sibling module)
import type { Effects } from "./effects.js";

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
  /** Fork point (default: current head) */
  from?: WorldId;

  /** Branch name */
  name?: string;

  /** New domain triggers new Runtime creation */
  domain?: MelText | DomainSchema;

  /** Switch to new branch after fork. @default true */
  switchTo?: boolean;
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
// System Runtime Types
// =============================================================================

/**
 * System Runtime state.
 *
 * @see SPEC §16.3
 */
export interface SystemRuntimeState {
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
