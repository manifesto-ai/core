/**
 * ContinueCompute Job Handler for Host v2.0.2
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
 * Note: job handlers are synchronous; use computeSync.
 *
 * @see SPEC §6.3 Re-Entry Requirement
 */
export function handleContinueCompute(
  job: ContinueComputeJob,
  ctx: ExecutionContext
): void {
  // Emit job:start trace
  ctx.trace({
    t: "job:start",
    key: ctx.key,
    jobType: "ContinueCompute",
    jobId: job.id,
  });

  // Get fresh snapshot (JOB-4)
  const snapshot = ctx.getSnapshot();

  // Reset and freeze context for this job (CTX-1~5)
  ctx.resetFrozenContext();
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

  // Call core.computeSync() - synchronous internal computation
  const result = ctx.core.computeSync(
    ctx.schema,
    snapshot,
    intent,
    frozenContext
  );
  ctx.recordCoreTrace?.(result.trace);

  // Emit core:compute trace
  ctx.trace({
    t: "core:compute",
    key: ctx.key,
    intentId: job.intentId,
    iteration,
  });

  // Interlock order: apply(patches) -> applyNamespaceDeltas(namespaceDelta) -> applySystemDelta(systemDelta) -> dispatch
  ctx.applyPatches(result.patches, "compute");
  ctx.applyNamespaceDeltas(result.namespaceDelta ?? [], "compute");
  ctx.applySystemDelta(result.systemDelta, "compute");

  // Check terminal states
  if (
    result.status === "complete"
    || result.status === "error"
    || result.status === "halted"
  ) {
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
    // Read requirements from snapshot after apply (COMP-REQ-INTERLOCK-2)
    const requirements = ctx.getSnapshot().system.pendingRequirements;
    const requirement = requirements[0];

    if (requirement) {
      // Dispatch a single effect request (ORD-SERIAL)
      ctx.trace({
        t: "effect:dispatch",
        key: ctx.key,
        requirementId: requirement.id,
        effectType: requirement.type,
      });

      ctx.requestEffectExecution(
        job.intentId,
        requirement.id,
        requirement.type,
        requirement.params,
        intent
      );
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
