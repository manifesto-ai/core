/**
 * @fileoverview MergeStrategy Interface (SPEC Section 6.3)
 *
 * Merges multiple Intent Graphs into one.
 *
 * Per SPEC Section 6.3:
 * - merge() is synchronous (no I/O)
 * - Result must satisfy M-INV-* invariants
 *
 * @module core/interfaces/merger
 */

import type { IntentGraph } from "../types/intent-graph.js";

// =============================================================================
// MergeOptions
// =============================================================================

/**
 * Options for merging graphs.
 *
 * Per SPEC Section 6.3
 */
export interface MergeOptions {
  /** Use prefix-based node ID collision prevention */
  prefixNodeIds?: boolean;

  /** Perform semantic deduplication */
  deduplicate?: boolean;

  /** Cross-chunk linking strategy */
  linkStrategy?: "conservative" | "aggressive" | "none";
}

// =============================================================================
// MergeStrategy
// =============================================================================

/**
 * Merges multiple Intent Graphs into one.
 *
 * Per SPEC Section 6.3:
 * - merge() returns merged IntentGraph satisfying M-INV-* invariants
 * - Synchronous operation (no I/O)
 *
 * Built-in implementations:
 * - ConservativeMerger: Minimal linking, safe dedup
 * - AggressiveMerger: Maximum linking, semantic matching
 *
 * Invariants (M-INV-*):
 * - M-INV-1: Result graph is a valid DAG
 * - M-INV-2: C-ABS-1 is preserved
 * - M-INV-3: prefixNodeIds=true => no ID collisions
 * - M-INV-4: Overlap input triggers semantic deduplication
 * - M-INV-5: Result graph node IDs are globally unique
 */
export interface MergeStrategy {
  /**
   * Strategy name for debugging and logging.
   */
  readonly name: string;

  /**
   * Merge graphs.
   *
   * @param graphs - Array of graphs to merge
   * @param options - Merge options
   * @returns Single merged graph satisfying M-INV-* invariants
   */
  merge(graphs: readonly IntentGraph[], options?: MergeOptions): IntentGraph;
}
