/**
 * Proposal Manager Module
 *
 * Manages ActionHandle lifecycle and publish boundary tracking.
 *
 * @see FDR-APP-PUB-001 §2 (PUB-TICK-2~3)
 * @module
 */

import type { ActionHandle, RuntimeKind } from "../../types/index.js";
import { ActionHandleImpl } from "../action/index.js";
import { ActionNotFoundError } from "../../errors/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Proposal Manager interface.
 *
 * Manages ActionHandle instances and tracks publish boundaries.
 */
export interface ProposalManager {
  /**
   * Create a new ActionHandle for a proposal.
   *
   * @param proposalId - The proposal ID
   * @param runtime - The runtime kind (domain or system)
   * @returns The created ActionHandle
   */
  createHandle(proposalId: string, runtime: RuntimeKind): ActionHandleImpl;

  /**
   * Get an existing ActionHandle by proposal ID.
   *
   * @param proposalId - The proposal ID
   * @throws ActionNotFoundError if proposalId is unknown
   */
  getHandle(proposalId: string): ActionHandle;

  /**
   * Check if a handle exists for a proposal.
   *
   * @param proposalId - The proposal ID
   */
  hasHandle(proposalId: string): boolean;

  /**
   * Mark a proposal as having emitted state:publish.
   *
   * @see PUB-TICK-2~3
   * @param proposalId - The proposal ID
   */
  markPublished(proposalId: string): void;

  /**
   * Check if a proposal has already emitted state:publish.
   *
   * @see PUB-TICK-2~3
   * @param proposalId - The proposal ID
   */
  wasPublished(proposalId: string): boolean;

  /**
   * Cleanup state for a completed proposal.
   *
   * @param proposalId - The proposal ID
   */
  cleanup(proposalId: string): void;

  /**
   * Generate a new proposal ID.
   */
  generateProposalId(): string;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Proposal Manager implementation.
 */
export class ProposalManagerImpl implements ProposalManager {
  /**
   * Action handles registry.
   */
  private _actionHandles: Map<string, ActionHandle> = new Map();

  /**
   * Proposal tick tracking for publish boundary.
   * Tracks which proposals have emitted state:publish to ensure exactly-once semantics.
   *
   * @see PUB-TICK-2~3
   */
  private _publishEmitted: Set<string> = new Set();

  createHandle(proposalId: string, runtime: RuntimeKind): ActionHandleImpl {
    const handle = new ActionHandleImpl(proposalId, runtime);
    this._actionHandles.set(proposalId, handle);
    return handle;
  }

  getHandle(proposalId: string): ActionHandle {
    const handle = this._actionHandles.get(proposalId);
    if (!handle) {
      throw new ActionNotFoundError(proposalId);
    }
    return handle;
  }

  hasHandle(proposalId: string): boolean {
    return this._actionHandles.has(proposalId);
  }

  markPublished(proposalId: string): void {
    this._publishEmitted.add(proposalId);
  }

  wasPublished(proposalId: string): boolean {
    return this._publishEmitted.has(proposalId);
  }

  cleanup(proposalId: string): void {
    this._publishEmitted.delete(proposalId);
  }

  generateProposalId(): string {
    return `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new ProposalManager instance.
 */
export function createProposalManager(): ProposalManager {
  return new ProposalManagerImpl();
}
