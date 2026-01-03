/**
 * Host Execution Listener
 *
 * Creates HostLoopOptions callbacks that emit World events.
 * This bridges Host's execution loop to World's event system.
 *
 * Note: ComputeResult doesn't surface patches directly; we extract them from trace.
 */

import type { ComputeResult, Patch, Requirement, Snapshot, TraceNode } from "@manifesto-ai/core";
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
  let currentSnapshot: Snapshot | null = null;
  let computeBefore: { snapshot: Snapshot; hash: string } | null = null;
  let totalPatches = 0;
  let totalEffects = 0;

  const options: HostLoopOptions = {
    onBeforeCompute: async (iteration: number, snapshot: Snapshot) => {
      const hash = await computeSnapshotHash(snapshot);
      currentSnapshotHash = hash;
      currentSnapshot = snapshot;
      computeBefore = { snapshot, hash };

      eventBus.emit({
        type: "execution:computing",
        timestamp: Date.now(),
        intentId,
        iteration: iteration - 1, // iteration starts at 1 in Host, spec expects 0-indexed
      });
    },

    onAfterCompute: async (_iteration: number, result: ComputeResult) => {
      const patches = collectPatchesFromTrace(result.trace.root);
      totalPatches += patches.length;

      eventBus.emit({
        type: "execution:patches",
        timestamp: Date.now(),
        intentId,
        patches,
        source: "compute",
      });

      const afterHash = await computeSnapshotHash(result.snapshot);
      const beforeSnapshot = computeBefore?.snapshot ?? currentSnapshot;
      const beforeHash = computeBefore?.hash ?? currentSnapshotHash;
      if (beforeSnapshot && beforeHash && beforeHash !== afterHash) {
        eventBus.emit({
          type: "snapshot:changed",
          timestamp: Date.now(),
          intentId,
          before: {
            snapshotHash: beforeHash,
            snapshot: beforeSnapshot,
          },
          after: {
            snapshotHash: afterHash,
            snapshot: result.snapshot,
          },
          cause: "patches",
        });
      }

      currentSnapshotHash = afterHash;
      currentSnapshot = result.snapshot;
      computeBefore = { snapshot: result.snapshot, hash: afterHash };
    },

    onBeforeEffect: async (requirement: Requirement) => {
      totalEffects++;

      eventBus.emit({
        type: "execution:effect",
        timestamp: Date.now(),
        intentId,
        effectType: requirement.type,
        effectParams: requirement.params,
      });
    },

    onAfterEffect: async (requirement: Requirement, patches: Patch[], error?: string) => {
      eventBus.emit({
        type: "execution:effect_result",
        timestamp: Date.now(),
        intentId,
        effectType: requirement.type,
        resultPatches: patches,
        success: !error,
        error: error ? { code: "EFFECT_ERROR", message: error } : undefined,
      });
    },

    onAfterApply: async (_source, patches: Patch[], before: Snapshot, after: Snapshot) => {
      totalPatches += patches.length;

      eventBus.emit({
        type: "execution:patches",
        timestamp: Date.now(),
        intentId,
        patches,
        source: "effect",
      });

      const beforeHash = await computeSnapshotHash(before);
      const afterHash = await computeSnapshotHash(after);
      if (beforeHash !== afterHash) {
        eventBus.emit({
          type: "snapshot:changed",
          timestamp: Date.now(),
          intentId,
          before: {
            snapshotHash: beforeHash,
            snapshot: before,
          },
          after: {
            snapshotHash: afterHash,
            snapshot: after,
          },
          cause: "effect_result",
        });
      }

      currentSnapshotHash = afterHash;
      currentSnapshot = after;
    },
  };

  return {
    options,
    getState: () => ({ totalPatches, totalEffects }),
  };
}

function collectPatchesFromTrace(root: TraceNode): Patch[] {
  const patches: Patch[] = [];

  function visit(node: TraceNode) {
    if (node.kind === "patch") {
      const op = node.inputs.op;
      const path = node.inputs.path;
      if (typeof op === "string" && typeof path === "string") {
        if (op === "unset") {
          patches.push({ op: "unset", path });
        } else if (op === "merge") {
          patches.push({ op: "merge", path, value: node.output as Record<string, unknown> });
        } else {
          patches.push({ op: "set", path, value: node.output });
        }
      }
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  visit(root);
  return patches;
}
