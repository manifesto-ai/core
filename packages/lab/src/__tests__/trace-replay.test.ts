/**
 * Trace Replay Tests
 *
 * Tests for trace replay functionality (v1.1).
 */

import { describe, it, expect, vi } from "vitest";
import { replay, replayPartial, findFirstDivergence } from "../trace/replay.js";
import type {
  LabTrace,
  LabTraceHeader,
  LabTraceEvent,
  ReplayOptions,
} from "../types.js";

// =============================================================================
// Mock World
// =============================================================================

function createMockWorld() {
  const handlers: Array<(event: any) => void> = [];

  return {
    subscribe: (handler: (event: any) => void) => {
      handlers.push(handler);
      return () => {
        const index = handlers.indexOf(handler);
        if (index !== -1) handlers.splice(index, 1);
      };
    },
    emit: (event: any) => {
      handlers.forEach((h) => h(event));
    },
    submitProposal: vi.fn().mockResolvedValue({ proposalId: "test" }),
    getProposal: vi.fn().mockResolvedValue(null),
    processHITLDecision: vi.fn().mockResolvedValue(undefined),
  };
}

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestTrace(): LabTrace {
  const header: LabTraceHeader = {
    specVersion: "lab/1.1",
    runId: "test-run-001",
    necessityLevel: 0,
    schemaHash: "test-hash",
    createdAt: "2024-01-01T00:00:00.000Z",
    completedAt: "2024-01-01T00:01:00.000Z",
    durationMs: 60000,
  };

  const events: LabTraceEvent[] = [
    {
      type: "proposal",
      seq: 0,
      timestamp: "2024-01-01T00:00:10.000Z",
      proposalId: "p-1",
      intentType: "item.add",
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
      type: "apply",
      seq: 2,
      timestamp: "2024-01-01T00:00:30.000Z",
      intentId: "intent-1",
      patchCount: 3,
      source: "compute",
    },
    {
      type: "termination",
      seq: 3,
      timestamp: "2024-01-01T00:01:00.000Z",
      outcome: "success",
    },
  ];

  return {
    header,
    events,
    outcome: "success",
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe("replay", () => {
  it("returns a ReplayResult structure", async () => {
    const trace = createTestTrace();
    const world = createMockWorld() as any;

    const result = await replay(trace, { world });

    expect(result).toHaveProperty("trace");
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("diff");
    expect(result).toHaveProperty("divergences");
    expect(result).toHaveProperty("eventsReplayed");
    expect(result).toHaveProperty("eventsRemaining");
  });

  it("creates a replay trace with correct header", async () => {
    const trace = createTestTrace();
    const world = createMockWorld() as any;

    const result = await replay(trace, { world });

    expect(result.trace.header.runId).toBe("replay-test-run-001");
    expect(result.trace.header.necessityLevel).toBe(0);
    expect(result.trace.header.specVersion).toBe("lab/1.1");
    expect(result.trace.header.environment?.replay).toBe(true);
    expect(result.trace.header.environment?.originalRunId).toBe("test-run-001");
  });

  it("counts replayed proposals", async () => {
    const trace = createTestTrace();
    const world = createMockWorld() as any;

    const result = await replay(trace, { world });

    // Only proposal events are replayed
    expect(result.eventsReplayed).toBe(1);
  });

  it("respects stopAtSeq option", async () => {
    const trace = createTestTrace();
    const world = createMockWorld() as any;

    const result = await replay(trace, { world, stopAtSeq: 1 });

    expect(result.eventsReplayed).toBe(1); // First proposal at seq 0
    expect(result.eventsRemaining).toBe(0); // No more proposals after seq 0
  });

  it("respects stopAtEvent option", async () => {
    const trace = createTestTrace();
    const world = createMockWorld() as any;

    const result = await replay(trace, { world, stopAtEvent: "proposal" });

    expect(result.eventsReplayed).toBe(0); // Stopped at first proposal
    expect(result.eventsRemaining).toBe(1); // One proposal remaining
  });

  describe("replay modes", () => {
    it("compare mode always succeeds", async () => {
      const trace = createTestTrace();
      const world = createMockWorld() as any;

      const result = await replay(trace, { world, mode: "compare" });

      expect(result.success).toBe(true);
    });

    it("strict mode is default", async () => {
      const trace = createTestTrace();
      const world = createMockWorld() as any;

      const result = await replay(trace, { world });

      // With no divergences, strict mode succeeds
      expect(result.success).toBe(true);
    });
  });
});

describe("replayPartial", () => {
  it("replays up to specified sequence", async () => {
    const trace = createTestTrace();
    const world = createMockWorld() as any;

    const result = await replayPartial(trace, 2, { world });

    // Should stop before seq 2
    expect(result.eventsReplayed).toBeLessThanOrEqual(1);
  });
});

describe("findFirstDivergence", () => {
  it("returns null when no divergence", async () => {
    const trace = createTestTrace();
    const world = createMockWorld() as any;

    const divergence = await findFirstDivergence(trace, { world });

    expect(divergence).toBe(null);
  });
});

describe("replay diff", () => {
  it("compares original and replay traces", async () => {
    const trace = createTestTrace();
    const world = createMockWorld() as any;

    const result = await replay(trace, { world });

    expect(result.diff).toBeDefined();
    expect(result.diff).toHaveProperty("identical");
    expect(result.diff).toHaveProperty("eventDiffs");
  });
});
