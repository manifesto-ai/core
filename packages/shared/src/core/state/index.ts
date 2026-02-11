/**
 * State Management
 *
 * @see SPEC §7 State Model
 * @see App SPEC v2.3.2 §2.2 (DX aliases)
 * @module
 */

import type { Snapshot } from "@manifesto-ai/core";
import type { AppState, SystemState, SnapshotMeta } from "../types/index.js";

// =============================================================================
// DX Aliases (App SPEC v2.3.2)
// =============================================================================

const VALID_IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * Add computed alias keys.
 *
 * For each canonical key of the form `computed.<name>`, exposes a
 * non-enumerable alias `<name>` on the same object.
 *
 * @see App SPEC v2.3.2 COMP-ALIAS-1~3
 */
function addComputedAliases(computed: Record<string, unknown>): void {
  if (!Object.isExtensible(computed)) {
    return;
  }
  const keys = Object.keys(computed);
  for (const key of keys) {
    if (key.startsWith("computed.")) {
      const alias = key.slice("computed.".length);
      if (VALID_IDENTIFIER_RE.test(alias) && !(alias in computed)) {
        const fullKey = key;
        Object.defineProperty(computed, alias, {
          get() {
            return computed[fullKey];
          },
          enumerable: false,
          configurable: false,
        });
      }
    }
  }
}

/**
 * Convert an AppState-shaped object into client-consumable form.
 *
 * Attaches DX aliases (idempotent):
 * - `state` → non-enumerable accessor aliasing `data` (STATE-ALIAS-1/2)
 * - Computed short keys → non-enumerable aliases (COMP-ALIAS-1~3)
 *
 * @see App SPEC v2.3.2 §2.2
 */
export function toClientState<T>(obj: Omit<AppState<T>, "state"> | AppState<T>): AppState<T> {
  if (!Object.getOwnPropertyDescriptor(obj, "state")) {
    Object.defineProperty(obj, "state", {
      get() {
        return (this as { data: T }).data;
      },
      enumerable: false,
      configurable: false,
    });
  }
  addComputedAliases(obj.computed as Record<string, unknown>);
  return obj as AppState<T>;
}

/**
 * Convert Core Snapshot to AppState.
 *
 * AppState is a read-only projection of Snapshot that excludes
 * the transient `input` field. Includes DX aliases (state, computed short keys).
 */
export function snapshotToAppState<T = unknown>(snapshot: Snapshot): AppState<T> {
  return toClientState<T>({
    data: snapshot.data as T,
    computed: { ...(snapshot.computed as Record<string, unknown>) },
    system: snapshot.system as SystemState,
    meta: snapshot.meta as SnapshotMeta,
  });
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
 *
 * When schemaDefaults is provided, its values serve as the base layer.
 * initialData (if any) is spread on top, overriding matching keys.
 */
export function createInitialAppState<T = unknown>(
  schemaHash: string,
  initialData?: T,
  schemaDefaults?: Record<string, unknown>
): AppState<T> {
  const now = Date.now();
  const base =
    schemaDefaults && Object.keys(schemaDefaults).length > 0
      ? { ...schemaDefaults, ...(initialData ?? {}) }
      : (initialData ?? {});
  return toClientState<T>({
    data: deepClone(base) as T,
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
  });
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
    computed: { ...state.computed },
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

/**
 * @deprecated Use `toClientState` instead. Will be removed in v3.
 */
export const withDxAliases = toClientState;
