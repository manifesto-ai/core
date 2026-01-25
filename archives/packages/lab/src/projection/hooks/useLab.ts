/**
 * useLab Hook
 *
 * React hook for accessing Lab state in Ink components.
 */

import { useState, useEffect, useCallback } from "react";
import type { Proposal } from "@manifesto-ai/world";
import type {
  LabWorld,
  LabState,
  LabMeta,
  HITLController,
  LabTraceEvent,
} from "../../types.js";

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
 * Create initial UI state.
 */
function createInitialState(labWorld: LabWorld): LabUIState {
  return {
    meta: labWorld.labMeta,
    status: labWorld.state.status,
    isRunning: labWorld.state.status === "running",
    isWaitingHITL: labWorld.state.status === "waiting_hitl",
    pendingProposals: labWorld.hitl.pending,
    eventCount: labWorld.trace().events.length,
    proposalCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    elapsed: Date.now() - labWorld.labMeta.startedAt,
  };
}

/**
 * React hook for accessing Lab state.
 *
 * @param labWorld - The LabWorld instance
 * @returns Lab UI state and controls
 */
export function useLab(labWorld: LabWorld): UseLabResult {
  const [state, setState] = useState<LabUIState>(() =>
    createInitialState(labWorld)
  );
  const [events, setEvents] = useState<LabTraceEvent[]>(() =>
    labWorld.trace().events
  );

  // Subscribe to lab events
  useEffect(() => {
    const unsubscribe = labWorld.onLabEvent((event) => {
      // Update state based on event type
      setState((prev) => {
        const newState = { ...prev };

        switch (event.type) {
          case "hitl:pending":
            newState.isWaitingHITL = true;
            newState.pendingProposals = labWorld.hitl.pending;
            break;

          case "hitl:decided":
            if (event.decision === "approved") {
              newState.approvedCount++;
            } else {
              newState.rejectedCount++;
            }
            newState.pendingProposals = labWorld.hitl.pending;
            newState.isWaitingHITL = labWorld.hitl.pending.length > 0;
            break;

          case "lab:status_changed":
            newState.status = event.status;
            newState.isRunning = event.status === "running";
            newState.isWaitingHITL = event.status === "waiting_hitl";
            break;

          case "world:event":
            newState.eventCount++;
            if (event.event.type === "proposal:submitted") {
              newState.proposalCount++;
            } else if (event.event.type === "proposal:decided") {
              // Only update counts and pending list for final decisions (not pending)
              // Pending state is handled via hitl:pending event to ensure proper timing
              if (event.event.decision === "approved") {
                newState.approvedCount++;
                // Update pending list only after final decision
                newState.pendingProposals = labWorld.hitl.pending;
                newState.isWaitingHITL = labWorld.hitl.pending.length > 0;
              } else if (event.event.decision === "rejected") {
                newState.rejectedCount++;
                // Update pending list only after final decision
                newState.pendingProposals = labWorld.hitl.pending;
                newState.isWaitingHITL = labWorld.hitl.pending.length > 0;
              }
              // Note: "pending" decision is handled by hitl:pending event
            }
            break;
        }

        newState.elapsed = Date.now() - labWorld.labMeta.startedAt;
        return newState;
      });

      // Update events
      setEvents(labWorld.trace().events);
    });

    return unsubscribe;
  }, [labWorld]);

  // Update elapsed time periodically
  useEffect(() => {
    if (state.status === "running" || state.status === "waiting_hitl") {
      const interval = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsed: Date.now() - labWorld.labMeta.startedAt,
        }));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [state.status, labWorld.labMeta.startedAt]);

  // HITL actions
  const approve = useCallback(
    async (proposalId: string) => {
      await labWorld.hitl.approve(proposalId);
    },
    [labWorld]
  );

  const reject = useCallback(
    async (proposalId: string, reason: string) => {
      await labWorld.hitl.reject(proposalId, reason);
    },
    [labWorld]
  );

  return {
    state,
    hitl: labWorld.hitl,
    events,
    approve,
    reject,
  };
}
