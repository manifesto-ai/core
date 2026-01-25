/**
 * Snapshot Hash Types - World Protocol v2.0.2
 *
 * Per WORLD-HASH-* rules:
 * - WORLD-HASH-1: Exclude $host namespace from data
 * - WORLD-HASH-2: Normalize terminalStatus to 'completed' | 'failed'
 * - WORLD-HASH-3: Error signatures exclude message and timestamp
 * - WORLD-HASH-4: Sort error signatures by their hash
 * - WORLD-HASH-5: Compute pendingDigest as JCS hash of pending requirement IDs
 *
 * @since v2.0.2
 */

// =============================================================================
// Error Signature
// =============================================================================

/**
 * Error signature for deterministic hashing
 *
 * Per WORLD-HASH-3:
 * - MUST include: code, source
 * - MUST NOT include: message (non-deterministic wording), timestamp (non-deterministic)
 * - MUST NOT include: context (may include non-deterministic values)
 */
export interface ErrorSignature {
  readonly code: string;
  readonly source: {
    readonly actionId: string;
    readonly nodePath: string;
  };
}

// =============================================================================
// Terminal Status
// =============================================================================

/**
 * Normalized terminal status for hashing
 *
 * Per WORLD-HASH-2:
 * - 'completed' for successful execution
 * - 'failed' for any error state
 */
export type TerminalStatusForHash = "completed" | "failed";

// =============================================================================
// Snapshot Hash Input
// =============================================================================

/**
 * Normalized input for snapshot hash computation
 *
 * This structure is what gets hashed to produce snapshotHash.
 */
export interface SnapshotHashInput {
  /**
   * Domain data excluding $host namespace
   */
  readonly data: Record<string, unknown>;

  /**
   * Normalized system state
   */
  readonly system: {
    /**
     * Normalized terminal status
     */
    readonly terminalStatus: TerminalStatusForHash;

    /**
     * Sorted error signatures (by hash)
     */
    readonly errors: ErrorSignature[];

    /**
     * Hash of pending requirement IDs
     */
    readonly pendingDigest: string;
  };
}

// =============================================================================
// World ID Input
// =============================================================================

/**
 * Input for WorldId computation
 *
 * Per WORLD-ID-*:
 * - WorldId = computeHash(JCS({ schemaHash, snapshotHash }))
 * - NOT string concatenation
 */
export interface WorldIdInput {
  readonly schemaHash: string;
  readonly snapshotHash: string;
}
