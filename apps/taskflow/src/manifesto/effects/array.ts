/**
 * Array Effect Handlers
 *
 * Implements Host effect handlers for array operations declared in MEL.
 * These handlers process the effect params and return patches with results.
 *
 * Effect Pattern:
 *   effect array.filter({ source: tasks, where: predicate, into: filteredTasks })
 *
 * Handler returns:
 *   [{ op: "set", path: "filteredTasks", value: [...filtered results...] }]
 */

import type { EffectHandler, EffectContext } from "@manifesto-ai/host";
import type { Patch, Snapshot } from "@manifesto-ai/core";

/**
 * Evaluate a simple predicate expression against an item
 * This is a simplified evaluator for common predicate patterns
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
      // Resolve from snapshot
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
    return getNestedValue((snapshot as any).state, path.slice("state.".length));
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

/**
 * array.filter effect handler
 *
 * Filters an array based on a predicate and writes result to `into` path.
 */
export const arrayFilterHandler: EffectHandler = async (
  _type: string,
  params: Record<string, unknown>,
  context: EffectContext
): Promise<Patch[]> => {
  const { source, where, into } = params;

  if (typeof into !== "string") {
    console.error("array.filter: 'into' must be a string path");
    return [];
  }

  // Resolve source array
  const sourceArray = resolveValue(source, null, context.snapshot);

  if (!Array.isArray(sourceArray)) {
    console.error("array.filter: source is not an array");
    return [{ op: "set", path: into, value: [] }];
  }

  // Filter the array
  const filtered = sourceArray.filter(item =>
    evaluatePredicate(where, item, context.snapshot)
  );

  return [{ op: "set", path: into, value: filtered }];
};

/**
 * array.map effect handler
 *
 * Maps over an array with a transform and writes result to `into` path.
 */
export const arrayMapHandler: EffectHandler = async (
  _type: string,
  params: Record<string, unknown>,
  context: EffectContext
): Promise<Patch[]> => {
  const { source, select, into } = params;

  if (typeof into !== "string") {
    console.error("array.map: 'into' must be a string path");
    return [];
  }

  const sourceArray = resolveValue(source, null, context.snapshot);

  if (!Array.isArray(sourceArray)) {
    console.error("array.map: source is not an array");
    return [{ op: "set", path: into, value: [] }];
  }

  const mapped = sourceArray.map(item =>
    transformItem(select, item, context.snapshot)
  );

  return [{ op: "set", path: into, value: mapped }];
};

/**
 * array.sort effect handler
 *
 * Sorts an array and writes result to `into` path.
 */
export const arraySortHandler: EffectHandler = async (
  _type: string,
  params: Record<string, unknown>,
  context: EffectContext
): Promise<Patch[]> => {
  const { source, by, order, into } = params;

  if (typeof into !== "string") {
    console.error("array.sort: 'into' must be a string path");
    return [];
  }

  const sourceArray = resolveValue(source, null, context.snapshot);

  if (!Array.isArray(sourceArray)) {
    console.error("array.sort: source is not an array");
    return [{ op: "set", path: into, value: [] }];
  }

  // Clone to avoid mutation
  const sorted = [...sourceArray];

  // Sort by the specified field
  sorted.sort((a, b) => {
    const aValue = resolveValue(by, a, context.snapshot);
    const bValue = resolveValue(by, b, context.snapshot);

    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    const comparison = aValue < bValue ? -1 : 1;
    return order === "desc" ? -comparison : comparison;
  });

  return [{ op: "set", path: into, value: sorted }];
};

/**
 * array.flatMap effect handler
 *
 * Flattens and maps an array, writes result to `into` path.
 */
export const arrayFlatMapHandler: EffectHandler = async (
  _type: string,
  params: Record<string, unknown>,
  context: EffectContext
): Promise<Patch[]> => {
  const { source, select, into } = params;

  if (typeof into !== "string") {
    console.error("array.flatMap: 'into' must be a string path");
    return [];
  }

  const sourceArray = resolveValue(source, null, context.snapshot);

  if (!Array.isArray(sourceArray)) {
    console.error("array.flatMap: source is not an array");
    return [{ op: "set", path: into, value: [] }];
  }

  const flatMapped = sourceArray.flatMap(item => {
    const result = transformItem(select, item, context.snapshot);
    return Array.isArray(result) ? result : [result];
  });

  return [{ op: "set", path: into, value: flatMapped }];
};

/**
 * Register all array effect handlers
 */
export function registerArrayEffects(
  register: (type: string, handler: EffectHandler) => void
): void {
  register("array.filter", arrayFilterHandler);
  register("array.map", arrayMapHandler);
  register("array.sort", arraySortHandler);
  register("array.flatMap", arrayFlatMapHandler);
}
