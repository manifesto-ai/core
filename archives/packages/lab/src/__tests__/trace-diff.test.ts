/**
 * Trace Diff Tests
 *
 * Tests for trace comparison functionality (v1.1).
 */

import { describe, it, expect } from "vitest";
import { diffTraces, formatDiff, areTracesIdentical } from "../trace/diff.js";
import type {
  LabTrace,
  LabTraceHeader,
  LabTraceEvent,
} from "../types.js";

// =============================================================================
// Test Fixtures
// =============================================================================

function createHeader(runId = "test-run"): LabTraceHeader {
  return {
    specVersion: "lab/1.1",
    runId,
    necessityLevel: 0,
    schemaHash: "test-hash",
    createdAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:01:00.000Z",
    durationMs: 60000,
  };
}

function createProposalEvent(seq: number, intentType = "test.action"): LabTraceEvent {
  return {
    type: "proposal",
    seq,
    timestamp: `2024-01-01T00:00:${String(seq * 10).padStart(2, "0")}.000Z`,
    proposalId: `p-${seq}`,
    intentType,
    actorId: "test-actor",
  };
}

function createDecisionEvent(
  seq: number,
  decision: "approved" | "rejected" | "pending" = "approved"
): LabTraceEvent {
  return {
    type: "authority.decision",
    seq,
    timestamp: `2024-01-01T00:00:${String(seq * 10).padStart(2, "0")}.000Z`,
    proposalId: `p-${seq - 1}`,
    decision,
    authorityId: "test-authority",
  };
}

function createTerminationEvent(
  seq: number,
  outcome: "success" | "failure" = "success"
): LabTraceEvent {
  return {
    type: "termination",
    seq,
    timestamp: `2024-01-01T00:01:00.000Z`,
    outcome,
  };
}

function createHITLEvent(
  seq: number,
  action: "pending" | "approved" | "rejected" | "timeout" = "pending"
): LabTraceEvent {
  return {
    type: "hitl",
    seq,
    timestamp: `2024-01-01T00:00:${String(seq * 10).padStart(2, "0")}.000Z`,
    proposalId: `p-${seq - 1}`,
    action,
  };
}

