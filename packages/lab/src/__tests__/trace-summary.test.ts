/**
 * Trace Summary Tests
 *
 * Tests for trace summarization functionality (v1.1).
 */

import { describe, it, expect } from "vitest";
import { summarize, formatSummary } from "../trace/summary.js";
import type {
  LabTrace,
  LabTraceHeader,
  LabTraceEvent,
  NecessityLevel,
} from "../types.js";

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestTrace(options: {
  runId?: string;
  level?: NecessityLevel;
  outcome?: "success" | "failure" | "aborted";
  durationMs?: number;
  events?: LabTraceEvent[];
}): LabTrace {
  const header: LabTraceHeader = {
    specVersion: "lab/1.1",
    runId: options.runId ?? "test-run",
    necessityLevel: options.level ?? 0,
    schemaHash: "test-hash",
    createdAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:01:00.000Z",
    durationMs: options.durationMs ?? 60000,
  };

  const events: LabTraceEvent[] = options.events ?? [
    {
      type: "proposal",
      seq: 0,
      timestamp: "2024-01-01T00:00:10.000Z",
      proposalId: "p-1",
      intentType: "test.action",
      actorId: "test-actor",
    },
    {
      type: "authority.decision",
      seq: 1,
      timestamp: "2024-01-01T00:00:20.000Z",
      proposalId: "p-1",
      decision: "approved",
      authorityId: "test-authority",
    },
    {
      type: "termination",
      seq: 2,
      timestamp: "2024-01-01T00:01:00.000Z",
      outcome: options.outcome === "failure" ? "failure" : "success",
    },
  ];

  return {
    header,
    events,
    outcome: options.outcome ?? "success",
  };
}

function createTraceWithHITL(): LabTrace {
  const header: LabTraceHeader = {
    specVersion: "lab/1.1",
    runId: "hitl-run",
    necessityLevel: 2,
    schemaHash: "test-hash",
    createdAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:05:00.000Z",
    durationMs: 300000,
  };

  const events: LabTraceEvent[] = [
    {
      type: "proposal",
      seq: 0,
      timestamp: "2024-01-01T00:00:10.000Z",
      proposalId: "p-1",
      intentType: "test.action",
      actorId: "llm-fact-proposer",
    },
    {
      type: "hitl",
      seq: 1,
      timestamp: "2024-01-01T00:00:20.000Z",
      proposalId: "p-1",
      action: "pending",
    },
    {
      type: "hitl",
      seq: 2,
      timestamp: "2024-01-01T00:01:00.000Z",
      proposalId: "p-1",
      action: "approved",
      decidedBy: "human-1",
      decisionTimeMs: 40000,
    },
    {
      type: "proposal",
      seq: 3,
      timestamp: "2024-01-01T00:02:00.000Z",
      proposalId: "p-2",
      intentType: "test.action2",
      actorId: "llm-belief-proposer",
    },
    {
      type: "hitl",
      seq: 4,
      timestamp: "2024-01-01T00:02:10.000Z",
      proposalId: "p-2",
      action: "pending",
    },
    {
      type: "hitl",
      seq: 5,
      timestamp: "2024-01-01T00:02:30.000Z",
      proposalId: "p-2",
      action: "rejected",
      decidedBy: "human-1",
      decisionTimeMs: 20000,
    },
    {
      type: "termination",
      seq: 6,
      timestamp: "2024-01-01T00:05:00.000Z",
      outcome: "success",
    },
  ];

  return {
    header,
    events,
    outcome: "success",
  };
}

