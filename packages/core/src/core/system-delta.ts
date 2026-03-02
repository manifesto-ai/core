import type { Snapshot } from "../schema/snapshot.js";
import type { Requirement, ErrorValue, SystemState } from "../schema/snapshot.js";
import type { SystemDelta } from "../schema/result.js";

/**
 * Apply a declarative system transition to a snapshot.
 *
 * This function is pure, deterministic, and total.
 */
export function applySystemDelta(snapshot: Snapshot, delta: SystemDelta): Snapshot {
  const hasStatus = hasOwn(delta, "status");
  const hasCurrentAction = hasOwn(delta, "currentAction");
  const hasLastError = hasOwn(delta, "lastError");
  const removeRequirementIds = new Set(delta.removeRequirementIds ?? []);
  const addRequirements = delta.addRequirements ?? [];
  const appendErrors = delta.appendErrors ?? [];

  const nextPending = applyRequirementDelta(
    snapshot.system.pendingRequirements,
    removeRequirementIds,
    addRequirements
  );

  const nextSystem: SystemState = {
    ...snapshot.system,
    status: hasStatus ? delta.status! : snapshot.system.status,
    currentAction: hasCurrentAction ? (delta.currentAction ?? null) : snapshot.system.currentAction,
    lastError: hasLastError ? (delta.lastError ?? null) : snapshot.system.lastError,
    errors: appendErrors.length > 0 ? [...snapshot.system.errors, ...appendErrors] : snapshot.system.errors,
    pendingRequirements: nextPending,
  };

  if (!hasSystemChanged(snapshot.system, nextSystem)) {
    return snapshot;
  }

  return {
    ...snapshot,
    system: nextSystem,
    meta: {
      ...snapshot.meta,
      version: snapshot.meta.version + 1,
    },
  };
}

function applyRequirementDelta(
  current: readonly Requirement[],
  removeRequirementIds: ReadonlySet<string>,
  addRequirements: readonly Requirement[]
): Requirement[] {
  const incomingIds = new Set(addRequirements.map((requirement) => requirement.id));
  const retained = current.filter(
    (requirement) => !removeRequirementIds.has(requirement.id) && !incomingIds.has(requirement.id)
  );

  return [...retained, ...addRequirements];
}

function hasSystemChanged(previous: SystemState, next: SystemState): boolean {
  if (previous.status !== next.status) {
    return true;
  }
  if (previous.currentAction !== next.currentAction) {
    return true;
  }
  if (!isErrorValueEqual(previous.lastError, next.lastError)) {
    return true;
  }
  if (!areErrorArraysEqual(previous.errors, next.errors)) {
    return true;
  }
  if (!areRequirementArraysEqual(previous.pendingRequirements, next.pendingRequirements)) {
    return true;
  }
  return false;
}

function areErrorArraysEqual(a: readonly ErrorValue[], b: readonly ErrorValue[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!isErrorValueEqual(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

function areRequirementArraysEqual(a: readonly Requirement[], b: readonly Requirement[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!isRequirementEqual(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

function isErrorValueEqual(a: ErrorValue | null, b: ErrorValue | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  if (a.code !== b.code || a.message !== b.message || a.timestamp !== b.timestamp) {
    return false;
  }
  if (a.source.actionId !== b.source.actionId || a.source.nodePath !== b.source.nodePath) {
    return false;
  }

  const aContext = a.context ?? {};
  const bContext = b.context ?? {};
  return JSON.stringify(aContext) === JSON.stringify(bContext);
}

function isRequirementEqual(a: Requirement, b: Requirement): boolean {
  return (
    a.id === b.id
    && a.type === b.type
    && a.actionId === b.actionId
    && a.createdAt === b.createdAt
    && a.flowPosition.nodePath === b.flowPosition.nodePath
    && a.flowPosition.snapshotVersion === b.flowPosition.snapshotVersion
    && JSON.stringify(a.params) === JSON.stringify(b.params)
  );
}

function hasOwn<T extends object, K extends PropertyKey>(obj: T, key: K): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
