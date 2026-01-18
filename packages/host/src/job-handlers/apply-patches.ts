/**
 * ApplyPatches Job Handler for Host v2.0.1
 *
 * Handles direct patch application without requirement clearing.
 *
 * @see host-SPEC-v2.0.1.md Appendix C.3
 */

import type { ExecutionContext } from "../types/execution.js";
import type { ApplyPatchesJob } from "../types/job.js";

/**
 * Handle ApplyPatches job
 *
 * Used for direct state mutations (rare), not for Core Requirements.
 *
 * @see SPEC Appendix C.3 When to Use Each
 */
export function handleApplyPatches(
  job: ApplyPatchesJob,
  ctx: ExecutionContext
): void {
  // Emit job:start trace
  ctx.trace({
    t: "job:start",
    key: ctx.key,
    jobType: "ApplyPatches",
    jobId: job.id,
  });

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

  // Apply patches directly
  if (job.patches.length > 0) {
    ctx.applyPatches(job.patches, job.source);
  }

  // Emit job:end trace
  ctx.trace({
    t: "job:end",
    key: ctx.key,
    jobType: "ApplyPatches",
    jobId: job.id,
  });
}
