/**
 * HCTS Assertion Utilities
 *
 * Provides assertion helpers for verifying SPEC compliance rules
 * based on trace events.
 *
 * @see host-SPEC-v2.0.1.md
 */

import { expect } from "vitest";
import type { TraceEvent, ExecutionKey, ComplianceResult } from "./hcts-types.js";
import type { Snapshot } from "@manifesto-ai/core";

// =============================================================================
// Runner / Liveness Assertions (RUN-1~4, LIVE-1~4)
// =============================================================================

/**
 * Assert that no two runners are active simultaneously for the same key
 * @see SPEC RUN-1, RUN-2, INV-EX-4
 */
export function assertSingleRunner(
  trace: TraceEvent[],
  key: ExecutionKey
): ComplianceResult {
  const keyEvents = trace.filter(
    (e) => e.key === key && (e.t === "runner:start" || e.t === "runner:end")
  );

  let activeCount = 0;
  let maxConcurrent = 0;
  const violations: TraceEvent[] = [];

  for (const event of keyEvents) {
    if (event.t === "runner:start") {
      activeCount++;
      if (activeCount > 1) {
        violations.push(event);
      }
      maxConcurrent = Math.max(maxConcurrent, activeCount);
    } else if (event.t === "runner:end") {
      activeCount--;
    }
  }

  if (violations.length > 0) {
    return {
      ruleId: "RUN-1",
      status: "FAIL",
      message: `Multiple concurrent runners detected for key "${key}"`,
      evidence: violations,
    };
  }

  return {
    ruleId: "RUN-1",
    status: "PASS",
  };
}

/**
 * Assert that runner kicked on empty->non-empty transition
 * @see SPEC LIVE-2
 */
export function assertEmptyToNonEmptyKick(
  trace: TraceEvent[],
  key: ExecutionKey
): ComplianceResult {
  // If there's a job:start, there must have been a runner:start before it
  const keyEvents = trace.filter((e) => e.key === key);

  const hasJob = keyEvents.some((e) => e.t === "job:start");
  const hasRunnerStart = keyEvents.some((e) => e.t === "runner:start");

  if (hasJob && !hasRunnerStart) {
    return {
      ruleId: "LIVE-2",
      status: "FAIL",
      message: "Job executed without runner being started (kick missing)",
      evidence: keyEvents.filter((e) => e.t === "job:start"),
    };
  }

  return {
    ruleId: "LIVE-2",
    status: "PASS",
  };
}

/**
 * Assert that runner re-checks queue before releasing guard
 * @see SPEC RUN-4, LIVE-4
 */
export function assertLostWakeupPrevention(
  trace: TraceEvent[],
  key: ExecutionKey
): ComplianceResult {
  const recheckEvents = trace.filter(
    (e) => e.key === key && e.t === "runner:recheck"
  );

  // This is a SHOULD assertion - presence of recheck events is good
  // Absence doesn't necessarily mean failure (may not be observable)
  if (recheckEvents.length > 0) {
    return {
      ruleId: "RUN-4/LIVE-4",
      status: "PASS",
      message: "Runner recheck observed before guard release",
    };
  }

  return {
    ruleId: "RUN-4/LIVE-4",
    status: "WARN",
    message: "Runner recheck events not observed (may not be instrumented)",
  };
}

// =============================================================================
// Job Assertions (JOB-1~5)
// =============================================================================

/**
 * Assert that jobs run to completion without interleaving
 * @see SPEC JOB-1, JOB-2, INV-EX-3
 */
export function assertRunToCompletion(
  trace: TraceEvent[],
  key: ExecutionKey
): ComplianceResult {
  const keyEvents = trace.filter(
    (e) => e.key === key && (e.t === "job:start" || e.t === "job:end")
  );

  const activeJobs: string[] = [];
  const violations: TraceEvent[] = [];

  for (const event of keyEvents) {
    if (event.t === "job:start") {
      if (activeJobs.length > 0) {
        // Another job started while one was active
        violations.push(event);
      }
      activeJobs.push(event.jobId);
    } else if (event.t === "job:end") {
      const idx = activeJobs.indexOf(event.jobId);
      if (idx !== -1) {
        activeJobs.splice(idx, 1);
      }
    }
  }

  if (violations.length > 0) {
    return {
      ruleId: "JOB-1",
      status: "FAIL",
      message: "Job interleaving detected (await in job handler?)",
      evidence: violations,
    };
  }

  return {
    ruleId: "JOB-1",
    status: "PASS",
  };
}

// =============================================================================
// Interlock Assertions (COMP-REQ-INTERLOCK-1~2)
// =============================================================================

/**
 * Assert that compute patches are applied before effect dispatch
 * @see SPEC COMP-REQ-INTERLOCK-1, INV-EX-15
 */
