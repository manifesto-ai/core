/**
 * World Protocol Event System - Type Definitions
 *
 * Based on WORLD_EVENT_SPEC.md v1.1 Extension
 */

import type { Patch, Snapshot } from "@manifesto-ai/core";
import type {
  Proposal,
  ActorRef,
  DecisionRecord,
  World,
  WorldId,
} from "../schema/index.js";

// =============================================================================
// Event Type Union
// =============================================================================

export type WorldEventType =
  // Proposal lifecycle
  | "proposal:submitted"
  | "proposal:evaluating"
  | "proposal:decided"
  // Execution lifecycle
  | "execution:started"
  | "execution:computing"
  | "execution:patches"
  | "execution:effect"
  | "execution:effect_result"
  | "execution:completed"
  | "execution:failed"
  // State lifecycle
  | "snapshot:changed"
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
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

// =============================================================================
// Authority Decision (simplified for events)
// =============================================================================

export type AuthorityDecision = "approved" | "rejected" | "pending";

// =============================================================================
// Proposal Lifecycle Events
// =============================================================================

/**
 * Emitted when a proposal is submitted to the world.
 * This is the entry point for all state changes.
 */
export interface ProposalSubmittedEvent
  extends BaseWorldEvent<"proposal:submitted"> {
  readonly proposal: Proposal;
  readonly actor: ActorRef;
}

/**
 * Emitted when authority begins evaluating a proposal.
 * May not be emitted if authority decides synchronously.
 */
export interface ProposalEvaluatingEvent
  extends BaseWorldEvent<"proposal:evaluating"> {
  readonly proposalId: string;
  readonly authorityId: string;
}

/**
 * Emitted when authority makes a decision.
 * This is a terminal event for the proposal's authority phase.
 */
export interface ProposalDecidedEvent
  extends BaseWorldEvent<"proposal:decided"> {
  readonly proposalId: string;
  readonly authorityId: string;
  readonly decision: AuthorityDecision;
  readonly decisionRecord?: DecisionRecord;
}

// =============================================================================
// Execution Lifecycle Events
// =============================================================================

/**
 * Emitted when host begins executing an approved proposal.
 */
export interface ExecutionStartedEvent
  extends BaseWorldEvent<"execution:started"> {
  readonly proposalId: string;
  readonly intentId: string;
  readonly baseSnapshot: Snapshot;
}

/**
 * Emitted when core.compute() is called.
 * May be emitted multiple times per execution (for effect continuations).
 */
export interface ExecutionComputingEvent
  extends BaseWorldEvent<"execution:computing"> {
  readonly intentId: string;
  readonly iteration: number;
}

/**
 * Emitted when patches are applied to snapshot.
 */
export interface ExecutionPatchesEvent
  extends BaseWorldEvent<"execution:patches"> {
  readonly intentId: string;
  readonly patches: Patch[];
  readonly source: "compute" | "effect";
}

/**
 * Emitted when an effect is about to be executed.
 */
export interface ExecutionEffectEvent
  extends BaseWorldEvent<"execution:effect"> {
  readonly intentId: string;
  readonly effectType: string;
  readonly effectParams: unknown;
}

/**
 * Emitted when an effect completes and returns patches.
 */
export interface ExecutionEffectResultEvent
  extends BaseWorldEvent<"execution:effect_result"> {
  readonly intentId: string;
  readonly effectType: string;
  readonly resultPatches: Patch[];
  readonly success: boolean;
  readonly error?: ErrorInfo;
}

/**
 * Emitted when execution completes successfully.
 */
export interface ExecutionCompletedEvent
  extends BaseWorldEvent<"execution:completed"> {
  readonly proposalId: string;
  readonly intentId: string;
  readonly finalSnapshot: Snapshot;
  readonly totalPatches: number;
  readonly totalEffects: number;
}

/**
 * Emitted when execution fails.
 */
export interface ExecutionFailedEvent
  extends BaseWorldEvent<"execution:failed"> {
  readonly proposalId: string;
  readonly intentId: string;
  readonly error: ErrorInfo;
  readonly partialSnapshot: Snapshot;
}

// =============================================================================
// State Lifecycle Events
// =============================================================================

/**
 * Emitted when snapshot transitions to a new state.
 * This is the canonical state change event.
 */
export interface SnapshotChangedEvent
  extends BaseWorldEvent<"snapshot:changed"> {
  readonly intentId: string;
  readonly before: {
    readonly snapshotHash: string;
    readonly snapshot?: Snapshot;
  };
  readonly after: {
    readonly snapshotHash: string;
    readonly snapshot: Snapshot;
  };
  readonly cause: "patches" | "effect_result";
}

// =============================================================================
// World Lifecycle Events
// =============================================================================

/**
 * Emitted when a new world is created.
 */
export interface WorldCreatedEvent extends BaseWorldEvent<"world:created"> {
  readonly world: World;
  readonly proposalId: string | null;
  readonly parentWorldId: WorldId | null;
}

/**
 * Emitted when a world is forked (branching).
 */
export interface WorldForkedEvent extends BaseWorldEvent<"world:forked"> {
  readonly parentWorldId: WorldId;
  readonly childWorldId: WorldId;
  readonly proposalId: string;
}

// =============================================================================
// Union Type
// =============================================================================

export type WorldEvent =
  | ProposalSubmittedEvent
  | ProposalEvaluatingEvent
  | ProposalDecidedEvent
  | ExecutionStartedEvent
  | ExecutionComputingEvent
  | ExecutionPatchesEvent
  | ExecutionEffectEvent
  | ExecutionEffectResultEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | SnapshotChangedEvent
  | WorldCreatedEvent
  | WorldForkedEvent;

// =============================================================================
// Handler Types
// =============================================================================

export type WorldEventHandler = (event: WorldEvent) => void;
export type Unsubscribe = () => void;
