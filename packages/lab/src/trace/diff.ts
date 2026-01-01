/**
 * Trace Diff
 *
 * Compare two Lab traces and identify divergence points.
 * Added in v1.1.
 */

import type {
  LabTrace,
  LabTraceEvent,
  TraceDiff,
  EventDiff,
  DivergenceCause,
  DivergenceType,
  TraceOutcome,
} from "../types.js";

// =============================================================================
// Main API
// =============================================================================

/**
 * Compare two traces and identify differences.
 *
 * @param traceA - First trace
 * @param traceB - Second trace
 * @returns Comparison result
 */
export function diffTraces(traceA: LabTrace, traceB: LabTrace): TraceDiff {
  const eventsA = traceA.events;
  const eventsB = traceB.events;

  // Build event-by-event comparison
  const eventDiffs = buildEventDiffs(eventsA, eventsB);

  // Find first divergence point
  const divergencePoint = findDivergencePoint(eventDiffs);

  // Determine if traces are identical
  const identical =
    divergencePoint === null &&
    traceA.outcome === traceB.outcome &&
    eventsA.length === eventsB.length;

  // Get events at divergence point
  let eventA: LabTraceEvent | null = null;
  let eventB: LabTraceEvent | null = null;
  if (divergencePoint !== null) {
    eventA = eventsA[divergencePoint] ?? null;
    eventB = eventsB[divergencePoint] ?? null;
  }

  // Infer cause of divergence
  const cause =
    divergencePoint !== null
      ? inferDivergenceCause(eventA, eventB, eventDiffs, divergencePoint)
      : null;

  return {
    identical,
    divergedAtSeq: divergencePoint,
    eventA,
    eventB,
    cause,
    outcomes: {
      a: traceA.outcome ?? "success",
      b: traceB.outcome ?? "success",
    },
    eventDiffs,
  };
}

// =============================================================================
// Event Comparison
// =============================================================================

/**
 * Build event-by-event comparison.
 */
function buildEventDiffs(
  eventsA: LabTraceEvent[],
  eventsB: LabTraceEvent[]
): EventDiff[] {
  const maxLen = Math.max(eventsA.length, eventsB.length);
  const diffs: EventDiff[] = [];

  for (let i = 0; i < maxLen; i++) {
    const eventA = eventsA[i];
    const eventB = eventsB[i];

    if (!eventA && eventB) {
      diffs.push({
        seq: i,
        status: "only_b",
        eventB,
      });
    } else if (eventA && !eventB) {
      diffs.push({
        seq: i,
        status: "only_a",
        eventA,
      });
    } else if (eventA && eventB) {
      const differences = compareEvents(eventA, eventB);
      diffs.push({
        seq: i,
        status: differences.length === 0 ? "identical" : "different",
        eventA,
        eventB,
        differences: differences.length > 0 ? differences : undefined,
      });
    }
  }

  return diffs;
}

/**
 * Compare two events and return list of differences.
 */
