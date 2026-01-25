/**
 * Liveness Guard Module
 *
 * Prevents infinite re-entry loops during action execution.
 *
 * @see FDR-APP-PUB-001 §3 (PUB-LIVENESS-2~3)
 * @module
 */

import { LivenessError } from "../errors/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Runtime kind indicator.
 */
export type RuntimeKind = "domain" | "system";

/**
 * Liveness Guard interface.
 *
 * Prevents infinite loops from enqueueAction during hooks.
 */
export interface LivenessGuard {
  /**
   * Enter execution for a proposal.
   *
   * @see PUB-LIVENESS-2
   * @param proposalId - The proposal ID being executed
   */
  enterExecution(proposalId: string): void;

  /**
   * Exit execution for the current proposal.
   *
   * @see PUB-LIVENESS-2
   */
  exitExecution(): void;

  /**
   * Check re-injection for liveness guard.
   * Throws LivenessError if limit exceeded.
   *
   * @see PUB-LIVENESS-2~3
   * @param runtime - The runtime kind of the new action
   * @throws LivenessError if re-injection limit exceeded
   */
  checkReinjection(runtime: RuntimeKind): void;

  /**
   * Get current executing proposal ID.
   */
  getCurrentProposalId(): string | null;

  /**
   * Cleanup state for a completed proposal.
   *
   * @param proposalId - The proposal ID to cleanup
   */
  cleanup(proposalId: string): void;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Liveness Guard implementation.
 *
 * Tracks re-injection counts per proposal and enforces limits.
 */
export class LivenessGuardImpl implements LivenessGuard {
  /**
   * Re-injection counter per proposal.
   *
   * @see PUB-LIVENESS-2
   */
  private _reinjectionCount: Map<string, number> = new Map();

  /**
   * Current executing proposal ID.
   * When set, any new action enqueued via act() counts as re-injection.
   *
   * @see PUB-LIVENESS-2
   */
  private _currentExecutingProposalId: string | null = null;

  /**
   * Maximum re-injection limit.
   *
   * @see PUB-LIVENESS-3
   */
  private _maxReinjectionLimit: number;

  constructor(maxReinjectionLimit: number = 100) {
    this._maxReinjectionLimit = maxReinjectionLimit;
  }

  enterExecution(proposalId: string): void {
    this._currentExecutingProposalId = proposalId;
  }

  exitExecution(): void {
    this._currentExecutingProposalId = null;
  }

  checkReinjection(runtime: RuntimeKind): void {
    // Only check for domain actions during domain execution
    if (!this._currentExecutingProposalId || runtime !== "domain") {
      return;
    }

    const currentProposalId = this._currentExecutingProposalId;
    const currentCount = this._reinjectionCount.get(currentProposalId) ?? 0;
    const newCount = currentCount + 1;
    this._reinjectionCount.set(currentProposalId, newCount);

    // PUB-LIVENESS-3: Abort if limit exceeded
    if (newCount > this._maxReinjectionLimit) {
      throw new LivenessError(
        currentProposalId,
        newCount,
        this._maxReinjectionLimit
      );
    }
  }

  getCurrentProposalId(): string | null {
    return this._currentExecutingProposalId;
  }

  cleanup(proposalId: string): void {
    this._reinjectionCount.delete(proposalId);
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new LivenessGuard instance.
 *
 * @param maxReinjectionLimit - Maximum re-injection limit (default: 100)
 */
export function createLivenessGuard(maxReinjectionLimit?: number): LivenessGuard {
  return new LivenessGuardImpl(maxReinjectionLimit);
}
