/**
 * Authority Schema
 *
 * Defines Authority types - entities that judge Proposals and issue decisions.
 *
 * Authority MUST:
 * - Evaluate every routed Proposal
 * - Return a decision: approved, rejected, or pending
 * - Produce a DecisionRecord only for terminal decisions
 *
 * Authority MUST NOT:
 * - Execute effects
 * - Apply patches directly
 * - Modify Snapshots
 * - Skip Proposals
 * - Create DecisionRecord for pending state
 */
import { z } from "zod";
import { ActorRef } from "./actor.js";
import { IntentScope } from "./intent.js";

/**
 * Authority kinds
 *
 * | Kind     | Description              | Decision Maker               |
 * |----------|--------------------------|------------------------------|
 * | auto     | Automatic approval       | System (no deliberation)     |
 * | human    | Human-in-the-loop        | Specific human Actor         |
 * | policy   | Policy-based rules       | Deterministic rules          |
 * | tribunal | Multi-agent review       | Group of Actors              |
 */
export const AuthorityKind = z.enum(["auto", "human", "policy", "tribunal"]);
export type AuthorityKind = z.infer<typeof AuthorityKind>;

/**
 * Authority Reference - identifies an authority in the system
 */
export const AuthorityRef = z.object({
  /** Unique identifier for the authority */
  authorityId: z.string(),

  /** Type of authority */
  kind: AuthorityKind,

  /** Optional human-readable name */
  name: z.string().optional(),
});
export type AuthorityRef = z.infer<typeof AuthorityRef>;

/**
 * What the authority is waiting for (when in pending state)
 */
export const WaitingFor = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("human"),
    delegate: ActorRef,
  }),
  z.object({
    kind: z.literal("tribunal"),
    members: z.array(ActorRef),
  }),
  z.object({
    kind: z.literal("timeout"),
    until: z.number(),
  }),
]);
export type WaitingFor = z.infer<typeof WaitingFor>;

/**
 * Authority response after evaluating a Proposal
 *
 * Per Intent & Projection Specification v1.0:
 * - approved: Proposal is approved, proceed to execution (includes approvedScope)
 * - rejected: Proposal is rejected, no World created
 * - pending: Authority is still deliberating (not a decision!)
 *
 * approvedScope semantics:
 * - Copy of scopeProposal if approved as proposed
 * - Modified scope if approved with modification
 * - null if approved without scope restriction (no restriction)
 * - undefined is NOT allowed for approved (use null for "no restriction")
 */
export const AuthorityResponse = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("approved"),
    /** Approved scope (MUST be set for approved decisions) */
    approvedScope: IntentScope.nullable(),
  }),
  z.object({ kind: z.literal("rejected"), reason: z.string() }),
  z.object({ kind: z.literal("pending"), waitingFor: WaitingFor }),
]);
export type AuthorityResponse = z.infer<typeof AuthorityResponse>;

/**
 * Helper to create an AuthorityRef
 */
export function createAuthorityRef(
  authorityId: string,
  kind: AuthorityKind,
  name?: string
): AuthorityRef {
  return {
    authorityId,
    kind,
    ...(name !== undefined && { name }),
  };
}

/**
 * Create an approved response
 *
 * @param approvedScope - The approved scope (null = no restriction)
 */
export function approvedResponse(approvedScope: IntentScope | null = null): AuthorityResponse {
  return { kind: "approved", approvedScope };
}

/**
 * Create a rejected response
 */
export function rejectedResponse(reason: string): AuthorityResponse {
  return { kind: "rejected", reason };
}

/**
 * Create a pending response waiting for human
 */
export function pendingHumanResponse(delegate: ActorRef): AuthorityResponse {
  return { kind: "pending", waitingFor: { kind: "human", delegate } };
}

/**
 * Create a pending response waiting for tribunal
 */
export function pendingTribunalResponse(members: ActorRef[]): AuthorityResponse {
  return { kind: "pending", waitingFor: { kind: "tribunal", members } };
}

/**
 * Create a pending response waiting for timeout
 */
export function pendingTimeoutResponse(until: number): AuthorityResponse {
  return { kind: "pending", waitingFor: { kind: "timeout", until } };
}
