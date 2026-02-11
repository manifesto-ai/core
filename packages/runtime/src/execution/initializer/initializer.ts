/**
 * Host Initializer Module
 *
 * Initializes v2.0.0/v2.2.0 components: HostExecutor, effect handlers, and genesis World.
 *
 * v2.2.0: Effects may be pre-registered via createInternalHost (skipEffectRegistration=true).
 *
 * @see SPEC v2.2.0 §8-10
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import { createWorldId } from "@manifesto-ai/world";
import type {
  AppState,
  AppConfig,
  Host,
  PolicyService,
  World,
  WorldDelta,
  WorldStore,
} from "@manifesto-ai/shared";
import type { BranchManager } from "../../storage/branch/index.js";
import type { WorldHeadTracker } from "../../storage/world/index.js";
import { AppHostExecutor, createAppHostExecutor } from "../host-executor/index.js";
import { generateWorldId } from "../../storage/branch/index.js";
import {
  appStateToSnapshot,
  computeSnapshotHash,
} from "../state-converter.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Host Initializer dependencies.
 */
export interface HostInitializerDependencies {
  host: Host;
  worldStore: WorldStore;
  policyService: PolicyService;
  domainSchema: DomainSchema | null;
  options: AppConfig;
  worldHeadTracker: WorldHeadTracker;
  branchManager: BranchManager | null;
  currentState: AppState<unknown>;
}

/**
 * Host Initialized components.
 */
export interface HostInitializedComponents {
  hostExecutor: AppHostExecutor;
}

/**
 * Host Initializer interface.
 */
export interface HostInitializer {
  /**
   * Initialize v2 components.
   *
   * Sets up HostExecutor, registers effect handlers, and initializes genesis World.
   */
  initialize(): HostInitializedComponents;

  /**
   * Initialize genesis World in WorldStore.
   */
  initializeGenesisWorld(): Promise<void>;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Host Initializer implementation.
 */
export class HostInitializerImpl implements HostInitializer {
  private _deps: HostInitializerDependencies;
  private _hostExecutor: AppHostExecutor | null = null;

  constructor(deps: HostInitializerDependencies) {
    this._deps = deps;
  }

  initialize(): HostInitializedComponents {
    const {
      host,
      options,
    } = this._deps;

    // 1. Create AppHostExecutor wrapping injected Host
    this._hostExecutor = createAppHostExecutor(host, {
      defaultTimeoutMs: options.scheduler?.defaultTimeoutMs,
      traceEnabled: options.devtools?.enabled,
    });

    return {
      hostExecutor: this._hostExecutor,
    };
  }

  async initializeGenesisWorld(): Promise<void> {
    const { worldStore, worldHeadTracker, branchManager, domainSchema, currentState } = this._deps;

    if (!worldStore || !currentState) {
      return;
    }

    const genesisIdStr = branchManager?.currentBranch()?.head() ?? generateWorldId();
    const genesisWorldId = createWorldId(genesisIdStr);

    // Initialize world head tracker
    worldHeadTracker.initialize(genesisWorldId);

    // Convert AppState to Snapshot format
    const genesisSnapshot = appStateToSnapshot(currentState);

    // Compute snapshot hash
    const snapshotHash = computeSnapshotHash(genesisSnapshot);

    // Create genesis World object
    const genesisWorld: World = {
      worldId: genesisWorldId,
      schemaHash: domainSchema?.hash ?? "unknown",
      snapshotHash,
      createdAt: Date.now(),
      createdBy: null, // Genesis has no proposalId
    };

    // Genesis delta points to itself with empty patches
    const genesisDelta: WorldDelta = {
      fromWorld: genesisWorldId,
      toWorld: genesisWorldId,
      patches: [],
      createdAt: Date.now(),
    };

    // Store genesis in WorldStore
    try {
      if (worldStore.initializeGenesis) {
        await worldStore.initializeGenesis(genesisWorld, genesisSnapshot);
      } else {
        await worldStore.store(genesisWorld, genesisDelta);
      }
    } catch (error) {
      // Genesis may already exist in WorldStore
      console.warn("[Manifesto] Genesis World already exists or store failed:", error);
    }
  }

}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new HostInitializer instance.
 *
 * @param deps - The initializer dependencies
 */
export function createHostInitializer(deps: HostInitializerDependencies): HostInitializer {
  return new HostInitializerImpl(deps);
}
