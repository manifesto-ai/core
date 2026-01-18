/**
 * Job Dispatcher for Host v2.0.2
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
 * Job handlers are synchronous; effect execution is split outside the mailbox.
 */
export function runJob(job: Job, ctx: ExecutionContext): void {
  switch (job.type) {
    case "StartIntent":
      handleStartIntent(job, ctx);
      break;

    case "ContinueCompute":
      handleContinueCompute(job, ctx);
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
