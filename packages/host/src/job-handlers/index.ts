/**
 * Job Dispatcher for Host v2.0.1
 *
 * Routes jobs to their appropriate handlers.
 *
 * @see host-SPEC-v2.0.1.md §10.2 Run-to-Completion Job Model
 */

import type { ExecutionContext } from "../types/execution.js";
import type { Job } from "../types/job.js";
import { handleStartIntent } from "./start-intent.js";
import { handleContinueCompute } from "./continue-compute.js";
import { handleFulfillEffect } from "./fulfill-effect.js";
import { handleApplyPatches } from "./apply-patches.js";

/**
 * Run a job
 *
 * Note: Some job handlers need to await core.compute() which is async.
 * However, core.compute() is internal computation, not external IO.
 * The SPEC JOB-1 bans awaiting "external work (effects, network, translator)".
 *
 * @see SPEC §10.2.1 JOB-1: Job handlers MUST NOT await external work
 */
export async function runJob(job: Job, ctx: ExecutionContext): Promise<void> {
  switch (job.type) {
    case "StartIntent":
      await handleStartIntent(job, ctx);
      break;

    case "ContinueCompute":
      await handleContinueCompute(job, ctx);
      break;

    case "FulfillEffect":
      handleFulfillEffect(job, ctx);
      break;

    case "ApplyPatches":
      handleApplyPatches(job, ctx);
      break;

    default: {
      // Exhaustive check - TypeScript will error if we miss a case
      const _exhaustiveCheck: never = job;
      throw new Error(`Unknown job type: ${(_exhaustiveCheck as Job).type}`);
    }
  }
}

// Re-export individual handlers for testing
export { handleStartIntent } from "./start-intent.js";
export { handleContinueCompute } from "./continue-compute.js";
export { handleFulfillEffect } from "./fulfill-effect.js";
export { handleApplyPatches } from "./apply-patches.js";
