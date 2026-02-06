import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot } from "../schema/snapshot.js";
import type { Patch } from "../schema/patch.js";
import type { HostContext } from "../schema/host-context.js";
import type { FieldSpec } from "../schema/field.js";
import { getByPath, mergeAtPath, setByPath, unsetByPath } from "../utils/path.js";
import { evaluateComputed } from "../evaluator/computed.js";
import { isOk, isErr } from "../schema/common.js";
import type { SystemState, ErrorValue } from "../schema/snapshot.js";
import { createError } from "../errors.js";
import { getFieldSpecAtPath, validateValueAgainstFieldSpec } from "./validation-utils.js";

const PLATFORM_NAMESPACE_PREFIX = "$";
const PLATFORM_NAMESPACE_SPEC: FieldSpec = { type: "object", required: false };

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
  patches: readonly Patch[],
  context: HostContext
): Snapshot {
  // 1. Apply patches to data/system/input (data is default root)
  let newData = snapshot.data;
  let newSystem: SystemState = snapshot.system;
  let newInput = snapshot.input;
  const validationErrors: ErrorValue[] = [];
  const rootSpec: FieldSpec = { type: "object", required: true, fields: schema.state.fields };

  for (const patch of patches) {
    const { root, subPath } = splitPatchPath(patch.path);
    switch (root) {
      case "data":
        {
          const platformNamespace = getPlatformNamespace(subPath);
          if (platformNamespace) {
            if (patch.op !== "unset") {
              // Platform namespaces ($*) are opaque to Core. Only root object shape is validated.
              if (subPath === platformNamespace) {
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
                    `Invalid patch value at ${patch.path}: ${platformRootResult.message ?? "type mismatch"}`,
                    snapshot.system.currentAction ?? "",
                    patch.path,
                    context.now,
                    { patch }
                  ));
                  break;
                }
              }

              if (patch.op === "merge" && !isMergeTargetCompatible(newData, subPath)) {
                validationErrors.push(createError(
                  "TYPE_MISMATCH",
                  `Invalid merge target at ${patch.path}: target path must be an object or absent`,
                  snapshot.system.currentAction ?? "",
                  patch.path,
                  context.now,
                  { patch }
                ));
                break;
              }
            }

            newData = applyPatch(newData, patch, subPath);
            break;
          }

          const fieldSpec = getFieldSpecAtPath(rootSpec, subPath);
          if (!fieldSpec) {
            validationErrors.push(createError(
              "PATH_NOT_FOUND",
              `Unknown patch path: ${patch.path}`,
              snapshot.system.currentAction ?? "",
              patch.path,
              context.now,
              { patch }
            ));
            break;
          }

          if (patch.op === "merge" && !isMergeTargetCompatible(newData, subPath)) {
            validationErrors.push(createError(
              "TYPE_MISMATCH",
              `Invalid merge target at ${patch.path}: target path must be an object or absent`,
              snapshot.system.currentAction ?? "",
              patch.path,
              context.now,
              { patch }
            ));
            break;
          }

          if (patch.op !== "unset") {
            const result = validateValueAgainstFieldSpec(patch.value, fieldSpec, {
              allowPartial: patch.op === "merge",
              allowUndefined: false,
            });
            if (!result.ok) {
              validationErrors.push(createError(
                "TYPE_MISMATCH",
                `Invalid patch value at ${patch.path}: ${result.message ?? "type mismatch"}`,
                snapshot.system.currentAction ?? "",
                patch.path,
                context.now,
                { patch }
              ));
              break;
            }
          }

          newData = applyPatch(newData, patch, subPath);
        }
        break;
      case "system":
        newSystem = applyPatch(newSystem, patch, subPath) as SystemState;
        break;
      case "input":
        newInput = applyPatch(newInput, patch, subPath);
        break;
      case "computed":
      case "meta":
        // Computed/meta are Core-owned; ignore external patch attempts.
        break;
    }
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

  // 2. Create intermediate snapshot with new data
  const intermediateSnapshot: Snapshot = {
    ...snapshot,
    data: newData,
    system: newSystem,
    input: newInput,
  };

  // 3. Recompute all computed values
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

  // 4. Return new snapshot with updated metadata
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

type PatchRoot = "data" | "system" | "input" | "computed" | "meta";

function splitPatchPath(path: string): { root: PatchRoot; subPath: string } {
  if (path === "system" || path.startsWith("system.")) {
    return { root: "system", subPath: path === "system" ? "" : path.slice(7) };
  }
  if (path === "input" || path.startsWith("input.")) {
    return { root: "input", subPath: path === "input" ? "" : path.slice(6) };
  }
  if (path === "computed" || path.startsWith("computed.")) {
    return { root: "computed", subPath: path === "computed" ? "" : path.slice(9) };
  }
  if (path === "meta" || path.startsWith("meta.")) {
    return { root: "meta", subPath: path === "meta" ? "" : path.slice(5) };
  }
  return { root: "data", subPath: path };
}

function getPlatformNamespace(path: string): string | null {
  if (!path) {
    return null;
  }
  const [segment] = path.split(".");
  if (segment && segment.startsWith(PLATFORM_NAMESPACE_PREFIX)) {
    return segment;
  }
  return null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

/**
 * Merge target is valid when:
 * - path is absent (Core will create `{}` chain as needed), or
 * - existing target is an object.
 *
 * Any non-object value on the traversal path is a runtime contract violation.
 */
function isMergeTargetCompatible(root: unknown, path: string): boolean {
  if (!path) {
    return isObjectRecord(root);
  }

  const segments = path.split(".");
  let current: unknown = root;

  for (const segment of segments) {
    if (current === undefined) {
      return true;
    }
    if (!isObjectRecord(current)) {
      return false;
    }
    current = current[segment];
  }

  if (current === undefined) {
    return true;
  }
  return isObjectRecord(current);
}

function applyPatch(value: unknown, patch: Patch, subPath: string): unknown {
  switch (patch.op) {
    case "set":
      return setByPath(value, subPath, patch.value);
    case "unset":
      return unsetByPath(value, subPath);
    case "merge":
      return mergeAtPath(value, subPath, patch.value);
  }
}
