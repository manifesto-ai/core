import type { Snapshot } from "@manifesto-ai/core";
import type { SnapshotStore, SnapshotStoreWithHistory } from "./interface.js";

/**
 * Options for MemorySnapshotStore
 */
export interface MemorySnapshotStoreOptions {
  /**
   * Maximum number of snapshots to keep in history.
   * Older snapshots are automatically pruned.
   * Default: 100
   */
  maxHistory?: number;
}

/**
 * In-memory snapshot store
 *
 * Stores snapshots in memory with version history.
 * Useful for testing and development.
 */
export class MemorySnapshotStore implements SnapshotStoreWithHistory {
  private snapshots: Map<number, Snapshot> = new Map();
  private latestVersion: number = -1;
  private maxHistory: number;

  constructor(options: MemorySnapshotStoreOptions = {}) {
    this.maxHistory = options.maxHistory ?? 100;
  }

  async get(): Promise<Snapshot | null> {
    if (this.latestVersion < 0) {
      return null;
    }
    const snapshot = this.snapshots.get(this.latestVersion);
    if (!snapshot) {
      return null;
    }
    // Deep clone to ensure immutability
    return JSON.parse(JSON.stringify(snapshot)) as Snapshot;
  }

  async save(snapshot: Snapshot): Promise<void> {
    const version = snapshot.meta.version;

    // Validate version ordering
    if (version <= this.latestVersion) {
      throw new Error(
        `Cannot save snapshot with version ${version}. ` +
        `Latest version is ${this.latestVersion}. ` +
        `Versions must be strictly increasing.`
      );
    }

    // Deep clone to ensure immutability
    const cloned = JSON.parse(JSON.stringify(snapshot)) as Snapshot;
    this.snapshots.set(version, cloned);
    this.latestVersion = version;

    // Prune old snapshots if exceeding maxHistory
    if (this.snapshots.size > this.maxHistory) {
      const versions = Array.from(this.snapshots.keys()).sort((a, b) => a - b);
      const toRemove = versions.slice(0, versions.length - this.maxHistory);
      for (const v of toRemove) {
        this.snapshots.delete(v);
      }
    }
  }

  async getVersion(version: number): Promise<Snapshot | null> {
    const snapshot = this.snapshots.get(version);
    if (!snapshot) {
      return null;
    }
    // Deep clone to ensure immutability
    return JSON.parse(JSON.stringify(snapshot)) as Snapshot;
  }

  async getLatestVersion(): Promise<number> {
    return this.latestVersion;
  }

  async clear(): Promise<void> {
    this.snapshots.clear();
    this.latestVersion = -1;
  }

  async getVersionRange(start: number, end: number): Promise<Snapshot[]> {
    const result: Snapshot[] = [];

    for (let v = start; v <= end; v++) {
      const snapshot = this.snapshots.get(v);
      if (snapshot) {
        // Deep clone to ensure immutability
        result.push(JSON.parse(JSON.stringify(snapshot)) as Snapshot);
      }
    }

    return result;
  }

  async count(): Promise<number> {
    return this.snapshots.size;
  }
}

/**
 * Create a new memory snapshot store
 *
 * @param options - Store options (maxHistory defaults to 100)
 */
export function createMemoryStore(options?: MemorySnapshotStoreOptions): MemorySnapshotStore {
  return new MemorySnapshotStore(options);
}
