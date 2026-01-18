/**
 * World Event to Lab Trace Event Mapper
 *
 * Maps World Protocol events to Lab trace events.
 * Per SPEC Section 8.7.
 */

import type { WorldEvent } from "@manifesto-ai/world";
import type {
  LabTraceEvent,
  ProposalTraceEvent,
  AuthorityDecisionTraceEvent,
  ApplyTraceEvent,
  EffectTraceEvent,
  EffectResultTraceEvent,
  TerminationTraceEvent,
  WorldCreatedTraceEvent,
} from "../types.js";

/**
 * Map a World event to a Lab trace event.
 *
 * @param event - The World event to map
 * @param seq - Sequence number for the trace event
 * @returns The corresponding Lab trace event
 */
export function mapWorldEventToTraceEvent(
  event: WorldEvent,
  seq: number
): LabTraceEvent | null {
  const timestamp = new Date(event.timestamp).toISOString();

  switch (event.type) {
    case "proposal:submitted":
      return {
        type: "proposal",
        seq,
        timestamp,
        proposalId: event.proposal.proposalId,
        intentType: event.proposal.intent.body.type,
        actorId: event.actor.actorId,
      } satisfies ProposalTraceEvent;

    case "proposal:decided":
      return {
        type: "authority.decision",
        seq,
        timestamp,
        proposalId: event.proposalId,
        decision: event.decision,
        authorityId: event.authorityId,
      } satisfies AuthorityDecisionTraceEvent;

    case "execution:patches":
      return {
        type: "apply",
        seq,
        timestamp,
        intentId: event.intentId,
        patchCount: event.patches.length,
        source: event.source,
      } satisfies ApplyTraceEvent;

    case "execution:effect":
      return {
        type: "effect",
        seq,
        timestamp,
        intentId: event.intentId,
        effectType: event.effectType,
      } satisfies EffectTraceEvent;

    case "execution:effect_result":
      return {
        type: "effect.result",
        seq,
        timestamp,
        intentId: event.intentId,
        effectType: event.effectType,
        success: event.success,
        patchCount: event.resultPatches?.length ?? 0,
        error: event.error?.message,
      } satisfies EffectResultTraceEvent;

    case "execution:completed":
      return {
        type: "termination",
        seq,
        timestamp,
        outcome: "success",
        proposalId: event.proposalId,
      } satisfies TerminationTraceEvent;

    case "execution:failed":
      return {
        type: "termination",
        seq,
        timestamp,
        outcome: "failure",
        proposalId: event.proposalId,
        error: {
          code: event.error.code,
          message: event.error.message,
          details: event.error.details,
        },
      } satisfies TerminationTraceEvent;

    case "world:created":
      return {
        type: "world.created",
        seq,
        timestamp,
        worldId: event.world.worldId,
        parentWorldId: event.parentWorldId,
        proposalId: event.proposalId,
      } satisfies WorldCreatedTraceEvent;

    // Events that don't map to trace events
    case "proposal:evaluating":
    case "execution:started":
    case "execution:computing":
    case "snapshot:changed":
    case "world:forked":
      // These events provide internal detail but are not required in the trace
      // They can be added later if needed for debugging
      return null;

    default:
      // Unknown event type - should not happen with proper typing
      return null;
  }
}
