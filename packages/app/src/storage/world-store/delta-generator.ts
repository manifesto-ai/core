/**
 * Delta Generator
 *
 * Canonical patch generation for World deltas.
 *
 * Per FDR-APP-INTEGRATION-001 v0.4.1:
 * - Delta scope matches snapshotHash input scope (D-STORE-3, STORE-4)
 * - Platform namespaces ($host, $mel) excluded from delta (WORLD-HASH-4a, WORLD-HASH-4b)
 *
 * @see FDR-APP-INTEGRATION-001 §3.6 (DELTA-GEN-1~6)
 * @see World SPEC v2.0.3 §5.5.2 (WORLD-HASH-*)
 * @module
 */

import type { Patch, Snapshot } from "../../core/types/index.js";

/**
 * Canonical patch type (v2 operators only).
 *
 * DELTA-GEN-5: Only set/unset/merge operators.
 */
export type CanonicalPatch = Patch;

/**
 * Delta generation options.
 */
export interface DeltaGeneratorOptions {
  /**
   * Maximum depth for recursive diffing.
   * @default 10
   */
  maxDepth?: number;

  /**
   * Include computed values in delta.
   * @default false
   */
  includeComputed?: boolean;
}

/**
 * Generate canonical patches from base snapshot to terminal snapshot.
 *
 * DELTA-GEN-2: Deterministic generation.
 * DELTA-GEN-3: Platform namespaces stripped ($host, $mel).
 * DELTA-GEN-4: No-op elimination.
 * DELTA-GEN-5: v2 operators only.
 * DELTA-GEN-6: Lexicographic path sort.
 *
 * @param base - Base snapshot
 * @param terminal - Terminal snapshot
 * @param options - Generation options
 * @returns Canonical patches (excluding platform namespace changes)
 */
export function generateDelta(
  base: Snapshot,
  terminal: Snapshot,
  options?: DeltaGeneratorOptions
): CanonicalPatch[] {
  const opts = {
    maxDepth: options?.maxDepth ?? 10,
    includeComputed: options?.includeComputed ?? false,
  };

  // DELTA-GEN-3: Convert to canonical form (platform namespaces stripped, sorted keys)
  const canonicalBase = toCanonicalSnapshot(base);
  const canonicalTerminal = toCanonicalSnapshot(terminal);

  // Generate patches
  const patches: CanonicalPatch[] = [];

  // Diff data
  diffObject(canonicalBase.data, canonicalTerminal.data, "data", patches, opts.maxDepth);

  // Optionally diff computed
  if (opts.includeComputed) {
    diffObject(
      canonicalBase.computed ?? {},
      canonicalTerminal.computed ?? {},
      "computed",
      patches,
      opts.maxDepth
    );
  }

  // Diff system (except transient fields)
  diffSystemFields(canonicalBase.system, canonicalTerminal.system, patches);

  // DELTA-GEN-4: Eliminate no-ops
  const filteredPatches = eliminateNoOps(patches);

  // DELTA-GEN-5: Normalize to v2 operators
  const normalizedPatches = normalizePatches(filteredPatches);

  // DELTA-GEN-6: Sort by path lexicographically
  return sortPatches(normalizedPatches);
}

/**
 * Strip platform namespaces from data.
 *
 * Per WORLD-HASH-4a, WORLD-HASH-4b:
 * - $host: Host-owned state (excluded from hash)
 * - $mel: Compiler-owned guard state (excluded from hash)
 *
 * @param data - Data object
 * @returns Data without platform namespaces
 */
function stripPlatformNamespaces(
  data: Record<string, unknown>
): Record<string, unknown> {
  if (data === undefined || data === null) {
    return {};
  }
  if (!("$host" in data) && !("$mel" in data)) {
    return data;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $host, $mel, ...rest } = data;
  return rest;
}

