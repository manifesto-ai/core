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
  PersistedPatchEnvelope,
  PersistedSnapshotEnvelope,
  CompactOptions,
  CompactResult,
  PersistedBranchState,
  Snapshot,
  Patch,
} from "../../types/index.js";
import { PATCH_FORMAT_V2 } from "../../types/world-store.js";
import type { World, WorldId } from "@manifesto-ai/world";
import {
  mergeAtPatchPath,
  setByPatchPath,
  unsetByPatchPath,
  type PatchPath,
} from "@manifesto-ai/core";
import type { WorldStoreOptions, WorldEntry } from "./interface.js";
import { IncompatiblePatchFormatError } from "../../errors/index.js";
import { stripPlatformNamespaces } from "./platform-namespaces.js";

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
  private _branchState: PersistedBranchState | null = null;

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
        patchEnvelope: createPersistedPatchEnvelope([]),
        snapshotEnvelope: createPersistedSnapshotEnvelope(snapshot),
        createdAt: Date.now(),
      };

      this._worlds.set(genesis.worldId, {
        world: genesis,
        delta: genesisDelta,
        snapshot: this._excludePlatformData(snapshot),
      });

      this._children.set(genesis.worldId, new Set());
    }
  }

  /**
   * Initialize genesis World with a full Snapshot.
   */
  async initializeGenesis(world: World, snapshot: Snapshot): Promise<void> {
    if (this._worlds.has(world.worldId)) {
      return;
    }

    const genesisDelta: WorldDelta = {
      fromWorld: world.worldId,
      toWorld: world.worldId,
      patches: [],
      patchEnvelope: createPersistedPatchEnvelope([]),
      snapshotEnvelope: createPersistedSnapshotEnvelope(snapshot),
      createdAt: world.createdAt,
    };

    this._worlds.set(world.worldId, {
      world,
      delta: genesisDelta,
      snapshot: this._excludePlatformData(snapshot),
    });

    if (!this._children.has(world.worldId)) {
      this._children.set(world.worldId, new Set());
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
    const normalizedDelta = this._normalizeDelta(world.worldId, delta);

    // Determine if we should store full snapshot
    const withinHorizon = this._isWithinActiveHorizon(world.worldId);

    // Get terminal snapshot if available (for full snapshot storage)
    let snapshot: Snapshot | undefined;
    if (withinHorizon) {
      // Reconstruct snapshot from parent + delta
      const parentSnapshot = await this._getSnapshotForDelta(normalizedDelta.fromWorld);
      if (parentSnapshot) {
        snapshot = this._applyDelta(parentSnapshot, normalizedDelta, world.worldId);
      }
    }

    // STORE-7: Exclude $host from stored snapshot
    const cleanSnapshot = snapshot ? this._excludePlatformData(snapshot) : undefined;

    const entry: WorldEntry = {
      world,
      delta: normalizedDelta,
      snapshot: cleanSnapshot,
    };

    this._worlds.set(world.worldId, entry);

    // Track parent-child relationship
    const parentId = normalizedDelta.fromWorld;
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

    // ADR-009 hard cut: reject legacy/missing persisted patch format at ingress.
    this._assertPersistedPatchEnvelope(entry.delta, worldId);

    // If full snapshot is stored, return it
    if (entry.snapshot) {
      return this._excludePlatformData(entry.snapshot);
    }

    // Otherwise, reconstruct from lineage
    const snapshot = await this._reconstructSnapshot(worldId);
    return this._excludePlatformData(snapshot);
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
  // Branch Persistence (SPEC v2.0.5)
  // ===========================================================================

  /**
   * Save branch state.
   *
   * @see World SPEC v2.0.5 BRANCH-PERSIST-4
   */
  async saveBranchState(state: PersistedBranchState): Promise<void> {
    this._branchState = state;
  }

  /**
   * Load persisted branch state.
   */
  async loadBranchState(): Promise<PersistedBranchState | null> {
    return this._branchState;
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
      if (entry) {
        currentSnapshot = this._applyDelta(currentSnapshot, entry.delta, lineage[i]);
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
   * Apply world delta (data patches + non-data envelope) to snapshot.
   */
  private _applyDelta(snapshot: Snapshot, delta: WorldDelta, worldId: WorldId): Snapshot {
    const patches = this._getPersistedPatches(delta, worldId);
    let result = patches.length > 0 ? this._applyPatches(snapshot, patches) : { ...snapshot };

    if (delta.snapshotEnvelope) {
      const envelope = createPersistedSnapshotEnvelope(delta.snapshotEnvelope);
      result = {
        ...result,
        computed: envelope.computed,
        system: envelope.system,
        input: envelope.input,
        meta: envelope.meta,
      };
    }

    return result;
  }

  /**
   * Apply single patch manually.
   */
  private _applyPatch(snapshot: Snapshot, patch: Patch): Snapshot {
    const baseData = snapshot.data;

    switch (patch.op) {
      case "set":
        return {
          ...snapshot,
          data: setByPatchPath(baseData, patch.path, patch.value) as Record<string, unknown>,
        };
      case "unset":
        return {
          ...snapshot,
          data: unsetByPatchPath(baseData, patch.path) as Record<string, unknown>,
        };
      case "merge":
        return {
          ...snapshot,
          data: mergeAtPatchPath(baseData, patch.path, patch.value) as Record<string, unknown>,
        };
    }
  }

  /**
   * Exclude platform-owned data from snapshot.
   *
   * Per Core SPEC SCHEMA-RESERVED-1 and World SPEC v2.0.3:
   * - All $-prefixed keys are platform namespaces (future-proof)
   * - STORE-7: Platform namespaces MUST be excluded from canonical hash
   * - STORE-8: restore() MUST return without platform namespaces
   */
  private _excludePlatformData(snapshot: Snapshot): Snapshot {
    if (!snapshot.data || typeof snapshot.data !== "object") {
      return snapshot;
    }

    const cleanData = stripPlatformNamespaces(
      snapshot.data as Record<string, unknown>
    );

    // Return same snapshot if no changes (optimization)
    if (cleanData === snapshot.data) {
      return snapshot;
    }

    return {
      ...snapshot,
      data: cleanData,
    };
  }

  private _normalizeDelta(worldId: WorldId, delta: WorldDelta): WorldDelta {
    const envelope = delta.patchEnvelope
      ? this._parsePersistedPatchEnvelope(delta.patchEnvelope as unknown, worldId)
      : createPersistedPatchEnvelope(delta.patches);

    return {
      ...delta,
      patches: [...envelope.patches],
      patchEnvelope: {
        _patchFormat: PATCH_FORMAT_V2,
        patches: [...envelope.patches],
      },
      snapshotEnvelope: delta.snapshotEnvelope
        ? createPersistedSnapshotEnvelope(delta.snapshotEnvelope)
        : undefined,
    };
  }

  private _assertPersistedPatchEnvelope(delta: WorldDelta, worldId: WorldId): void {
    this._parsePersistedPatchEnvelope(delta.patchEnvelope as unknown, worldId);
  }

  private _getPersistedPatches(delta: WorldDelta, worldId: WorldId): readonly Patch[] {
    return this._parsePersistedPatchEnvelope(delta.patchEnvelope as unknown, worldId).patches;
  }

  private _parsePersistedPatchEnvelope(
    envelope: unknown,
    worldId: WorldId
  ): PersistedPatchEnvelope {
    if (!isRecord(envelope) || !("_patchFormat" in envelope)) {
      throw new IncompatiblePatchFormatError(String(worldId), null);
    }

    const format = typeof envelope._patchFormat === "number" ? envelope._patchFormat : null;
    if (format !== PATCH_FORMAT_V2) {
      throw new IncompatiblePatchFormatError(String(worldId), format);
    }

    if (!Array.isArray(envelope.patches)) {
      throw new IncompatiblePatchFormatError(String(worldId), format);
    }

    for (const patch of envelope.patches) {
      if (!isPatchPath(patch.path)) {
        throw new IncompatiblePatchFormatError(String(worldId), null);
      }
    }

    return {
      _patchFormat: PATCH_FORMAT_V2,
      patches: envelope.patches as readonly Patch[],
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

function createPersistedPatchEnvelope(patches: readonly Patch[]): PersistedPatchEnvelope {
  return {
    _patchFormat: PATCH_FORMAT_V2,
    patches: [...patches],
  };
}

function createPersistedSnapshotEnvelope(
  snapshot: Pick<Snapshot, "computed" | "system" | "input" | "meta">
): PersistedSnapshotEnvelope {
  return {
    computed: { ...(snapshot.computed as Record<string, unknown>) },
    system: {
      ...snapshot.system,
      errors: [...snapshot.system.errors],
      pendingRequirements: [...snapshot.system.pendingRequirements],
    },
    input: { ...(snapshot.input as Record<string, unknown>) },
    meta: { ...snapshot.meta },
  };
}

function isPatchPath(value: unknown): value is PatchPath {
  return Array.isArray(value)
    && value.every((segment) => {
      if (typeof segment !== "object" || segment === null) {
        return false;
      }

      const candidate = segment as {
        kind?: unknown;
        name?: unknown;
        index?: unknown;
      };

      if (candidate.kind === "prop") {
        return typeof candidate.name === "string";
      }

      if (candidate.kind === "index") {
        return typeof candidate.index === "number"
          && Number.isInteger(candidate.index)
          && candidate.index >= 0;
      }

      return false;
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
