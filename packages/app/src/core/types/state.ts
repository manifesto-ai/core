/**
 * Manifesto App — State Types
 *
 * Leaf module: no internal type imports.
 *
 * @see SPEC v2.0.0 §7
 * @see ADR-004 Phase 1
 * @module
 */

import type { Requirement } from "@manifesto-ai/core";

// =============================================================================
// State Types
// =============================================================================

/**
 * Error value representation.
 *
 * @see SPEC §7.2
 */
export interface ErrorValue {
  readonly code: string;
  readonly message: string;
  readonly source: {
    actionId: string;
    nodePath: string;
  };
  readonly timestamp: number;
  readonly context?: Record<string, unknown>;
}

/**
 * Snapshot metadata.
 *
 * @see SPEC §7.1
 */
export interface SnapshotMeta {
  readonly version: number;
  readonly timestamp: number;
  readonly randomSeed: string;
  readonly schemaHash: string;
}

/**
 * System state within snapshot.
 *
 * @see SPEC §7.1
 */
export interface SystemState {
  readonly status: "idle" | "computing" | "pending" | "error";
  readonly lastError: ErrorValue | null;
  readonly errors: readonly ErrorValue[];
  readonly pendingRequirements: readonly Requirement[];
  readonly currentAction: string | null;
}

// Note: Requirement is re-exported from @manifesto-ai/core

/**
 * Complete app state.
 *
 * @see SPEC §7.1
 */
export interface AppState<TData = unknown> {
  readonly data: TData;
  readonly computed: Record<string, unknown>;
  readonly system: SystemState;
  readonly meta: SnapshotMeta;
}
