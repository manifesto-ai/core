import {
  canonicalEqual,
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
  return canonicalEqual(left, right);
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
  return root.startsWith("$");
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

    if (objectNode.kind === "get" && typeof objectNode.path === "string") {
      paths.push(objectNode.path);
    }

    for (const value of Object.values(objectNode)) {
      visit(value);
    }
  };

  visit(expr);
  return paths;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
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
    deepFreeze(child, seen);
  }

  return Object.freeze(value);
}
