/**
 * Proposal State Machine
 *
 * Defines valid state transitions for Proposals.
 *
 * State Machine:
 * ```
 * submitted → pending → approved → executing → completed
 *     │          │                      │
 *     │          │                      └──→ failed
 *     │          │
 *     └──────────┴──────────────────────────→ rejected
 * ```
 *
 * Invariants:
 * - L-1: submitted → only pending, approved, or rejected
 * - L-2: pending → only approved or rejected
 * - L-3: approved → only executing
 * - L-4: executing → only completed or failed
 * - L-5: completed, rejected, failed are terminal
 * - L-6: Transitions MUST NOT skip states
 * - L-7: Reverse transitions MUST NOT occur
 * - L-8: DecisionRecord MUST exist before executing
 */
import type { ProposalStatus } from "../schema/proposal.js";

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  submitted: ["pending", "approved", "rejected"],
  pending: ["approved", "rejected"],
  approved: ["executing"],
  executing: ["completed", "failed"],
  rejected: [], // terminal
  completed: [], // terminal
  failed: [], // terminal
};

/**
 * Terminal statuses - no further transitions allowed
 */
export const TERMINAL_STATUSES: ProposalStatus[] = [
  "completed",
  "rejected",
  "failed",
];

/**
 * Statuses that require a DecisionRecord
 */
export const DECISION_REQUIRED_STATUSES: ProposalStatus[] = [
  "approved",
  "rejected",
];

/**
 * Statuses where World is created
 */
export const WORLD_CREATED_STATUSES: ProposalStatus[] = ["completed", "failed"];

/**
 * Check if a status is terminal
 */
export function isTerminalStatus(status: ProposalStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Check if a transition is valid
 *
 * @param from - Current status
 * @param to - Target status
 * @returns true if transition is valid
 */
export function isValidTransition(
  from: ProposalStatus,
  to: ProposalStatus
): boolean {
  const validTargets = VALID_TRANSITIONS[from];
  return validTargets.includes(to);
}

/**
 * Get valid transitions from a status
 *
 * @param status - Current status
 * @returns Array of valid target statuses
 */
export function getValidTransitions(status: ProposalStatus): ProposalStatus[] {
  return [...VALID_TRANSITIONS[status]];
}

/**
 * Check if a decision record is required for a transition
 *
 * @param to - Target status
 * @returns true if decision record is required
 */
export function requiresDecision(to: ProposalStatus): boolean {
  return DECISION_REQUIRED_STATUSES.includes(to);
}

/**
 * Check if a world will be created after this transition
 *
 * @param status - Target status
 * @returns true if world is created
 */
export function createsWorld(status: ProposalStatus): boolean {
  return WORLD_CREATED_STATUSES.includes(status);
}

/**
 * Status descriptions for debugging
 */
export const STATUS_DESCRIPTIONS: Record<ProposalStatus, string> = {
  submitted: "Actor has submitted, routing to Authority",
  pending: "Authority is deliberating (e.g., HITL waiting)",
  approved: "Authority approved, waiting for Host execution",
  rejected: "Authority rejected (terminal, no World created)",
  executing: "Host is running the Intent",
  completed: "Done, new World created (terminal)",
  failed: "Execution failed, World created with error state (terminal)",
};

/**
 * Get human-readable description for a status
 */
export function getStatusDescription(status: ProposalStatus): string {
  return STATUS_DESCRIPTIONS[status];
}
