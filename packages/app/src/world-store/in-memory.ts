/**
 * InMemoryWorldStore
 *
 * Reference implementation of WorldStore for testing and development.
 *
 * @see SPEC v2.0.0 §9
 * @module
 */

import type {
  WorldStore,
  WorldDelta,
  CompactOptions,
  CompactResult,
  Snapshot,
  Patch,
} from "../types/index.js";
import type { World, WorldId } from "@manifesto-ai/world";
import type { WorldStoreOptions, WorldEntry } from "./interface.js";

/**
 * InMemoryWorldStore: Reference implementation for testing.
 *
 * Features:
 * - Full snapshot storage for active horizon
 * - Delta-based reconstruction for older worlds
 * - Lineage tracking via parent relationships
 *
 * Limitations:
 * - Not suitable for production (memory-only)
 * - No persistence across restarts
 *
 * @see SPEC v2.0.0 §9
 */
export class InMemoryWorldStore implements WorldStore {
  private _worlds: Map<WorldId, WorldEntry> = new Map();
  private _children: Map<WorldId, Set<WorldId>> = new Map();
  private _activeHorizon: number;

  constructor(options?: WorldStoreOptions) {
    this._activeHorizon = options?.activeHorizon ?? 100;

    // Initialize with genesis if provided
    if (options?.genesisWorld && options?.genesisSnapshot) {
      const genesis = options.genesisWorld;
      const snapshot = options.genesisSnapshot;

      // Genesis has no parent, so delta is empty
      const genesisDelta: WorldDelta = {
        fromWorld: genesis.worldId,
        toWorld: genesis.worldId,
        patches: [],
        createdAt: Date.now(),
      };

      this._worlds.set(genesis.worldId, {
        world: genesis,
        delta: genesisDelta,
        snapshot: this._excludeHostData(snapshot),
      });

      this._children.set(genesis.worldId, new Set());
    }
  }

  /**
   * Store a World and its delta.
   *
   * STORE-6: MUST NOT modify World or Delta.
   * STORE-7: MUST exclude `data.$host` from canonical hash computation.
   *
   * @see SPEC v2.0.0 §9.3
   */
  async store(world: World, delta: WorldDelta): Promise<void> {
    // Determine if we should store full snapshot
    const withinHorizon = this._isWithinActiveHorizon(world.worldId);

    // Get terminal snapshot if available (for full snapshot storage)
    let snapshot: Snapshot | undefined;
    if (withinHorizon && delta.patches.length > 0) {
      // Reconstruct snapshot from parent + delta
      const parentSnapshot = await this._getSnapshotForDelta(delta.fromWorld);
      if (parentSnapshot) {
        snapshot = this._applyPatches(parentSnapshot, delta.patches);
      }
    }

    // STORE-7: Exclude $host from stored snapshot
    const cleanSnapshot = snapshot ? this._excludeHostData(snapshot) : undefined;

    const entry: WorldEntry = {
      world,
      delta,
      snapshot: cleanSnapshot,
    };

    this._worlds.set(world.worldId, entry);

    // Track parent-child relationship
    const parentId = delta.fromWorld;
    if (parentId && parentId !== world.worldId) {
      if (!this._children.has(parentId)) {
        this._children.set(parentId, new Set());
      }
      this._children.get(parentId)!.add(world.worldId);
    }

    // Ensure this world has a children set
    if (!this._children.has(world.worldId)) {
      this._children.set(world.worldId, new Set());
    }
  }

  /**
   * Restore a Snapshot for a World.
   *
   * STORE-2: MUST return complete Snapshot.
   * STORE-3: MUST reconstruct from deltas if necessary.
   * STORE-8: MUST return Snapshot without `data.$host`.
   *
   * @see SPEC v2.0.0 §9.3
   */
  async restore(worldId: WorldId): Promise<Snapshot> {
    const entry = this._worlds.get(worldId);
    if (!entry) {
      throw new WorldNotFoundError(worldId);
    }

    // If full snapshot is stored, return it
    if (entry.snapshot) {
      return this._excludeHostData(entry.snapshot);
    }

    // Otherwise, reconstruct from lineage
    const snapshot = await this._reconstructSnapshot(worldId);
    return this._excludeHostData(snapshot);
  }

  /**
   * Get World metadata.
   */
  async getWorld(worldId: WorldId): Promise<World | null> {
    const entry = this._worlds.get(worldId);
    return entry?.world ?? null;
  }

  /**
   * Check if World exists.
   */
  async has(worldId: WorldId): Promise<boolean> {
    return this._worlds.has(worldId);
  }

  /**
   * Get children of a World.
   */
  async getChildren(worldId: WorldId): Promise<readonly WorldId[]> {
    const children = this._children.get(worldId);
    return children ? Array.from(children) : [];
  }

  /**
   * Get lineage path to Genesis.
   */
  async getLineage(worldId: WorldId): Promise<readonly WorldId[]> {
    const lineage: WorldId[] = [];
    let currentId: WorldId | undefined = worldId;

    while (currentId) {
      lineage.push(currentId);
      const entry = this._worlds.get(currentId);
      if (!entry) break;

      // Genesis points to itself
      const parentId = entry.delta.fromWorld;
      if (parentId === currentId) break;

      currentId = parentId;
    }

    return lineage;
  }

