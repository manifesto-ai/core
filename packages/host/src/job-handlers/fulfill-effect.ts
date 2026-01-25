/**
 * FulfillEffect Job Handler for Host v2.0.1
 *
 * Handles effect result application with stale/duplicate protection.
 *
 * @see host-SPEC-v2.0.1.md §10.7 FulfillEffect Job Contract
 * @see host-SPEC-v2.0.1.md §13.4 FulfillEffect Error Handling
 *
 * Key requirements:
 * - FULFILL-0: FulfillEffect MUST verify requirementId exists in pendingRequirements before applying
 * - FULFILL-1: FulfillEffect MUST apply result patches (only if FULFILL-0 passes)
 * - FULFILL-2: FulfillEffect MUST clear requirement from pendingRequirements
 * - FULFILL-3: FulfillEffect MUST enqueue ContinueCompute
 * - FULFILL-4: Steps 0, 1, 2, 3 MUST be executed in one job (no splitting)
 * - ERR-FE-1: FulfillEffect MUST guarantee requirement is removed from pending, even on error
 * - ERR-FE-2: Apply failure does NOT exempt from clear obligation
 * - ERR-FE-3: If clear itself fails, escalate to ExecutionKey-level fatal
 * - ERR-FE-4: Any FulfillEffect error MUST prevent requirementId from being re-executed
 * - ERR-FE-5: Error patch recording is best-effort; failure MUST NOT block continue
 */

import type { Patch, Requirement } from "@manifesto-ai/core";
import type { ExecutionContext } from "../types/execution.js";
import type { FulfillEffectJob } from "../types/job.js";
import { createContinueComputeJob } from "../types/job.js";
import { getHostState } from "../types/host-state.js";

/**
 * Handle FulfillEffect job
 *
 * This handler implements the complete requirement lifecycle atomically:
 * 1. Stale check (FULFILL-0)
 * 2. Apply result patches (FULFILL-1)
 * 3. Clear requirement (FULFILL-2)
 * 4. Enqueue ContinueCompute (FULFILL-3)
 *
 * @see SPEC §10.7.3 Implementation (Stale-Safe)
 * @see SPEC §13.4.3 Safe FulfillEffect Pattern
 */
export function handleFulfillEffect(
  job: FulfillEffectJob,
  ctx: ExecutionContext
): void {
  // Emit job:start trace
  ctx.trace({
    t: "job:start",
    key: ctx.key,
    jobType: "FulfillEffect",
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

  const snapshot = ctx.getSnapshot();
  const requirement = snapshot.system.pendingRequirements.find(
    (r) => r.id === job.requirementId
  );

  // FULFILL-0: Check if requirement is still pending
  if (!requirement) {
    // Stale or duplicate - requirement already processed
    ctx.trace({
      t: "effect:fulfill:drop",
      key: ctx.key,
      requirementId: job.requirementId,
      reason: "stale",
    });

    // Emit job:end trace
    ctx.trace({
      t: "job:end",
      key: ctx.key,
      jobType: "FulfillEffect",
      jobId: job.id,
    });
    return; // MUST NOT apply, MUST NOT continue
  }

  let applyError: Error | null = null;

  // Step 1: Attempt apply (FULFILL-1) - may fail
  try {
    if (job.resultPatches.length > 0) {
      ctx.applyPatches(job.resultPatches, "effect");
    }
    ctx.trace({
      t: "effect:fulfill:apply",
      key: ctx.key,
      requirementId: job.requirementId,
      patchCount: job.resultPatches.length,
    });
  } catch (error) {
    applyError = error instanceof Error ? error : new Error(String(error));
    ctx.trace({
      t: "effect:fulfill:error",
      key: ctx.key,
      requirementId: job.requirementId,
      phase: "apply",
      error: applyError.message,
    });
    // ERR-FE-2: DO NOT RETURN - must still clear
  }

  // Step 2: ALWAYS clear (FULFILL-2, ERR-FE-1, ERR-FE-2)
  try {
    ctx.clearRequirement(job.requirementId);
    ctx.trace({
      t: "requirement:clear",
      key: ctx.key,
      requirementId: job.requirementId,
    });
  } catch (clearError) {
    // ERR-FE-3: Clear failure is fatal - cannot recover safely
    ctx.trace({
      t: "effect:fulfill:error",
      key: ctx.key,
      requirementId: job.requirementId,
      phase: "clear",
      error: clearError instanceof Error ? clearError.message : String(clearError),
    });
    ctx.escalateToFatal(
      job.intentId,
      clearError instanceof Error ? clearError : new Error(String(clearError))
    );

    // Emit job:end trace
    ctx.trace({
      t: "job:end",
      key: ctx.key,
      jobType: "FulfillEffect",
      jobId: job.id,
    });
    return; // Cannot continue - state is inconsistent
  }

  // Step 3: Record error if apply failed (best-effort) (ERR-FE-5)
  if (applyError) {
    try {
      applyHostErrorPatch(
        job.intentId,
        requirement,
        { code: "EFFECT_APPLY_FAILED", message: applyError.message },
        ctx
      );
    } catch (patchError) {
      // ERR-FE-5: Error patch failure is logged but does NOT block continue
      ctx.trace({
        t: "effect:fulfill:error",
        key: ctx.key,
        requirementId: job.requirementId,
        phase: "error-patch",
        error: patchError instanceof Error ? patchError.message : String(patchError),
      });
    }
  }

  // Step 3b: Record effect execution error if present (best-effort)
  if (job.effectError) {
    try {
      applyHostErrorPatch(job.intentId, requirement, job.effectError, ctx);
    } catch (patchError) {
      ctx.trace({
        t: "effect:fulfill:error",
        key: ctx.key,
        requirementId: job.requirementId,
        phase: "error-patch",
        error: patchError instanceof Error ? patchError.message : String(patchError),
      });
    }
  }

  // Step 4: Continue (FULFILL-3) - MUST happen
  ctx.mailbox.enqueue(createContinueComputeJob(job.intentId, undefined, job.intent));
  ctx.trace({
    t: "continue:enqueue",
    key: ctx.key,
    intentId: job.intentId,
  });

  // Emit job:end trace
  ctx.trace({
    t: "job:end",
    key: ctx.key,
    jobType: "FulfillEffect",
    jobId: job.id,
  });
}

/**
 * Apply error patch for effect failure
 *
 * @see SPEC §13.4.4 Error Patch Recording
 */
function applyHostErrorPatch(
  intentId: string,
  requirement: Requirement,
  error: { code: string; message: string },
  ctx: ExecutionContext
): void {
  const snapshot = ctx.getSnapshot();
  const frozenContext = ctx.getFrozenContext();
  const hostState = getHostState(snapshot.data);
  const existingErrors = hostState?.errors ?? [];

  const errorValue = {
    code: error.code,
    message: error.message,
    source: {
      actionId: requirement.actionId,
      nodePath: requirement.flowPosition.nodePath,
    },
    timestamp: frozenContext.now,
    context: {
      intentId,
      requirementId: requirement.id,
      effectType: requirement.type,
    },
  };

  const patches: Patch[] = [
    {
      op: "merge",
      path: "$host",
      value: { lastError: errorValue, errors: [...existingErrors, errorValue] },
    },
  ];

  ctx.applyPatches(patches, "error");
}
