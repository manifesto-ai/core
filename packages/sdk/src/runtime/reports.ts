import type { Snapshot as CoreSnapshot } from "@manifesto-ai/core";
import type { HostResult } from "@manifesto-ai/host";

import type {
  AvailableActionDelta,
  CanonicalSnapshot,
  ExecutionOutcome,
  ManifestoDomainShape,
  Snapshot,
} from "../types.js";
import {
  cloneAndDeepFreeze,
} from "../projection/snapshot-projection.js";
import type {
  RuntimeReportHelpers,
} from "./facets.js";

type RuntimeReportHelperOptions<T extends ManifestoDomainShape> = {
  readonly getAvailableActionsFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
  ) => readonly (keyof T["actions"])[];
  readonly projectSnapshotFromCanonical: (
    snapshot: CoreSnapshot,
  ) => Snapshot<T["state"]>;
};

export function createRuntimeReportHelpers<T extends ManifestoDomainShape>({
  getAvailableActionsFor,
  projectSnapshotFromCanonical,
}: RuntimeReportHelperOptions<T>): RuntimeReportHelpers<T> {
  function deriveAvailableActionDelta(
    beforeSnapshot: CanonicalSnapshot<T["state"]>,
    afterSnapshot: CanonicalSnapshot<T["state"]>,
  ): AvailableActionDelta<T> {
    const before = getAvailableActionsFor(beforeSnapshot);
    const after = getAvailableActionsFor(afterSnapshot);
    const unlocked = Object.freeze(
      after.filter((actionName) => !before.includes(actionName)),
    ) as readonly (keyof T["actions"])[];
    const locked = Object.freeze(
      before.filter((actionName) => !after.includes(actionName)),
    ) as readonly (keyof T["actions"])[];

    return Object.freeze({
      before,
      after,
      unlocked,
      locked,
    }) as AvailableActionDelta<T>;
  }

  function deriveExecutionOutcome(
    beforeSnapshot: CanonicalSnapshot<T["state"]>,
    afterSnapshot: CanonicalSnapshot<T["state"]>,
  ): ExecutionOutcome<T> {
    const stableBefore = cloneAndDeepFreeze(
      beforeSnapshot,
    ) as CanonicalSnapshot<T["state"]>;
    const stableAfter = cloneAndDeepFreeze(
      afterSnapshot,
    ) as CanonicalSnapshot<T["state"]>;
    const projectedBefore = projectSnapshotFromCanonical(stableBefore as CoreSnapshot);
    const projectedAfter = projectSnapshotFromCanonical(stableAfter as CoreSnapshot);

    return Object.freeze({
      projected: Object.freeze({
        beforeSnapshot: projectedBefore,
        afterSnapshot: projectedAfter,
        changedPaths: diffProjectedPaths(projectedBefore, projectedAfter),
        availability: deriveAvailableActionDelta(stableBefore, stableAfter),
      }),
      canonical: Object.freeze({
        beforeCanonicalSnapshot: stableBefore,
        afterCanonicalSnapshot: stableAfter,
        pendingRequirements: stableAfter.system.pendingRequirements,
        status: stableAfter.system.status,
      }),
    }) as ExecutionOutcome<T>;
  }

  function classifyExecutionFailure(
    error: unknown,
    stage: "host" | "seal",
  ) {
    const failure = toError(error);
    const failureWithCode = failure as Error & { code?: unknown };
    return Object.freeze({
      message: failure.message,
      ...(typeof failureWithCode.code === "string"
        ? { code: failureWithCode.code }
        : {}),
      ...(typeof failure.name === "string" ? { name: failure.name } : {}),
      stage,
    });
  }

  function createExecutionDiagnostics(result: HostResult) {
    return Object.freeze({
      hostTraces: cloneAndDeepFreeze(result.traces),
    });
  }

  return Object.freeze({
    deriveExecutionOutcome,
    classifyExecutionFailure,
    createExecutionDiagnostics,
  }) as RuntimeReportHelpers<T>;
}

export function diffProjectedPaths<T>(
  left: Snapshot<T>,
  right: Snapshot<T>,
): readonly string[] {
  const paths = new Set<string>();
  const seen = new WeakMap<object, WeakSet<object>>();

  const visit = (a: unknown, b: unknown, path: string): void => {
    if (Object.is(a, b)) {
      return;
    }

    if (a === null || b === null) {
      paths.add(path);
      return;
    }

    if (typeof a !== "object" || typeof b !== "object") {
      paths.add(path);
      return;
    }

    const leftObject = a as object;
    const rightObject = b as object;
    const leftSeen = seen.get(leftObject);
    if (leftSeen?.has(rightObject)) {
      return;
    }
    if (leftSeen) {
      leftSeen.add(rightObject);
    } else {
      seen.set(leftObject, new WeakSet([rightObject]));
    }

    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b)) {
        paths.add(path);
        return;
      }

      const limit = Math.max(a.length, b.length);
      for (let index = 0; index < limit; index += 1) {
        const leftHas = Object.prototype.hasOwnProperty.call(a, index);
        const rightHas = Object.prototype.hasOwnProperty.call(b, index);
        const childPath = `${path}[${index}]`;
        if (leftHas !== rightHas) {
          paths.add(childPath);
          continue;
        }
        if (!leftHas && !rightHas) {
          continue;
        }
        visit(a[index], b[index], childPath);
      }
      return;
    }

    if (!isPlainDiffableObject(a) || !isPlainDiffableObject(b)) {
      paths.add(path);
      return;
    }

    const keys = new Set([
      ...Object.keys(a),
      ...Object.keys(b),
    ]);
    for (const key of [...keys].sort()) {
      const leftHas = Object.prototype.hasOwnProperty.call(a, key);
      const rightHas = Object.prototype.hasOwnProperty.call(b, key);
      const childPath = `${path}.${key}`;
      if (leftHas !== rightHas) {
        paths.add(childPath);
        continue;
      }
      visit(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        childPath,
      );
    }
  };

  visit(left.data, right.data, "data");
  visit(left.computed, right.computed, "computed");
  visit(left.system, right.system, "system");
  visit(left.meta, right.meta, "meta");

  return Object.freeze([...paths].sort());
}

function isPlainDiffableObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(String(error));
}
