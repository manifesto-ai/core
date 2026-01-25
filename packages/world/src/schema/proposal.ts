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
import { ExecutionKeySchema } from "../types/index.js";

/**
 * Proposal status values
 *
 * State Machine:
 * submitted → evaluating → approved → executing → completed
 *     │            │           │           │
 *     │            │           │           └──→ failed
 *     │            │           │
 *     │            └───────────┴──────────────→ rejected
 *
 * Terminal states: completed, rejected, failed
 * DecisionRecord created at: approved or rejected (terminal decisions only)
 * World created at: completed or failed
 *
 * Per EPOCH-3~5:
 * - Ingress-stage proposals (submitted, evaluating) MAY be dropped on epoch change
 */
export const ProposalStatus = z.enum([
  "submitted", // Actor has submitted, routing to Authority
  "evaluating", // Authority is deliberating (including HITL waiting)
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
export const TERMINAL_STATUSES: ProposalStatus[] = [
  "completed",
  "rejected",
  "failed",
];

/**
 * Ingress-stage statuses - can be dropped by epoch change
 */
export const INGRESS_STATUSES: ProposalStatus[] = ["submitted", "evaluating"];

/**
 * Check if a status is terminal
 */
export function isTerminalStatus(status: ProposalStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Check if a status is in the ingress stage (can be dropped)
 */
export function isIngressStatus(status: ProposalStatus): boolean {
  return INGRESS_STATUSES.includes(status);
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

  /**
   * Epoch at time of submission
   *
   * Per EPOCH-1: Proposals MUST carry the epoch at which they were submitted.
   * Used for stale detection on branch switch.
   */
  epoch: z.number(),

  /**
   * Execution key for Host dispatch
   *
   * Per WORLD-EXK-1~2: Proposal MUST carry executionKey at submission.
   * Format: `${proposalId}:${attempt}`
   * Immutable once set.
   */
  executionKey: ExecutionKeySchema,

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