export function assertApplyBeforeDispatch(
  trace: TraceEvent[],
  key: ExecutionKey
): ComplianceResult {
  const keyEvents = trace.filter((e) => e.key === key);
  const violations: TraceEvent[] = [];

  // Find sequences of compute -> apply -> dispatch
  let lastCompute: TraceEvent | null = null;
  let appliedAfterCompute = false;

  for (const event of keyEvents) {
    if (event.t === "core:compute") {
      lastCompute = event;
      appliedAfterCompute = false;
    } else if (event.t === "core:apply" && event.source === "compute") {
      appliedAfterCompute = true;
    } else if (event.t === "effect:dispatch") {
      if (lastCompute && !appliedAfterCompute) {
        violations.push(event);
      }
    }
  }

  if (violations.length > 0) {
    return {
      ruleId: "COMP-REQ-INTERLOCK-1",
      status: "FAIL",
      message: "Effect dispatch occurred before compute patches were applied",
      evidence: violations,
    };
  }

  return {
    ruleId: "COMP-REQ-INTERLOCK-1",
    status: "PASS",
  };
}

// =============================================================================
// Requirement Lifecycle Assertions (REQ-CLEAR-1, INV-RL-2)
// =============================================================================

/**
 * Assert that requirements are cleared after fulfillment
 * @see SPEC REQ-CLEAR-1, INV-RL-2
 */
export function assertRequirementCleared(
  snapshot: Snapshot,
  requirementId: string
): ComplianceResult {
  const isPending = snapshot.system.pendingRequirements.some(
    (r) => r.id === requirementId
  );

  if (isPending) {
    return {
      ruleId: "REQ-CLEAR-1",
      status: "FAIL",
      message: `Requirement "${requirementId}" still in pendingRequirements after fulfillment`,
    };
  }

  return {
    ruleId: "REQ-CLEAR-1",
    status: "PASS",
  };
}

/**
 * Assert that requirement was only executed once (no infinite loop)
 * @see SPEC REQ-CLEAR-1
 */
export function assertNoInfiniteLoop(
  trace: TraceEvent[],
  requirementId: string,
  maxExecutions: number = 1
): ComplianceResult {
  const dispatchEvents = trace.filter(
    (e) => e.t === "effect:dispatch" && e.requirementId === requirementId
  );

  if (dispatchEvents.length > maxExecutions) {
    return {
      ruleId: "REQ-CLEAR-1",
      status: "FAIL",
      message: `Requirement "${requirementId}" executed ${dispatchEvents.length} times (infinite loop?)`,
      evidence: dispatchEvents,
    };
  }

  return {
    ruleId: "REQ-CLEAR-1",
    status: "PASS",
  };
}

// =============================================================================
// FulfillEffect Assertions (FULFILL-0~4, ERR-FE-1~5)
// =============================================================================

/**
 * Assert that stale fulfillments are dropped
 * @see SPEC FULFILL-0, INV-EX-13
 */
export function assertStaleFulfillmentDropped(
  trace: TraceEvent[],
  requirementId: string
): ComplianceResult {
  const dropEvents = trace.filter(
    (e) =>
      e.t === "effect:fulfill:drop" &&
      e.requirementId === requirementId &&
      e.reason === "stale"
  );

  if (dropEvents.length > 0) {
    return {
      ruleId: "FULFILL-0",
      status: "PASS",
      message: "Stale fulfillment correctly dropped",
    };
  }

  // Check if there was an apply event (which would be wrong)
  const applyEvents = trace.filter(
    (e) => e.t === "effect:fulfill:apply" && e.requirementId === requirementId
  );

  if (applyEvents.length > 0) {
    return {
      ruleId: "FULFILL-0",
      status: "FAIL",
      message: "Stale fulfillment was applied instead of dropped",
      evidence: applyEvents,
    };
  }

  return {
    ruleId: "FULFILL-0",
    status: "WARN",
    message: "Could not verify stale fulfillment handling",
  };
}

/**
 * Assert that apply failure still results in requirement clear
 * @see SPEC ERR-FE-1, ERR-FE-2, INV-EX-12, INV-EX-14
 */
export function assertClearOnApplyFailure(
  trace: TraceEvent[],
  snapshot: Snapshot,
  requirementId: string
): ComplianceResult {
  const errorEvents = trace.filter(
    (e) => e.t === "effect:fulfill:error" && e.requirementId === requirementId
  );

  if (errorEvents.length === 0) {
    return {
      ruleId: "ERR-FE-2",
      status: "SKIP",
      message: "No apply error occurred to test",
    };
  }

  // Even after error, requirement should be cleared
  const clearEvents = trace.filter(
    (e) => e.t === "requirement:clear" && e.requirementId === requirementId
  );

  if (clearEvents.length === 0) {
    return {
      ruleId: "ERR-FE-2",
      status: "FAIL",
      message: "Requirement not cleared after apply failure",
      evidence: errorEvents,
    };
  }

  // Also verify it's not in snapshot
  const isPending = snapshot.system.pendingRequirements.some(
    (r) => r.id === requirementId
  );

  if (isPending) {
    return {
      ruleId: "ERR-FE-2",
      status: "FAIL",
      message: "Requirement still pending in snapshot after apply failure",
    };
  }

  return {
    ruleId: "ERR-FE-2",
    status: "PASS",
  };
}

