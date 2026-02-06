/**
 * Branch Manager
 *
 * Manages multiple branches and their state.
 *
 * @see SPEC §9 Branch Management
 * @see SPEC v2.0.0 §12 Schema Compatibility
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type {
  AppState,
  ForkOptions,
} from "../../core/types/index.js";

import { BranchNotFoundError } from "../../errors/index.js";

import {
  BranchImpl,
  BranchCallbacks,
  generateBranchId,
  generateWorldId,
} from "./branch.js";

import {
  validateSchemaCompatibility,
  SchemaIncompatibleError,
} from "./schema-compatibility.js";

/**
 * Branch Manager configuration.
 */
export interface BranchManagerConfig {
  schemaHash: string;
  initialState: AppState<unknown>;
  callbacks: Omit<BranchCallbacks, "createBranch" | "getSchemaHash">;

  /**
   * v2.0.0: Callback to get registered effect types for schema compatibility check.
   *
   * When provided, fork() will validate that the new schema's effect types
   * are compatible with the registered handlers.
   *
   * @see SPEC v2.0.0 §12.4 FORK-2, FORK-3
   */
  getRegisteredEffectTypes?: () => readonly string[];
}

/**
 * Manages branches and their states.
 *
 * @internal
 */
export class BranchManager {
  private _branches: Map<string, BranchImpl> = new Map();
  private _branchStates: Map<string, AppState<unknown>> = new Map();
  private _currentBranchId: string | null = null;
  private _schemaHash: string;
  private _callbacks: Omit<BranchCallbacks, "createBranch" | "getSchemaHash">;
  private _getRegisteredEffectTypes?: () => readonly string[];

  constructor(config: BranchManagerConfig) {
    this._schemaHash = config.schemaHash;
    this._callbacks = config.callbacks;
    this._getRegisteredEffectTypes = config.getRegisteredEffectTypes;

    // Create main branch
    const mainBranchId = "main";
    const genesisWorldId = generateWorldId();

    const mainBranch = new BranchImpl(
      mainBranchId,
      this._schemaHash,
      genesisWorldId,
      this._createBranchCallbacks(),
      "main"
    );

    this._branches.set(mainBranchId, mainBranch);
    this._branchStates.set(mainBranchId, config.initialState);
    this._currentBranchId = mainBranchId;
  }

  /**
   * Get the current active branch.
   */
  currentBranch(): BranchImpl {
    if (!this._currentBranchId) {
      throw new Error("No active branch");
    }
    return this._branches.get(this._currentBranchId)!;
  }

  /**
   * List all branches.
   */
  listBranches(): readonly BranchImpl[] {
    return Array.from(this._branches.values());
  }

  /**
   * Switch to a different branch.
   */
  switchBranch(branchId: string): BranchImpl {
    const branch = this._branches.get(branchId);
    if (!branch) {
      throw new BranchNotFoundError(branchId);
    }
    this._currentBranchId = branchId;
    return branch;
  }

  /**
   * Get a branch by ID.
   */
  getBranch(branchId: string): BranchImpl | undefined {
    return this._branches.get(branchId);
  }

  /**
   * Fork a branch to create a new one.
   *
   * @see SPEC §9.5 FORK-1~4
   * @see SPEC v2.0.0 §12.4 FORK-2, FORK-3
   */
  async fork(parentBranchId: string, opts?: ForkOptions): Promise<BranchImpl> {
    const parentBranch = this._branches.get(parentBranchId);
    if (!parentBranch) {
      throw new BranchNotFoundError(parentBranchId);
    }

    const parentSchemaHash = parentBranch.schemaHash;
    let branchSchemaHash = parentSchemaHash;

    // FORK-1: Schema-changing fork
    if (opts?.domain) {
      // If new domain is provided, need migration
      const newSchemaHash =
        typeof opts.domain === "string"
          ? "pending-compile" // MEL text needs compilation
          : opts.domain.hash;

      branchSchemaHash = newSchemaHash;

      // FORK-2: Verify effect handler compatibility before creating branch (v2.0.0)
      // FORK-3: Missing effect handler MUST cause fork to fail without World creation
      if (typeof opts.domain !== "string" && this._getRegisteredEffectTypes) {
        const registeredEffects = this._getRegisteredEffectTypes();
        const result = validateSchemaCompatibility(opts.domain, registeredEffects);

        if (!result.compatible) {
          throw new SchemaIncompatibleError(result.missingEffects!);
        }
      }
    }

    // Create new branch
    const newBranchId = generateBranchId();
    const forkWorldId = opts?.from ?? parentBranch.head();

    const newBranch = new BranchImpl(
      newBranchId,
      branchSchemaHash,
      forkWorldId,
      this._createBranchCallbacks(),
      opts?.name
    );

    // FORK-3: Copy state from parent
    const parentState = this._branchStates.get(parentBranchId);
    if (parentState) {
      this._branchStates.set(newBranchId, { ...parentState });
    }

    this._branches.set(newBranchId, newBranch);

    // FORK-4: Switch to new branch if requested (default: true)
    if (opts?.switchTo !== false) {
      this._currentBranchId = newBranchId;
    }

    return newBranch;
  }

  /**
   * Get state for a specific branch.
   */
  getStateForBranch(branchId: string): AppState<unknown> {
    const state = this._branchStates.get(branchId);
    if (!state) {
      throw new BranchNotFoundError(branchId);
    }
    return state;
  }

  /**
   * Update state for a specific branch.
   */
  updateBranchState(branchId: string, state: AppState<unknown>): void {
    if (!this._branches.has(branchId)) {
      throw new BranchNotFoundError(branchId);
    }
    this._branchStates.set(branchId, state);
  }

  /**
   * Append a world to a branch's lineage.
   */
  appendWorldToBranch(branchId: string, worldId: string): void {
    const branch = this._branches.get(branchId);
    if (!branch) {
      throw new BranchNotFoundError(branchId);
    }
    branch._appendWorld(worldId);
  }

  /**
   * Get current branch ID.
   */
  get currentBranchId(): string | null {
    return this._currentBranchId;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private _createBranchCallbacks(): BranchCallbacks {
    return {
      executeAction: this._callbacks.executeAction,
      getStateForBranch: (branchId: string) => this.getStateForBranch(branchId),
      createBranch: (parentBranchId: string, opts?: ForkOptions) =>
        this.fork(parentBranchId, opts),
      getSchemaHash: () => this.currentBranch().schemaHash,
    };
  }
}
