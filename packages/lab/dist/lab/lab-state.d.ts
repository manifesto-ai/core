/**
 * Lab State Management
 *
 * Manages the internal state of a Lab experiment.
 */
import type { Proposal, WorldEvent } from "@manifesto-ai/world";
import type { LabState } from "../types.js";
/**
 * Create initial lab state.
 */
export declare function createInitialLabState(): LabState;
/**
 * Update lab state based on a World event.
 */
export declare function updateLabState(currentState: LabState, event: WorldEvent): LabState;
/**
 * Transition lab state to aborted.
 */
export declare function abortLabState(reason: string): LabState;
/**
 * Add a pending HITL proposal to state.
 */
export declare function addPendingHITL(currentState: LabState, proposal: Proposal): LabState;
/**
 * Remove a resolved HITL proposal from state.
 */
export declare function resolvePendingHITL(currentState: LabState, proposalId: string): LabState;
//# sourceMappingURL=lab-state.d.ts.map