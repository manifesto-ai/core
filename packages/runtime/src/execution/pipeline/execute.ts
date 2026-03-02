/**
 * Execute Stage
 *
 * Phase 5-6: Restore base snapshot, recall memory, execute via HostExecutor,
 * post-validate result scope.
 *
 * @see ADR-004 Phase 3
 * @module
 */

import type { Snapshot } from "@manifesto-ai/core";
import type { WorldId } from "@manifesto-ai/world";
import type { Intent, RecallRequest } from "../../types/index.js";
import type { PipelineContext, ExecuteDeps, PatchFormatRecovery, StageResult } from "./types.js";
import { IncompatiblePatchFormatError } from "../../errors/index.js";
import {
  appStateToSnapshot,
  normalizeSnapshot,
} from "../state-converter.js";
import { freezeRecallResult } from "../../memory/index.js";

/**
 * Execute the Execute stage.
 *
 * Restores snapshot, optionally recalls memory, runs host execution,
 * and optionally validates result scope.
 */
export async function executeHost(
  ctx: PipelineContext,
  deps: ExecuteDeps
): Promise<StageResult> {
  const { handle, actionType, input, opts } = ctx;
  const { worldStore, memoryFacade, hostExecutor, policyService, schedulerOptions, getCurrentState } = deps;
  let { baseWorldId } = ctx.prepare!;
  const { executionKey, decision } = ctx.authorize!;
  const actorId = ctx.actorId;
  const branchId = ctx.branchId;

  // ==== Phase 5: executing ====
  handle._transitionTo("executing");

  // Restore base snapshot from WorldStore
  let baseSnapshot: Snapshot;
  try {
    baseSnapshot = await worldStore.restore(baseWorldId);
  } catch (error) {
    if (error instanceof IncompatiblePatchFormatError) {
      if (deps.resetToGenesisOnPatchFormatError) {
        const recovery = normalizePatchFormatRecoveryResult(
          await deps.resetToGenesisOnPatchFormatError({
            error,
            baseWorldId,
            branchId,
          }),
          baseWorldId
        );
        baseSnapshot = recovery.snapshot;

        if (recovery.baseWorldId !== baseWorldId && ctx.prepare) {
          const nextBaseWorldId = recovery.baseWorldId;
          ctx.prepare = {
            ...ctx.prepare,
            baseWorldId: nextBaseWorldId,
            baseWorldIdStr: String(nextBaseWorldId),
            proposal: {
              ...ctx.prepare.proposal,
              baseWorld: nextBaseWorldId,
            },
          };
          baseWorldId = nextBaseWorldId;
        }
      } else {
        baseSnapshot = appStateToSnapshot(getCurrentState());
      }
    } else {
      // Fallback to current state for generic WorldStore failures
      baseSnapshot = appStateToSnapshot(getCurrentState());
    }
  }
  baseSnapshot = normalizeSnapshot(baseSnapshot);

  // Handle memory recall if requested
  if (opts?.recall) {
    try {
      const recallRequests = Array.isArray(opts.recall) ? opts.recall : [opts.recall];
      const recallResult = await memoryFacade.recall(
        recallRequests as RecallRequest[],
        { actorId, branchId }
      );
      // MEM-7: Freeze recall context into snapshot
      baseSnapshot = freezeRecallResult(baseSnapshot, recallResult);
    } catch (recallError) {
      // Recall failure doesn't block execution, but we log it
      console.warn("[Manifesto] Memory recall failed:", recallError);
    }
  }

  // Create Intent for execution
  const uniqueIntentSuffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const intent: Intent = {
    type: actionType,
    input,
    intentId: `intent_${executionKey}_${uniqueIntentSuffix}`,
  };

  // Execute via HostExecutor
  const execResult = await hostExecutor.execute(
    executionKey,
    baseSnapshot,
    intent,
    {
      approvedScope: decision.scope,
      timeoutMs: schedulerOptions?.defaultTimeoutMs,
    }
  );

  // ==== Phase 6: post-validate (optional) ====
  if (decision.scope && policyService.validateResultScope) {
    const scopeValidation = policyService.validateResultScope(
      baseSnapshot,
      execResult.terminalSnapshot,
      decision.scope as import("../../types/index.js").ApprovedScope
    );

    if (!scopeValidation.valid) {
      // Scope violation - treat as warning (logged)
      console.warn("[Manifesto] Result scope validation failed:", scopeValidation.errors);
    }
  }

  // Write stage output
  (ctx as { execute?: unknown }).execute = {
    execResult,
    baseSnapshot,
    intent,
  };

  return { halted: false };
}

function normalizePatchFormatRecoveryResult(
  recovery: PatchFormatRecovery,
  defaultBaseWorldId: WorldId
): { snapshot: Snapshot; baseWorldId: WorldId } {
  if (typeof recovery === "object" && recovery !== null && "snapshot" in recovery) {
    const recovered = recovery as { snapshot: Snapshot; baseWorldId: WorldId };
    return {
      snapshot: recovered.snapshot,
      baseWorldId: recovered.baseWorldId ?? defaultBaseWorldId,
    };
  }

  return {
    snapshot: recovery,
    baseWorldId: defaultBaseWorldId,
  };
}
