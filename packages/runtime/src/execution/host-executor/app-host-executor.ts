/**
 * AppHostExecutor
 *
 * App's implementation of HostExecutor that wraps the actual Host
 * using the v2 mailbox API (seedSnapshot/submitIntent/drain).
 *
 * @see SPEC v2.0.0 §8
 * @see FDR-H018~H020 (Mailbox, Run-to-Completion, Single-Runner)
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

/** Maximum drain-effect-drain iterations before giving up. */
const MAX_DRAIN_ITERATIONS = 100;

/**
 * AppHostExecutor: Implements HostExecutor by wrapping a Host instance.
 *
 * Uses the v2 mailbox API for per-key execution isolation:
 * - seedSnapshot(key, snapshot) — typed Snapshot, no duck-typing
 * - submitIntent(key, intent)   — enqueues work into the key's mailbox
 * - drain(key)                  — processes one cycle of mailbox jobs
 * - getContextSnapshot(key)     — reads terminal snapshot
 *
 * Same-key serialization is enforced via _executionLocks so that
 * concurrent calls for the same key never overlap Host state.
 *
 * @see SPEC v2.0.0 §8 HEXEC-1~6
 */
export class AppHostExecutor implements HostExecutor {
  private _host: Host;
  private _options: AppHostExecutorOptions;
  private _executions: Map<ExecutionKey, ExecutionContext> = new Map();
  private _executionLocks: Map<ExecutionKey, Promise<void>> = new Map();

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

    const previous = this._executionLocks.get(key) ?? Promise.resolve();

    // Resolved in the finally block AFTER releaseExecution and cleanup.
    // The lock gates on this so a queued same-key execute cannot start
    // until the current execute has fully cleaned up Host state.
    let resolveDrainSettled!: () => void;
    const drainSettled = new Promise<void>((r) => { resolveDrainSettled = r; });

