/**
 * Ingress Context - Epoch Management
 *
 * Per EPOCH-1~5:
 * - EPOCH-1: Proposals MUST carry epoch at submission
 * - EPOCH-2: Epoch increments on branch switch
 * - EPOCH-3: Ingress-stage proposals cancelled on epoch change
 * - EPOCH-4: Executing proposals continue (no rollback)
 * - EPOCH-5: superseded event for dropped proposals
 *
 * The IngressContext manages the epoch counter and provides
 * stale detection for proposals.
 *
 * @since v2.0.1
 */

// =============================================================================
// Ingress Context Interface
// =============================================================================

/**
 * IngressContext manages epoch for proposal lifecycle
 *
 * Epoch represents the "branch" context. When a branch switch occurs,
 * the epoch increments, invalidating all ingress-stage proposals.
 */
export interface IngressContext {
  /**
   * Current epoch value
   */
  readonly epoch: number;

  /**
   * Increment epoch (called on branch switch)
   */
  incrementEpoch(): void;

  /**
   * Check if a proposal epoch is stale (older than current)
   *
   * @param proposalEpoch - The epoch when the proposal was submitted
   * @returns true if the proposal is stale and should be dropped
   */
  isStale(proposalEpoch: number): boolean;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create an IngressContext
 *
 * @param initialEpoch - Optional initial epoch value (default: 0)
 */
export function createIngressContext(initialEpoch = 0): IngressContext {
  let currentEpoch = initialEpoch;

  return {
    get epoch(): number {
      return currentEpoch;
    },

    incrementEpoch(): void {
      currentEpoch += 1;
    },

    isStale(proposalEpoch: number): boolean {
      return proposalEpoch < currentEpoch;
    },
  };
}
