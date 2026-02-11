/**
 * WorldStore Interface
 *
 * Persistence abstraction for Worlds.
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
} from "@manifesto-ai/shared";
import type { World, WorldId } from "@manifesto-ai/world";

// Re-export types
export type { WorldStore, WorldDelta, CompactOptions, CompactResult };
export type { World, WorldId };
export type { Snapshot };

/**
 * World storage entry.
 */
export type WorldEntry = {
  readonly world: World;
  readonly delta: WorldDelta;
  readonly snapshot?: Snapshot;
};

/**
 * Options for creating a WorldStore.
 */
export type WorldStoreOptions = {
  /**
   * Keep full snapshots for recent Worlds.
   * Older Worlds use delta reconstruction.
   *
   * @default 100
   */
  readonly activeHorizon?: number;

  /**
   * Genesis snapshot to initialize with.
   */
  readonly genesisSnapshot?: Snapshot;

  /**
   * Genesis world to initialize with.
   */
  readonly genesisWorld?: World;
};

/**
 * Host context type for restore operations.
 *
 * @see FDR-APP-INTEGRATION-001 §3.5.1
 */
export type RestoreHostContext = {
  readonly now: number;
  readonly randomSeed: string;
  readonly env: Record<string, unknown>;
};

/**
 * Fixed deterministic context for WorldStore restoration.
 *
 * When applying deltas to reconstruct a Snapshot, WorldStore MUST use
 * this fixed context to ensure "same WorldId → same Snapshot" guarantee.
 *
 * RESTORE-CTX-1: Restore MUST use fixed deterministic HostContext.
 *
 * @see FDR-APP-INTEGRATION-001 §3.5.1
 */
export const RESTORE_CONTEXT: RestoreHostContext = Object.freeze({
  now: 0,
  randomSeed: "worldstore",
  env: {},
});
