/**
 * Proposal Schema
 *
 * Defines Proposal - an accountability envelope wrapping an IntentInstance with Actor identity.
 *
 * Proposal = Actor + IntentInstance + baseWorld
 *          = "누가" + "무슨 의도를" + "어디서"
 *
 * Per Intent & Projection Specification v1.0:
 * - Proposal.intent is IntentInstance (not simple Intent)
 * - scopeProposal is read from intent.body.scopeProposal (not duplicated)
 * - approvedScope is set by Authority
 *
 * Proposal Rules (MUST):
 * - P-1: Proposals MUST reference exactly one existing baseWorld
 * - P-2: Proposals MUST include valid actor reference
 * - P-3: Proposals MUST include valid IntentInstance with intentId and intentKey
 * - P-4: Proposal readonly fields MUST NOT be modified after submission
 * - P-5: proposalId MUST be unique within the World Protocol instance
 * - P-6: Proposals MUST be created by registered Actors only
 */
import { z } from "zod";
import { ActorRef } from "./actor.js";
import { WorldId, ProposalId, DecisionId } from "./world.js";
import { IntentInstance, IntentScope } from "./intent.js";

/**
 * Proposal status values
 *
 * State Machine:
 * submitted → pending → approved → executing → completed
 *     │          │                      │
 *     │          │                      └──→ failed
 *     │          │
 *     └──────────┴──────────────────────────→ rejected
 *
 * Terminal states: completed, rejected, failed
 * DecisionRecord created at: approved or rejected (terminal decisions only)
 * World created at: completed or failed
 */
export const ProposalStatus = z.enum([
  "submitted", // Actor has submitted, routing to Authority
  "pending", // Authority is deliberating (e.g., HITL waiting)
  "approved", // Authority approved, waiting for Host execution
  "rejected", // Authority rejected (terminal, no World created)
  "executing", // Host is running the Intent
  "completed", // Done, new World created (terminal)
  "failed", // Execution failed, World created with error state (terminal)
]);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

/**
 * Terminal statuses - no further transitions allowed
 */
export const TERMINAL_STATUSES: ProposalStatus[] = ["completed", "rejected", "failed"];

/**
 * Check if a status is terminal
 */
export function isTerminalStatus(status: ProposalStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Proposal trace - optional reasoning for audit
 */
export const ProposalTrace = z.object({
  /** Short summary of the proposal */
  summary: z.string(),

  /** Detailed reasoning */
  reasoning: z.string().optional(),

  /** Additional context */
  context: z.record(z.string(), z.unknown()).optional(),
});
export type ProposalTrace = z.infer<typeof ProposalTrace>;

/**
 * Proposal - accountability envelope
 *
 * A Proposal answers:
 * - WHO: actor — who is accountable
 * - WHAT: intent — what action is requested (IntentInstance)
 * - WHERE: baseWorld — which reality to change
 * - WHEN: submittedAt — when it was submitted
 * - WHY: trace — optional reasoning
 *
 * Note per spec:
 * - scopeProposal is NOT duplicated; it's read from intent.body.scopeProposal
 * - approvedScope is set by Authority when decision is made
 */
export const Proposal = z.object({
  /** Unique proposal identifier */
  proposalId: ProposalId,

  /** Who is proposing this change */
  actor: ActorRef,

  /** What action is being requested (IntentInstance per spec) */
  intent: IntentInstance,

  /** Which world to base this change on */
  baseWorld: WorldId,

  /** Current status in the state machine */
  status: ProposalStatus,

  /** Optional reasoning for audit */
  trace: ProposalTrace.optional(),

  /** When the proposal was submitted */
  submittedAt: z.number(),

  /**
   * Approved scope set by Authority
   *
   * Per spec:
   * - If approved as proposed: copy of scopeProposal
   * - If approved with modification: modified scope
   * - If approved without scope: null (no restriction)
   * - If rejected: not set
   */
  approvedScope: IntentScope.nullable().optional(),

  /** Decision ID (set when terminal decision made) */
  decisionId: DecisionId.optional(),

  /** Result world ID (set when World created) */
  resultWorld: WorldId.optional(),

  /** When the decision was made */
  decidedAt: z.number().optional(),

  /** When the proposal completed (success or failure) */
  completedAt: z.number().optional(),
});
export type Proposal = z.infer<typeof Proposal>;

/**
 * Helper to get scopeProposal from a Proposal
 *
 * Per spec: scopeProposal is read from intent.body.scopeProposal
 */
export function getScopeProposal(proposal: Proposal): IntentScope | undefined {
  return proposal.intent.body.scopeProposal;
}
