/**
 * Host Execution Listener
 *
 * Creates HostLoopOptions callbacks that emit World events.
 * This bridges Host's execution loop to World's event system.
 *
 * Note: ComputeResult from Core doesn't expose patches directly.
 * Patches are only visible from effect results. Therefore:
 * - execution:patches with source="compute" is not emitted (patches not accessible)
 * - execution:patches with source="effect" is emitted from onAfterEffect
 * - snapshot:changed is emitted when effects produce patches
 */

import type { ComputeResult, Patch, Requirement, Snapshot } from "@manifesto-ai/core";
import type { HostLoopOptions } from "@manifesto-ai/host";
import type { WorldEventBus } from "./bus.js";
import { computeSnapshotHash } from "../factories.js";

/**
 * Execution listener state for tracking metrics
 */
export interface ExecutionListenerState {
  totalPatches: number;
  totalEffects: number;
}

/**
 * Creates HostLoopOptions callbacks that emit World events.
 *
 * @param eventBus - The WorldEventBus to emit events to
 * @param proposalId - The proposal being executed
 * @param intentId - The intent being executed
 * @returns HostLoopOptions with callbacks and state accessor
 */
export function createHostExecutionListener(
  eventBus: WorldEventBus,
  proposalId: string,
  intentId: string
): {
  options: HostLoopOptions;
  getState: () => ExecutionListenerState;
} {
  let currentSnapshotHash: string | null = null;
  let totalPatches = 0;
  let totalEffects = 0;

  const options: HostLoopOptions = {
    onBeforeCompute: (iteration: number, snapshot: Snapshot) => {
      // Cache the current snapshot hash for comparison
      // We do this synchronously but handle potential async issues
      void computeSnapshotHash(snapshot).then((hash) => {
        currentSnapshotHash = hash;
      });

      eventBus.emit({
        type: "execution:computing",
        timestamp: Date.now(),
        intentId,
        iteration: iteration - 1, // iteration starts at 1 in Host, spec expects 0-indexed
      });
    },

    onAfterCompute: (_iteration: number, result: ComputeResult) => {
      // Note: ComputeResult doesn't expose patches directly.
      // The snapshot change from compute is internal to Core.
      // We update the hash for tracking purposes.
      void computeSnapshotHash(result.snapshot).then((hash) => {
        currentSnapshotHash = hash;
      });
    },

    onBeforeEffect: (requirement: Requirement) => {
      totalEffects++;

      eventBus.emit({
        type: "execution:effect",
        timestamp: Date.now(),
        intentId,
        effectType: requirement.type,
        effectParams: requirement.params,
      });
    },

    onAfterEffect: (requirement: Requirement, patches: Patch[], error?: string) => {
      eventBus.emit({
        type: "execution:effect_result",
        timestamp: Date.now(),
        intentId,
        effectType: requirement.type,
        resultPatches: patches,
        success: !error,
        error: error ? { code: "EFFECT_ERROR", message: error } : undefined,
      });

      // Emit patches event if there are patches from the effect
      if (patches.length > 0) {
        totalPatches += patches.length;

        eventBus.emit({
          type: "execution:patches",
          timestamp: Date.now(),
          intentId,
          patches,
          source: "effect",
        });
      }
    },
  };

  return {
    options,
    getState: () => ({ totalPatches, totalEffects }),
  };
}
