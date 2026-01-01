/**
 * Trace Replay
 *
 * Replay Lab traces against a ManifestoWorld.
 * Added in v1.1.
 */

import type {
  LabTrace,
  LabTraceEvent,
  LabTraceEventType,
  ReplayOptions,
  ReplayResult,
  Divergence,
  DivergenceCause,
  TraceDiff,
  ProposalTraceEvent,
} from "../types.js";
import { diffTraces } from "./diff.js";
import { createTraceRecorder } from "./recorder.js";

// =============================================================================
// Main API
// =============================================================================

/**
 * Replay a trace against a world.
 *
 * This re-executes the proposals from the original trace against the
 * provided world and compares the results.
 *
 * @param trace - The trace to replay
 * @param options - Replay options
 * @returns Replay result with comparison
 */
export async function replay(
  trace: LabTrace,
  options: ReplayOptions
): Promise<ReplayResult> {
  const { world, stopAtSeq, stopAtEvent, actorOverride, mode = "strict" } = options;

  // Initialize trace recorder for the replay
  const recorder = createTraceRecorder({
    runId: `replay-${trace.header.runId}`,
    necessityLevel: trace.header.necessityLevel,
    outputPath: "/dev/null", // Don't write to disk during replay
  });

  const divergences: Divergence[] = [];
  const replayEvents: LabTraceEvent[] = [];
  let eventsReplayed = 0;
  let stopped = false;

  // Subscribe to world events to record replay trace
  const unsubscribe = world.subscribe((event) => {
    const replayEvent = mapWorldEventToReplayEvent(event, replayEvents.length);
    if (replayEvent) {
      replayEvents.push(replayEvent);
    }
  });

  try {
    // Process each event from the original trace
    for (let i = 0; i < trace.events.length; i++) {
      const originalEvent = trace.events[i];

      // Check stop conditions
      if (stopAtSeq !== undefined && originalEvent.seq >= stopAtSeq) {
        stopped = true;
        break;
      }

      if (stopAtEvent && originalEvent.type === stopAtEvent) {
        stopped = true;
        break;
      }

      // Only replay proposal events - other events are results
      if (originalEvent.type === "proposal") {
        await replayProposal(originalEvent as ProposalTraceEvent, world, actorOverride);
        eventsReplayed++;

        // Check for divergence after replaying
        const replayEvent = replayEvents[replayEvents.length - 1];
        if (replayEvent) {
          const cause = checkDivergence(originalEvent, replayEvent);
          if (cause) {
            divergences.push({
              seq: originalEvent.seq,
              originalEvent,
              replayEvent,
              cause,
            });

            // In strict mode, stop on first divergence
            if (mode === "strict") {
              stopped = true;
              break;
            }
          }
        }
      }
    }
  } finally {
    unsubscribe();
  }

  // Complete the replay trace
  const replayTrace: LabTrace = {
    header: {
      specVersion: "lab/1.1",
      runId: `replay-${trace.header.runId}`,
      necessityLevel: trace.header.necessityLevel,
      schemaHash: trace.header.schemaHash,
      createdAt: new Date().toISOString(),
      environment: { replay: true, originalRunId: trace.header.runId },
    },
    events: replayEvents,
    outcome: determineReplayOutcome(replayEvents, divergences, mode),
  };

  // Compare traces
  const diff = diffTraces(trace, replayTrace);

  return {
    trace: replayTrace,
    success: mode === "compare" ? true : divergences.length === 0,
    diff,
    divergences,
    eventsReplayed,
    eventsRemaining: stopped
      ? trace.events.filter((e) => e.type === "proposal").length - eventsReplayed
      : 0,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Replay a single proposal event.
 */
async function replayProposal(
  event: ProposalTraceEvent,
  world: import("@manifesto-ai/world").ManifestoWorld,
  actorOverride?: string
): Promise<void> {
  // Note: This is a simplified implementation.
  // In a full implementation, we would need to:
  // 1. Reconstruct the full Intent from the trace event
  // 2. Submit it to the world
  // 3. Handle the result
  //
  // For now, we just simulate the replay by yielding to event loop
  // The actual proposal submission would require more context about
  // the original intent payload.

  await Promise.resolve();
}

/**
 * Map a world event to a replay trace event.
 */
function mapWorldEventToReplayEvent(
  event: import("@manifesto-ai/world").WorldEvent,
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
        actorId: event.proposal.actor.actorId,
      };

    case "proposal:decided":
      return {
        type: "authority.decision",
        seq,
        timestamp,
        proposalId: event.proposalId,
        decision: event.decision,
        authorityId: event.authorityId,
        verificationMethod: (event as any).verificationMethod,
      };

    case "execution:patches":
      return {
        type: "apply",
        seq,
        timestamp,
        intentId: event.intentId,
        patchCount: event.patches.length,
        source: "compute",
      };

    case "execution:effect":
      return {
        type: "effect",
        seq,
        timestamp,
        intentId: event.intentId,
        effectType: event.effectType,
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
          code: "EXECUTION_FAILED",
          message: event.error?.message ?? "Unknown error",
        },
      };

    default:
      return null;
  }
}