/**
 * Assert that continue is enqueued even on error
 * @see SPEC ERR-FE-5, INV-EX-17
 */
export function assertContinueAfterError(
  trace: TraceEvent[],
  intentId: string
): ComplianceResult {
  const errorEvents = trace.filter((e) => e.t === "effect:fulfill:error");

  if (errorEvents.length === 0) {
    return {
      ruleId: "ERR-FE-5",
      status: "SKIP",
      message: "No error occurred to test",
    };
  }

  // Check for continue:enqueue after the error
  const continueEvents = trace.filter(
    (e) => e.t === "continue:enqueue" && e.intentId === intentId
  );

  if (continueEvents.length === 0) {
    return {
      ruleId: "ERR-FE-5",
      status: "FAIL",
      message: "ContinueCompute not enqueued after error",
    };
  }

  return {
    ruleId: "ERR-FE-5",
    status: "PASS",
  };
}

// =============================================================================
// Context Determinism Assertions (CTX-1~5)
// =============================================================================

/**
 * Type guard for context:frozen events
 */
function isContextFrozenEvent(
  event: TraceEvent
): event is TraceEvent & {
  t: "context:frozen";
  jobId: string;
  now: number;
  randomSeed: string;
} {
  return event.t === "context:frozen";
}

/**
 * Assert that context is frozen per job
 * @see SPEC CTX-1, CTX-2, INV-CTX-1, INV-CTX-2
 */
export function assertContextFrozenPerJob(
  trace: TraceEvent[],
  key: ExecutionKey
): ComplianceResult {
  const contextEvents = trace.filter(
    (e): e is TraceEvent & {
      t: "context:frozen";
      jobId: string;
      now: number;
      randomSeed: string;
    } => e.key === key && isContextFrozenEvent(e)
  );

  // Group context events by jobId and verify same values
  const contextsByJob = new Map<string, typeof contextEvents>();

  for (const event of contextEvents) {
    const existing = contextsByJob.get(event.jobId) ?? [];
    existing.push(event);
    contextsByJob.set(event.jobId, existing);
  }

  for (const [jobId, events] of contextsByJob) {
    if (events.length > 1) {
      // Multiple context captures for same job - check they're identical
      const first = events[0];
      for (let i = 1; i < events.length; i++) {
        const current = events[i];
        if (
          current.now !== first.now ||
          current.randomSeed !== first.randomSeed
        ) {
          return {
            ruleId: "CTX-1",
            status: "FAIL",
            message: `Context changed during job "${jobId}"`,
            evidence: events,
          };
        }
      }
    }
  }

  return {
    ruleId: "CTX-1",
    status: "PASS",
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Filter trace events by execution key
 */
export function filterByKey(
  trace: TraceEvent[],
  key: ExecutionKey
): TraceEvent[] {
  return trace.filter((e) => e.key === key);
}

/**
 * Get all unique execution keys from trace
 */
export function getExecutionKeys(trace: TraceEvent[]): ExecutionKey[] {
  return [...new Set(trace.map((e) => e.key))];
}

/**
 * Extract event timeline for debugging
 */
export function formatTimeline(trace: TraceEvent[]): string {
  return trace
    .map((e) => {
      const key = e.key.substring(0, 8);
      switch (e.t) {
        case "runner:start":
          return `[${key}] RUNNER START @ ${e.timestamp}`;
        case "runner:end":
          return `[${key}] RUNNER END @ ${e.timestamp}`;
        case "job:start":
          return `[${key}] JOB START: ${e.jobType} (${e.jobId})`;
        case "job:end":
          return `[${key}] JOB END: ${e.jobType} (${e.jobId})`;
        case "core:compute":
          return `[${key}] COMPUTE: ${e.intentId} iter=${e.iteration}`;
        case "core:apply":
          return `[${key}] APPLY: ${e.patchCount} patches (${e.source})`;
        case "effect:dispatch":
          return `[${key}] DISPATCH: ${e.effectType} (${e.requirementId})`;
        case "requirement:clear":
          return `[${key}] CLEAR: ${e.requirementId}`;
        case "continue:enqueue":
          return `[${key}] CONTINUE: ${e.intentId}`;
        default:
          return `[${key}] ${e.t}`;
      }
    })
    .join("\n");
}

/**
 * Assert helper for easier test writing
 */
export function expectCompliance(result: ComplianceResult): void {
  if (result.status === "FAIL") {
    const message = result.message ?? `Rule ${result.ruleId} violated`;
    const evidence = result.evidence
      ? `\n\nEvidence:\n${formatTimeline(result.evidence)}`
      : "";
    expect.fail(`${message}${evidence}`);
  }
}
