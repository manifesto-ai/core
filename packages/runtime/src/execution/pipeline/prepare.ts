/**
 * Prepare Stage
 *
 * Phase 1-2: Emit action:preparing hook, validate action type,
 * create Proposal, transition to submitted, emit action:submitted hook.
 *
 * Early exit: preparation_failed if action not found.
 *
 * @see ADR-004 Phase 3
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import { createWorldId } from "@manifesto-ai/world";
import type { ErrorValue, Proposal } from "@manifesto-ai/shared";
import type { PipelineContext, PrepareDeps, StageResult } from "./types.js";

/**
 * Execute the Prepare stage.
 *
 * Validates the action type exists in the schema and creates a Proposal.
 * If the action type is not found, emits action:completed and halts.
 */
export async function prepare(
  ctx: PipelineContext,
  deps: PrepareDeps
): Promise<StageResult> {
  const { handle, actionType, input, actorId, branchId } = ctx;
  const { domainSchema, lifecycleManager, worldHeadTracker, branchManager, subscriptionStore } = deps;

  // ==== Phase 1: preparing ====
  await lifecycleManager.emitHook(
    "action:preparing",
    {
      proposalId: handle.proposalId,
      actorId,
      branchId,
      type: actionType,
      runtime: "domain" as const,
    },
    { actorId, branchId }
  );

  handle._transitionTo("preparing");

  // Validate action type exists
  const actionDef = domainSchema?.actions[actionType];
  if (!actionDef) {
    const error: ErrorValue = {
      code: "ACTION_NOT_FOUND",
      message: `Action type '${actionType}' not found in schema`,
      source: { actionId: handle.proposalId, nodePath: "" },
      timestamp: Date.now(),
    };

    handle._transitionTo("preparation_failed", {
      kind: "preparation_failed",
      error,
    });

    const result = {
      status: "preparation_failed" as const,
      proposalId: handle.proposalId,
      error,
      runtime: handle.runtime,
    };

    subscriptionStore.endTransaction();

    await lifecycleManager.emitHook(
      "action:completed",
      { proposalId: handle.proposalId, result },
      {}
    );

    handle._setResult(result);

    return { halted: true, result };
  }

  // ==== Phase 2: submitted ====
  handle._transitionTo("submitted");

  // Create Proposal
  const baseWorldIdStr = worldHeadTracker.getCurrentHead() ?? branchManager?.currentBranch()?.head() ?? "genesis";
  const baseWorldId = createWorldId(String(baseWorldIdStr));
  const proposal: Proposal = {
    proposalId: handle.proposalId,
    actorId,
    intentType: actionType,
    intentBody: input,
    baseWorld: baseWorldId,
    branchId,
    createdAt: Date.now(),
  };

  // Emit submitted hook
  await lifecycleManager.emitHook(
    "action:submitted",
    {
      proposalId: handle.proposalId,
      actorId,
      branchId,
      type: actionType,
      input,
      runtime: "domain" as const,
    },
    { actorId, branchId }
  );

  // Write stage output
  (ctx as { prepare?: unknown }).prepare = {
    proposal,
    baseWorldId,
    baseWorldIdStr: String(baseWorldIdStr),
  };

  return { halted: false };
}
