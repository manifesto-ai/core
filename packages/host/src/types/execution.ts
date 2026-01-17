/**
 * Execution Types for Host v2.0.1
 *
 * Defines the ExecutionKey and ExecutionContext types for the
 * Mailbox + Runner + Job execution model.
 *
 * @see host-SPEC-v2.0.1.md §3.6 ExecutionKey
 * @see host-SPEC-v2.0.1.md §10 Execution Model
 */

import type {
  DomainSchema,
  HostContext,
  Intent,
  ManifestoCore,
  Patch,
  Snapshot,
} from "@manifesto-ai/core";
import type { ExecutionMailbox } from "../mailbox.js";
import type { TraceEvent } from "./trace.js";

/**
 * Opaque execution key for single-writer serialization.
 *
 * ExecutionKey is opaque to Host. World/App layer determines the mapping policy.
 *
 * @see SPEC §3.6, MAIL-2
 */
export type ExecutionKey = string;

/**
 * Runtime abstraction for deterministic testing and async scheduling.
 *
 * Provides injectable timing and scheduling primitives.
 */
export interface Runtime {
  /**
   * Get current timestamp (injectable for testing)
   */
  now(): number;

  /**
   * Schedule work on microtask queue (for lost wakeup prevention)
   * @see SPEC §10.3.3 RUN-4
   */
  microtask(fn: () => void): void;

  /**
   * Yield to allow other work (between job processing)
   * @see SPEC §10.2.1 JOB-5
   */
  yield(): Promise<void>;
}

/**
 * Default runtime using real time and native scheduling
 */
export const defaultRuntime: Runtime = {
  now: () => Date.now(),
  microtask: (fn) => queueMicrotask(fn),
  yield: () => Promise.resolve(),
};

/**
 * Execution context provided to job handlers.
 *
 * Contains all dependencies needed for job execution within a single
 * ExecutionKey context.
 *
 * @see SPEC §10.10 Canonical Head
 */
export interface ExecutionContext {
  /**
   * The execution key this context belongs to
   */
  readonly key: ExecutionKey;

  /**
   * Domain schema for computation
   */
  readonly schema: DomainSchema;

  /**
   * Core instance for compute and apply operations
   */
  readonly core: ManifestoCore;

  /**
   * Mailbox for this execution key
   */
  readonly mailbox: ExecutionMailbox;

  /**
   * Runtime for timing and scheduling
   */
  readonly runtime: Runtime;

  /**
   * Get the canonical head snapshot for this execution.
   *
   * Job handlers MUST read fresh snapshot via this method.
   *
   * @see SPEC §10.10 Canonical Head, JOB-4
   */
  getSnapshot(): Snapshot;

  /**
   * Set the canonical head snapshot.
   *
   * Called after applying patches.
   */
  setSnapshot(snapshot: Snapshot): void;

  /**
   * Get the frozen HostContext for the current job.
   *
   * Context is frozen at job start and reused throughout the job.
   *
   * @see SPEC §11.3 CTX-1~5
   */
  getFrozenContext(): HostContext;

  /**
   * Apply patches to the current snapshot.
   *
   * This is a convenience method that:
   * 1. Gets current snapshot
   * 2. Calls core.apply with frozen context
   * 3. Sets the new snapshot
   *
   * @returns The new snapshot after applying patches
   */
  applyPatches(patches: Patch[], source: string): Snapshot;

  /**
   * Emit a trace event for debugging and compliance testing.
   */
  trace(event: TraceEvent): void;

  /**
   * Check if requirement is pending (for FULFILL-0 stale check)
   *
   * @see SPEC §10.7.2 FULFILL-0
   */
  isPendingRequirement(requirementId: string): boolean;

  /**
   * Clear a requirement from pending list (for FULFILL-2)
   *
   * @see SPEC §10.7.1 FULFILL-2, REQ-CLEAR-1
   */
  clearRequirement(requirementId: string): void;

  /**
   * Request effect execution (dispatches to effect runner)
   *
   * This initiates async effect execution outside the mailbox.
   *
   * @see SPEC §10.9 Effect Runner Location
   */
  requestEffectExecution(
    intentId: string,
    requirementId: string,
    effectType: string,
    params: unknown,
    intent: Intent
  ): void;

  /**
   * Escalate to fatal error (for ERR-FE-3)
   *
   * @see SPEC §13.4.5 Fatal Escalation
   */
  escalateToFatal(intentId: string, error: Error): void;
}

/**
 * Options for creating an ExecutionContext
 */
export interface ExecutionContextOptions {
  key: ExecutionKey;
  schema: DomainSchema;
  core: ManifestoCore;
  mailbox: ExecutionMailbox;
  runtime: Runtime;
  initialSnapshot: Snapshot;
  onTrace?: (event: TraceEvent) => void;
  onEffectRequest?: (
    key: ExecutionKey,
    intentId: string,
    requirementId: string,
    effectType: string,
    params: unknown,
    intent: Intent
  ) => void;
  onFatalError?: (key: ExecutionKey, intentId: string, error: Error) => void;
}