function createApplyEvent(seq: number, patchCount = 1): LabTraceEvent {
  return {
    type: "apply",
    seq,
    timestamp: `2024-01-01T00:00:${String(seq * 10).padStart(2, "0")}.000Z`,
    intentId: `intent-${seq}`,
    patchCount,
    source: "compute",
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe("diffTraces", () => {
  describe("identical traces", () => {
    it("identifies identical traces", () => {
      const events: LabTraceEvent[] = [
        createProposalEvent(0),
        createDecisionEvent(1),
        createTerminationEvent(2),
      ];

      const traceA: LabTrace = {
        header: createHeader("run-a"),
        events: [...events],
        outcome: "success",
      };

      const traceB: LabTrace = {
        header: createHeader("run-b"),
        events: [...events],
        outcome: "success",
      };

      const diff = diffTraces(traceA, traceB);

      expect(diff.identical).toBe(true);
      expect(diff.divergedAtSeq).toBe(null);
      expect(diff.cause).toBe(null);
    });

    it("reports all events as identical", () => {
      const events: LabTraceEvent[] = [
        createProposalEvent(0),
        createDecisionEvent(1),
        createTerminationEvent(2),
      ];

      const traceA: LabTrace = {
        header: createHeader(),
        events: [...events],
        outcome: "success",
      };

      const traceB: LabTrace = {
        header: createHeader(),
        events: [...events],
        outcome: "success",
      };

      const diff = diffTraces(traceA, traceB);

      expect(diff.eventDiffs.length).toBe(3);
      expect(diff.eventDiffs.every((d) => d.status === "identical")).toBe(true);
    });
  });

  describe("divergent traces", () => {
    it("identifies divergence in authority decision", () => {
      const traceA: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0),
          createDecisionEvent(1, "approved"),
          createTerminationEvent(2),
        ],
        outcome: "success",
      };

      const traceB: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0),
          createDecisionEvent(1, "rejected"),
          createTerminationEvent(2, "failure"),
        ],
        outcome: "failure",
      };

      const diff = diffTraces(traceA, traceB);

      expect(diff.identical).toBe(false);
      expect(diff.divergedAtSeq).toBe(1);
      expect(diff.cause?.type).toBe("authority_decision");
      expect(diff.outcomes.a).toBe("success");
      expect(diff.outcomes.b).toBe("failure");
    });

    it("identifies divergence in HITL decision", () => {
      const traceA: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0),
          createHITLEvent(1, "pending"),
          createHITLEvent(2, "approved"),
          createTerminationEvent(3),
        ],
        outcome: "success",
      };

      const traceB: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0),
          createHITLEvent(1, "pending"),
          createHITLEvent(2, "rejected"),
          createTerminationEvent(3, "failure"),
        ],
        outcome: "failure",
      };

      const diff = diffTraces(traceA, traceB);

      expect(diff.identical).toBe(false);
      expect(diff.divergedAtSeq).toBe(2);
      expect(diff.cause?.type).toBe("hitl_decision");
    });

    it("identifies divergence in proposal content", () => {
      const traceA: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0, "item.add"),
          createTerminationEvent(1),
        ],
        outcome: "success",
      };

      const traceB: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0, "item.remove"),
          createTerminationEvent(1),
        ],
        outcome: "success",
      };

      const diff = diffTraces(traceA, traceB);

      expect(diff.identical).toBe(false);
      expect(diff.divergedAtSeq).toBe(0);
      expect(diff.cause?.type).toBe("proposal_content");
    });

    it("identifies divergence in execution result", () => {
      const traceA: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0),
          createApplyEvent(1, 3),
          createTerminationEvent(2),
        ],
        outcome: "success",
      };

      const traceB: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0),
          createApplyEvent(1, 5),
          createTerminationEvent(2),
        ],
        outcome: "success",
      };

      const diff = diffTraces(traceA, traceB);

      expect(diff.identical).toBe(false);
      expect(diff.divergedAtSeq).toBe(1);
      expect(diff.cause?.type).toBe("execution_result");
    });
  });

  describe("different lengths", () => {
    it("handles trace A being longer", () => {
      const traceA: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0),
          createDecisionEvent(1),
          createTerminationEvent(2),
        ],
        outcome: "success",
      };

      const traceB: LabTrace = {
        header: createHeader(),
        events: [createProposalEvent(0)],
        outcome: "success",
      };

      const diff = diffTraces(traceA, traceB);

      expect(diff.identical).toBe(false);
      expect(diff.divergedAtSeq).toBe(1);
      expect(diff.eventDiffs[1].status).toBe("only_a");
      expect(diff.eventDiffs[2].status).toBe("only_a");
    });

    it("handles trace B being longer", () => {
      const traceA: LabTrace = {
        header: createHeader(),
        events: [createProposalEvent(0)],
        outcome: "success",
      };

      const traceB: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0),
          createDecisionEvent(1),
          createTerminationEvent(2),
        ],
        outcome: "success",
      };

      const diff = diffTraces(traceA, traceB);

      expect(diff.identical).toBe(false);
      expect(diff.divergedAtSeq).toBe(1);
      expect(diff.eventDiffs[1].status).toBe("only_b");
      expect(diff.eventDiffs[2].status).toBe("only_b");
    });

    it("handles empty trace A", () => {
      const traceA: LabTrace = {
        header: createHeader(),
        events: [],
        outcome: "success",
      };

      const traceB: LabTrace = {
        header: createHeader(),
        events: [createProposalEvent(0)],
        outcome: "success",
      };

      const diff = diffTraces(traceA, traceB);

      expect(diff.identical).toBe(false);
      expect(diff.divergedAtSeq).toBe(0);
      expect(diff.eventDiffs[0].status).toBe("only_b");
    });
  });

  describe("outcome differences", () => {
    it("reports different outcomes", () => {
      const events: LabTraceEvent[] = [
        createProposalEvent(0),
        createTerminationEvent(1, "success"),
      ];

      const traceA: LabTrace = {
        header: createHeader(),
        events: [...events],
        outcome: "success",
      };

      const eventsB: LabTraceEvent[] = [
        createProposalEvent(0),
        createTerminationEvent(1, "failure"),
      ];

      const traceB: LabTrace = {
        header: createHeader(),
        events: eventsB,
        outcome: "failure",
      };

      const diff = diffTraces(traceA, traceB);

      expect(diff.identical).toBe(false);
      expect(diff.outcomes.a).toBe("success");
      expect(diff.outcomes.b).toBe("failure");
    });
  });

  describe("event details", () => {
    it("provides differences list for divergent events", () => {
      const traceA: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0, "item.add"),
          createDecisionEvent(1, "approved"),
        ],
        outcome: "success",
      };

      const traceB: LabTrace = {
        header: createHeader(),
        events: [
          createProposalEvent(0, "item.remove"),
          createDecisionEvent(1, "rejected"),
        ],
        outcome: "failure",
      };

      const diff = diffTraces(traceA, traceB);

      expect(diff.eventDiffs[0].differences).toBeDefined();
      expect(diff.eventDiffs[0].differences?.length).toBeGreaterThan(0);
    });
  });
});

describe("formatDiff", () => {
  it("formats identical traces", () => {
    const events: LabTraceEvent[] = [createProposalEvent(0)];

    const traceA: LabTrace = {
      header: createHeader(),
      events: [...events],
      outcome: "success",
    };

    const traceB: LabTrace = {
      header: createHeader(),
      events: [...events],
      outcome: "success",
    };

    const diff = diffTraces(traceA, traceB);
    const text = formatDiff(diff);

    expect(text).toContain("IDENTICAL");
  });

  it("formats divergent traces", () => {
    const traceA: LabTrace = {
      header: createHeader(),
      events: [
        createProposalEvent(0),
        createDecisionEvent(1, "approved"),
      ],
      outcome: "success",
    };

    const traceB: LabTrace = {
      header: createHeader(),
      events: [
        createProposalEvent(0),
        createDecisionEvent(1, "rejected"),
      ],
      outcome: "failure",
    };

    const diff = diffTraces(traceA, traceB);
    const text = formatDiff(diff);

    expect(text).toContain("DIVERGED");
    expect(text).toContain("sequence 1");
    expect(text).toContain("authority_decision");
  });
});

describe("areTracesIdentical", () => {
  it("returns true for identical traces", () => {
    const events: LabTraceEvent[] = [createProposalEvent(0)];

    const traceA: LabTrace = {
      header: createHeader(),
      events: [...events],
      outcome: "success",
    };

    const traceB: LabTrace = {
      header: createHeader(),
      events: [...events],
      outcome: "success",
    };

    expect(areTracesIdentical(traceA, traceB)).toBe(true);
  });

  it("returns false for different traces", () => {
    const traceA: LabTrace = {
      header: createHeader(),
      events: [createProposalEvent(0, "item.add")],
      outcome: "success",
    };

    const traceB: LabTrace = {
      header: createHeader(),
      events: [createProposalEvent(0, "item.remove")],
      outcome: "success",
    };

    expect(areTracesIdentical(traceA, traceB)).toBe(false);
  });
});
