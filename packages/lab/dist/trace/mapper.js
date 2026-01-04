/**
 * World Event to Lab Trace Event Mapper
 *
 * Maps World Protocol events to Lab trace events.
 * Per SPEC Section 8.7.
 */
/**
 * Map a World event to a Lab trace event.
 *
 * @param event - The World event to map
 * @param seq - Sequence number for the trace event
 * @returns The corresponding Lab trace event
 */
export function mapWorldEventToTraceEvent(event, seq) {
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
            };
        case "proposal:decided":
            return {
                type: "authority.decision",
                seq,
                timestamp,
                proposalId: event.proposalId,
                decision: event.decision,
                authorityId: event.authorityId,
            };
        case "execution:patches":
            return {
                type: "apply",
                seq,
                timestamp,
                intentId: event.intentId,
                patchCount: event.patches.length,
                source: event.source,
            };
        case "execution:effect":
            return {
                type: "effect",
                seq,
                timestamp,
                intentId: event.intentId,
                effectType: event.effectType,
            };
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
            };
        case "execution:completed":
            return {
                type: "termination",
                seq,
                timestamp,
                outcome: "success",
                proposalId: event.proposalId,
            };
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
            };
        case "world:created":
            return {
                type: "world.created",
                seq,
                timestamp,
                worldId: event.world.worldId,
                parentWorldId: event.parentWorldId,
                proposalId: event.proposalId,
            };
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
//# sourceMappingURL=mapper.js.map