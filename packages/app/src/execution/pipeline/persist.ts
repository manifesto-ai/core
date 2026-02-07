/**
 * Persist Stage
 *
 * Phase 7-8: Create World/Delta, store, update state, advance head,
 * emit state:publish (exactly once per proposal — INV-9).
 *
 * @see ADR-004 Phase 3
 * @module
 */

import type { Snapshot } from "@manifesto-ai/core";
import { createWorldId, createProposalId } from "@manifesto-ai/world";
import type { World, WorldDelta } from "../../core/types/index.js";
import type { PipelineContext, PersistDeps, StageResult } from "./types.js";
import {
  snapshotToAppState,
  computePatches,
  computeSnapshotHash,
} from "../state-converter.js";
import { generateWorldId } from "../../storage/branch/index.js";

/**
 * Execute the Persist stage.
 *
 * Creates World and WorldDelta, stores them, updates app state,
 * advances branch head (BRANCH-7: only if completed), and emits
 * state:publish (INV-9: at most once per proposal).
 */
export async function persist(
  ctx: PipelineContext,
  deps: PersistDeps
): Promise<StageResult> {
  const { handle, actorId, branchId } = ctx;
  const {
    domainSchema,
    worldStore,
    subscriptionStore,
    worldHeadTracker,
    branchManager,
    proposalManager,
    lifecycleManager,
    setCurrentState,
  } = deps;
  const { baseWorldId } = ctx.prepare!;
  const { execResult, baseSnapshot } = ctx.execute!;

  // ==== Phase 7: store ====
  const newWorldIdStr = generateWorldId();
  const newWorldId = createWorldId(newWorldIdStr);
  const decisionId = `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Compute snapshot hash for the terminal snapshot
  const snapshotHash = computeSnapshotHash(execResult.terminalSnapshot);

  // Create World object
  const newWorld: World = {
    worldId: newWorldId,
    schemaHash: domainSchema?.hash ?? "unknown",
    snapshotHash,
    createdAt: Date.now(),
    createdBy: createProposalId(handle.proposalId),
  };

  // Create WorldDelta
  const delta: WorldDelta = {
    fromWorld: baseWorldId,
    toWorld: newWorldId,
    patches: computePatches(baseSnapshot, execResult.terminalSnapshot),
    createdAt: Date.now(),
  };

  // Store in WorldStore
  try {
    await worldStore.store(newWorld, delta);
  } catch (storeError) {
    console.error("[Manifesto] Failed to store World:", storeError);
    // Continue - execution was successful even if storage failed
  }

  // ==== Phase 8: update ====
  // Update state with terminal snapshot
  const newState = snapshotToAppState(execResult.terminalSnapshot);
  setCurrentState(newState);
  subscriptionStore.notify(newState);

  // BRANCH-7: Only advance head if completed (not failed)
  if (execResult.outcome === "completed") {
    worldHeadTracker.advanceHead(newWorldId);
    branchManager?.appendWorldToBranch(branchId, newWorldId);
  }

  // ==== Phase 8.5: state:publish (exactly once per proposal tick — INV-9) ====
  if (!proposalManager.wasPublished(handle.proposalId)) {
    proposalManager.markPublished(handle.proposalId);

    const publishSnapshot: Snapshot = {
      data: execResult.terminalSnapshot.data,
      computed: execResult.terminalSnapshot.computed ?? {},
      system: execResult.terminalSnapshot.system ?? {
        status: "idle",
        pendingRequirements: [],
        errors: [],
      },
      input: {},
      meta: execResult.terminalSnapshot.meta ?? {
        version: 0,
        timestamp: new Date().toISOString(),
        hash: "",
      },
    };

    await lifecycleManager.emitHook(
      "state:publish",
      {
        snapshot: publishSnapshot,
        worldId: String(newWorldId),
      },
      { actorId, branchId, worldId: String(newWorldId) }
    );
  }

  // Write stage output
  (ctx as { persist?: unknown }).persist = {
    newWorldId,
    newWorldIdStr,
    newWorld,
    delta,
    decisionId,
  };

  return { halted: false };
}
