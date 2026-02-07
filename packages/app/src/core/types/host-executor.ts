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
  readonly body: unknown;
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
