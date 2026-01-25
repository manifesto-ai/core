/**
 * World Protocol Event Types (Governance Events Only)
 *
 * Per World SPEC v2.0.2 (WORLD-EVT-OWN-*):
 * - World defines governance event payloads
 * - Telemetry events remain App-owned
 *
 * Per ADR-001 Layer Separation:
 * - World emits results; App owns event/listener mechanics
 */

import type { ErrorValue } from "@manifesto-ai/core";
import type {
  DecisionId,
  ProposalId,
  World,
  WorldId,
} from "../schema/index.js";
import type { ExecutionKey } from "../types/index.js";

// =============================================================================
// Event Type Union
// =============================================================================

/**
 * World event types - Governance events only
 *
 * Per WORLD-EVT-OWN-*:
 * - Proposal lifecycle (governance)
 * - Execution terminal events (outcome, not details)
 * - World lifecycle (state transitions)
 *
 * Removed per ADR-001:
 * - execution:started (telemetry - Host concern)
 * - execution:computing (telemetry - Host concern)
 * - execution:patches (telemetry - Host concern)
 * - execution:effect (telemetry - Host concern)
 * - execution:effect_result (telemetry - Host concern)
 * - snapshot:changed (telemetry - Host concern)
 */
export type WorldEventType =
  // Proposal lifecycle
  | "proposal:submitted"
  | "proposal:evaluating"
  | "proposal:decided"
  | "proposal:superseded" // NEW: Epoch cancellation
  // Execution terminal events (outcomes only)
  | "execution:completed"
  | "execution:failed"
  // World lifecycle
  | "world:created"
  | "world:forked";

// =============================================================================
// Base Event Interface
// =============================================================================

interface BaseWorldEvent<T extends WorldEventType> {
  readonly type: T;
  readonly timestamp: number;
}

// =============================================================================
// Error Info
// =============================================================================

export interface ErrorInfo {
  readonly summary: string;
  readonly details?: ErrorValue[];
  readonly pendingRequirements?: string[];
}

// =============================================================================
// Authority Decision (event payload)
// =============================================================================

export type AuthorityDecision = "approved" | "rejected";

// =============================================================================
// Proposal Lifecycle Events
// =============================================================================

/**
 * Emitted when a proposal is submitted to the world.
 * This is the entry point for all state changes.
 */
export interface ProposalSubmittedEvent
  extends BaseWorldEvent<"proposal:submitted"> {
  readonly proposalId: ProposalId;
  readonly actorId: string;
  readonly baseWorld: WorldId;
  readonly intent: {
    readonly type: string;
    readonly intentId: string;
    readonly input?: unknown;
  };
  readonly executionKey: ExecutionKey;
  readonly epoch: number;
}

/**
 * Emitted when authority begins evaluating a proposal.
 * May not be emitted if authority decides synchronously.
 */
export interface ProposalEvaluatingEvent
  extends BaseWorldEvent<"proposal:evaluating"> {
  readonly proposalId: ProposalId;
  readonly authorityId: string;
}

/**
 * Emitted when authority makes a decision.
 * This is a terminal event for the proposal's authority phase.
 */
export interface ProposalDecidedEvent
  extends BaseWorldEvent<"proposal:decided"> {
  readonly proposalId: ProposalId;
  readonly decisionId: DecisionId;
  readonly decision: AuthorityDecision;
  readonly authorityId: string;
  readonly reason?: string;
}

/**
 * Emitted when a proposal is superseded due to epoch change
 *
 * Per EPOCH-3~5:
 * - Emitted when branch switch invalidates ingress-stage proposals
 * - Only proposals in submitted/evaluating status can be superseded
 */
export interface ProposalSupersededEvent
  extends BaseWorldEvent<"proposal:superseded"> {
  readonly proposalId: ProposalId;
  readonly currentEpoch: number;
  readonly proposalEpoch: number;
  readonly reason: "branch_switch" | "manual_cancel";
}

// =============================================================================
// Execution Terminal Events
// =============================================================================

/**
 * Emitted when execution completes successfully.
 *
 * Note: This is an outcome event, not telemetry.
 * For execution details, subscribe to Host's TraceEvent.
 */
export interface ExecutionCompletedEvent
  extends BaseWorldEvent<"execution:completed"> {
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly resultWorld: WorldId;
}

/**
 * Emitted when execution fails.
 *
 * Note: This is an outcome event, not telemetry.
 * For execution details, subscribe to Host's TraceEvent.
 */
export interface ExecutionFailedEvent
  extends BaseWorldEvent<"execution:failed"> {
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly error: ErrorInfo;
  readonly resultWorld: WorldId;
}

// =============================================================================
// World Lifecycle Events
// =============================================================================

/**
 * Emitted when a new world is created.
 */
export interface WorldCreatedEvent extends BaseWorldEvent<"world:created"> {
  readonly world: World;
  readonly from: WorldId | null;
  readonly proposalId: ProposalId | null;
  readonly outcome: "completed" | "failed";
}

/**
 * Emitted when a world is forked (branching).
 */
export interface WorldForkedEvent extends BaseWorldEvent<"world:forked"> {
  readonly parentWorldId: WorldId;
  readonly childWorldId: WorldId;
  readonly proposalId: ProposalId;
}

// =============================================================================
// Union Type
// =============================================================================

export type WorldEvent =
  | ProposalSubmittedEvent
  | ProposalEvaluatingEvent
  | ProposalDecidedEvent
  | ProposalSupersededEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | WorldCreatedEvent
  | WorldForkedEvent;

// =============================================================================
// World Event Sink (App-owned event/listener layer)
// =============================================================================

export interface WorldEventSink {
  emit(event: WorldEvent): void;
}

export function createNoopWorldEventSink(): WorldEventSink {
  return {
    emit(): void {
      // no-op
    },
  };
}
