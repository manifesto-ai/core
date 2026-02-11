/**
 * Manifesto App — Hook Types
 *
 * @see SPEC v2.0.0 §11, §17
 * @see ADR-004 Phase 1
 * @module
 */

import type { DomainSchema, Snapshot } from "@manifesto-ai/core";
import type { WorldId } from "@manifesto-ai/world";
import type { AppStatus, RuntimeKind, Unsubscribe, ProposalId } from "./identifiers.js";
import type { AppState, ErrorValue } from "./state.js";
import type { ActionPhase, ActionUpdateDetail, ActionResult, ActionHandle } from "./action.js";
import type { MemoryTrace, RecallRequest, RecallResult, MemoryMaintenanceOp } from "./memory.js";
import type { MigrationLink } from "./migration.js";
// TYPE-ONLY circular imports (safe: erased at compile time)
import type { Branch } from "./branch.js";
import type { ActOptions } from "./config.js";

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
