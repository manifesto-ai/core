import type { Snapshot } from "@manifesto-ai/core";

/**
 * Snapshot store interface for Host persistence
 *
 * Implementations MUST:
 * - Be thread-safe / atomic for concurrent access
 * - Preserve snapshot immutability
 * - Handle serialization correctly (JSON-compatible)
 */
export interface SnapshotStore {
  /**
   * Get the current snapshot
   * Returns null if no snapshot exists
   */
  get(): Promise<Snapshot | null>;

  /**
   * Save a new snapshot
   * Implementations should verify version ordering
   */
  save(snapshot: Snapshot): Promise<void>;

  /**
   * Get snapshot at a specific version
   * Returns null if version not found
   */
  getVersion(version: number): Promise<Snapshot | null>;

  /**
   * Get the latest version number
   * Returns -1 if no snapshots exist
   */
  getLatestVersion(): Promise<number>;

  /**
   * Clear all stored snapshots
   */
  clear(): Promise<void>;
}

/**
 * Snapshot store with history support
 */
export interface SnapshotStoreWithHistory extends SnapshotStore {
  /**
   * Get all versions between start and end (inclusive)
   */
  getVersionRange(start: number, end: number): Promise<Snapshot[]>;

  /**
   * Get the total number of stored snapshots
   */
  count(): Promise<number>;
}
