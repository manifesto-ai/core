/**
 * Branch Implementation
 *
 * @see SPEC §9 Branch Management
 * @module
 */

import type { DomainSchema } from "@manifesto-ai/core";
import type {
  ActionHandle,
  ActOptions,
  AppState,
  Branch,
  ForkOptions,
  LineageOptions,
} from "@manifesto-ai/shared";

import {
  BranchNotFoundError,
  WorldNotFoundError,
  WorldNotInLineageError,
  SystemActionRoutingError,
  RESERVED_NAMESPACE_PREFIX,
} from "@manifesto-ai/shared";

/**
 * Callback interface for Branch to communicate with App.
 */
export interface BranchCallbacks {
  /** Execute an action */
  executeAction: (
    branchId: string,
    type: string,
    input: unknown,
    opts?: ActOptions
  ) => ActionHandle;

  /** Get current state for a branch */
  getStateForBranch: (branchId: string) => AppState<unknown>;

  /** Create a new branch (fork) */
  createBranch: (
    parentBranchId: string,
    opts?: ForkOptions
  ) => Promise<BranchImpl>;

  /** Get schema hash */
  getSchemaHash: () => string;
}

/**
 * Internal Branch implementation.
 *
 * @see SPEC §9.1
 */
export class BranchImpl implements Branch {
  private _headWorldId: string;
  private _lineage: string[] = [];
  private _callbacks: BranchCallbacks;

  constructor(
    public readonly id: string,
    public readonly schemaHash: string,
    initialWorldId: string,
    callbacks: BranchCallbacks,
    public readonly name?: string
  ) {
    this._headWorldId = initialWorldId;
    this._lineage = [initialWorldId];
    this._callbacks = callbacks;
  }

  /**
   * Get the current head worldId.
   *
   * @see SPEC §9.2
   */
  head(): string {
    return this._headWorldId;
  }

  /**
   * Checkout to a specific worldId in lineage.
   *
   * @see SPEC §9.3 CHECKOUT-1~3
   */
  async checkout(worldId: string): Promise<void> {
    // CHECKOUT-1: Validate worldId is in lineage
    if (!this._lineage.includes(worldId)) {
      throw new WorldNotInLineageError(worldId, this.id);
    }

    // CHECKOUT-2: Update head
    this._headWorldId = worldId;

    // CHECKOUT-3: Truncate lineage to the checked-out world
    const index = this._lineage.indexOf(worldId);
    this._lineage = this._lineage.slice(0, index + 1);
  }

  /**
   * Execute an action on this branch.
   *
   * @throws SystemActionRoutingError if type is a system.* action
   *
   * @see SPEC §9.4
   * @see SPEC §17.8 SYS-INV-2
   */
  act(type: string, input?: unknown, opts?: ActOptions): ActionHandle {
    // SYS-INV-2: branch.act() MUST reject system.* actions
    if (type.startsWith(RESERVED_NAMESPACE_PREFIX)) {
      throw new SystemActionRoutingError(type, "branch");
    }

    return this._callbacks.executeAction(this.id, type, input, {
      ...opts,
      branchId: this.id,
    });
  }

  /**
   * Fork this branch to create a new branch.
   *
   * @see SPEC §9.5 FORK-1~4
   */
  async fork(opts?: ForkOptions): Promise<Branch> {
    return this._callbacks.createBranch(this.id, opts);
  }

  /**
   * Get current state for this branch.
   *
   * @see SPEC §9.6
   */
  getState<T = unknown>(): AppState<T> {
    return this._callbacks.getStateForBranch(this.id) as AppState<T>;
  }

  /**
   * Get lineage (world history) for this branch.
   *
   * @see SPEC §9.7
   */
  lineage(opts?: LineageOptions): readonly string[] {
    let result = [...this._lineage];

    // Apply untilWorldId filter
    if (opts?.untilWorldId) {
      const index = result.indexOf(opts.untilWorldId);
      if (index !== -1) {
        result = result.slice(index);
      }
    }

    // Apply limit
    if (opts?.limit !== undefined && opts.limit > 0) {
      result = result.slice(-opts.limit);
    }

    return result;
  }

  // ===========================================================================
  // Deserialization (SPEC v2.0.5)
  // ===========================================================================

  /**
   * Create a BranchImpl from a persisted entry.
   *
   * @see World SPEC v2.0.5 BRANCH-PERSIST
   */
  static fromPersistedEntry(
    entry: import("@manifesto-ai/shared").PersistedBranchEntry,
    callbacks: BranchCallbacks
  ): BranchImpl {
    const branch = new BranchImpl(
      entry.id,
      entry.schemaHash,
      entry.head,
      callbacks,
      entry.name
    );
    // Restore full lineage from persisted data
    branch._lineage = [...entry.lineage];
    // Ensure head is the last lineage entry
    if (branch._lineage.length === 0 || branch._lineage[branch._lineage.length - 1] !== entry.head) {
      branch._lineage.push(entry.head);
    }
    return branch;
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  /**
   * Append a new worldId to lineage.
   * Called after successful action execution.
   * @internal
   */
  _appendWorld(worldId: string): void {
    this._lineage.push(worldId);
    this._headWorldId = worldId;
  }

  /**
   * Get full lineage for internal use.
   * @internal
   */
  _getFullLineage(): readonly string[] {
    return this._lineage;
  }
}

/**
 * Generate a unique branch ID.
 */
export function generateBranchId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `branch_${timestamp}_${random}`;
}

/**
 * Generate a unique world ID.
 */
export function generateWorldId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `world_${timestamp}_${random}`;
}
