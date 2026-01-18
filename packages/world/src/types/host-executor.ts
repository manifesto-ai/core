/**
 * Host Executor Interface - World Protocol v2.0.2
 *
 * Per ADR-001 Layer Separation:
 * - World MUST NOT depend on Host package
 * - World defines HostExecutor interface (hexagonal port)
 * - App implements HostExecutor adapter
 *
 * This decouples World's governance from Host's execution mechanics.
 *
 * @since v2.0.2
 */

import { z } from "zod";
import type { Snapshot, ErrorValue, Intent } from "@manifesto-ai/core";

// =============================================================================
// Branded Types
// =============================================================================

/**
 * Branded type for execution key
 *
 * ExecutionKey uniquely identifies an execution attempt within a proposal.
 * Format: `${proposalId}:${attempt}` where attempt starts at 1
 *
 * Per WORLD-EXK-2: Proposal MUST carry executionKey at submission
 */
export const ExecutionKeySchema = z.string().brand<"ExecutionKey">();
export type ExecutionKey = z.infer<typeof ExecutionKeySchema>;

/**
 * Create an ExecutionKey from proposalId and attempt number
 */
export function createExecutionKey(
  proposalId: string,
  attempt: number = 1
): ExecutionKey {
  return ExecutionKeySchema.parse(`${proposalId}:${attempt}`);
}

// =============================================================================
// Artifact Reference (for traceability)
// =============================================================================

/**
 * Reference to an external artifact (trace, log, etc.)
 */
export interface ArtifactRef {
  readonly kind: "trace" | "log" | "snapshot";
  readonly uri: string;
  readonly hash?: string;
}

// =============================================================================
// Host Execution Options
// =============================================================================

/**
 * Options passed to HostExecutor.execute()
 *
 * These are World-defined options, NOT Host-specific options.
 */
export interface HostExecutionOptions {
  /**
   * Approved scope from Authority decision
   * Executor SHOULD respect this scope
   */
  readonly approvedScope?: unknown;

  /**
   * Maximum execution time in milliseconds
   * If undefined, no timeout
   */
  readonly timeoutMs?: number;

  /**
   * Signal for cancellation
   */
  readonly signal?: AbortSignal;
}

// =============================================================================
// Host Execution Result
// =============================================================================

/**
 * Result of Host execution
 *
 * Per OUTCOME-*:
 * - outcome is ADVISORY (World derives its own from snapshot)
 * - terminalSnapshot is the final snapshot after execution
 * - traceRef is optional reference to execution trace
 * - error is present only if outcome is 'failed'
 */
export interface HostExecutionResult {
  /**
   * Advisory outcome from Host
   *
   * World MUST derive its own outcome from terminalSnapshot per OUTCOME-*.
   * Host's outcome is informational only.
   */
  readonly outcome: "completed" | "failed";

  /**
   * Terminal snapshot after execution
   *
   * This is the source of truth for World's outcome derivation.
   */
  readonly terminalSnapshot: Snapshot;

  /**
   * Optional reference to execution trace
   */
  readonly traceRef?: ArtifactRef;

  /**
   * Error information if outcome is 'failed'
   *
   * Note: Even if outcome is 'completed', errors may exist in
   * terminalSnapshot.system.errors (handled errors)
   */
  readonly error?: ErrorValue;
}

// =============================================================================
// Host Executor Interface
// =============================================================================

/**
 * HostExecutor - Hexagonal port for execution
 *
 * World defines this interface; App implements it by adapting to actual Host.
 *
 * This decoupling ensures:
 * - World doesn't import @manifesto-ai/host
 * - World can be tested with mock executors
 * - App controls how World connects to Host
 *
 * @example
 * ```typescript
 * // App implements adapter:
 * function createAppHostExecutor(host: ManifestoHost): HostExecutor {
 *   return {
 *     async execute(key, baseSnapshot, intent, opts) {
 *       const result = await host.dispatch(intent, {
 *         snapshot: baseSnapshot,
 *         approvedScope: opts?.approvedScope,
 *       });
 *       return {
 *         outcome: result.status === 'complete' ? 'completed' : 'failed',
 *         terminalSnapshot: result.snapshot,
 *       };
 *     }
 *   };
 * }
 * ```
 */
export interface HostExecutor {
  /**
   * Execute an intent and return the result
   *
   * @param key - Unique execution key for this attempt
   * @param baseSnapshot - Starting snapshot for execution
   * @param intent - The intent to execute
   * @param opts - Optional execution options
   * @returns Execution result with terminal snapshot
   *
   * @remarks
   * - MUST NOT throw for business logic errors (return failed outcome)
   * - MAY throw for infrastructure errors (network, timeout, etc.)
   * - MUST return terminalSnapshot even for failed outcomes
   */
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult>;
}

// =============================================================================
// Execution Key Policy
// =============================================================================

/**
 * Policy for generating execution keys
 *
 * Default: `${proposalId}:1` (single attempt)
 * Custom: Apps may implement retry policies
 */
export type ExecutionKeyPolicy = (
  proposalId: string,
  attempt: number
) => ExecutionKey;

/**
 * Default execution key policy
 */
export const defaultExecutionKeyPolicy: ExecutionKeyPolicy = (
  proposalId,
  attempt
) => createExecutionKey(proposalId, attempt);
