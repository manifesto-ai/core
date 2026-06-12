import type { DomainSchema } from "../schema/domain.js";
import type { Snapshot } from "../schema/snapshot.js";
import type { Patch, PatchPath } from "../schema/patch.js";
import type { FieldSpec } from "../schema/field.js";
import { evaluateComputed } from "../evaluator/computed.js";
import { isOk, isErr } from "../schema/common.js";
import type { SystemState, ErrorValue } from "../schema/snapshot.js";
import type { NamespaceDelta } from "../schema/result.js";
import { createError } from "../errors.js";
import { getFieldSpecAtSegments, validateValueAgainstFieldSpec } from "./validation-utils.js";
import {
  getStateTypeDefinitionAtSegments,
  validateValueAgainstTypeDefinition,
} from "./type-definition-utils.js";
import {
  isSafePatchPath,
  mergeAtPatchPath,
  patchPathToDisplayString,
  setByPatchPath,
  unsetByPatchPath,
} from "../utils/patch-path.js";
import { findJsonValueViolation } from "../utils/json-value.js";

/**
 * Apply domain patches to snapshot.state and recompute computed values.
 *
 * Patch targets are rooted at snapshot.state only.
 * System transitions are handled by applySystemDelta().
 */
export function apply(
  schema: DomainSchema,
  snapshot: Snapshot,
  patches: readonly Patch[],
): Snapshot {
  let newState = snapshot.state;
  let newSystem: SystemState = snapshot.system;
  const newInput = snapshot.input;
  const validationErrors: ErrorValue[] = [];
  const errorTimestamp = snapshot.meta.timestamp;
  const rootSpec: FieldSpec = { type: "object", required: true, fields: schema.state.fields };

  for (const patch of patches) {
    const displayPath = patchPathToDisplayString(patch.path);

    if (!isSafePatchPath(patch.path)) {
      validationErrors.push(
        createError(
          "PATH_NOT_FOUND",
          `Unsafe patch path: ${displayPath}`,
          snapshot.system.currentAction ?? "",
          displayPath,
          errorTimestamp,
          { patch },
        ),
      );
      continue;
    }

    const typeDefinition = getStateTypeDefinitionAtSegments(schema.state, schema.types, patch.path);
    const fieldSpec = typeDefinition ? null : getFieldSpecAtSegments(rootSpec, patch.path);
    if (!typeDefinition && !fieldSpec) {
      validationErrors.push(
        createError(
          "PATH_NOT_FOUND",
          `Unknown patch path: ${displayPath}`,
          snapshot.system.currentAction ?? "",
          displayPath,
          errorTimestamp,
          { patch },
        ),
      );
      continue;
    }

    if (patch.op === "merge" && !isMergeTargetCompatible(newState, patch.path)) {
      validationErrors.push(
        createError(
          "TYPE_MISMATCH",
          `Invalid merge target at ${displayPath}: target path must be an object or absent`,
          snapshot.system.currentAction ?? "",
          displayPath,
          errorTimestamp,
          { patch },
        ),
      );
      continue;
    }

    if (patch.op !== "unset") {
      const result = typeDefinition
        ? validateValueAgainstTypeDefinition(patch.value, typeDefinition, schema.types, {
            allowPartial: patch.op === "merge",
            allowUndefined: false,
          })
        : validateValueAgainstFieldSpec(patch.value, fieldSpec as FieldSpec, {
            allowPartial: patch.op === "merge",
            allowUndefined: false,
          });
      if (!result.ok) {
        validationErrors.push(
          createError(
            "TYPE_MISMATCH",
            `Invalid patch value at ${displayPath}: ${result.message ?? "type mismatch"}`,
            snapshot.system.currentAction ?? "",
            displayPath,
            errorTimestamp,
            { patch },
          ),
        );
        continue;
      }

      // Field specs validate structure; the JSON value-domain check rejects
      // what JSON cannot represent (non-finite numbers, class instances,
      // nested undefined/functions) so canonicalization never silently
      // drops or coerces accepted state (#480).
      const jsonViolation = findJsonValueViolation(patch.value, displayPath);
      if (jsonViolation) {
        validationErrors.push(
          createError(
            "INVALID_VALUE",
            `Non-JSON patch value at ${jsonViolation.path}: ${jsonViolation.reason}`,
            snapshot.system.currentAction ?? "",
            displayPath,
            errorTimestamp,
            { patch },
          ),
        );
        continue;
      }
    }

    newState = applyPatch(newState, patch);
  }

  if (validationErrors.length > 0) {
    const lastError = validationErrors[validationErrors.length - 1];
    newSystem = {
      ...newSystem,
      status: "error",
      lastError,
    };
  }

  const intermediateSnapshot: Snapshot = {
    ...snapshot,
    state: newState,
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
    };
  }

  return {
    state: newState,
    computed,
    system: newSystem,
    input: newInput,
    meta: {
      ...snapshot.meta,
      version: snapshot.meta.version + 1,
    },
    namespaces: snapshot.namespaces,
  };
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

