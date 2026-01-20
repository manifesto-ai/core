/**
 * State Converter Module
 *
 * Pure functions for Snapshot ↔ AppState conversion.
 *
 * @see SPEC §7.1 State Model
 * @module
 */

import type { Snapshot, Patch } from "@manifesto-ai/core";
import type { AppState, ErrorValue } from "../core/types/index.js";
import { generateDelta } from "../storage/world-store/index.js";

// =============================================================================
// Snapshot → AppState Conversion
// =============================================================================

/**
 * Convert a Snapshot to AppState format.
 *
 * @param snapshot - The Snapshot from Core/Host
 * @returns AppState compatible with App's internal state representation
 */
export function snapshotToAppState(snapshot: Snapshot): AppState<unknown> {
  return {
    data: snapshot.data,
    computed: (snapshot.computed ?? {}) as Record<string, unknown>,
    system: {
      status:
        (snapshot.system?.status as "idle" | "computing" | "pending" | "error") ?? "idle",
      lastError: snapshot.system?.lastError ?? null,
      errors: (snapshot.system?.errors ?? []) as readonly ErrorValue[],
      pendingRequirements: snapshot.system?.pendingRequirements ?? [],
      currentAction: snapshot.system?.currentAction ?? null,
    },
    meta: {
      version: snapshot.meta?.version ?? 0,
      timestamp: snapshot.meta?.timestamp ?? Date.now(),
      randomSeed: snapshot.meta?.randomSeed ?? "",
      schemaHash: snapshot.meta?.schemaHash ?? "unknown",
    },
  };
}

// =============================================================================
// AppState → Snapshot Conversion
// =============================================================================

/**
 * Convert an AppState to Snapshot format.
 *
 * @param state - The AppState from App's internal representation
 * @returns Snapshot compatible with Core/Host
 */
export function appStateToSnapshot(state: AppState<unknown>): Snapshot {
  return {
    data: state.data as Record<string, unknown>,
    computed: state.computed,
    system: {
      status: state.system.status,
      lastError: state.system.lastError,
      pendingRequirements: [...state.system.pendingRequirements],
      currentAction: state.system.currentAction,
      errors: [...state.system.errors],
    },
    input: {},
    meta: {
      version: state.meta.version,
      timestamp: state.meta.timestamp,
      randomSeed: state.meta.randomSeed,
      schemaHash: state.meta.schemaHash,
    },
  };
}

// =============================================================================
// Patch Computation
// =============================================================================

/**
 * Compute patches between two snapshots.
 *
 * Uses canonical delta generation for deterministic patches.
 *
 * @see FDR-APP-INTEGRATION-001 §3.4 (DELTA-GEN-1~6)
 * @param from - Base snapshot
 * @param to - Target snapshot
 * @returns Array of patches to transform from → to
 */
export function computePatches(from: Snapshot, to: Snapshot): Patch[] {
  // DELTA-GEN-1~6: Use canonical delta generation
  return generateDelta(from, to);
}

// =============================================================================
// Hash Computation
// =============================================================================

/**
 * Compute a hash for a snapshot.
 *
 * Simple hash computation using JSON serialization.
 * In production, use a proper content-addressable hash.
 *
 * @param snapshot - The Snapshot to hash
 * @returns Hash string for the snapshot
 */
export function computeSnapshotHash(snapshot: Snapshot): string {
  try {
    const content = JSON.stringify({
      data: snapshot.data,
      computed: snapshot.computed,
    });
    // Simple hash - sum of char codes (replace with crypto hash in prod)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = (hash << 5) - hash + content.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return `snap_${Math.abs(hash).toString(36)}`;
  } catch {
    return `snap_${Date.now().toString(36)}`;
  }
}
