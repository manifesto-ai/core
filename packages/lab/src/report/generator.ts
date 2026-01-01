/**
 * Lab Report Generator
 *
 * Generates structured reports from Lab traces.
 */

import type {
  LabOptions,
  LabTrace,
  LabReport,
  FailureExplanation,
  LabTraceEvent,
} from "../types.js";

/**
 * Generate a Lab report from a trace.
 *
 * @param trace - The Lab trace
 * @param options - Lab options
 * @param startedAt - Experiment start timestamp
 * @returns A structured Lab report
 */
export function generateReport(
  trace: LabTrace,
  options: LabOptions,
  startedAt: number = Date.now()
): LabReport {
  const completedAt = new Date().toISOString();
  const duration = Date.now() - startedAt;

  // Calculate summary statistics
  const summary = calculateSummary(trace.events);

  // Determine outcome
  const outcome = determineOutcome(trace.events);

  // Extract failure explanation if present
  const failureExplanation = extractFailureExplanation(trace.events);

  return {
    runId: options.runId,
    necessityLevel: options.necessityLevel,
    startedAt: new Date(startedAt).toISOString(),
    completedAt,
    duration,
    outcome,
    summary,
    failureExplanation,
    trace,
  };
}

/**
 * Calculate summary statistics from trace events.
 */
function calculateSummary(events: LabTraceEvent[]): LabReport["summary"] {
  let totalProposals = 0;
  let approvedProposals = 0;
  let rejectedProposals = 0;
  let hitlInterventions = 0;
  let totalPatches = 0;
  let totalEffects = 0;
  let worldsCreated = 0;

  for (const event of events) {
    switch (event.type) {
      case "proposal":
        totalProposals++;
        break;
      case "authority.decision":
        if (event.decision === "approved") approvedProposals++;
        else if (event.decision === "rejected") rejectedProposals++;
        break;
      case "hitl":
        if (event.action === "approved" || event.action === "rejected") {
          hitlInterventions++;
        }
        break;
      case "apply":
        totalPatches += event.patchCount;
        break;
      case "effect":
        totalEffects++;
        break;
      case "world.created":
        worldsCreated++;
        break;
    }
  }

  return {
    totalProposals,
    approvedProposals,
    rejectedProposals,
    hitlInterventions,
    totalPatches,
    totalEffects,
    worldsCreated,
  };
}

/**
 * Determine the outcome from trace events.
 */
function determineOutcome(
  events: LabTraceEvent[]
): "success" | "failure" | "aborted" {
  // Look for termination event
  const termination = events.find((e) => e.type === "termination");

  if (termination && termination.type === "termination") {
    return termination.outcome;
  }

  // No termination event - check for failure indicators
  const hasFailure = events.some(
    (e) => e.type === "termination" && e.outcome === "failure"
  );

  return hasFailure ? "failure" : "success";
}

/**
 * Extract failure explanation from trace events.
 */
function extractFailureExplanation(
  events: LabTraceEvent[]
): FailureExplanation | undefined {
  const explanationEvent = events.find(
    (e) => e.type === "failure.explanation"
  );

  if (explanationEvent && explanationEvent.type === "failure.explanation") {
    return explanationEvent.explanation;
  }

  return undefined;
}
