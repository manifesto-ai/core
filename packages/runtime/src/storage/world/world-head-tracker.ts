/**
 * World Head Tracker Module
 *
 * Tracks the current World head for v2 execution.
 *
 * @see SPEC v2.0.0 §6.2
 * @module
 */

import type { WorldId } from "@manifesto-ai/world";

// =============================================================================
// Types
// =============================================================================

/**
 * World Head Tracker interface.
 *
 * Manages v2 current World head tracking.
 */
export interface WorldHeadTracker {
  /**
   * Get the current head WorldId.
   *
   * @returns Current head WorldId, or null if not initialized
   */
  getCurrentHead(): WorldId | null;

  /**
   * Get the genesis WorldId.
   *
   * @returns Genesis WorldId, or null if not initialized
   */
  getGenesisWorldId(): WorldId | null;

  /**
   * Advance the head to a new WorldId.
   *
   * @param worldId - The new head WorldId
   */
  advanceHead(worldId: WorldId): void;

  /**
   * Set the genesis WorldId.
   *
   * @param worldId - The genesis WorldId
   */
  setGenesisWorldId(worldId: WorldId): void;

  /**
   * Initialize the tracker with genesis.
   *
   * @param genesisWorldId - The genesis WorldId
   */
  initialize(genesisWorldId: WorldId): void;

  /**
   * Check if the tracker is initialized.
   */
  isInitialized(): boolean;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * World Head Tracker implementation.
 *
 * Simple state container for tracking the current World head.
 */
export class WorldHeadTrackerImpl implements WorldHeadTracker {
  /**
   * Current head WorldId.
   */
  private _currentHead: WorldId | null = null;

  /**
   * Genesis WorldId (for lineage root).
   */
  private _genesisWorldId: WorldId | null = null;

  getCurrentHead(): WorldId | null {
    return this._currentHead;
  }

  getGenesisWorldId(): WorldId | null {
    return this._genesisWorldId;
  }

  advanceHead(worldId: WorldId): void {
    this._currentHead = worldId;
  }

  setGenesisWorldId(worldId: WorldId): void {
    this._genesisWorldId = worldId;
  }

  initialize(genesisWorldId: WorldId): void {
    this._genesisWorldId = genesisWorldId;
    this._currentHead = genesisWorldId;
  }

  isInitialized(): boolean {
    return this._genesisWorldId !== null;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new WorldHeadTracker instance.
 */
export function createWorldHeadTracker(): WorldHeadTracker {
  return new WorldHeadTrackerImpl();
}
