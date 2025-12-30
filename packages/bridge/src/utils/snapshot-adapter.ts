/**
 * Snapshot Adapter
 *
 * Converts full Snapshot to SnapshotView.
 *
 * Per Intent & Projection Specification v1.0 (Section 10):
 * - SnapshotView intentionally excludes meta, version, timestamp
 * - SnapshotView includes only data and computed
 * - SnapshotView MUST be read-only
 */
import type { Snapshot } from "@manifesto-ai/core";
import type { SnapshotView } from "../schema/snapshot-view.js";

// ============================================================================
// Snapshot to SnapshotView Conversion
// ============================================================================

/**
 * Convert a full Snapshot to a SnapshotView
 *
 * This function extracts only the semantic state (data + computed)
 * and ensures immutability via Object.freeze.
 *
 * Excluded fields:
 * - meta.version: Would break determinism across versions
 * - meta.timestamp: Non-deterministic
 * - meta.schemaHash: Passed separately in ProjectionRequest
 * - system.*: Internal state, not for Projection
 * - input: Transient effect input
 *
 * @param snapshot - Full Snapshot from Core
 * @returns Read-only SnapshotView with only data and computed
 */
export function toSnapshotView(snapshot: Snapshot): SnapshotView {
  // Create shallow copies of data and computed
  const view: SnapshotView = {
    data: snapshot.data,
    computed: { ...snapshot.computed },
  };

  // Freeze the view for immutability
  Object.freeze(view.computed);
  Object.freeze(view);

  return view;
}

/**
 * Deep freeze an object recursively
 *
 * Note: This is more expensive than shallow freeze.
 * Use only when deep immutability is required.
 */
export function deepFreeze<T extends object>(obj: T): T {
  const propNames = Object.getOwnPropertyNames(obj) as (keyof T)[];

  for (const name of propNames) {
    const value = obj[name];
    if (value && typeof value === "object") {
      deepFreeze(value as object);
    }
  }

  return Object.freeze(obj);
}

/**
 * Convert a full Snapshot to a deeply frozen SnapshotView
 *
 * Use this when you need to ensure deep immutability.
 */
export function toDeepFrozenSnapshotView(snapshot: Snapshot): SnapshotView {
  const view: SnapshotView = {
    data: structuredClone(snapshot.data),
    computed: structuredClone(snapshot.computed),
  };

  return deepFreeze(view);
}
