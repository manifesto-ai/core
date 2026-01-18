/**
 * StartIntent Job Handler for Host v2.0.2
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
import { getHostState } from "../types/host-state.js";

/**
 * Handle StartIntent job
 *
 * Note: job handlers are synchronous; use computeSync.
 *
 * @see SPEC §10.2.2 Job Handler Await Ban
 * @see SPEC §10.2.4 Compute Result and Effect Request Ordering
 */
export function handleStartIntent(
  job: StartIntentJob,
  ctx: ExecutionContext
): void {
  // Emit job:start trace
  ctx.trace({
    t: "job:start",
    key: ctx.key,
    jobType: "StartIntent",
    jobId: job.id,
  });

  // Get fresh snapshot (JOB-4)
  let snapshot = ctx.getSnapshot();

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

  // Store intent slot in data.$host (HOST-NS-1)
  const hostState = getHostState(snapshot.data);
  const intentSlots = hostState?.intentSlots ?? {};
  const intentSlot =
    job.intent.input === undefined
      ? { type: job.intent.type }
      : { type: job.intent.type, input: job.intent.input };
  const nextSlots = {
    ...intentSlots,
    [job.intentId]: intentSlot,
  };
  ctx.applyPatches(
    [
      {
        op: "merge",
        path: "$host",
        value: { intentSlots: nextSlots },
      },
    ],
    "host-intent-slot"
  );
  snapshot = ctx.getSnapshot();

  // Call core.computeSync() - synchronous internal computation
  const result = ctx.core.computeSync(
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
        job.intent
      );
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