/**
 * Apply namespace transitions to snapshot.namespaces.
 *
 * Patch targets are rooted at snapshot.namespaces[namespace].
 */
export function applyNamespaceDeltas(
  snapshot: Snapshot,
  deltas: readonly NamespaceDelta[],
): Snapshot {
  if (deltas.length === 0) {
    return snapshot;
  }

  let newNamespaces: Record<string, unknown> = cloneNamespaceRecord(snapshot.namespaces);
  let newSystem: SystemState = snapshot.system;
  const validationErrors: ErrorValue[] = [];
  const errorTimestamp = snapshot.meta.timestamp;

  for (const delta of deltas) {
    if (delta.namespace.length === 0) {
      validationErrors.push(
        createError(
          "PATH_NOT_FOUND",
          "Invalid namespace: namespace must be non-empty",
          snapshot.system.currentAction ?? "",
          "namespaces",
          errorTimestamp,
          { delta },
        ),
      );
      continue;
    }

    const existingRoot = Object.prototype.hasOwnProperty.call(newNamespaces, delta.namespace)
      ? newNamespaces[delta.namespace]
      : undefined;
    if (existingRoot !== undefined && !isObjectRecord(existingRoot)) {
      validationErrors.push(
        createError(
          "TYPE_MISMATCH",
          `Invalid namespace root: ${delta.namespace} must be an object`,
          snapshot.system.currentAction ?? "",
          `namespaces.${delta.namespace}`,
          errorTimestamp,
          { delta },
        ),
      );
      continue;
    }

    let namespaceRoot: unknown = existingRoot ?? {};
    let deltaFailed = false;

    for (const patch of delta.patches) {
      const displayPath = `${delta.namespace}.${patchPathToDisplayString(patch.path)}`;

      if (!isSafePatchPath(patch.path)) {
        validationErrors.push(
          createError(
            "PATH_NOT_FOUND",
            `Unsafe namespace patch path: ${displayPath}`,
            snapshot.system.currentAction ?? "",
            displayPath,
            errorTimestamp,
            { delta, patch },
          ),
        );
        deltaFailed = true;
        break;
      }

      if (patch.op === "merge" && !isMergeTargetCompatible(namespaceRoot, patch.path)) {
        validationErrors.push(
          createError(
            "TYPE_MISMATCH",
            `Invalid namespace merge target at ${displayPath}: target path must be an object or absent`,
            snapshot.system.currentAction ?? "",
            displayPath,
            errorTimestamp,
            { delta, patch },
          ),
        );
        deltaFailed = true;
        break;
      }

      if (patch.op !== "unset") {
        const jsonViolation = findJsonValueViolation(patch.value, displayPath);
        if (jsonViolation) {
          validationErrors.push(
            createError(
              "INVALID_VALUE",
              `Non-JSON namespace patch value at ${jsonViolation.path}: ${jsonViolation.reason}`,
              snapshot.system.currentAction ?? "",
              displayPath,
              errorTimestamp,
              { delta, patch },
            ),
          );
          deltaFailed = true;
          break;
        }
      }

      namespaceRoot = applyPatch(namespaceRoot, patch);
    }

    if (deltaFailed) {
      continue;
    }

    newNamespaces = cloneNamespaceRecord(newNamespaces);
    newNamespaces[delta.namespace] = namespaceRoot;
  }

  if (validationErrors.length > 0) {
    const lastError = validationErrors[validationErrors.length - 1];
    newSystem = {
      ...newSystem,
      status: "error",
      lastError,
    };
  }

  return {
    ...snapshot,
    system: newSystem,
    namespaces: newNamespaces,
    meta: {
      ...snapshot.meta,
      version: snapshot.meta.version + 1,
    },
  };
}

function cloneNamespaceRecord(
  namespaces: Snapshot["namespaces"] | Record<string, unknown>,
): Record<string, unknown> {
  return Object.assign(Object.create(null) as Record<string, unknown>, namespaces);
}
