import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot } from "../schema/snapshot.js";
import type { Patch, PatchPath } from "../schema/patch.js";
import type { HostContext } from "../schema/host-context.js";
import type { FieldSpec } from "../schema/field.js";
import { evaluateComputed } from "../evaluator/computed.js";
import { isOk, isErr } from "../schema/common.js";
import type { SystemState, ErrorValue } from "../schema/snapshot.js";
import { createError } from "../errors.js";
import {
  getFieldSpecAtSegments,
  validateValueAgainstFieldSpec,
} from "./validation-utils.js";
import {
  isSafePatchPath,
  mergeAtPatchPath,
  patchPathToDisplayString,
  setByPatchPath,
  unsetByPatchPath,
} from "../utils/patch-path.js";

const PLATFORM_NAMESPACE_SPEC: FieldSpec = { type: "object", required: false };

/**
 * Apply patches to snapshot.data and recompute computed values.
 *
 * Patch targets are rooted at snapshot.data only.
 * System transitions are handled by applySystemDelta().
 */
export function apply(
  schema: DomainSchema,
  snapshot: Snapshot,
  patches: readonly Patch[],
  context: HostContext
): Snapshot {
  let newData = snapshot.data;
  let newSystem: SystemState = snapshot.system;
  const newInput = snapshot.input;
  const validationErrors: ErrorValue[] = [];
  const rootSpec: FieldSpec = { type: "object", required: true, fields: schema.state.fields };

  for (const patch of patches) {
    const displayPath = patchPathToDisplayString(patch.path);

    if (!isSafePatchPath(patch.path)) {
      validationErrors.push(createError(
        "PATH_NOT_FOUND",
        `Unsafe patch path: ${displayPath}`,
        snapshot.system.currentAction ?? "",
        displayPath,
        context.now,
        { patch }
      ));
      continue;
    }

    const bypassRoot = getPlatformBypassRoot(patch.path);
    if (bypassRoot) {
      if (patch.op !== "unset") {
        if (patch.path.length === 1) {
          const platformRootResult = validateValueAgainstFieldSpec(
            patch.value,
            PLATFORM_NAMESPACE_SPEC,
            {
              allowPartial: patch.op === "merge",
              allowUndefined: false,
            }
          );
          if (!platformRootResult.ok) {
            validationErrors.push(createError(
              "TYPE_MISMATCH",
              `Invalid patch value at ${displayPath}: ${platformRootResult.message ?? "type mismatch"}`,
              snapshot.system.currentAction ?? "",
              displayPath,
              context.now,
              { patch }
            ));
            continue;
          }
        }

        if (patch.op === "merge" && !isMergeTargetCompatible(newData, patch.path)) {
          validationErrors.push(createError(
            "TYPE_MISMATCH",
            `Invalid merge target at ${displayPath}: target path must be an object or absent`,
            snapshot.system.currentAction ?? "",
            displayPath,
            context.now,
            { patch }
          ));
          continue;
        }
      }

      newData = applyPatch(newData, patch);
      continue;
    }

    const fieldSpec = getFieldSpecAtSegments(rootSpec, patch.path);
    if (!fieldSpec) {
      validationErrors.push(createError(
        "PATH_NOT_FOUND",
        `Unknown patch path: ${displayPath}`,
        snapshot.system.currentAction ?? "",
        displayPath,
        context.now,
        { patch }
      ));
      continue;
    }

    if (patch.op === "merge" && !isMergeTargetCompatible(newData, patch.path)) {
      validationErrors.push(createError(
        "TYPE_MISMATCH",
        `Invalid merge target at ${displayPath}: target path must be an object or absent`,
        snapshot.system.currentAction ?? "",
        displayPath,
        context.now,
        { patch }
      ));
      continue;
    }

    if (patch.op !== "unset") {
      const result = validateValueAgainstFieldSpec(patch.value, fieldSpec, {
        allowPartial: patch.op === "merge",
        allowUndefined: false,
      });
      if (!result.ok) {
        validationErrors.push(createError(
          "TYPE_MISMATCH",
          `Invalid patch value at ${displayPath}: ${result.message ?? "type mismatch"}`,
          snapshot.system.currentAction ?? "",
          displayPath,
          context.now,
          { patch }
        ));
        continue;
      }
    }

    newData = applyPatch(newData, patch);
  }

  if (validationErrors.length > 0) {
    const lastError = validationErrors[validationErrors.length - 1];
    newSystem = {
      ...newSystem,
      status: "error",
      lastError,
      errors: [...newSystem.errors, ...validationErrors],
    };
  }

  const intermediateSnapshot: Snapshot = {
    ...snapshot,
    data: newData,
    system: newSystem,
    input: newInput,
  };

  const computedResult = evaluateComputed(schema, intermediateSnapshot);
  let computed = snapshot.computed;
  if (isOk(computedResult)) {
    computed = computedResult.value;
  } else if (isErr(computedResult)) {
    const error = computedResult.error;
    computed = {};
    newSystem = {
      ...newSystem,
      status: "error",
      lastError: error,
      errors: [...newSystem.errors, error],
    };
  }

  return {
    data: newData,
    computed,
    system: newSystem,
    input: newInput,
    meta: {
      ...snapshot.meta,
      version: snapshot.meta.version + 1,
      timestamp: context.now,
      randomSeed: context.randomSeed,
    },
  };
}

function getPlatformBypassRoot(path: PatchPath): string | null {
  const first = path[0];
  if (first.kind !== "prop") {
    return null;
  }
  return first.name.startsWith("$") ? first.name : null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

/**
 * Merge target is valid when:
 * - path is absent, or
 * - existing target is an object.
 */
function isMergeTargetCompatible(root: unknown, path: PatchPath): boolean {
  let current: unknown = root;

  for (const segment of path) {
    if (current === undefined) {
      return true;
    }

    if (segment.kind === "prop") {
      if (!isObjectRecord(current)) {
        return false;
      }
      current = current[segment.name];
      continue;
    }

    if (!Array.isArray(current)) {
      return false;
    }
    current = current[segment.index];
  }

  if (current === undefined) {
    return true;
  }
  return isObjectRecord(current);
}

function applyPatch(value: unknown, patch: Patch): unknown {
  switch (patch.op) {
    case "set":
      return setByPatchPath(value, patch.path, patch.value);
    case "unset":
      return unsetByPatchPath(value, patch.path);
    case "merge":
      return mergeAtPatchPath(value, patch.path, patch.value);
  }
}