function compareEvents(
  eventA: LabTraceEvent,
  eventB: LabTraceEvent
): string[] {
  const differences: string[] = [];

  // Type must match
  if (eventA.type !== eventB.type) {
    differences.push(`type: ${eventA.type} vs ${eventB.type}`);
    return differences; // No point comparing further if types differ
  }

  // Compare based on event type
  switch (eventA.type) {
    case "proposal":
      if (eventA.type === eventB.type) {
        if (eventA.proposalId !== eventB.proposalId) {
          differences.push(`proposalId: ${eventA.proposalId} vs ${eventB.proposalId}`);
        }
        if (eventA.intentType !== eventB.intentType) {
          differences.push(`intentType: ${eventA.intentType} vs ${eventB.intentType}`);
        }
        if (eventA.actorId !== eventB.actorId) {
          differences.push(`actorId: ${eventA.actorId} vs ${eventB.actorId}`);
        }
      }
      break;

    case "authority.decision":
      if (eventA.type === eventB.type) {
        if (eventA.decision !== eventB.decision) {
          differences.push(`decision: ${eventA.decision} vs ${eventB.decision}`);
        }
        if (eventA.proposalId !== eventB.proposalId) {
          differences.push(`proposalId: ${eventA.proposalId} vs ${eventB.proposalId}`);
        }
      }
      break;

    case "hitl":
      if (eventA.type === eventB.type) {
        if (eventA.action !== eventB.action) {
          differences.push(`action: ${eventA.action} vs ${eventB.action}`);
        }
        if (eventA.proposalId !== eventB.proposalId) {
          differences.push(`proposalId: ${eventA.proposalId} vs ${eventB.proposalId}`);
        }
      }
      break;

    case "termination":
      if (eventA.type === eventB.type) {
        if (eventA.outcome !== eventB.outcome) {
          differences.push(`outcome: ${eventA.outcome} vs ${eventB.outcome}`);
        }
      }
      break;

    case "apply":
      if (eventA.type === eventB.type) {
        if (eventA.patchCount !== eventB.patchCount) {
          differences.push(`patchCount: ${eventA.patchCount} vs ${eventB.patchCount}`);
        }
      }
      break;

    case "effect.result":
      if (eventA.type === eventB.type) {
        if (eventA.success !== eventB.success) {
          differences.push(`success: ${eventA.success} vs ${eventB.success}`);
        }
      }
      break;
  }

  // Note: We intentionally don't compare timestamps as timing differences
  // are expected and not considered semantic differences

  return differences;
}

/**
 * Find the first divergence point.
 */
function findDivergencePoint(diffs: EventDiff[]): number | null {
  for (const diff of diffs) {
    if (diff.status !== "identical") {
      return diff.seq;
    }
  }
  return null;
}

// =============================================================================
// Cause Inference
// =============================================================================

/**
 * Infer the cause of divergence.
 */
function inferDivergenceCause(
  eventA: LabTraceEvent | null,
  eventB: LabTraceEvent | null,
  diffs: EventDiff[],
  divergenceSeq: number
): DivergenceCause {
  // No events at divergence point
  if (!eventA && eventB) {
    return {
      type: "unknown",
      description: `Trace A ended early at sequence ${divergenceSeq}`,
      details: { eventB: summarizeEvent(eventB) },
    };
  }

  if (eventA && !eventB) {
    return {
      type: "unknown",
      description: `Trace B ended early at sequence ${divergenceSeq}`,
      details: { eventA: summarizeEvent(eventA) },
    };
  }

  if (!eventA || !eventB) {
    return {
      type: "unknown",
      description: "Both traces have no event at divergence point",
      details: {},
    };
  }

  // Different event types
  if (eventA.type !== eventB.type) {
    return {
      type: "unknown",
      description: `Different event types: ${eventA.type} vs ${eventB.type}`,
      details: {
        typeA: eventA.type,
        typeB: eventB.type,
      },
    };
  }

  // Same event type - infer specific cause
  return inferSameTypeCause(eventA, eventB);
}

/**
 * Infer cause when events have the same type.
 */
