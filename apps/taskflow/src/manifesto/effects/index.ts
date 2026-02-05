/**
 * TaskFlow Effects - v2.3.0 Effects-first API
 *
 * Exports effect handlers for the TaskFlow domain.
 * Note: system.get is provided by the framework internally.
 */

import type { Patch } from "@manifesto-ai/core";
import type { Effects, AppEffectContext } from "@manifesto-ai/app";

export {
  LocalStoragePersistence,
  MemoryPersistence,
  createPersistenceObserver,
  defaultPersistence,
  type TaskFlowPersistence,
} from "./persistence";

// =============================================================================
// Predicate Evaluation Helpers
// =============================================================================

interface Snapshot {
  data: Record<string, unknown>;
  computed?: Record<string, unknown>;
  system?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

/**
 * Evaluate a simple predicate expression against an item
 */
function evaluatePredicate(
  predicate: unknown,
  item: unknown,
  snapshot: Readonly<Snapshot>
): boolean {
  if (predicate === null || predicate === undefined) {
    return true;
  }

  if (typeof predicate !== "object") {
    return Boolean(predicate);
  }

  const pred = predicate as Record<string, unknown>;
  const kind = pred.kind as string;

  switch (kind) {
    case "eq":
      return resolveValue(pred.left, item, snapshot) === resolveValue(pred.right, item, snapshot);

    case "neq":
      return resolveValue(pred.left, item, snapshot) !== resolveValue(pred.right, item, snapshot);

    case "isNull":
      return resolveValue(pred.arg, item, snapshot) === null;

    case "isNotNull":
      return resolveValue(pred.arg, item, snapshot) !== null;

    case "and":
      return (pred.args as unknown[]).every(arg => evaluatePredicate(arg, item, snapshot));

    case "or":
      return (pred.args as unknown[]).some(arg => evaluatePredicate(arg, item, snapshot));

    case "not":
      return !evaluatePredicate(pred.arg, item, snapshot);

    case "lit":
      return Boolean(pred.value);

    default:
      console.warn(`Unknown predicate kind: ${kind}`);
      return true;
  }
}

/**
 * Resolve a value from an expression
 */
function resolveValue(
  expr: unknown,
  item: unknown,
  snapshot: Readonly<Snapshot>
): unknown {
  if (expr === null || expr === undefined) {
    return null;
  }

  if (typeof expr !== "object") {
    return expr;
  }

  const e = expr as Record<string, unknown>;
  const kind = e.kind as string;

  switch (kind) {
    case "lit":
      return e.value;

    case "get": {
      const path = e.path as string;
      if (path.startsWith("$item.")) {
        const itemPath = path.slice("$item.".length);
        return getNestedValue(item, itemPath);
      }
      return getSnapshotValue(snapshot, path);
    }

    case "field": {
      const fieldPath = e.path as string;
      return getNestedValue(item, fieldPath);
    }

    default:
      return null;
  }
}

/**
 * Get nested value from an object by path
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Get value from snapshot by path
 */
function getSnapshotValue(snapshot: Readonly<Snapshot>, path: string): unknown {
  if (path.startsWith("data.")) {
    return getNestedValue(snapshot.data, path.slice("data.".length));
  }
  if (path.startsWith("state.")) {
    return getNestedValue((snapshot as Record<string, unknown>).state, path.slice("state.".length));
  }
  return getNestedValue(snapshot.data, path);
}

/**
 * Transform an item using a select expression
 */
function transformItem(
  select: unknown,
  item: unknown,
  snapshot: Readonly<Snapshot>
): unknown {
  if (select === null || select === undefined) {
    return item;
  }

  if (typeof select !== "object") {
    return select;
  }

  const s = select as Record<string, unknown>;
  const kind = s.kind as string;

  switch (kind) {
    case "get":
      return resolveValue(select, item, snapshot);

    case "object": {
      const fields = s.fields as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        result[key] = transformItem(value, item, snapshot);
      }
      return result;
    }

    case "if": {
      const cond = evaluatePredicate(s.cond, item, snapshot);
      return cond
        ? transformItem(s.then, item, snapshot)
        : transformItem(s.else, item, snapshot);
    }

    default:
      return resolveValue(select, item, snapshot);
  }
}

