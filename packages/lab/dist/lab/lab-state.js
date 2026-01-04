/**
 * Lab State Management
 *
 * Manages the internal state of a Lab experiment.
 */
/**
 * Create initial lab state.
 */
export function createInitialLabState() {
    return {
        status: "running",
        currentStep: 0,
        pendingHITL: [],
    };
}
/**
 * Update lab state based on a World event.
 */
export function updateLabState(currentState, event) {
    // If already terminal, don't update
    if (currentState.status === "completed" || currentState.status === "aborted") {
        return currentState;
    }
    switch (event.type) {
        case "proposal:submitted":
            return {
                ...currentState,
                status: "running",
                currentStep: currentState.status === "running"
                    ? currentState.currentStep + 1
                    : 1,
                pendingHITL: currentState.status === "running" ? currentState.pendingHITL : [],
            };
        case "proposal:decided":
            if (event.decision === "pending") {
                // Transition to waiting for HITL
                return {
                    status: "waiting_hitl",
                    proposal: {}, // Will be filled by HITL controller
                    waitingSince: event.timestamp,
                };
            }
            // For approved/rejected, stay in running state
            return currentState;
        case "execution:completed":
            return {
                status: "completed",
                outcome: "success",
            };
        case "execution:failed":
            return {
                status: "completed",
                outcome: "failure",
            };
        default:
            return currentState;
    }
}
/**
 * Transition lab state to aborted.
 */
export function abortLabState(reason) {
    return {
        status: "aborted",
        reason,
    };
}
/**
 * Add a pending HITL proposal to state.
 */
export function addPendingHITL(currentState, proposal) {
    if (currentState.status !== "running") {
        return {
            status: "waiting_hitl",
            proposal,
            waitingSince: Date.now(),
        };
    }
    return {
        ...currentState,
        pendingHITL: [...currentState.pendingHITL, proposal],
    };
}
/**
 * Remove a resolved HITL proposal from state.
 */
export function resolvePendingHITL(currentState, proposalId) {
    if (currentState.status === "waiting_hitl") {
        if (currentState.proposal.proposalId === proposalId) {
            return {
                status: "running",
                currentStep: 0,
                pendingHITL: [],
            };
        }
        return currentState;
    }
    if (currentState.status !== "running") {
        return currentState;
    }
    return {
        ...currentState,
        pendingHITL: currentState.pendingHITL.filter((p) => p.proposalId !== proposalId),
    };
}
//# sourceMappingURL=lab-state.js.map