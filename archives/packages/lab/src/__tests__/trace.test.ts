/**
 * Trace System Tests
 *
 * Tests for trace recording and mapping.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createTraceRecorder } from "../trace/recorder.js";
import { mapWorldEventToTraceEvent } from "../trace/mapper.js";
import type { LabOptions, LabTraceEvent } from "../types.js";
import {
  createTestLabOptions,
  createTestProposal,
  createProposalSubmittedEvent,
  createProposalDecidedEvent,
  createWorldCreatedEvent,
  createExecutionPatchesEvent,
  createExecutionCompletedEvent,
} from "./helpers/mock-world.js";

// ============================================================================
// Trace Recorder Tests
// ============================================================================

describe("TraceRecorder", () => {
  let options: LabOptions;

  beforeEach(() => {
    options = createTestLabOptions({
      runId: "test-run",
      necessityLevel: 1,
    });
  });

  describe("createTraceRecorder", () => {
    it("creates recorder with correct header", () => {
      const recorder = createTraceRecorder(options);
      const trace = recorder.getTrace();

      expect(trace.header.specVersion).toBe("lab/1.1");
      expect(trace.header.runId).toBe("test-run");
      expect(trace.header.necessityLevel).toBe(1);
      expect(trace.header.schemaHash).toBe(""); // Empty until set from World
      expect(trace.events).toEqual([]);
    });

    it("includes environment in header", () => {
      const optionsWithEnv = createTestLabOptions({
        runId: "test-run",
        environment: { nodeVersion: "18.0.0" },
      });
      const recorder = createTraceRecorder(optionsWithEnv);
      const trace = recorder.getTrace();

      expect(trace.header.environment).toEqual({ nodeVersion: "18.0.0" });
    });
  });

  describe("record", () => {
    it("records events in order", () => {
      const recorder = createTraceRecorder(options);
      const event1: LabTraceEvent = {
        type: "proposal",
        seq: 0,
        timestamp: new Date().toISOString(),
        proposalId: "p1",
        intentType: "test",
        actorId: "actor1",
      };
      const event2: LabTraceEvent = {
        type: "proposal",
        seq: 1,
        timestamp: new Date().toISOString(),
        proposalId: "p2",
        intentType: "test",
        actorId: "actor2",
      };

      recorder.record(event1);
      recorder.record(event2);

      const trace = recorder.getTrace();
      expect(trace.events).toHaveLength(2);
      expect(trace.events[0].seq).toBe(0);
      expect(trace.events[1].seq).toBe(1);
    });

    it("increments event count", () => {
      const recorder = createTraceRecorder(options);
      expect(recorder.eventCount).toBe(0);

      recorder.record({
        type: "proposal",
        seq: 0,
        timestamp: new Date().toISOString(),
        proposalId: "p1",
        intentType: "test",
        actorId: "actor1",
      });

      expect(recorder.eventCount).toBe(1);
    });
  });

  describe("getTrace", () => {
    it("returns immutable copy of trace", () => {
      const recorder = createTraceRecorder(options);
      const trace1 = recorder.getTrace();

      recorder.record({
        type: "proposal",
        seq: 0,
        timestamp: new Date().toISOString(),
        proposalId: "p1",
        intentType: "test",
        actorId: "actor1",
      });

      // trace1 should still be empty (immutable)
      expect(trace1.events).toHaveLength(0);

      const trace2 = recorder.getTrace();
      expect(trace2.events).toHaveLength(1);
    });
  });

  describe("complete", () => {
    it("adds termination event on success", () => {
      const recorder = createTraceRecorder(options);
      recorder.complete("success");

      const trace = recorder.getTrace();
      expect(trace.events).toHaveLength(1);
      expect(trace.events[0].type).toBe("termination");
      if (trace.events[0].type === "termination") {
        expect(trace.events[0].outcome).toBe("success");
      }
    });

    it("adds termination event on failure", () => {
      const recorder = createTraceRecorder(options);
      recorder.complete("failure");

      const trace = recorder.getTrace();
      expect(trace.events).toHaveLength(1);
      if (trace.events[0].type === "termination") {
        expect(trace.events[0].outcome).toBe("failure");
      }
    });
  });
});

// ============================================================================
// Trace Mapper Tests
// ============================================================================

describe("mapWorldEventToTraceEvent", () => {
  it("maps proposal:submitted to proposal event", () => {
    const proposal = createTestProposal("actor-1");
    const worldEvent = createProposalSubmittedEvent(proposal);

    const traceEvent = mapWorldEventToTraceEvent(worldEvent, 0);

    expect(traceEvent).not.toBeNull();
    expect(traceEvent?.type).toBe("proposal");
    if (traceEvent?.type === "proposal") {
      expect(traceEvent.proposalId).toBe(proposal.proposalId);
      expect(traceEvent.actorId).toBe("actor-1");
      expect(traceEvent.seq).toBe(0);
    }
  });

  it("maps proposal:decided to authority.decision event", () => {
    const proposal = createTestProposal();
    const worldEvent = createProposalDecidedEvent(proposal, "approved");

    const traceEvent = mapWorldEventToTraceEvent(worldEvent, 1);

    expect(traceEvent).not.toBeNull();
    expect(traceEvent?.type).toBe("authority.decision");
    if (traceEvent?.type === "authority.decision") {
      expect(traceEvent.proposalId).toBe(proposal.proposalId);
      expect(traceEvent.decision).toBe("approved");
      expect(traceEvent.seq).toBe(1);
    }
  });

  it("maps world:created to world.created event", () => {
    const worldEvent = createWorldCreatedEvent("world-1", "parent-1", "prop-1");

    const traceEvent = mapWorldEventToTraceEvent(worldEvent, 2);

    expect(traceEvent).not.toBeNull();
    expect(traceEvent?.type).toBe("world.created");
    if (traceEvent?.type === "world.created") {
      expect(traceEvent.worldId).toBe("world-1");
      expect(traceEvent.parentWorldId).toBe("parent-1");
      expect(traceEvent.proposalId).toBe("prop-1");
    }
  });

  it("maps execution:patches to apply event", () => {
    const worldEvent = createExecutionPatchesEvent("intent-1", 5);

    const traceEvent = mapWorldEventToTraceEvent(worldEvent, 3);

    expect(traceEvent).not.toBeNull();
    expect(traceEvent?.type).toBe("apply");
    if (traceEvent?.type === "apply") {
      expect(traceEvent.intentId).toBe("intent-1");
      expect(traceEvent.patchCount).toBe(5);
      expect(traceEvent.source).toBe("compute");
    }
  });

  it("maps execution:completed to termination event", () => {
    const worldEvent = createExecutionCompletedEvent("prop-1");

    const traceEvent = mapWorldEventToTraceEvent(worldEvent, 4);

    expect(traceEvent).not.toBeNull();
    expect(traceEvent?.type).toBe("termination");
    if (traceEvent?.type === "termination") {
      expect(traceEvent.outcome).toBe("success");
      expect(traceEvent.proposalId).toBe("prop-1");
    }
  });

  it("returns null for unknown event types", () => {
    const unknownEvent = {
      type: "unknown:event",
      timestamp: Date.now(),
    } as any;

    const traceEvent = mapWorldEventToTraceEvent(unknownEvent, 0);

    expect(traceEvent).toBeNull();
  });
});
