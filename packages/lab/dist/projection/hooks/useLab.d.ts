/**
 * useLab Hook
 *
 * React hook for accessing Lab state in Ink components.
 */
import type { Proposal } from "@manifesto-ai/world";
import type { LabWorld, LabState, LabMeta, HITLController, LabTraceEvent } from "../../types.js";
/**
 * Lab UI state for rendering.
 */
export interface LabUIState {
    meta: LabMeta;
    status: LabState["status"];
    isRunning: boolean;
    isWaitingHITL: boolean;
    pendingProposals: Proposal[];
    eventCount: number;
    proposalCount: number;
    approvedCount: number;
    rejectedCount: number;
    elapsed: number;
}
/**
 * useLab hook return type.
 */
export interface UseLabResult {
    state: LabUIState;
    hitl: HITLController;
    events: LabTraceEvent[];
    approve: (proposalId: string) => Promise<void>;
    reject: (proposalId: string, reason: string) => Promise<void>;
}
/**
 * React hook for accessing Lab state.
 *
 * @param labWorld - The LabWorld instance
 * @returns Lab UI state and controls
 */
export declare function useLab(labWorld: LabWorld): UseLabResult;
//# sourceMappingURL=useLab.d.ts.map