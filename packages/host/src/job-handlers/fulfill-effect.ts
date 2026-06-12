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
 * - FULFILL-NS-1: FulfillEffect MUST apply namespace deltas before clear/continue
 * - FULFILL-2: FulfillEffect MUST clear requirement from pendingRequirements
 * - FULFILL-3: FulfillEffect MUST enqueue ContinueCompute
 * - FULFILL-4: Steps 0, 1, NS, 2, 3 MUST be executed in one job (no splitting)
 * - ERR-FE-1: FulfillEffect MUST guarantee requirement is removed from pending, even on error
 * - ERR-FE-2: Apply failure does NOT exempt from clear obligation
 * - ERR-FE-3: If clear itself fails, escalate to ExecutionKey-level fatal
 * - ERR-FE-4: Any FulfillEffect error MUST prevent requirementId from being re-executed
 * - ERR-FE-5: Error patch recording failure escalates to ExecutionKey-level fatal
 */

import {
  toJcs,
  type ErrorValue,
  type NamespaceDelta,
  type Requirement,
  type Snapshot,
} from "@manifesto-ai/core";
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
 * 3. Apply namespace deltas (FULFILL-NS-1)
 * 4. Clear requirement (FULFILL-2)
 * 5. Enqueue ContinueCompute (FULFILL-3)
 *
 * @see SPEC §10.7.3 Implementation (Stale-Safe)
 * @see SPEC §13.4.3 Safe FulfillEffect Pattern
 */
