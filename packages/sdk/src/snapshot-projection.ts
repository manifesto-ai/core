import {
  type DomainSchema,
  type Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";

export type CanonicalPlatformNamespaces = {
  $host?: Record<string, unknown>;
  $mel?: Record<string, unknown>;
  [k: `$${string}`]: unknown;
};

export type Snapshot<T = unknown> = {
  data: T;
  computed: Record<string, unknown>;
  system: Pick<CoreSnapshot["system"], "status" | "lastError">;
  meta: Pick<CoreSnapshot["meta"], "schemaHash">;
};

export type CanonicalSnapshot<T = unknown> =
  Omit<CoreSnapshot, "data"> & {
    data: T & CanonicalPlatformNamespaces;
  };

export type SnapshotProjectionPlan = {
  visibleComputedKeys: readonly string[];
};

const COLLECTION_CONTEXT_ROOTS = new Set(["$item", "$index", "$array"]);

export function buildSnapshotProjectionPlan(
  schema: DomainSchema,
): SnapshotProjectionPlan {
  const computedFields = schema.computed.fields;
  const memo = new Map<string, boolean>();

  function isVisibleComputed(
    name: string,
    visiting: Set<string>,
  ): boolean {
    const cached = memo.get(name);
    if (cached !== undefined) {
      return cached;
    }

    if (visiting.has(name)) {
      return false;
    }

    visiting.add(name);

    const field = computedFields[name];
    if (!field) {
      visiting.delete(name);
      memo.set(name, true);
      return true;
    }

    for (const path of collectExprGetPaths(field.expr)) {
      if (isPlatformDependency(path)) {
        visiting.delete(name);
        memo.set(name, false);
        return false;
      }

      const computedDependency = resolveComputedDependency(path, computedFields);
      if (
        computedDependency !== null
        && !isVisibleComputed(computedDependency, visiting)
      ) {
        visiting.delete(name);
        memo.set(name, false);
        return false;
      }
    }

    visiting.delete(name);
    memo.set(name, true);
    return true;
  }

  const visibleComputedKeys = Object.keys(computedFields)
    .filter((name) => isVisibleComputed(name, new Set()));

  return {
    visibleComputedKeys,
  };
}

export function projectCanonicalSnapshot<T = unknown>(
  snapshot: CoreSnapshot,
  plan: SnapshotProjectionPlan,
): Snapshot<T> {
  return {
    data: projectData<T>(snapshot.data),
    computed: projectComputed(snapshot.computed, plan),
    system: {
      status: snapshot.system.status,
      lastError: snapshot.system.lastError,
    },
    meta: {
      schemaHash: snapshot.meta.schemaHash,
    },
  };
}

export function projectEffectContextSnapshot<T = unknown>(
  snapshot: CoreSnapshot,
  plan: SnapshotProjectionPlan,
): Snapshot<T> {
  return projectCanonicalSnapshot<T>(snapshot, plan);
}

export function cloneAndDeepFreeze<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

export function projectedSnapshotsEqual<T>(
  left: Snapshot<T>,
  right: Snapshot<T>,
): boolean {
  return cycleSafeEqual(left, right);
}

function projectData<T>(data: unknown): T {
  if (data === null || data === undefined) {
    return data as T;
  }

  if (Array.isArray(data) || typeof data !== "object") {
    return structuredClone(data) as T;
  }

  const projected: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!key.startsWith("$")) {
      projected[key] = value;
    }
  }

  return structuredClone(projected) as T;
}

function projectComputed(
  computed: CoreSnapshot["computed"],
  plan: SnapshotProjectionPlan,
): Snapshot["computed"] {
  const projected: Record<string, unknown> = {};

  for (const key of plan.visibleComputedKeys) {
    if (Object.prototype.hasOwnProperty.call(computed, key)) {
      projected[key] = computed[key];
    }
  }

  return structuredClone(projected);
}

function resolveComputedDependency(
  dep: string,
  computedFields: DomainSchema["computed"]["fields"],
): string | null {
  if (Object.prototype.hasOwnProperty.call(computedFields, dep)) {
    return dep;
  }

  if (!dep.startsWith("computed.")) {
    return null;
  }

  const candidate = dep.slice("computed.".length);
  return Object.prototype.hasOwnProperty.call(computedFields, candidate)
    ? candidate
    : null;
}

function isPlatformDependency(dep: string): boolean {
  const normalized = dep.startsWith("data.")
    ? dep.slice("data.".length)
    : dep;
  const root = normalized.split(".")[0] ?? "";
  if (!root.startsWith("$")) {
    return false;
  }

  return !COLLECTION_CONTEXT_ROOTS.has(root);
}

function collectExprGetPaths(expr: unknown): string[] {
  const paths: string[] = [];
  const seen = new WeakSet<object>();

  const visit = (node: unknown): void => {
    if (node === null || node === undefined) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    const objectNode = node as Record<string, unknown>;
    if (seen.has(objectNode)) {
      return;
    }
    seen.add(objectNode);

    if (objectNode.kind === "lit") {
      return;
    }

    if (objectNode.kind === "get" && typeof objectNode.path === "string") {
      paths.push(objectNode.path);
      return;
    }

    for (const value of Object.values(objectNode)) {
      visit(value);
    }
  };

  visit(expr);
  return paths;
}

function cycleSafeEqual(left: unknown, right: unknown): boolean {
  return cycleSafeEqualInternal(left, right, new WeakMap<object, WeakSet<object>>());
}

