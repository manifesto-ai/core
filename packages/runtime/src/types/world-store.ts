/**
 * Manifesto App — WorldStore Types
 *
 * @see SPEC v2.0.0 §9
 * @see ADR-004 Phase 1
 * @module
 */

import type { Patch, Snapshot } from "@manifesto-ai/core";
import type { World, WorldId } from "@manifesto-ai/world";

// =============================================================================
// Branch Persistence Types (SPEC v2.0.5)
// =============================================================================

/**
 * Serialized branch entry for persistence.
 *
 * @see World SPEC v2.0.5 §4.3 BRANCH-PERSIST
 */
export type PersistedBranchEntry = {
  readonly id: string;
  readonly name: string;
  readonly head: string; // WorldId as string
  readonly schemaHash: string;
  readonly createdAt: number;
  readonly parentBranch?: string;
  readonly lineage: readonly string[];
};

/**
 * Full branch state snapshot for persistence.
 *
 * @see World SPEC v2.0.5 §4.3 BRANCH-PERSIST-1~5
 */
export type PersistedBranchState = {
  readonly branches: readonly PersistedBranchEntry[];
  readonly activeBranchId: string;
};

// =============================================================================
// v2.0.0 WorldStore Interface
// =============================================================================

/**
 * World delta for persistence.
 *
 * @see SPEC v2.0.0 §9.2
 */
export type WorldDelta = {
  readonly fromWorld: WorldId;
  readonly toWorld: WorldId;
  readonly patches: readonly Patch[];
  readonly createdAt: number;
};

/**
 * Compact options for WorldStore maintenance.
 */
export type CompactOptions = {
  readonly olderThan?: number;
  readonly maxWorlds?: number;
};

/**
 * Compact result from WorldStore maintenance.
 */
export type CompactResult = {
  readonly compactedCount: number;
  readonly freedBytes?: number;
};

/**
 * WorldStore: Persistence abstraction for Worlds.
 *
 * @see SPEC v2.0.0 §9.1
 */
export interface WorldStore {
  // Core Operations
  /**
   * Store a World and its delta.
   */
  store(world: World, delta: WorldDelta): Promise<void>;

  /**
   * Initialize a genesis World with a full Snapshot.
   *
   * Optional hook for stores that need explicit seeding.
   */
  initializeGenesis?(world: World, snapshot: Snapshot): Promise<void>;

  /**
   * Restore a Snapshot for a World.
   * MAY involve delta reconstruction.
   */
  restore(worldId: WorldId): Promise<Snapshot>;

  /**
   * Get World metadata.
   */
  getWorld(worldId: WorldId): Promise<World | null>;

  /**
   * Check if World exists.
   */
  has(worldId: WorldId): Promise<boolean>;

  // Query
  /**
   * Get children of a World.
   */
  getChildren(worldId: WorldId): Promise<readonly WorldId[]>;

  /**
   * Get lineage path to Genesis.
   */
  getLineage(worldId: WorldId): Promise<readonly WorldId[]>;

  // Maintenance (Optional)
  /**
   * Compact old Worlds (delta-only storage).
   */
  compact?(options: CompactOptions): Promise<CompactResult>;

  /**
   * Archive cold Worlds.
   */
  archive?(worldIds: readonly WorldId[]): Promise<void>;

  // Branch Persistence (SPEC v2.0.5)
  /**
   * Save branch state atomically.
   *
   * @see World SPEC v2.0.5 BRANCH-PERSIST-4
   */
  saveBranchState?(state: PersistedBranchState): Promise<void>;

  /**
   * Load persisted branch state.
   *
   * Returns null if no branch state has been saved.
   */
  loadBranchState?(): Promise<PersistedBranchState | null>;
}
