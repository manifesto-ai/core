/**
 * Finalize Stage
 *
 * Phase 9: Create terminal ActionResult, handle completed/failed paths,
 * end transaction, emit action:completed, set result, cleanup.
 *
 * Always runs (not skippable).
 *
 * @see ADR-004 Phase 3
 * @module
 */

import type { ActionResult } from "@manifesto-ai/shared";
import { toClientState } from "@manifesto-ai/shared";
import type { PipelineContext, FinalizeDeps, StageResult } from "./types.js";

/**
 * Execute the Finalize stage.
 *
 * Creates the terminal ActionResult based on host execution outcome,
 * emits audit:failed (on failure), updates system.lastError (on failure),
 * ends the subscription transaction, emits action:completed, sets the
 * handle result, and cleans up proposal/liveness tracking.
 */
export async function finalize(
  ctx: PipelineContext,
  deps: FinalizeDeps
): Promise<StageResult> {
  const { handle, actionType, actorId, branchId } = ctx;
  const { lifecycleManager, subscriptionStore, proposalManager, livenessGuard, getCurrentState, setCurrentState } = deps;
  const { execResult } = ctx.execute!;
  const { newWorldId, delta, decisionId } = ctx.persist!;
  const proposal = ctx.prepare!.proposal;

  // ==== Phase 9: completed/failed ====
  let finalResult: ActionResult;

  if (execResult.outcome === "completed") {
    handle._transitionTo("completed", {
      kind: "completed",
      worldId: newWorldId,
    });

    finalResult = {
      status: "completed" as const,
      worldId: newWorldId,
      proposalId: handle.proposalId,
      decisionId,
      stats: {
        durationMs: Date.now() - proposal.createdAt,
        effectCount: 0,
        patchCount: delta.patches.length,
      },
      runtime: "domain" as const,
    };
  } else {
    // Failed
    handle._transitionTo("failed", {
      kind: "failed",
      error: execResult.error ?? {
        code: "EXECUTION_FAILED",
        message: "Execution failed",
        source: { actionId: handle.proposalId, nodePath: "" },
        timestamp: Date.now(),
      },
    });

    // Update system.lastError
    const currentState = getCurrentState();
    setCurrentState(toClientState({
      ...currentState,
      system: {
        ...currentState.system,
        lastError: execResult.error ?? null,
        errors: [
          ...currentState.system.errors,
          ...(execResult.error ? [execResult.error] : []),
        ],
      },
    }));

    finalResult = {
      status: "failed" as const,
      proposalId: handle.proposalId,
      decisionId,
      error: execResult.error ?? {
        code: "EXECUTION_FAILED",
        message: "Execution failed",
        source: { actionId: handle.proposalId, nodePath: "" },
        timestamp: Date.now(),
      },
      worldId: newWorldId,
      runtime: "domain" as const,
    };

    // Emit audit:failed
    await lifecycleManager.emitHook(
      "audit:failed",
      {
        operation: actionType,
        error: execResult.error ?? {
          code: "EXECUTION_FAILED",
          message: "Execution failed",
          source: { actionId: handle.proposalId, nodePath: "" },
          timestamp: Date.now(),
        },
        proposalId: handle.proposalId,
      },
      { actorId, branchId }
    );
  }

  // End transaction
  subscriptionStore.endTransaction();

  // Emit action:completed
  await lifecycleManager.emitHook(
    "action:completed",
    { proposalId: handle.proposalId, result: finalResult },
    { actorId, branchId }
  );

  handle._setResult(finalResult);

  // Cleanup proposal tracking state
  proposalManager.cleanup(handle.proposalId);
  livenessGuard.cleanup(handle.proposalId);

  return { halted: false };
}
