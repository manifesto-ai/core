import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot } from "../schema/snapshot.js";
import type { Patch } from "../schema/patch.js";
import { setByPath, unsetByPath, mergeAtPath } from "../utils/path.js";
import { evaluateComputed } from "../evaluator/computed.js";
import { isOk } from "../schema/common.js";

/**
 * Apply patches to a snapshot
 *
 * This function:
 * 1. Applies all patches to the data
 * 2. Recomputes all computed values
 * 3. Increments the version number
 * 4. Updates the timestamp
 *
 * Note: Version and timestamp are Core-owned - Host MUST NOT modify these directly.
 */
export function apply(
  schema: DomainSchema,
  snapshot: Snapshot,
  patches: readonly Patch[]
): Snapshot {
  // 1. Apply patches to data
  let newData = snapshot.data;

  for (const patch of patches) {
    switch (patch.op) {
      case "set":
        newData = setByPath(newData, patch.path, patch.value);
        break;
      case "unset":
        newData = unsetByPath(newData, patch.path);
        break;
      case "merge":
        newData = mergeAtPath(newData, patch.path, patch.value);
        break;
    }
  }

  // 2. Create intermediate snapshot with new data
  const intermediateSnapshot: Snapshot = {
    ...snapshot,
    data: newData,
  };

  // 3. Recompute all computed values
  const computedResult = evaluateComputed(schema, intermediateSnapshot);
  const computed = isOk(computedResult) ? computedResult.value : snapshot.computed;

  // 4. Return new snapshot with updated metadata
  return {
    data: newData,
    computed,
    system: snapshot.system,
    input: snapshot.input,
    meta: {
      ...snapshot.meta,
      version: snapshot.meta.version + 1,
      timestamp: Date.now(),
    },
  };
}
