import {
  toJcs,
  type ComputeResult,
  type ErrorValue,
  type Snapshot,
  type SystemDelta,
} from "@manifesto-ai/core";

import type { ExecutionContext } from "../types/execution.js";

export function applyComputeResult(
  ctx: ExecutionContext,
  result: ComputeResult,
): { readonly snapshot: Snapshot; readonly interlockError: ErrorValue | null } {
  const beforePatches = ctx.getSnapshot();
  const afterPatches = ctx.applyPatches(result.patches, "compute");
  const patchError = getNewSystemError(beforePatches, afterPatches);

  const beforeNamespace = ctx.getSnapshot();
  const afterNamespace = ctx.applyNamespaceDeltas(result.namespaceDelta ?? [], "compute");
  const namespaceError = getNewSystemError(beforeNamespace, afterNamespace);
  const interlockError = namespaceError ?? patchError;

  const systemDelta = interlockError
    ? preserveInterlockError(result.systemDelta, interlockError)
    : result.systemDelta;
  const snapshot = ctx.applySystemDelta(systemDelta, "compute");

  return { snapshot, interlockError };
}

function preserveInterlockError(delta: SystemDelta, error: ErrorValue): SystemDelta {
  return {
    ...delta,
    status: "error",
    currentAction: null,
    lastError: error,
    addRequirements: [],
    removeRequirementIds: delta.removeRequirementIds ?? [],
  };
}

function getNewSystemError(before: Snapshot, after: Snapshot): ErrorValue | null {
  if (after.system.status !== "error" || after.system.lastError === null) {
    return null;
  }

  if (isSameErrorValue(before.system.lastError, after.system.lastError)) {
    return null;
  }

  return after.system.lastError;
}

function isSameErrorValue(
  left: Snapshot["system"]["lastError"],
  right: Snapshot["system"]["lastError"],
): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }
  return toJcs(left) === toJcs(right);
}
