/**
 * ContinueCompute Job Handler for Host v2.0.1
 *
 * Handles re-invocation of compute after effect completion.
 *
 * @see host-SPEC-v2.0.1.md §10.7.1 FULFILL-3
 */

import type { Intent } from "@manifesto-ai/core";
import type { ExecutionContext } from "../types/execution.js";
import type { ContinueComputeJob } from "../types/job.js";
import { createContinueComputeJob } from "../types/job.js";

/**
 * Handle ContinueCompute job
 *
 * Re-invokes compute with the same intentId to continue processing
 * after effect completion.
 *
 * Note: core.compute() is async but is internal computation, not external IO.
 *
 * @see SPEC §6.3 Re-Entry Requirement
 */
export async function handleContinueCompute(
  job: ContinueComputeJob,
  ctx: ExecutionContext
): Promise<void> {
  // Emit job:start trace
  ctx.trace({
    t: "job:start",
    key: ctx.key,
    jobType: "ContinueCompute",
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

  // For re-entry, we use a minimal intent with just the intentId
  // The Flow uses state-guarded patterns, so it will pick up where it left off
  const intent: Intent = {
    type: job.intent?.type ?? "continue",
    intentId: job.intentId,
    input: job.intent?.input,
  };

  const iteration = job.iteration ?? 1;

  // Call core.compute() - async internal computation (not external IO)
  const result = await ctx.core.compute(
    ctx.schema,
    snapshot,
    intent,
    frozenContext
  );

  // Update canonical head with computed snapshot (patches already applied by Core)
  ctx.setSnapshot(result.snapshot);

  // Emit core:compute trace
  ctx.trace({
    t: "core:compute",
    key: ctx.key,
    intentId: job.intentId,
    iteration,
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
      jobType: "ContinueCompute",
      jobId: job.id,
    });
    return;
  }

  // Status is "pending" - execute effects
  if (result.status === "pending") {
    // Read requirements from computed result (consistent with snapshot)
    const requirements = result.requirements;

    if (requirements.length > 0) {
      // Dispatch effect requests
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
          intent
        );
      }
    } else {
      // No effects needed, enqueue continue
      ctx.mailbox.enqueue(createContinueComputeJob(job.intentId, iteration + 1, job.intent));
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
    jobType: "ContinueCompute",
    jobId: job.id,
  });
}
