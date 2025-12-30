/**
 * SnapshotView Schema
 *
 * Defines the read-only view of semantic state that Projection receives.
 *
 * Per Intent & Projection Specification v1.0 (Section 3.3, 10):
 * - SnapshotView intentionally excludes meta, version, and timestamp
 * - Projection reads data + computed only
 * - SnapshotView MUST be read-only
 *
 * Excluded Fields:
 * - meta.version: Would break determinism across versions
 * - meta.timestamp: Non-deterministic
 * - meta.schemaHash: Passed separately in ProjectionRequest
 * - system.*: Internal state, not for Projection
 * - input: Transient effect input
 */
import { z } from "zod";

// ============================================================================
// SnapshotView Schema
// ============================================================================

/**
 * SnapshotView - read-only view for Projection
 *
 * Contains only the semantic state needed for projection:
 * - data: Domain state
 * - computed: Computed values
 */
export const SnapshotView = z
  .object({
    /** Domain state (data from Snapshot) */
    data: z.unknown(),

    /** Computed values (computed from Snapshot) */
    computed: z.record(z.string(), z.unknown()),
  })
  .readonly();

export type SnapshotView = z.infer<typeof SnapshotView>;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a SnapshotView
 *
 * Note: For converting a full Snapshot to SnapshotView,
 * use toSnapshotView() from utils/snapshot-adapter.ts
 */
export function createSnapshotView(
  data: unknown,
  computed: Record<string, unknown> = {}
): SnapshotView {
  return Object.freeze({
    data,
    computed: Object.freeze({ ...computed }),
  });
}

/**
 * Create an empty SnapshotView
 */
export function createEmptySnapshotView(): SnapshotView {
  return createSnapshotView({}, {});
}
