/**
 * Delta Generator
 *
 * Canonical patch generation for World deltas.
 *
 * Per ADR-009:
 * - Patch paths are structured segments (PatchPath), rooted at snapshot.data.
 * - system/input/computed/meta are not patch targets.
 *
 * @module
 */

import { patchPathToDisplayString, type PatchPath } from "@manifesto-ai/core";
import type { Patch, Snapshot } from "../../types/index.js";
import type { PersistedSnapshotEnvelope } from "../../types/world-store.js";
import { stripPlatformNamespaces } from "./platform-namespaces.js";

/**
 * Canonical patch type (v2 operators only).
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
   * Kept for backward compatibility.
   * Ignored under ADR-009 because patch root is snapshot.data.
   * @default false
   */
  includeComputed?: boolean;
}

/**
 * Generate canonical data-root patches from base snapshot to terminal snapshot.
 *
 * Non-data snapshot fields are persisted through `createSnapshotEnvelope()`.
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

  const canonicalBase = toCanonicalSnapshot(base);
  const canonicalTerminal = toCanonicalSnapshot(terminal);

  const patches: CanonicalPatch[] = [];

  // ADR-009 root anchor: patches target snapshot.data only.
  diffObject(canonicalBase.data, canonicalTerminal.data, [], patches, opts.maxDepth);

  // Reserved for compatibility; intentionally ignored in ADR-009 mode.
  if (opts.includeComputed) {
    // no-op
  }

  const filteredPatches = eliminateNoOps(patches);
  const normalizedPatches = normalizePatches(filteredPatches);
  return sortPatches(normalizedPatches);
}

/**
 * Create persisted non-data snapshot envelope.
 *
 * ADR-009 constrains patch roots to `snapshot.data`, so WorldStore persists
 * non-data transitions explicitly via this envelope.
 */
export function createSnapshotEnvelope(snapshot: Snapshot): PersistedSnapshotEnvelope {
  const canonical = toCanonicalSnapshot(snapshot);
  return {
    computed: canonical.computed,
    system: canonical.system,
    input: canonical.input,
    meta: canonical.meta,
  };
}

/**
 * Convert snapshot to canonical form with sorted keys and platform namespaces removed.
 */
export function toCanonicalSnapshot(snapshot: Snapshot): Snapshot {
  const strippedData = stripPlatformNamespaces(snapshot.data);

  return {
    data: sortObjectKeys(strippedData),
    computed: sortObjectKeys(snapshot.computed ?? {}),
    system: sortObjectKeys(snapshot.system ?? {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    }),
    input: sortObjectKeys(snapshot.input ?? {}),
    meta: sortObjectKeys(snapshot.meta ?? {
      version: 0,
      timestamp: 0,
      randomSeed: "",
      schemaHash: "",
    }),
  };
}

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
 */
export function eliminateNoOps(patches: CanonicalPatch[]): CanonicalPatch[] {
  const pathStates: Map<string, { op: string; value?: unknown }> = new Map();
  const result: CanonicalPatch[] = [];

  for (const patch of patches) {
    const pathKey = patchPathStructuralKey(patch.path);
    const value = "value" in patch ? patch.value : undefined;

    const existing = pathStates.get(pathKey);
    if (existing) {
      if (patch.op === "unset" && existing.op === "unset") {
        continue;
      }
      if (patch.op === "set" && existing.op === "set" && deepEquals(existing.value, value)) {
        continue;
      }
    }

    pathStates.set(pathKey, { op: patch.op, value });
    result.push(patch);
  }

  return result;
}

/**
 * Normalize patches to v2 operators only.
 */
export function normalizePatches(patches: CanonicalPatch[]): CanonicalPatch[] {
  return patches.filter((patch) => patch.op === "set" || patch.op === "unset" || patch.op === "merge");
}

/**
 * Sort patches deterministically.
 */
export function sortPatches(patches: CanonicalPatch[]): CanonicalPatch[] {
  return [...patches].sort((a, b) => {
    const aPath = patchPathToDisplayString(a.path);
    const bPath = patchPathToDisplayString(b.path);

    const pathCompare = aPath.localeCompare(bPath);
    if (pathCompare !== 0) {
      return pathCompare;
    }

    const aStructuralPath = patchPathStructuralKey(a.path);
    const bStructuralPath = patchPathStructuralKey(b.path);
    const structuralCompare = aStructuralPath.localeCompare(bStructuralPath);
    if (structuralCompare !== 0) {
      return structuralCompare;
    }

    const opOrder: Record<Patch["op"], number> = {
      set: 0,
      unset: 1,
      merge: 2,
    };

    return opOrder[a.op] - opOrder[b.op];
  });
}

function diffObject(
  base: unknown,
  terminal: unknown,
  path: PatchPath,
  patches: CanonicalPatch[],
  maxDepth: number,
  depth: number = 0
): void {
  if (depth > maxDepth) {
    pushSetIfChanged(base, terminal, path, patches);
    return;
  }

  if (isArray(base) || isArray(terminal)) {
    pushSetIfChanged(base, terminal, path, patches);
    return;
  }

  if (!isRecord(base) || !isRecord(terminal)) {
    pushSetIfChanged(base, terminal, path, patches);
    return;
  }

  const allKeys = Array.from(new Set([...Object.keys(base), ...Object.keys(terminal)])).sort();

  for (const key of allKeys) {
    if (!isSafePropKey(key)) {
      continue;
    }

    const childPath = appendProp(path, key);
    const baseHas = Object.prototype.hasOwnProperty.call(base, key);
    const terminalHas = Object.prototype.hasOwnProperty.call(terminal, key);

    if (!terminalHas) {
      patches.push({ op: "unset", path: childPath });
      continue;
    }

    if (!baseHas) {
      patches.push({ op: "set", path: childPath, value: terminal[key] });
      continue;
    }

    const baseValue = base[key];
    const terminalValue = terminal[key];

    if (
      isRecord(baseValue)
      && isRecord(terminalValue)
      && !isArray(baseValue)
      && !isArray(terminalValue)
    ) {
      diffObject(baseValue, terminalValue, childPath, patches, maxDepth, depth + 1);
      continue;
    }

    if (!deepEquals(baseValue, terminalValue)) {
      patches.push({ op: "set", path: childPath, value: terminalValue });
    }
  }
}

function patchPathStructuralKey(path: PatchPath): string {
  return JSON.stringify(path);
}

function pushSetIfChanged(
  base: unknown,
  terminal: unknown,
  path: PatchPath,
  patches: CanonicalPatch[]
): void {
  if (path.length === 0) {
    return;
  }

  if (!deepEquals(base, terminal)) {
    patches.push({ op: "set", path, value: terminal });
  }
}

function appendProp(path: PatchPath, name: string): PatchPath {
  return [...path, { kind: "prop", name }];
}

function isSafePropKey(key: string): boolean {
  return key !== "__proto__" && key !== "constructor" && key !== "prototype";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return a === b;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== "object") {
    return a === b;
  }

  return JSON.stringify(sortObjectKeys(a)) === JSON.stringify(sortObjectKeys(b));
}

/**
 * Compute canonical hash for a snapshot.
 */
export function computeCanonicalHash(snapshot: Snapshot): string {
  const canonical = toCanonicalSnapshot(snapshot);
  const json = JSON.stringify(canonical);

  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash) ^ json.charCodeAt(i);
  }

  return `snap_${(hash >>> 0).toString(36)}`;
}
