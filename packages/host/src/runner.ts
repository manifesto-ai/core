/**
 * Single-Runner for Host v2.0.1
 *
 * Implements the single-runner per ExecutionKey with lost-wakeup prevention.
 *
 * @see host-SPEC-v2.0.1.md §10.3 Single-Runner Invariant
 * @see host-SPEC-v2.0.1.md §10.5 Mailbox Liveness Guarantee
 *
 * Key requirements:
 * - RUN-1: At most one runner per ExecutionKey at any time
 * - RUN-2: Re-entrant processing attempts MUST return immediately
 * - RUN-3: Runner guard MUST be maintained across async yields
 * - RUN-4: Runner MUST re-check mailbox before releasing guard (lost wakeup prevention)
 * - LIVE-1: Every enqueued job MUST eventually be processed
 * - LIVE-2: When queue transitions from empty to non-empty, runner MUST be kicked/scheduled
 * - LIVE-3: Runner kick failure MUST be logged and retried
 * - LIVE-4: Kick blocked by runnerActive MUST be remembered and retried after runner exits
 */

import type { ExecutionKey, ExecutionContext, Runtime } from "./types/execution.js";
import type { Job } from "./types/job.js";
import { runJob } from "./job-handlers/index.js";

/**
 * Runner state for tracking active runners and blocked kicks
 *
 * @see SPEC §10.3.3 Implementation Pattern
 */
export interface RunnerState {
  /**
   * Set of execution keys with active runners
   * @see RUN-1, RUN-2
   */
  readonly runnerActive: Set<ExecutionKey>;

  /**
   * Set of execution keys with blocked kick requests
   * @see LIVE-4
   */
  readonly kickRequested: Set<ExecutionKey>;
}

/**
 * Create initial runner state
 */
export function createRunnerState(): RunnerState {
  return {
    runnerActive: new Set(),
    kickRequested: new Set(),
  };
}

/**
 * Process the mailbox for an execution key
 *
 * This is the core runner function implementing single-runner semantics
 * with lost-wakeup prevention.
 *
 * @see SPEC §10.3.3 Implementation Pattern
 *
 * @param ctx - Execution context (includes mailbox, runtime, etc.)
 * @param state - Runner state for coordination
 */
export async function processMailbox(
  ctx: ExecutionContext,
  state: RunnerState
): Promise<void> {
  const { key, mailbox, runtime } = ctx;

  // RUN-2: Re-entrant attempts return immediately, but remember the kick
  if (state.runnerActive.has(key)) {
    state.kickRequested.add(key); // LIVE-4: Remember blocked kick
    return;
  }

  // RUN-1: Mark runner as active
  state.runnerActive.add(key);

  // Emit runner:start trace
  ctx.trace({
    t: "runner:start",
    key,
    timestamp: runtime.now(),
  });

  try {
    // JOB-5: Mailbox drain loop
    while (true) {
      const job = mailbox.dequeue();
      if (!job) break;

      // Run job (may await core.compute which is internal, not external IO)
      await runJob(job, ctx);

      // MAY yield between jobs (JOB-5)
      await runtime.yield();
    }
  } finally {
    // RUN-4 + LIVE-4: Prevent lost wakeup before releasing guard
    const queueEmpty = mailbox.isEmpty();
    const kickReq = state.kickRequested.has(key);

    // Emit runner:recheck trace
    ctx.trace({
      t: "runner:recheck",
      key,
      queueEmpty,
      kickRequested: kickReq,
    });

    // Clear kick request flag
    state.kickRequested.delete(key);

    // Release the guard
    state.runnerActive.delete(key);

    // RUN-4: Re-schedule if queue not empty or kick was requested
    if (!queueEmpty || kickReq) {
      runtime.microtask(() => processMailbox(ctx, state));
    }

    // Emit runner:end trace
    ctx.trace({
      t: "runner:end",
      key,
      timestamp: runtime.now(),
    });
  }
}

/**
 * Kick the runner for an execution key
 *
 * Call this after enqueuing a job to ensure processing starts.
 *
 * @see SPEC §10.5.3 Implementation Pattern
 * @see LIVE-2: Kick runner on empty→non-empty transition
 */
export function kickRunner(
  ctx: ExecutionContext,
  state: RunnerState
): void {
  const { runtime } = ctx;

  // LIVE-2: Schedule runner processing
  runtime.microtask(() => processMailbox(ctx, state));
}

/**
 * Enqueue a job and kick the runner
 *
 * Convenience function that combines enqueue with kick.
 *
 * @see SPEC §10.5.3 Implementation Pattern
 *
 * @param job - Job to enqueue
 * @param ctx - Execution context
 * @param state - Runner state
 */
export function enqueueAndKick(
  job: Job,
  ctx: ExecutionContext,
  state: RunnerState
): void {
  const wasEmpty = ctx.mailbox.isEmpty();

  ctx.mailbox.enqueue(job);

  // LIVE-2: Kick runner on empty→non-empty transition
  if (wasEmpty) {
    kickRunner(ctx, state);
  }
}

/**
 * Check if a runner is active for an execution key
 */
export function isRunnerActive(
  key: ExecutionKey,
  state: RunnerState
): boolean {
  return state.runnerActive.has(key);
}

/**
 * Check if a kick is pending for an execution key
 */
export function isKickPending(
  key: ExecutionKey,
  state: RunnerState
): boolean {
  return state.kickRequested.has(key);
}
