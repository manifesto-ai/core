import type { ProposalStatus } from "./types.js";

export const INGRESS_STATUSES = ["submitted", "evaluating"] as const satisfies readonly ProposalStatus[];
export const EXECUTION_STAGE_STATUSES = ["approved", "executing"] as const satisfies readonly ProposalStatus[];
export const TERMINAL_STATUSES = ["rejected", "completed", "failed", "superseded"] as const satisfies readonly ProposalStatus[];
export const DECISION_TRANSITION_TARGETS = ["approved", "rejected"] as const satisfies readonly ProposalStatus[];

const VALID_TRANSITIONS: Record<ProposalStatus, readonly ProposalStatus[]> = {
  submitted: ["evaluating", "rejected", "superseded"],
  evaluating: ["approved", "rejected", "superseded"],
  approved: ["executing"],
  rejected: [],
  executing: ["completed", "failed"],
  completed: [],
  failed: [],
  superseded: [],
};

export function isIngressStatus(status: ProposalStatus): boolean {
  return (INGRESS_STATUSES as readonly ProposalStatus[]).includes(status);
}

export function isExecutionStageStatus(status: ProposalStatus): boolean {
  return (EXECUTION_STAGE_STATUSES as readonly ProposalStatus[]).includes(status);
}

export function isTerminalStatus(status: ProposalStatus): boolean {
  return (TERMINAL_STATUSES as readonly ProposalStatus[]).includes(status);
}

export function isValidTransition(
  from: ProposalStatus,
  to: ProposalStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function getValidTransitions(status: ProposalStatus): ProposalStatus[] {
  return [...VALID_TRANSITIONS[status]];
}

export function transitionCreatesDecisionRecord(
  from: ProposalStatus,
  to: ProposalStatus
): boolean {
  return (
    (from === "submitted" && to === "rejected") ||
    (from === "evaluating" && to === "approved") ||
    (from === "evaluating" && to === "rejected")
  );
}