// =============================================================================
// Effects (v2.3.0 API)
// =============================================================================

export const taskflowEffects: Effects = {
  /**
   * array.filter effect handler
   */
  "array.filter": async (params, ctx: AppEffectContext): Promise<readonly Patch[]> => {
    const { source, where, into } = params as {
      source?: unknown;
      where?: unknown;
      into?: string;
    };

    if (typeof into !== "string") {
      console.error("array.filter: 'into' must be a string path");
      return [];
    }

    const sourceArray = resolveValue(source, null, ctx.snapshot as Snapshot);

    if (!Array.isArray(sourceArray)) {
      console.error("array.filter: source is not an array");
      return [{ op: "set", path: into, value: [] }];
    }

    const filtered = sourceArray.filter(item =>
      evaluatePredicate(where, item, ctx.snapshot as Snapshot)
    );

    return [{ op: "set", path: into, value: filtered }];
  },

  /**
   * array.map effect handler
   */
  "array.map": async (params, ctx: AppEffectContext): Promise<readonly Patch[]> => {
    const { source, select, into } = params as {
      source?: unknown;
      select?: unknown;
      into?: string;
    };

    if (typeof into !== "string") {
      console.error("array.map: 'into' must be a string path");
      return [];
    }

    const sourceArray = resolveValue(source, null, ctx.snapshot as Snapshot);

    if (!Array.isArray(sourceArray)) {
      console.error("array.map: source is not an array");
      return [{ op: "set", path: into, value: [] }];
    }

    const mapped = sourceArray.map(item =>
      transformItem(select, item, ctx.snapshot as Snapshot)
    );

    return [{ op: "set", path: into, value: mapped }];
  },

  /**
   * array.sort effect handler
   */
  "array.sort": async (params, ctx: AppEffectContext): Promise<readonly Patch[]> => {
    const { source, by, order, into } = params as {
      source?: unknown;
      by?: unknown;
      order?: string;
      into?: string;
    };

    if (typeof into !== "string") {
      console.error("array.sort: 'into' must be a string path");
      return [];
    }

    const sourceArray = resolveValue(source, null, ctx.snapshot as Snapshot);

    if (!Array.isArray(sourceArray)) {
      console.error("array.sort: source is not an array");
      return [{ op: "set", path: into, value: [] }];
    }

    const sorted = [...sourceArray];

    sorted.sort((a, b) => {
      const aValue = resolveValue(by, a, ctx.snapshot as Snapshot);
      const bValue = resolveValue(by, b, ctx.snapshot as Snapshot);

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return order === "desc" ? -comparison : comparison;
    });

    return [{ op: "set", path: into, value: sorted }];
  },

  /**
   * array.flatMap effect handler
   */
  "array.flatMap": async (params, ctx: AppEffectContext): Promise<readonly Patch[]> => {
    const { source, select, into } = params as {
      source?: unknown;
      select?: unknown;
      into?: string;
    };

    if (typeof into !== "string") {
      console.error("array.flatMap: 'into' must be a string path");
      return [];
    }

    const sourceArray = resolveValue(source, null, ctx.snapshot as Snapshot);

    if (!Array.isArray(sourceArray)) {
      console.error("array.flatMap: source is not an array");
      return [{ op: "set", path: into, value: [] }];
    }

    const flatMapped = sourceArray.flatMap(item => {
      const result = transformItem(select, item, ctx.snapshot as Snapshot);
      return Array.isArray(result) ? result : [result];
    });

    return [{ op: "set", path: into, value: flatMapped }];
  },
};