function cycleSafeEqualInternal(
  left: unknown,
  right: unknown,
  seen: WeakMap<object, WeakSet<object>>,
): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (typeof left !== typeof right) {
    return false;
  }

  if (left === null || right === null) {
    return left === right;
  }

  if (typeof left !== "object" || typeof right !== "object") {
    return false;
  }

  const leftObject = left as object;
  const rightObject = right as object;
  const leftTag = Object.prototype.toString.call(leftObject);
  const rightTag = Object.prototype.toString.call(rightObject);

  if (leftTag !== rightTag) {
    return false;
  }

  let seenRight = seen.get(leftObject);
  if (seenRight?.has(rightObject)) {
    return true;
  }

  if (!seenRight) {
    seenRight = new WeakSet<object>();
    seen.set(leftObject, seenRight);
  }
  seenRight.add(rightObject);

  if (Array.isArray(leftObject) && Array.isArray(rightObject)) {
    if (leftObject.length !== rightObject.length) {
      return false;
    }

    for (let index = 0; index < leftObject.length; index += 1) {
      const leftHasValue = Object.prototype.hasOwnProperty.call(leftObject, index);
      const rightHasValue = Object.prototype.hasOwnProperty.call(rightObject, index);

      if (leftHasValue !== rightHasValue) {
        return false;
      }

      if (
        leftHasValue
        && !cycleSafeEqualInternal(leftObject[index], rightObject[index], seen)
      ) {
        return false;
      }
    }

    return true;
  }

  if (leftObject instanceof Date && rightObject instanceof Date) {
    return leftObject.getTime() === rightObject.getTime();
  }

  if (leftObject instanceof RegExp && rightObject instanceof RegExp) {
    return leftObject.source === rightObject.source
      && leftObject.flags === rightObject.flags;
  }

  if (ArrayBuffer.isView(leftObject) && ArrayBuffer.isView(rightObject)) {
    if (leftObject.constructor !== rightObject.constructor) {
      return false;
    }

    if (leftObject.byteLength !== rightObject.byteLength) {
      return false;
    }

    const leftBytes = new Uint8Array(
      leftObject.buffer,
      leftObject.byteOffset,
      leftObject.byteLength,
    );
    const rightBytes = new Uint8Array(
      rightObject.buffer,
      rightObject.byteOffset,
      rightObject.byteLength,
    );

    return leftBytes.every((value, index) => value === rightBytes[index]);
  }

  if (leftObject instanceof ArrayBuffer && rightObject instanceof ArrayBuffer) {
    if (leftObject.byteLength !== rightObject.byteLength) {
      return false;
    }

    const leftBytes = new Uint8Array(leftObject);
    const rightBytes = new Uint8Array(rightObject);
    return leftBytes.every((value, index) => value === rightBytes[index]);
  }

  if (leftObject instanceof Map && rightObject instanceof Map) {
    if (leftObject.size !== rightObject.size) {
      return false;
    }

    const leftEntries = Array.from(leftObject.entries());
    const rightEntries = Array.from(rightObject.entries());

    return leftEntries.every(([leftKey, leftValue], index) => {
      const rightEntry = rightEntries[index];
      if (!rightEntry) {
        return false;
      }

      const [rightKey, rightValue] = rightEntry;
      return cycleSafeEqualInternal(leftKey, rightKey, seen)
        && cycleSafeEqualInternal(leftValue, rightValue, seen);
    });
  }

  if (leftObject instanceof Set && rightObject instanceof Set) {
    if (leftObject.size !== rightObject.size) {
      return false;
    }

    const leftValues = Array.from(leftObject.values());
    const rightValues = Array.from(rightObject.values());

    return leftValues.every((value, index) =>
      cycleSafeEqualInternal(value, rightValues[index], seen));
  }

  const leftKeys = getComparableObjectKeys(leftObject);
  const rightKeys = getComparableObjectKeys(rightObject);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];
    if (leftKey !== rightKey) {
      return false;
    }

    const leftValue = (leftObject as Record<string, unknown>)[leftKey];
    const rightValue = (rightObject as Record<string, unknown>)[rightKey];
    if (!cycleSafeEqualInternal(leftValue, rightValue, seen)) {
      return false;
    }
  }

  return true;
}

function getComparableObjectKeys(value: object): string[] {
  return Object.keys(value as Record<string, unknown>)
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .sort();
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  if (isBinaryValue(value)) {
    return cloneBinaryValue(value) as T;
  }

  const objectValue = value as Record<PropertyKey, unknown>;

  if (seen.has(objectValue)) {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  seen.add(objectValue);

  for (const key of Reflect.ownKeys(objectValue)) {
    const child = objectValue[key];
    if (isBinaryValue(child)) {
      defineReadOnlyBinaryProperty(objectValue, key, child);
      continue;
    }
    deepFreeze(child, seen);
  }

  return Object.freeze(value);
}

function isBinaryValue(value: unknown): value is ArrayBuffer | ArrayBufferView {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function cloneBinaryValue<T extends ArrayBuffer | ArrayBufferView>(value: T): T {
  return structuredClone(value);
}

function defineReadOnlyBinaryProperty(
  target: Record<PropertyKey, unknown>,
  key: PropertyKey,
  value: ArrayBuffer | ArrayBufferView,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor || !("value" in descriptor)) {
    return;
  }

  Object.defineProperty(target, key, {
    enumerable: descriptor.enumerable ?? true,
    configurable: false,
    get() {
      return cloneBinaryValue(value);
    },
  });
}
