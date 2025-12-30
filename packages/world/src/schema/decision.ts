/**
 * Decision Record Schema
 *
 * Defines DecisionRecord - an immutable audit log of Authority judgment.
 *
 * Per Intent & Projection Specification v1.0:
 * - DecisionRecord MUST include approvedScope if approved
 * - approvedScope can be: copy of scopeProposal, modified scope, or null (no restriction)
 *
 * DecisionRecord Rules (MUST):
 * - D-1: DecisionRecord MUST be created only for terminal decisions
 * - D-2: DecisionRecords MUST be immutable after creation
 * - D-3: DecisionRecords MUST reference valid proposalId
 * - D-4: decidedAt MUST be >= Proposal's submittedAt
 * - D-5: Each Proposal MUST have at most one DecisionRecord
 * - D-6: pending state MUST NOT create a DecisionRecord
 * - D-7: approvedScope MUST be set if decision is approved
 */
import { z } from "zod";
import { AuthorityRef } from "./authority.js";
import { ActorRef } from "./actor.js";
import { ProposalId, DecisionId } from "./world.js";
import { IntentScope } from "./intent.js";

/**
 * Final decision made by Authority
 *
 * Note: pending is NOT a decision - it's a deliberation state.
 */
export const FinalDecision = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("approved") }),
  z.object({ kind: z.literal("rejected"), reason: z.string() }),
  z.object({
    kind: z.literal("timeout"),
    action: z.enum(["approved", "rejected"]),
  }),
]);
export type FinalDecision = z.infer<typeof FinalDecision>;

/**
 * Decision Record - immutable audit log
 *
 * Created only when Authority makes a terminal decision (approved or rejected).
 * pending state does NOT create a DecisionRecord.
 *
 * Per spec:
 * - approvedScope MUST be set if decision is approved
 * - approvedScope can be: copy of scopeProposal, modified scope, or null (no restriction)
 */
export const DecisionRecord = z.object({
  /** Unique decision identifier */
  decisionId: DecisionId,

  /** Proposal being decided */
  proposalId: ProposalId,

  /** Authority that made the decision */
  authority: AuthorityRef,

  /** The final decision */
  decision: FinalDecision,

  /**
   * Approved scope (MUST be set if approved)
   *
   * Per spec:
   * - Copy of scopeProposal if approved as proposed
   * - Modified scope if approved with modification
   * - null if approved without scope restriction
   * - undefined if rejected (not applicable)
   */
  approvedScope: IntentScope.nullable().optional(),

  /** Optional reasoning */
  reasoning: z.string().optional(),

  /** When the decision was made */
  decidedAt: z.number(),
});
export type DecisionRecord = z.infer<typeof DecisionRecord>;

/**
 * Vote in a tribunal decision
 */
export const Vote = z.object({
  /** Who voted */
  voter: ActorRef,

  /** Their vote */
  decision: z.enum(["approve", "reject", "abstain"]),

  /** Optional reasoning */
  reasoning: z.string().optional(),

  /** When they voted */
  votedAt: z.number(),
});
export type Vote = z.infer<typeof Vote>;

/**
 * Tribunal Decision Record - extended decision record for multi-agent review
 */
export const TribunalDecisionRecord = DecisionRecord.extend({
  /** All votes cast */
  votes: z.array(Vote),

  /** Whether quorum was met */
  quorumMet: z.boolean(),
});
export type TribunalDecisionRecord = z.infer<typeof TribunalDecisionRecord>;

/**
 * Helper to create an approved decision
 */
export function createApprovedDecision(): FinalDecision {
  return { kind: "approved" };
}

/**
 * Helper to create a rejected decision
 */
export function createRejectedDecision(reason: string): FinalDecision {
  return { kind: "rejected", reason };
}

/**
 * Helper to create a timeout decision
 */
export function createTimeoutDecision(
  action: "approved" | "rejected"
): FinalDecision {
  return { kind: "timeout", action };
}

/**
 * Check if a decision is approved (including timeout-approved)
 */
export function isApprovedDecision(decision: FinalDecision): boolean {
  return (
    decision.kind === "approved" ||
    (decision.kind === "timeout" && decision.action === "approved")
  );
}

/**
 * Check if a decision is rejected (including timeout-rejected)
 */
export function isRejectedDecision(decision: FinalDecision): boolean {
  return (
    decision.kind === "rejected" ||
    (decision.kind === "timeout" && decision.action === "rejected")
  );
}
