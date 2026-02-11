/**
 * HostExecutor Interface
 *
 * App's adapter for Host execution.
 *
 * @see SPEC v2.0.0 §8
 * @module
 */

import type {
  HostExecutor,
  HostExecutionOptions,
  HostExecutionResult,
  ExecutionKey,
  Intent,
  Snapshot,
  ArtifactRef,
  ErrorValue,
  WorldOutcome,
} from "@manifesto-ai/shared";

// Re-export types
export type {
  HostExecutor,
  HostExecutionOptions,
  HostExecutionResult,
  ExecutionKey,
  Intent,
  ArtifactRef,
  ErrorValue,
  WorldOutcome,
};

/**
 * Options for creating an AppHostExecutor.
 */
export type AppHostExecutorOptions = {
  /**
   * Enable trace collection.
   * @default false
   */
  readonly traceEnabled?: boolean;

  /**
   * Timeout for execution in milliseconds.
   * @default 30000
   */
  readonly defaultTimeoutMs?: number;
};

/**
 * Execution context for App-level tracking.
 */
export type ExecutionContext = {
  readonly key: ExecutionKey;
  readonly startedAt: number;
  readonly baseSnapshot: Snapshot;
  readonly intent: Intent;
  readonly signal?: AbortSignal;
  aborted?: boolean;
};