/**
 * Convert snapshot to canonical form with sorted keys and platform namespaces removed.
 *
 * DELTA-GEN-3: Canonical snapshot has:
 * - Platform namespaces removed ($host, $mel) per WORLD-HASH-4a, WORLD-HASH-4b
 * - Sorted keys for deterministic hashing
 *
 * This ensures delta scope matches snapshotHash input scope (D-STORE-3, STORE-4).
 *
 * @param snapshot - Input snapshot
 * @returns Canonical snapshot with platform namespaces removed and sorted keys
 */
export function toCanonicalSnapshot(snapshot: Snapshot): Snapshot {
  // Strip platform namespaces from data (WORLD-HASH-4a, WORLD-HASH-4b)
  const strippedData = stripPlatformNamespaces(snapshot.data ?? {});

  return {
    data: sortObjectKeys(strippedData),
    computed: sortObjectKeys(snapshot.computed ?? {}),
    system: sortObjectKeys(snapshot.system ?? {
      status: "idle",
      pendingRequirements: [],
      errors: [],
    }),
    input: sortObjectKeys(snapshot.input ?? {}),
    meta: sortObjectKeys(snapshot.meta ?? {
      version: 0,
      timestamp: "",
      hash: "",
    }),
  };
}

/**
 * Recursively sort object keys.
 *
 * @param obj - Object to sort
 * @returns Object with sorted keys
 */
function sortObjectKeys<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys) as unknown as T;
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();

  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }

  return sorted as T;
}

/**
 * Eliminate no-op patches.
 *
 * DELTA-GEN-4: Patches that don't change anything are removed.
 *
 * @param patches - Input patches
 * @returns Patches without no-ops
 */
export function eliminateNoOps(patches: CanonicalPatch[]): CanonicalPatch[] {
  // Track path states to detect redundant operations
  const pathStates: Map<string, { op: string; value?: unknown }> = new Map();

  const result: CanonicalPatch[] = [];

  for (const patch of patches) {
    const { op, path } = patch;
    const value = "value" in patch ? patch.value : undefined;

    // Skip if this is an unset after another unset on same path
    const existing = pathStates.get(path);
    if (existing) {
      if (op === "unset" && existing.op === "unset") {
        continue;
      }
      // If setting same value, skip
      if (op === "set" && existing.op === "set" && deepEquals(existing.value, value)) {
        continue;
      }
    }

    pathStates.set(path, { op, value });
    result.push(patch);
  }

  return result;
}

/**
 * Normalize patches to v2 operators only.
 *
 * DELTA-GEN-5: Only set/unset/merge operators are allowed.
 *
 * @param patches - Input patches
 * @returns Normalized patches
 */
export function normalizePatches(patches: CanonicalPatch[]): CanonicalPatch[] {
  return patches.filter((patch) => {
    const { op } = patch;
    return op === "set" || op === "unset" || op === "merge";
  });
}

/**
 * Sort patches by path lexicographically.
 *
 * DELTA-GEN-6: Patches MUST be sorted by path for determinism.
 *
 * @param patches - Input patches
 * @returns Sorted patches
 */
export function sortPatches(patches: CanonicalPatch[]): CanonicalPatch[] {
  return [...patches].sort((a, b) => {
    // Primary sort: path
    const pathCompare = a.path.localeCompare(b.path);
    if (pathCompare !== 0) return pathCompare;

    // Secondary sort: operation (set < unset < merge)
    const opOrder: Record<string, number> = { set: 0, unset: 1, merge: 2 };
    return (opOrder[a.op] ?? 3) - (opOrder[b.op] ?? 3);
  });
}

/**
 * Deep diff two objects and generate patches.
 *
 * @param base - Base object
 * @param terminal - Terminal object
 * @param path - Current path prefix
 * @param patches - Accumulator for patches
 * @param maxDepth - Maximum recursion depth
 */
