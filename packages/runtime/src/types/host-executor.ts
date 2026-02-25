/**
 * Manifesto App — Host Executor & Integration Types
 *
 * @see SPEC v2.0.0 §8
 * @see ADR-004 Phase 1
 * @module
 */

import type { Patch, Snapshot } from "@manifesto-ai/core";
import type { ExecutionKey, ArtifactRef, WorldOutcome } from "./identifiers.js";
import type { ErrorValue } from "./state.js";
import type { WorldStore } from "./world-store.js";

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
  readonly input?: unknown;
  readonly intentId: string;
};

// =============================================================================
// v2.3.0 World Wrapper
// =============================================================================

/**
 * ManifestoWorld wrapper for App integration.
 *
 * World owns persistence per ADR-003; App consumes its WorldStore.
 */
export type ManifestoWorld = {
  readonly store: WorldStore;
};

// =============================================================================
// v2.0.0 AppConfig
// =============================================================================

/**
 * Host interface for v2 injection.
 *
 * v2.1: Added mailbox API methods (seedSnapshot, submitIntent, drain,
 * getContextSnapshot, hasPendingEffects, waitForPendingEffects, releaseExecution)
 * for SPEC-compliant per-key execution. Legacy dispatch/reset preserved for
 * backward compatibility but deprecated for AppHostExecutor use.
 *
 * @see SPEC v2.0.0 §8, FDR-H018~H020
 */
export interface Host {
  // === v2.1 Mailbox API (used by AppHostExecutor) ===

  /**
   * Seed a snapshot for a given execution key.
   * Creates per-key mailbox and execution context.
   */
  seedSnapshot(key: ExecutionKey, snapshot: Snapshot): void;

  /**
   * Submit an intent for processing under an execution key.
   * Requires prior seedSnapshot() call. Enqueues a StartIntentJob.
   */
  submitIntent(key: ExecutionKey, intent: Intent): void;

  /**
   * Drain the mailbox for an execution key (one processing cycle).
   * Resolves when the current batch of jobs is processed.
   */
  drain(key: ExecutionKey): Promise<void>;

  /**
   * Get the current terminal snapshot for an execution key.
   * Returns a cloned snapshot or undefined if no context exists.
   */
  getContextSnapshot(key: ExecutionKey): Snapshot | undefined;

  /**
   * Check if there are pending (in-flight) effects for a key.
   */
  hasPendingEffects(key: ExecutionKey): boolean;

  /**
   * Wait for pending effects to settle for a key.
   * After settlement, a FulfillEffect job is enqueued — caller should drain() again.
   */
  waitForPendingEffects(key: ExecutionKey): Promise<void>;

  /**
   * Check if the mailbox for a key still has queued jobs.
   * Used by the drain loop to avoid premature exit when processMailbox
   * re-schedules itself via microtask (RUN-4/LIVE-4).
   */
  hasQueuedWork(key: ExecutionKey): boolean;

  /**
   * Check if a fatal error has been recorded for a key.
   * Fatal errors are escalated by the runner when jobs throw and are
   * tracked in a separate map (not in snapshot.system.lastError), so
   * the drain loop must check this explicitly to avoid reporting
   * "completed" after a fatal failure.
   */
  hasFatalError(key: ExecutionKey): boolean;

  /**
   * Release execution state for a key (cleanup).
   * MUST be called after execution completes to prevent resource leaks.
   */
  releaseExecution(key: ExecutionKey): void;

  // === Legacy API (kept for backward compatibility) ===

  /**
   * Execute an intent and return result.
   * @deprecated Use seedSnapshot + submitIntent + drain loop instead.
   */
  dispatch(intent: Intent, options?: { key?: ExecutionKey }): Promise<HostResult>;

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
   * @deprecated Use seedSnapshot(key, snapshot) instead.
   */
  reset?(snapshotOrData: unknown): void | Promise<void>;
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
