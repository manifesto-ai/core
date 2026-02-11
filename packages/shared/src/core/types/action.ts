/**
 * Manifesto App — Action Lifecycle Types
 *
 * @see SPEC v2.0.0 §5.4, §5.10, §8, §16
 * @see ADR-004 Phase 1
 * @module
 */

import type { Snapshot } from "@manifesto-ai/core";
import type { World } from "@manifesto-ai/world";
import type { RuntimeKind, WorldOutcome, Unsubscribe } from "./identifiers.js";
import type { ErrorValue } from "./state.js";
import type { AuthorityDecision } from "./authority.js";

// =============================================================================
// v2.0.0 Schema Compatibility
// =============================================================================

/**
 * Schema compatibility validation result.
 *
 * @see SPEC v2.0.0 §12.4
 */
export type SchemaCompatibilityResult =
  | { readonly compatible: true }
  | { readonly compatible: false; readonly missingEffects: readonly string[] };

// =============================================================================
// v2.0.0 ActionResult (extended)
// =============================================================================

/**
 * v2.0.0 Action Result (extended).
 *
 * @see SPEC v2.0.0 §5.10
 */
export type ActionResultV2 =
  | { readonly status: "completed"; readonly world: World; readonly snapshot: Snapshot }
  | { readonly status: "failed"; readonly world: World; readonly error: ErrorValue }
  | { readonly status: "rejected"; readonly reason: string; readonly decision: AuthorityDecision }
  | { readonly status: "preparation_failed"; readonly reason: string; readonly error?: ErrorValue };

// =============================================================================
// Action Phase & Results
// =============================================================================

/**
 * Action lifecycle phase.
 *
 * @see SPEC §8.2
 */
export type ActionPhase =
  | "preparing" // Pre-submission async work (recall, trace composition)
  | "preparation_failed" // Preparation failed (recall error, validation error, etc.)
  | "submitted" // Proposal submitted to World Protocol
  | "evaluating" // Authority evaluation (optional)
  | "pending" // HITL approval required
  | "approved" // Approved, awaiting execution
  | "executing" // Host executing effects
  | "completed" // Success, World created
  | "rejected" // Authority rejected (NO World created)
  | "failed"; // Execution failed (World created with error state)

/**
 * Common execution statistics.
 *
 * @see SPEC §8.3
 */
export interface ExecutionStats {
  durationMs: number;
  effectCount: number;
  patchCount: number;
}

/**
 * Successful action completion result.
 *
 * @see SPEC §8.3
 */
export interface CompletedActionResult {
  readonly status: "completed";
  readonly worldId: string;
  readonly proposalId: string;
  readonly decisionId: string;
  readonly stats: ExecutionStats;
  readonly runtime: RuntimeKind;
}

/**
 * Action rejected by Authority.
 *
 * @see SPEC §8.3
 */
export interface RejectedActionResult {
  readonly status: "rejected";
  readonly proposalId: string;
  readonly decisionId: string;
  readonly reason?: string;
  readonly runtime: RuntimeKind;
  // Note: No worldId - rejected actions do not create Worlds
}

/**
 * Action execution failed.
 *
 * @see SPEC §8.3
 */
export interface FailedActionResult {
  readonly status: "failed";
  readonly proposalId: string;
  readonly decisionId: string;
  readonly error: ErrorValue;
  readonly worldId: string; // World created with error state
  readonly runtime: RuntimeKind;
}

/**
 * Action preparation failed before submission.
 *
 * @see SPEC §8.3
 */
export interface PreparationFailedActionResult {
  readonly status: "preparation_failed";
  readonly proposalId: string;
  readonly error: ErrorValue;
  readonly runtime: RuntimeKind;
}

/**
 * Union of all action result types.
 *
 * @see SPEC §8.3
 */
export type ActionResult =
  | CompletedActionResult
  | RejectedActionResult
  | FailedActionResult
  | PreparationFailedActionResult;

/**
 * Phase change notification.
 *
 * @see SPEC Appendix A.3
 */
export interface ActionUpdate {
  readonly phase: ActionPhase;
  readonly previousPhase: ActionPhase;
  readonly detail?: ActionUpdateDetail;
  readonly timestamp: number;
}

/**
 * Phase-specific details.
 *
 * @see SPEC Appendix A.3
 */
export type ActionUpdateDetail =
  | { kind: "pending"; approvers: readonly string[] }
  | { kind: "rejected"; reason?: string }
  | { kind: "failed"; error: ErrorValue }
  | { kind: "completed"; worldId: string }
  | { kind: "preparation_failed"; error: ErrorValue };

// =============================================================================
// Done Options
// =============================================================================

/**
 * Done/result wait options.
 *
 * @see SPEC §8.1
 */
export interface DoneOptions {
  /** Maximum wait time in ms. @default Infinity */
  timeoutMs?: number;
}

// =============================================================================
// ActionHandle Interface
// =============================================================================

/**
 * ActionHandle interface.
 *
 * @see SPEC §8.1
 */
export interface ActionHandle {
  /**
   * Proposal ID.
   *
   * This ID is stable throughout the action lifecycle, including the `preparing` phase.
   * It can be used for reattachment via `app.getActionHandle(proposalId)` at any point.
   */
  readonly proposalId: string;

  /** Current phase snapshot */
  readonly phase: ActionPhase;

  /**
   * Target runtime.
   * 'domain' for user actions, 'system' for System Actions.
   */
  readonly runtime: RuntimeKind;

  /**
   * Wait for successful completion.
   * @throws ActionRejectedError - Authority rejected
   * @throws ActionFailedError - Execution failed
   * @throws ActionPreparationError - Preparation failed
   * @throws ActionTimeoutError - Timeout exceeded
   */
  done(opts?: DoneOptions): Promise<CompletedActionResult>;

  /**
   * Wait for any result (no throw except timeout).
   * @throws ActionTimeoutError - Timeout exceeded
   */
  result(opts?: DoneOptions): Promise<ActionResult>;

  /** Subscribe to phase changes */
  subscribe(listener: (update: ActionUpdate) => void): Unsubscribe;

  /**
   * Detach from this handle.
   * The proposal continues in World Protocol.
   */
  detach(): void;
}