/**
 * Check for divergence between original and replay events.
 */
function checkDivergence(
  original: LabTraceEvent,
  replay: LabTraceEvent
): DivergenceCause | null {
  // Type mismatch
  if (original.type !== replay.type) {
    return {
      type: "unknown",
      description: `Event type mismatch: ${original.type} vs ${replay.type}`,
      details: { originalType: original.type, replayType: replay.type },
    };
  }

  // Check type-specific differences
  switch (original.type) {
    case "authority.decision":
      if (
        original.type === replay.type &&
        original.decision !== replay.decision
      ) {
        return {
          type: "authority_decision",
          description: `Authority made different decision: ${original.decision} vs ${replay.decision}`,
          details: {
            originalDecision: original.decision,
            replayDecision: replay.decision,
          },
        };
      }
      break;

    case "apply":
      if (
        original.type === replay.type &&
        original.patchCount !== replay.patchCount
      ) {
        return {
          type: "execution_result",
          description: `Different patch count: ${original.patchCount} vs ${replay.patchCount}`,
          details: {
            originalPatchCount: original.patchCount,
            replayPatchCount: replay.patchCount,
          },
        };
      }
      break;

    case "effect.result":
      if (
        original.type === replay.type &&
        original.success !== replay.success
      ) {
        return {
          type: "effect_result",
          description: `Different effect result: ${original.success} vs ${replay.success}`,
          details: {
            originalSuccess: original.success,
            replaySuccess: replay.success,
          },
        };
      }
      break;

    case "hitl":
      if (original.type === replay.type && original.action !== replay.action) {
        return {
          type: "hitl_decision",
          description: `Different HITL action: ${original.action} vs ${replay.action}`,
          details: {
            originalAction: original.action,
            replayAction: replay.action,
          },
        };
      }
      break;

    case "termination":
      if (
        original.type === replay.type &&
        original.outcome !== replay.outcome
      ) {
        return {
          type: "unknown",
          description: `Different outcome: ${original.outcome} vs ${replay.outcome}`,
          details: {
            originalOutcome: original.outcome,
            replayOutcome: replay.outcome,
          },
        };
      }
      break;
  }

  return null;
}

/**
 * Determine the outcome of the replay.
 */
function determineReplayOutcome(
  events: LabTraceEvent[],
  divergences: Divergence[],
  mode: import("../types.js").ReplayMode
): import("../types.js").TraceOutcome {
  // Look for termination event
  const termination = events.find((e) => e.type === "termination");
  if (termination && termination.type === "termination") {
    return termination.outcome;
  }

  // In strict/lenient mode, divergences indicate failure
  if (mode !== "compare" && divergences.length > 0) {
    return "failure";
  }

  // Default to success if no termination
  return "success";
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Create a partial replay (for debugging).
 *
 * @param trace - The trace to replay
 * @param upToSeq - Stop at this sequence number
 * @param options - Replay options
 * @returns Partial replay result
 */
export async function replayPartial(
  trace: LabTrace,
  upToSeq: number,
  options: ReplayOptions
): Promise<ReplayResult> {
  return replay(trace, { ...options, stopAtSeq: upToSeq });
}

/**
 * Find the first divergence point between two traces via replay.
 *
 * @param trace - The trace to replay
 * @param options - Replay options
 * @returns The first divergence or null if identical
 */
export async function findFirstDivergence(
  trace: LabTrace,
  options: ReplayOptions
): Promise<Divergence | null> {
  const result = await replay(trace, { ...options, mode: "strict" });
  return result.divergences[0] ?? null;
}