  /**
   * Compact old Worlds (delta-only storage).
   *
   * Removes full snapshots from old Worlds, keeping only deltas.
   */
  async compact(options: CompactOptions): Promise<CompactResult> {
    let compactedCount = 0;

    for (const [worldId, entry] of this._worlds.entries()) {
      if (entry.snapshot && !this._isWithinActiveHorizon(worldId)) {
        // Remove full snapshot, keep delta only
        this._worlds.set(worldId, {
          world: entry.world,
          delta: entry.delta,
          snapshot: undefined,
        });
        compactedCount++;
      }

      if (options.maxWorlds && compactedCount >= options.maxWorlds) {
        break;
      }
    }

    return { compactedCount };
  }

  /**
   * Archive cold Worlds (remove from active storage).
   */
  async archive(worldIds: readonly WorldId[]): Promise<void> {
    for (const worldId of worldIds) {
      this._worlds.delete(worldId);
      this._children.delete(worldId);

      // Remove from parent's children
      for (const children of this._children.values()) {
        children.delete(worldId);
      }
    }
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  /**
   * Check if world is within active horizon.
   */
  private _isWithinActiveHorizon(_worldId: WorldId): boolean {
    // Simple implementation: always within horizon
    // More sophisticated implementations could use timestamps
    return this._worlds.size < this._activeHorizon;
  }

  /**
   * Get snapshot for delta application.
   */
  private async _getSnapshotForDelta(worldId: WorldId): Promise<Snapshot | null> {
    const entry = this._worlds.get(worldId);
    if (!entry) return null;

    if (entry.snapshot) return entry.snapshot;

    // Reconstruct if needed
    return this._reconstructSnapshot(worldId);
  }

  /**
   * Reconstruct snapshot from deltas.
   */
  private async _reconstructSnapshot(worldId: WorldId): Promise<Snapshot> {
    const lineage = await this.getLineage(worldId);
    if (lineage.length === 0) {
      throw new WorldNotFoundError(worldId);
    }

    // Find the first snapshot in lineage (going from oldest to newest)
    let baseSnapshot: Snapshot | null = null;
    let startIndex = lineage.length - 1;

    for (let i = lineage.length - 1; i >= 0; i--) {
      const entry = this._worlds.get(lineage[i]);
      if (entry?.snapshot) {
        baseSnapshot = entry.snapshot;
        startIndex = i;
        break;
      }
    }

    if (!baseSnapshot) {
      throw new Error(`No base snapshot found in lineage for World: ${worldId}`);
    }

    // Apply deltas from startIndex to target
    let currentSnapshot = baseSnapshot;
    for (let i = startIndex - 1; i >= 0; i--) {
      const entry = this._worlds.get(lineage[i]);
      if (entry && entry.delta.patches.length > 0) {
        currentSnapshot = this._applyPatches(currentSnapshot, entry.delta.patches);
      }
    }

    return currentSnapshot;
  }

  /**
   * Apply patches to snapshot.
   */
  private _applyPatches(snapshot: Snapshot, patches: readonly Patch[]): Snapshot {
    // Fallback: manual patch application
    // Note: core's apply() requires full schema which we don't have here
    let result = { ...snapshot };
    for (const patch of patches) {
      result = this._applyPatch(result, patch);
    }
    return result;
  }

  /**
   * Apply single patch manually.
   */
  private _applyPatch(snapshot: Snapshot, patch: Patch): Snapshot {
    const { op, path } = patch;
    const value = "value" in patch ? patch.value : undefined;
    const pathParts = path.split(".").filter(Boolean);

    if (pathParts.length === 0) {
      return snapshot;
    }

    // Deep clone and modify
    const result = JSON.parse(JSON.stringify(snapshot)) as Snapshot;
    let current: any = result;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const key = pathParts[i];
      if (!(key in current)) {
        if (op === "unset") return result;
        current[key] = {};
      }
      current = current[key];
    }

    const lastKey = pathParts[pathParts.length - 1];

    switch (op) {
      case "set":
        current[lastKey] = value;
        break;
      case "unset":
        delete current[lastKey];
        break;
      case "merge":
        current[lastKey] = { ...(current[lastKey] ?? {}), ...(value as Record<string, unknown>) };
        break;
    }

    return result;
  }

  /**
   * Exclude $host data from snapshot.
   *
   * STORE-7: data.$host MUST be excluded from canonical hash.
   * STORE-8: restore() MUST return without data.$host.
   */
  private _excludeHostData(snapshot: Snapshot): Snapshot {
    if (!snapshot.data || typeof snapshot.data !== "object") {
      return snapshot;
    }

    const data = snapshot.data as Record<string, unknown>;
    if (!("$host" in data)) {
      return snapshot;
    }

    // Clone and remove $host
    const { $host, ...cleanData } = data;
    return {
      ...snapshot,
      data: cleanData,
    };
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get total number of stored Worlds.
   */
  get size(): number {
    return this._worlds.size;
  }

  /**
   * Clear all stored Worlds.
   */
  clear(): void {
    this._worlds.clear();
    this._children.clear();
  }
}

/**
 * Error thrown when World is not found.
 */
export class WorldNotFoundError extends Error {
  readonly worldId: WorldId;

  constructor(worldId: WorldId) {
    super(`World not found: ${worldId}`);
    this.name = "WorldNotFoundError";
    this.worldId = worldId;
  }
}

/**
 * Create an InMemoryWorldStore.
 */
export function createInMemoryWorldStore(
  options?: WorldStoreOptions
): InMemoryWorldStore {
  return new InMemoryWorldStore(options);
}