export function handleFulfillEffect(job: FulfillEffectJob, ctx: ExecutionContext): void {
  // Emit job:start trace
  ctx.trace({
    t: "job:start",
    key: ctx.key,
    jobType: "FulfillEffect",
    jobId: job.id,
  });

  // Read the transition-attempt context (CTX-1~5)
  ctx.resetFrozenContext();
  const frozenContext = ctx.getFrozenContext();

  // Emit context:frozen trace
  ctx.trace({
    t: "context:frozen",
    key: ctx.key,
    jobId: job.id,
    now: frozenContext.runtime.time.timestamp,
    randomSeed: frozenContext.runtime.random.seed,
  });

  const snapshot = ctx.getSnapshot();
  const requirement = snapshot.system.pendingRequirements.find((r) => r.id === job.requirementId);

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

  // Step 1: Attempt apply (FULFILL-1, FULFILL-NS-1) - may fail
  try {
    if (job.resultPatches.length > 0) {
      const beforePatches = ctx.getSnapshot();
      const afterPatches = ctx.applyPatches(job.resultPatches, "effect");
      applyError = getApplyReportedError(beforePatches, afterPatches);
    }
    const partitionedNamespaceDelta = partitionHostNamespaceDeltas(job.namespaceDelta ?? []);
    if (partitionedNamespaceDelta.hostDeltas.length > 0) {
      const beforeNamespace = ctx.getSnapshot();
      const afterNamespace = ctx.applyNamespaceDeltas(
        partitionedNamespaceDelta.hostDeltas,
        "effect-namespace",
      );
      applyError ??= getApplyReportedError(beforeNamespace, afterNamespace);
    }
    applyError ??= partitionedNamespaceDelta.error;
    ctx.trace({
      t: "effect:fulfill:apply",
      key: ctx.key,
      requirementId: job.requirementId,
      patchCount: job.resultPatches.length,
    });
    if (applyError) {
      ctx.trace({
        t: "effect:fulfill:error",
        key: ctx.key,
        requirementId: job.requirementId,
        phase: "apply",
        error: applyError.message,
      });
    }
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
      clearError instanceof Error ? clearError : new Error(String(clearError)),
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

  let errorRecordingFailure: Error | null = null;

  // Step 3: Record error if apply failed (ERR-FE-5)
  if (applyError) {
    try {
      errorRecordingFailure = applyHostErrorPatch(
        job.intentId,
        requirement,
        { code: "EFFECT_APPLY_FAILED", message: applyError.message },
        ctx,
      );
    } catch (patchError) {
      ctx.trace({
        t: "effect:fulfill:error",
        key: ctx.key,
        requirementId: job.requirementId,
        phase: "error-patch",
        error: patchError instanceof Error ? patchError.message : String(patchError),
      });
      errorRecordingFailure =
        patchError instanceof Error ? patchError : new Error(String(patchError));
    }
  }

  // Step 3b: Record effect execution error if present
  if (job.effectError && !errorRecordingFailure) {
    try {
      errorRecordingFailure = applyHostErrorPatch(job.intentId, requirement, job.effectError, ctx);
    } catch (patchError) {
      ctx.trace({
        t: "effect:fulfill:error",
        key: ctx.key,
        requirementId: job.requirementId,
        phase: "error-patch",
        error: patchError instanceof Error ? patchError.message : String(patchError),
      });
      errorRecordingFailure =
        patchError instanceof Error ? patchError : new Error(String(patchError));
    }
  }

  if (errorRecordingFailure) {
    ctx.trace({
      t: "effect:fulfill:error",
      key: ctx.key,
      requirementId: job.requirementId,
      phase: "error-patch",
      error: errorRecordingFailure.message,
    });
    ctx.escalateToFatal(job.intentId, errorRecordingFailure);
    ctx.trace({
      t: "job:end",
      key: ctx.key,
      jobType: "FulfillEffect",
      jobId: job.id,
    });
    return;
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

function partitionHostNamespaceDeltas(deltas: readonly NamespaceDelta[]): {
  readonly hostDeltas: readonly NamespaceDelta[];
  readonly error: Error | null;
} {
  const hostDeltas = deltas.filter((delta) => delta.namespace === "host");
  const rejectedNamespaces = [
    ...new Set(
      deltas.filter((delta) => delta.namespace !== "host").map((delta) => delta.namespace),
    ),
  ];

  if (rejectedNamespaces.length === 0) {
    return { hostDeltas, error: null };
  }

  return {
    hostDeltas,
    error: new Error(
      `Effect namespaceDelta may only target namespaces.host; received ${rejectedNamespaces.join(", ")}`,
    ),
  };
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
  ctx: ExecutionContext,
): Error | null {
  const snapshot = ctx.getSnapshot();
  const frozenContext = ctx.getFrozenContext();

  const errorValue: ErrorValue = {
    code: error.code,
    message: error.message,
    source: {
      actionId: requirement.actionId,
      nodePath: requirement.flowPosition.nodePath,
    },
    timestamp: frozenContext.runtime.time.timestamp,
    context: {
      intentId,
      requirementId: requirement.id,
      effectType: requirement.type,
    },
  };

  const after = ctx.applyNamespaceDeltas(
    [
      {
        namespace: "host",
        patches: [
          {
            op: "set",
            path: [{ kind: "prop", name: "lastError" }],
            value: errorValue,
          },
        ],
      },
    ],
    "error",
  );

  const recorded = getHostState(after)?.lastError ?? null;
  if (isSameErrorValue(recorded, errorValue)) {
    return null;
  }

  const reported = getApplyReportedError(snapshot, after);
  return new Error(
    reported
      ? `Failed to record host error: ${reported.message}`
      : "Failed to record host error in namespaces.host.lastError",
  );
}

function getApplyReportedError(before: Snapshot, after: Snapshot): Error | null {
  if (after.system.status !== "error" || after.system.lastError === null) {
    return null;
  }

  if (isSameErrorValue(before.system.lastError, after.system.lastError)) {
    return null;
  }

  return new Error(after.system.lastError.message);
}

function isSameErrorValue(
  left: ErrorValue | null | undefined,
  right: ErrorValue | null | undefined,
): boolean {
  if (left === right) {
    return true;
  }
  if (left == null || right == null) {
    return false;
  }
  return toJcs(left) === toJcs(right);
}