function diffObject(
  base: unknown,
  terminal: unknown,
  path: string,
  patches: CanonicalPatch[],
  maxDepth: number,
  depth: number = 0
): void {
  if (depth > maxDepth) {
    // At max depth, treat as atomic value
    if (!deepEquals(base, terminal)) {
      patches.push({ op: "set", path, value: terminal });
    }
    return;
  }

  const baseObj = (base ?? {}) as Record<string, unknown>;
  const terminalObj = (terminal ?? {}) as Record<string, unknown>;

  // Handle non-object values
  if (typeof baseObj !== "object" || typeof terminalObj !== "object") {
    if (!deepEquals(base, terminal)) {
      patches.push({ op: "set", path, value: terminal });
    }
    return;
  }

  // Handle null values
  if (baseObj === null || terminalObj === null) {
    if (base !== terminal) {
      patches.push({ op: "set", path, value: terminal });
    }
    return;
  }

  // Handle array values
  if (Array.isArray(baseObj) || Array.isArray(terminalObj)) {
    if (!deepEquals(base, terminal)) {
      patches.push({ op: "set", path, value: terminal });
    }
    return;
  }

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(baseObj), ...Object.keys(terminalObj)]);

  for (const key of allKeys) {
    const childPath = path ? `${path}.${key}` : key;
    const baseValue = baseObj[key];
    const terminalValue = terminalObj[key];

    if (!(key in terminalObj)) {
      // Key removed
      patches.push({ op: "unset", path: childPath });
    } else if (!(key in baseObj)) {
      // Key added
      patches.push({ op: "set", path: childPath, value: terminalValue });
    } else if (
      typeof baseValue === "object" &&
      typeof terminalValue === "object" &&
      baseValue !== null &&
      terminalValue !== null &&
      !Array.isArray(baseValue) &&
      !Array.isArray(terminalValue)
    ) {
      // Both are objects, recurse
      diffObject(baseValue, terminalValue, childPath, patches, maxDepth, depth + 1);
    } else if (!deepEquals(baseValue, terminalValue)) {
      // Value changed
      patches.push({ op: "set", path: childPath, value: terminalValue });
    }
  }
}

/**
 * Diff system fields (special handling for transient fields).
 *
 * @param base - Base system object
 * @param terminal - Terminal system object
 * @param patches - Accumulator for patches
 */
function diffSystemFields(
  base: Snapshot["system"],
  terminal: Snapshot["system"],
  patches: CanonicalPatch[]
): void {
  const baseSystem = base ?? {
    status: "idle",
    pendingRequirements: [],
    errors: [],
  };
  const terminalSystem = terminal ?? {
    status: "idle",
    pendingRequirements: [],
    errors: [],
  };

  // Status
  if (baseSystem.status !== terminalSystem.status) {
    patches.push({ op: "set", path: "system.status", value: terminalSystem.status });
  }

  // Errors (array, treat as atomic)
  if (!deepEquals(baseSystem.errors, terminalSystem.errors)) {
    patches.push({ op: "set", path: "system.errors", value: terminalSystem.errors ?? [] });
  }

  // lastError
  if (!deepEquals(baseSystem.lastError, terminalSystem.lastError)) {
    if (terminalSystem.lastError) {
      patches.push({ op: "set", path: "system.lastError", value: terminalSystem.lastError });
    } else {
      patches.push({ op: "unset", path: "system.lastError" });
    }
  }

  // pendingRequirements (array, treat as atomic)
  if (!deepEquals(baseSystem.pendingRequirements, terminalSystem.pendingRequirements)) {
    patches.push({
      op: "set",
      path: "system.pendingRequirements",
      value: terminalSystem.pendingRequirements ?? [],
    });
  }
}

/**
 * Deep equality check using JSON serialization.
 *
 * @param a - First value
 * @param b - Second value
 * @returns True if deeply equal
 */
function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return a === b;

  // Use JSON serialization for deep comparison
  return JSON.stringify(sortObjectKeys(a)) === JSON.stringify(sortObjectKeys(b));
}

/**
 * Compute canonical hash for a snapshot.
 *
 * Uses deterministic JSON serialization of canonical snapshot.
 *
 * @param snapshot - Snapshot to hash
 * @returns Canonical hash string
 */
export function computeCanonicalHash(snapshot: Snapshot): string {
  const canonical = toCanonicalSnapshot(snapshot);
  const json = JSON.stringify(canonical);

  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash) ^ json.charCodeAt(i);
  }

  return `snap_${(hash >>> 0).toString(36)}`;
}
