/**
 * State Management
 *
 * @see SPEC §7 State Model
 * @module
 */

import type { Snapshot } from "@manifesto-ai/core";
import type { AppState, SystemState, SnapshotMeta } from "../types/index.js";

/**
 * Convert Core Snapshot to AppState.
 *
 * AppState is a read-only projection of Snapshot that excludes
 * the transient `input` field.
 */
export function snapshotToAppState<T = unknown>(snapshot: Snapshot): AppState<T> {
  return {
    data: snapshot.data as T,
    computed: snapshot.computed as Record<string, unknown>,
    system: snapshot.system as SystemState,
    meta: snapshot.meta as SnapshotMeta,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Normalize a Snapshot to ensure platform namespaces exist with proper structure.
 *
 * Ensures:
 * - data.$host is an object
 * - data.$mel.guards.intent is an object
 */
export function normalizeSnapshot(snapshot: Snapshot): Snapshot {
  if (!isPlainObject(snapshot.data)) {
    return snapshot;
  }

  const data = snapshot.data as Record<string, unknown>;
  let nextData = data;
  let changed = false;

  if (!isPlainObject(data.$host)) {
    nextData = { ...nextData, $host: {} };
    changed = true;
  }

  const melValue = data.$mel;
  let melChanged = false;
  let nextMel: Record<string, unknown>;

  if (!isPlainObject(melValue)) {
    nextMel = { guards: { intent: {} } };
    melChanged = true;
  } else {
    nextMel = melValue;
    const guardsValue = melValue.guards;

    if (!isPlainObject(guardsValue)) {
      nextMel = { ...nextMel, guards: { intent: {} } };
      melChanged = true;
    } else if (!isPlainObject(guardsValue.intent)) {
      nextMel = { ...nextMel, guards: { ...guardsValue, intent: {} } };
      melChanged = true;
    }
  }

  if (melChanged) {
    nextData = { ...nextData, $mel: nextMel };
    changed = true;
  }

  if (!changed) {
    return snapshot;
  }

  return {
    ...snapshot,
    data: nextData,
  };
}

/**
 * Deep clone a value using structuredClone.
 * Falls back to JSON parse/stringify if structuredClone is not available.
 */
function deepClone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  // Use structuredClone if available (Node 17+, modern browsers)
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  // Fallback to JSON for older environments
  return JSON.parse(JSON.stringify(value));
}

/**
 * Create initial AppState for genesis snapshot.
 */
export function createInitialAppState<T = unknown>(
  schemaHash: string,
  initialData?: T
): AppState<T> {
  const now = Date.now();
  return {
    data: deepClone(initialData ?? {}) as T,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    meta: {
      version: 0,
      timestamp: now,
      randomSeed: `${now}-${Math.random().toString(36).slice(2)}`,
      schemaHash,
    },
  };
}

/**
 * Create a Snapshot from AppState (for internal use).
 */
export function appStateToSnapshot<T = unknown>(
  state: AppState<T>,
  input?: unknown
): Snapshot {
  return {
    data: state.data,
    computed: state.computed,
    system: {
      status: state.system.status,
      lastError: state.system.lastError,
      errors: [...state.system.errors],
      pendingRequirements: [...state.system.pendingRequirements],
      currentAction: state.system.currentAction,
    },
    input: input ?? {},
    meta: state.meta,
  };
}
