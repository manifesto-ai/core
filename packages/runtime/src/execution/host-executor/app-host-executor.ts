/**
 * AppHostExecutor
 *
 * App's implementation of HostExecutor that wraps the actual Host.
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
  Host,
  ArtifactRef,
  ErrorValue,
} from "../../types/index.js";
import type { AppHostExecutorOptions, ExecutionContext } from "./interface.js";

/**
 * AppHostExecutor: Implements HostExecutor by wrapping a Host instance.
 *
 * Responsibilities:
 * - Route execution to correct mailbox via ExecutionKey
 * - Track in-flight executions for abort support
 * - Convert Host results to HostExecutionResult
 * - Exclude Host internal types (use ArtifactRef for trace)
 *
 * @see SPEC v2.0.0 §8 HEXEC-1~6
 */
export class AppHostExecutor implements HostExecutor {
  private _host: Host;
  private _options: AppHostExecutorOptions;
  private _executions: Map<ExecutionKey, ExecutionContext> = new Map();

  constructor(host: Host, options?: AppHostExecutorOptions) {
    this._host = host;
    this._options = options ?? {};
  }

  /**
   * Execute an intent against a snapshot.
   *
   * HEXEC-3: MUST return HostExecutionResult.
   * HEXEC-4: MUST route to correct ExecutionKey mailbox.
   * HEXEC-6: MUST NOT contain Host internal types; use ArtifactRef.
   *
   * @see SPEC v2.0.0 §8.1
   */
  async execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult> {
    const startedAt = Date.now();
    const timeoutMs = opts?.timeoutMs ?? this._options.defaultTimeoutMs ?? 30000;

    // Create execution context
    const ctx: ExecutionContext = {
      key,
      startedAt,
      baseSnapshot,
      intent,
      signal: opts?.signal,
      aborted: false,
    };

    // Track execution
    this._executions.set(key, ctx);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          ctx.aborted = true;
          reject(new ExecutionTimeoutError(key, timeoutMs));
        }, timeoutMs);
      });

      // Create abort promise (if signal provided)
      // Note: Using { once: true } to prevent memory leak - listener auto-removes after firing
      const abortPromise = opts?.signal
        ? new Promise<never>((_, reject) => {
            opts.signal!.addEventListener("abort", () => {
              ctx.aborted = true;
              reject(new ExecutionAbortedError(key));
            }, { once: true });
          })
        : null;

      // Execute with timeout and abort handling
      const dispatchPromise = this._executeWithHost(intent, baseSnapshot);

      const racePromises = [dispatchPromise, timeoutPromise];
      if (abortPromise) {
        racePromises.push(abortPromise);
      }

      const result = await Promise.race(racePromises);

      // Convert to HostExecutionResult
      return this._toHostExecutionResult(result, startedAt);
    } catch (error) {
      // Handle errors
      return this._toErrorResult(error, baseSnapshot, startedAt);
    } finally {
      // Cleanup
      this._executions.delete(key);
    }
  }

  /**
   * Abort execution for a key (best-effort).
   *
   * HEXEC-5: SHOULD be implemented for cancellation support.
   *
   * @see SPEC v2.0.0 §8.1
   */
  abort(key: ExecutionKey): void {
    const ctx = this._executions.get(key);
    if (ctx) {
      ctx.aborted = true;
      // Note: Actual abort depends on Host implementation
      // This is best-effort as the Host may not support abort
    }
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  /**
   * Execute intent through Host.
   */
  private async _executeWithHost(
    intent: Intent,
    _baseSnapshot: Snapshot
  ): Promise<HostDispatchResult> {
    // Dispatch to Host
    const hostResult = await this._host.dispatch(intent);

    return {
      status: hostResult.status,
      snapshot: hostResult.snapshot,
      error: hostResult.error,
    };
  }

  /**
   * Convert Host result to HostExecutionResult.
   *
   * HEXEC-6: MUST NOT contain Host internal types.
   */
  private _toHostExecutionResult(
    result: HostDispatchResult,
    startedAt: number
  ): HostExecutionResult {
    // Note: Host returns "complete" (not "completed") for success
    const outcome = result.status === "complete" ? "completed" : "failed";

    // Generate trace reference if tracing is enabled
    const traceRef: ArtifactRef | undefined = this._options.traceEnabled
      ? {
          uri: `trace://execution/${Date.now().toString(36)}`,
          hash: `hash_${Math.random().toString(36).slice(2, 10)}`,
        }
      : undefined;

    return {
      outcome,
      terminalSnapshot: result.snapshot,
      error: result.error,
      traceRef,
    };
  }

  /**
   * Convert error to HostExecutionResult.
   */
  private _toErrorResult(
    error: unknown,
    baseSnapshot: Snapshot,
    startedAt: number
  ): HostExecutionResult {
    const errorValue: ErrorValue = {
      code: error instanceof ExecutionTimeoutError
        ? "EXECUTION_TIMEOUT"
        : error instanceof ExecutionAbortedError
        ? "EXECUTION_ABORTED"
        : "EXECUTION_ERROR",
      message: error instanceof Error ? error.message : String(error),
      source: {
        actionId: "host-executor",
        nodePath: "execute",
      },
      timestamp: Date.now(),
    };

    return {
      outcome: "failed",
      terminalSnapshot: baseSnapshot,
      error: errorValue,
    };
  }

  // ===========================================================================
  // Host Access
  // ===========================================================================

  /**
   * Get the underlying Host instance.
   * Use with caution - this breaks encapsulation.
   */
  getHost(): Host {
    return this._host;
  }

  /**
   * Get list of registered effect types.
   */
  getRegisteredEffectTypes(): readonly string[] {
    return this._host.getRegisteredEffectTypes?.() ?? [];
  }
}

/**
 * Internal Host dispatch result type.
 * Note: Host returns "complete"/"pending"/"error", not "completed"/"failed"
 */
type HostDispatchResult = {
  status: "complete" | "pending" | "error";
  snapshot: Snapshot;
  error?: ErrorValue;
};

/**
 * Error thrown when execution times out.
 */
export class ExecutionTimeoutError extends Error {
  readonly key: ExecutionKey;
  readonly timeoutMs: number;

  constructor(key: ExecutionKey, timeoutMs: number) {
    super(`Execution timed out after ${timeoutMs}ms for key: ${key}`);
    this.name = "ExecutionTimeoutError";
    this.key = key;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when execution is aborted.
 */
export class ExecutionAbortedError extends Error {
  readonly key: ExecutionKey;

  constructor(key: ExecutionKey) {
    super(`Execution aborted for key: ${key}`);
    this.name = "ExecutionAbortedError";
    this.key = key;
  }
}

/**
 * Create an AppHostExecutor.
 */
export function createAppHostExecutor(
  host: Host,
  options?: AppHostExecutorOptions
): AppHostExecutor {
  return new AppHostExecutor(host, options);
}
