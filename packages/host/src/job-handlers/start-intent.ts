/**
 * StartIntent Job Handler for Host v2.0.1
 *
 * Handles the initial processing of an intent.
 *
 * @see host-SPEC-v2.0.1.md §10.2.4 Compute Result and Effect Request Ordering
 *
 * Key requirements:
 * - COMP-REQ-INTERLOCK-1: All snapshot mutations from Core.compute() MUST be
 *   applied BEFORE effect execution requests are dispatched
 * - COMP-REQ-INTERLOCK-2: Effect dispatch list SHOULD be read from
 *   snapshot.system.pendingRequirements AFTER apply
 */

import type { ExecutionContext } from "../types/execution.js";
import type { StartIntentJob } from "../types/job.js";
import { createContinueComputeJob } from "../types/job.js";

/**
 * Handle StartIntent job
 *
 * Note: core.compute() is async but is internal computation, not external IO.
 * The SPEC JOB-1 bans awaiting "external work (effects, network, translator)".
 *
 * @see SPEC §10.2.2 Job Handler Await Ban
 * @see SPEC §10.2.4 Compute Result and Effect Request Ordering
 */
export async function handleStartIntent(
  job: StartIntentJob,
  ctx: ExecutionContext
): Promise<void> {
  // Emit job:start trace
  ctx.trace({
    t: "job:start",
    key: ctx.key,
    jobType: "StartIntent",
    jobId: job.id,
  });

  // Get fresh snapshot (JOB-4)
  const snapshot = ctx.getSnapshot();

  // Get frozen context for this job (CTX-1~5)
  const frozenContext = ctx.getFrozenContext();

  // Emit context:frozen trace
  ctx.trace({
    t: "context:frozen",
    key: ctx.key,
    jobId: job.id,
    now: frozenContext.now,
    randomSeed: frozenContext.randomSeed,
  });

  // Call core.compute() - async internal computation (not external IO)
  const result = await ctx.core.compute(
    ctx.schema,
    snapshot,
    job.intent,
    frozenContext
  );

  // Update canonical head with computed snapshot (patches already applied by Core)
  ctx.setSnapshot(result.snapshot);

  // Emit core:compute trace
  ctx.trace({
    t: "core:compute",
    key: ctx.key,
    intentId: job.intentId,
    iteration: 1,
  });

  // Emit core:apply trace to signal patches were applied from compute
  // Note: Patch count is approximate based on snapshot delta (Core applies internally)
  ctx.trace({
    t: "core:apply",
    key: ctx.key,
    patchCount: 0, // Core applies patches internally, we don't have access to count
    source: "compute",
  });

  // Check terminal states
  if (result.status === "complete" || result.status === "error") {
    // Emit job:end trace
    ctx.trace({
      t: "job:end",
      key: ctx.key,
      jobType: "StartIntent",
      jobId: job.id,
    });
    return;
  }

  // Status is "pending" - execute effects
  if (result.status === "pending") {
    // Read requirements from computed result (consistent with snapshot)
    const requirements = result.requirements;

    if (requirements.length > 0) {
      // Dispatch effect requests (async, outside mailbox)
      for (const req of requirements) {
        ctx.trace({
          t: "effect:dispatch",
          key: ctx.key,
          requirementId: req.id,
          effectType: req.type,
        });

        ctx.requestEffectExecution(
          job.intentId,
          req.id,
          req.type,
          req.params,
          job.intent
        );
      }
      // Job terminates here - no continuation state
    } else {
      // No effects needed, enqueue continue
      ctx.mailbox.enqueue(createContinueComputeJob(job.intentId, 2, job.intent));
      ctx.trace({
        t: "continue:enqueue",
        key: ctx.key,
        intentId: job.intentId,
      });
    }
  }

  // Emit job:end trace
  ctx.trace({
    t: "job:end",
    key: ctx.key,
    jobType: "StartIntent",
    jobId: job.id,
  });
}