    const run = previous.then(async () => {
      // Early-exit if already aborted while queued
      if (opts?.signal?.aborted) {
        resolveDrainSettled();
        return this._toErrorResult(
          new ExecutionAbortedError(key), baseSnapshot,
        );
      }

      // Create execution context for tracking
      const ctx: ExecutionContext = {
        key,
        startedAt,
        baseSnapshot,
        intent,
        signal: opts?.signal,
        aborted: false,
      };
      this._executions.set(key, ctx);

      // Single try/finally ensures releaseExecution and _executions cleanup
      // always run, including when seedSnapshot/submitIntent throw.
      try {
        // Seed snapshot and submit intent via mailbox API (typed, no duck-typing)
        this._host.seedSnapshot(key, baseSnapshot);
        this._host.submitIntent(key, intent);

        // Drain-effect-drain loop
        const drainPromise = this._drainToCompletion(key);

        // Timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            ctx.aborted = true;
            reject(new ExecutionTimeoutError(key, timeoutMs));
          }, timeoutMs);
        });

        // Abort promise (if signal provided)
        const abortPromise = opts?.signal
          ? new Promise<never>((_, reject) => {
              opts.signal!.addEventListener("abort", () => {
                ctx.aborted = true;
                reject(new ExecutionAbortedError(key));
              }, { once: true });
            })
          : null;

        const racePromises: Promise<unknown>[] = [drainPromise, timeoutPromise];
        if (abortPromise) {
          racePromises.push(abortPromise);
        }

        await Promise.race(racePromises);

        // Drain completed normally — get terminal snapshot
        const terminalSnapshot = this._host.getContextSnapshot(key) ?? baseSnapshot;
        return this._toResult(terminalSnapshot);
      } catch (error) {
        return this._toErrorResult(error, baseSnapshot);
      } finally {
        // Cleanup Host execution state and local tracking.
        // Also resolve drainSettled in case setup failed before drainPromise
        // was created, preventing the per-key lock from staying stuck.
        this._host.releaseExecution(key);
        this._executions.delete(key);
        resolveDrainSettled();
      }
    });

    // Lock gates on drainSettled, which is resolved in finally after cleanup.
    const lock = drainSettled.then(() => undefined);
    this._executionLocks.set(key, lock);
    lock.finally(() => {
      if (this._executionLocks.get(key) === lock) {
        this._executionLocks.delete(key);
      }
    });

    return await run;
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
    }
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  /**
   * Run the drain-effect-drain loop until the mailbox is fully processed.
   *
   * Mirrors the termination condition in ManifestoHost.dispatch():
   * break only when the mailbox is empty AND no pending effects.
   *
   * 1. drain(key) — process one cycle of queued jobs
   * 2. If effects are pending, wait for them (FulfillEffect job will be enqueued)
   * 3. If mailbox still has queued work (e.g. from runner teardown microtask
   *    re-scheduling per RUN-4/LIVE-4), re-drain
   * 4. Repeat until no pending effects and no queued work
   */
  private async _drainToCompletion(key: ExecutionKey): Promise<void> {
    for (let i = 0; i < MAX_DRAIN_ITERATIONS; i++) {
      await this._host.drain(key);

      // Mirror dispatch(): check for fatal errors after each drain cycle.
      // Fatal errors are tracked in a separate Host map (not in
      // snapshot.system.lastError), so hasPendingEffects/hasQueuedWork
      // both return false after a fatal — without this check the loop
      // would exit "normally" and the caller would report "completed".
      if (this._host.hasFatalError(key)) {
        throw new HostFatalError(key);
      }

      if (this._host.hasPendingEffects(key)) {
        await this._host.waitForPendingEffects(key);
        continue; // FulfillEffect job enqueued → re-drain
      }

      // Mirror dispatch(): only break when mailbox is truly empty.
      // processMailbox may re-schedule via microtask during runner
      // teardown (RUN-4/LIVE-4), leaving queued jobs after drain().
      if (!this._host.hasQueuedWork(key)) {
        return;
      }
    }

    // Iteration cap exhausted — execution may not have reached terminal state.
    // Throw so the caller reports failure rather than a false "completed".
    throw new DrainIterationCapError(key, MAX_DRAIN_ITERATIONS);
  }

  /**
   * Derive outcome from terminal snapshot.
   *
   * WORLD-HEXEC-6: World's deriveOutcome(terminalSnapshot) is authoritative;
   * this is an advisory hint matching the same logic.
   */
  private _deriveOutcome(snapshot: Snapshot): "completed" | "failed" {
    if (snapshot.system.lastError != null) return "failed";
    if (
      snapshot.system.pendingRequirements &&
      snapshot.system.pendingRequirements.length > 0
    ) {
      return "failed";
    }
    return "completed";
  }

  /**
   * Build HostExecutionResult from a terminal snapshot.
   */
  private _toResult(terminalSnapshot: Snapshot): HostExecutionResult {
    const outcome = this._deriveOutcome(terminalSnapshot);

    const traceRef: ArtifactRef | undefined = this._options.traceEnabled
      ? {
          uri: `trace://execution/${Date.now().toString(36)}`,
          hash: `hash_${Math.random().toString(36).slice(2, 10)}`,
        }
      : undefined;

    const error: ErrorValue | undefined =
      terminalSnapshot.system.lastError != null
        ? terminalSnapshot.system.lastError
        : undefined;

    return {
      outcome,
      terminalSnapshot,
      error,
      traceRef,
    };
  }

  /**
   * Convert error to HostExecutionResult.
   *
   * Injects failure markers (status + lastError) into the terminal snapshot
   * so that World's deriveOutcome(terminalSnapshot) sees the failure, not
   * just the advisory `error` field on HostExecutionResult.
   */
  private _toErrorResult(
    error: unknown,
    baseSnapshot: Snapshot,
  ): HostExecutionResult {
    const errorValue: ErrorValue = {
      code: error instanceof ExecutionTimeoutError
        ? "EXECUTION_TIMEOUT"
        : error instanceof ExecutionAbortedError
        ? "EXECUTION_ABORTED"
        : error instanceof DrainIterationCapError
        ? "DRAIN_ITERATION_CAP"
        : error instanceof HostFatalError
        ? "HOST_FATAL_ERROR"
        : "EXECUTION_ERROR",
      message: error instanceof Error ? error.message : String(error),
      source: {
        actionId: "host-executor",
        nodePath: "execute",
      },
      timestamp: Date.now(),
    };

    // Stamp failure into the snapshot itself so downstream consumers
    // (World.deriveOutcome) cannot misinterpret it as successful.
    const terminalSnapshot: Snapshot = {
      ...baseSnapshot,
      system: {
        ...baseSnapshot.system,
        status: "error",
        lastError: errorValue,
      },
    };

    return {
      outcome: "failed",
      terminalSnapshot,
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
 * Error thrown when a Host fatal error is detected during drain.
 * Fatal errors are tracked in a Host-internal map and are NOT reflected
 * in snapshot.system.lastError, so the drain loop must check explicitly.
 */
export class HostFatalError extends Error {
  readonly key: ExecutionKey;

  constructor(key: ExecutionKey) {
    super(`Host fatal error during execution for key: ${key}`);
    this.name = "HostFatalError";
    this.key = key;
  }
}

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
 * Error thrown when drain loop hits MAX_DRAIN_ITERATIONS without reaching
 * terminal state. Prevents false "completed" reports.
 */
export class DrainIterationCapError extends Error {
  readonly key: ExecutionKey;
  readonly iterations: number;

  constructor(key: ExecutionKey, iterations: number) {
    super(
      `Drain loop exhausted ${iterations} iterations without reaching terminal state for key: ${key}`
    );
    this.name = "DrainIterationCapError";
    this.key = key;
    this.iterations = iterations;
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