function inferSameTypeCause(
  eventA: LabTraceEvent,
  eventB: LabTraceEvent
): DivergenceCause {
  switch (eventA.type) {
    case "authority.decision":
      if (
        eventA.type === eventB.type &&
        eventA.decision !== eventB.decision
      ) {
        return {
          type: "authority_decision",
          description: `Authority made different decision: ${eventA.decision} vs ${eventB.decision}`,
          details: {
            proposalId: eventA.proposalId,
            decisionA: eventA.decision,
            decisionB: eventB.decision,
          },
        };
      }
      break;

    case "hitl":
      if (eventA.type === eventB.type && eventA.action !== eventB.action) {
        return {
          type: "hitl_decision",
          description: `HITL made different decision: ${eventA.action} vs ${eventB.action}`,
          details: {
            proposalId: eventA.proposalId,
            actionA: eventA.action,
            actionB: eventB.action,
          },
        };
      }
      break;

    case "proposal":
      if (
        eventA.type === eventB.type &&
        eventA.intentType !== eventB.intentType
      ) {
        return {
          type: "proposal_content",
          description: `Different proposal content: ${eventA.intentType} vs ${eventB.intentType}`,
          details: {
            intentTypeA: eventA.intentType,
            intentTypeB: eventB.intentType,
          },
        };
      }
      break;

    case "apply":
      if (
        eventA.type === eventB.type &&
        eventA.patchCount !== eventB.patchCount
      ) {
        return {
          type: "execution_result",
          description: `Different execution result: ${eventA.patchCount} vs ${eventB.patchCount} patches`,
          details: {
            patchCountA: eventA.patchCount,
            patchCountB: eventB.patchCount,
          },
        };
      }
      break;

    case "effect.result":
      if (eventA.type === eventB.type && eventA.success !== eventB.success) {
        return {
          type: "effect_result",
          description: `Different effect result: ${eventA.success ? "success" : "failure"} vs ${eventB.success ? "success" : "failure"}`,
          details: {
            successA: eventA.success,
            successB: eventB.success,
          },
        };
      }
      break;
  }

  // Default unknown cause
  return {
    type: "unknown",
    description: `Divergence in ${eventA.type} event`,
    details: {
      eventTypeA: eventA.type,
      eventTypeB: eventB.type,
    },
  };
}

/**
 * Create a summary of an event for logging/details.
 */
function summarizeEvent(event: LabTraceEvent): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    type: event.type,
    seq: event.seq,
  };

  switch (event.type) {
    case "proposal":
      summary.proposalId = event.proposalId;
      summary.intentType = event.intentType;
      break;
    case "authority.decision":
      summary.proposalId = event.proposalId;
      summary.decision = event.decision;
      break;
    case "hitl":
      summary.proposalId = event.proposalId;
      summary.action = event.action;
      break;
    case "termination":
      summary.outcome = event.outcome;
      break;
  }

  return summary;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Format a trace diff as human-readable text.
 *
 * @param diff - The trace diff
 * @returns Formatted string
 */
export function formatDiff(diff: TraceDiff): string {
  const lines: string[] = [];

  lines.push("=== Trace Diff ===");
  lines.push("");

  if (diff.identical) {
    lines.push("Traces are IDENTICAL");
    return lines.join("\n");
  }

  lines.push("Traces DIVERGED");
  lines.push("");

  lines.push(`Divergence point: sequence ${diff.divergedAtSeq}`);
  lines.push(`Outcomes: A=${diff.outcomes.a}, B=${diff.outcomes.b}`);
  lines.push("");

  if (diff.cause) {
    lines.push(`Cause: ${diff.cause.type}`);
    lines.push(`Description: ${diff.cause.description}`);
    lines.push("");
  }

  // Summary of differences
  const differentCount = diff.eventDiffs.filter(
    (d) => d.status !== "identical"
  ).length;
  const identicalCount = diff.eventDiffs.filter(
    (d) => d.status === "identical"
  ).length;

  lines.push(`Events: ${identicalCount} identical, ${differentCount} different`);
  lines.push("");

  // First few differences
  const differences = diff.eventDiffs.filter((d) => d.status !== "identical");
  for (const d of differences.slice(0, 5)) {
    lines.push(`  [${d.seq}] ${d.status}:`);
    if (d.eventA) lines.push(`    A: ${d.eventA.type}`);
    if (d.eventB) lines.push(`    B: ${d.eventB.type}`);
    if (d.differences) {
      for (const diff of d.differences) {
        lines.push(`      - ${diff}`);
      }
    }
  }

  if (differences.length > 5) {
    lines.push(`  ... and ${differences.length - 5} more differences`);
  }

  return lines.join("\n");
}

/**
 * Check if two traces are identical.
 *
 * @param traceA - First trace
 * @param traceB - Second trace
 * @returns true if traces are identical
 */
export function areTracesIdentical(
  traceA: LabTrace,
  traceB: LabTrace
): boolean {
  return diffTraces(traceA, traceB).identical;
}