function createFailedTrace(): LabTrace {
  const header: LabTraceHeader = {
    specVersion: "lab/1.1",
    runId: "failed-run",
    necessityLevel: 1,
    schemaHash: "test-hash",
    createdAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:00:30.000Z",
    durationMs: 30000,
  };

  const events: LabTraceEvent[] = [
    {
      type: "proposal",
      seq: 0,
      timestamp: "2024-01-01T00:00:10.000Z",
      proposalId: "p-1",
      intentType: "test.action",
      actorId: "test-actor",
    },
    {
      type: "failure.explanation",
      seq: 1,
      timestamp: "2024-01-01T00:00:20.000Z",
      explanation: {
        reason: "GOAL_UNREACHABLE",
        description: "Goal cannot be reached",
      },
    },
    {
      type: "termination",
      seq: 2,
      timestamp: "2024-01-01T00:00:30.000Z",
      outcome: "failure",
    },
  ];

  return {
    header,
    events,
    outcome: "failure",
    failureExplanation: {
      kind: "informational" as const,
      title: "Goal Unreachable",
      description: "Goal cannot be reached",
      evidence: [],
    },
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe("summarize", () => {
  describe("single trace", () => {
    it("summarizes a single successful trace", () => {
      const trace = createTestTrace({ outcome: "success", durationMs: 60000 });
      const summary = summarize(trace);

      expect(summary.runs).toBe(1);
      expect(summary.successRate).toBe(1);
      expect(summary.avgSteps).toBe(1); // 1 proposal event
      expect(summary.avgDurationMs).toBe(60000);
    });

    it("summarizes a single failed trace", () => {
      const trace = createFailedTrace();
      const summary = summarize(trace);

      expect(summary.runs).toBe(1);
      expect(summary.successRate).toBe(0);
      expect(summary.failureReasons).toHaveProperty("GOAL_UNREACHABLE");
      expect(summary.failureReasons["GOAL_UNREACHABLE"]).toBe(1);
    });

    it("tracks by necessity level", () => {
      const trace = createTestTrace({ level: 2 });
      const summary = summarize(trace);

      expect(summary.byLevel[2].runs).toBe(1);
      expect(summary.byLevel[2].successRate).toBe(1);
      expect(summary.byLevel[0].runs).toBe(0);
    });
  });

  describe("multiple traces", () => {
    it("summarizes multiple traces", () => {
      const traces = [
        createTestTrace({ runId: "run-1", outcome: "success", durationMs: 60000 }),
        createTestTrace({ runId: "run-2", outcome: "success", durationMs: 120000 }),
        createTestTrace({ runId: "run-3", outcome: "failure", durationMs: 30000 }),
      ];

      const summary = summarize(traces);

      expect(summary.runs).toBe(3);
      expect(summary.successRate).toBeCloseTo(2 / 3);
      expect(summary.avgDurationMs).toBeCloseTo((60000 + 120000 + 30000) / 3);
    });

    it("aggregates by necessity level", () => {
      const traces = [
        createTestTrace({ level: 0, outcome: "success" }),
        createTestTrace({ level: 0, outcome: "success" }),
        createTestTrace({ level: 1, outcome: "success" }),
        createTestTrace({ level: 1, outcome: "failure" }),
        createTestTrace({ level: 2, outcome: "failure" }),
      ];

      const summary = summarize(traces);

      expect(summary.byLevel[0].runs).toBe(2);
      expect(summary.byLevel[0].successRate).toBe(1);
      expect(summary.byLevel[1].runs).toBe(2);
      expect(summary.byLevel[1].successRate).toBe(0.5);
      expect(summary.byLevel[2].runs).toBe(1);
      expect(summary.byLevel[2].successRate).toBe(0);
    });

    it("aggregates failure reasons", () => {
      const trace1 = createFailedTrace();
      const trace2: LabTrace = {
        ...createFailedTrace(),
        header: { ...createFailedTrace().header, runId: "run-2" },
        failureExplanation: {
          kind: "structural" as const,
          title: "No Executable Action",
          description: "No action available",
          evidence: [],
        },
      };

      const summary = summarize([trace1, trace2]);

      expect(summary.failureReasons["GOAL_UNREACHABLE"]).toBe(1);
      expect(summary.failureReasons["NO_EXECUTABLE_ACTION"]).toBe(1);
    });
  });

  describe("HITL statistics", () => {
    it("tracks HITL events", () => {
      const trace = createTraceWithHITL();
      const summary = summarize(trace);

      expect(summary.hitl.triggered).toBe(2);
      expect(summary.hitl.approved).toBe(1);
      expect(summary.hitl.rejected).toBe(1);
      expect(summary.hitl.timedOut).toBe(0);
    });

    it("calculates average decision time", () => {
      const trace = createTraceWithHITL();
      const summary = summarize(trace);

      // (40000 + 20000) / 2 = 30000
      expect(summary.hitl.avgDecisionTimeMs).toBe(30000);
    });

    it("calculates HITL rate", () => {
      const trace = createTraceWithHITL();
      const summary = summarize(trace);

      // 2 HITL triggers / 2 proposals = 1.0
      expect(summary.hitl.hitlRate).toBe(1);
    });
  });

  describe("LLM statistics", () => {
    it("detects LLM proposals by actor ID", () => {
      const trace = createTraceWithHITL();
      const summary = summarize(trace);

      expect(summary.llm.totalProposals).toBe(2);
    });

    it("tracks by LLM role", () => {
      const trace = createTraceWithHITL();
      const summary = summarize(trace);

      expect(summary.llm.byRole.fact_proposer.proposals).toBe(1);
      expect(summary.llm.byRole.belief_proposer.proposals).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("handles empty trace array", () => {
      const summary = summarize([]);

      expect(summary.runs).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.avgSteps).toBe(0);
    });

    it("handles trace with no events", () => {
      const trace = createTestTrace({ events: [] });
      const summary = summarize(trace);

      expect(summary.runs).toBe(1);
      expect(summary.avgSteps).toBe(0);
    });

    it("handles trace with no duration", () => {
      const trace = createTestTrace({});
      // Manually remove durationMs to simulate missing value
      delete (trace.header as Record<string, unknown>).durationMs;
      const summary = summarize(trace);

      expect(summary.avgDurationMs).toBe(0);
    });
  });
});

describe("formatSummary", () => {
  it("formats summary as readable text", () => {
    const trace = createTestTrace({});
    const summary = summarize(trace);
    const text = formatSummary(summary);

    expect(text).toContain("Trace Summary");
    expect(text).toContain("Runs: 1");
    expect(text).toContain("Success Rate: 100.0%");
    expect(text).toContain("HITL:");
    expect(text).toContain("LLM:");
  });

  it("includes level breakdown", () => {
    const trace = createTestTrace({ level: 2 });
    const summary = summarize(trace);
    const text = formatSummary(summary);

    expect(text).toContain("Level 2:");
    expect(text).toContain("1 runs");
  });

  it("includes failure reasons when present", () => {
    const trace = createFailedTrace();
    const summary = summarize(trace);
    const text = formatSummary(summary);

    expect(text).toContain("Failure Reasons:");
    expect(text).toContain("GOAL_UNREACHABLE");
  });
});
