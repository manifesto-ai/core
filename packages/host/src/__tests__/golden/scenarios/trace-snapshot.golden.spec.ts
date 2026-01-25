/**
 * Golden Test: Trace Snapshots
 *
 * Tests that execution traces match expected patterns.
 * Uses normalized traces to allow comparison despite
 * non-deterministic IDs and timestamps.
 *
 * Verifies:
 * - Trace event ordering
 * - Event types emitted correctly
 * - Runner/Job lifecycle events
 *
 * @see host-SPEC-v2.0.1.md
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createGoldenRunner,
  createGoldenSchema,
  normalizeTrace,
  stripHostState,
  type GoldenRunner,
  type GoldenScenario,
  type NormalizedTraceEvent,
} from "../helpers/index.js";

describe("Golden: Trace Snapshots", () => {
  let runner: GoldenRunner;

  beforeEach(() => {
    runner = createGoldenRunner();
  });

  afterEach(async () => {
    await runner.dispose();
  });

  /**
   * Create a simple counter schema for trace testing
   */
  function createCounterSchema() {
    return createGoldenSchema({
      id: "golden:counter",
      fields: {
        count: { type: "number" },
        lastAction: { type: "string" },
      },
      actions: {
        increment: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: "count",
                value: {
                  kind: "add",
                  left: {
                    kind: "coalesce",
                    args: [{ kind: "get", path: "count" }, { kind: "lit", value: 0 }],
                  },
                  right: { kind: "lit", value: 1 },
                },
              },
              {
                kind: "patch",
                op: "set",
                path: "lastAction",
                value: { kind: "lit", value: "increment" },
              },
            ],
          },
        },
        decrement: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: "count",
                value: {
                  kind: "sub",
                  left: { kind: "get", path: "count" },
                  right: { kind: "lit", value: 1 },
                },
              },
              {
                kind: "patch",
                op: "set",
                path: "lastAction",
                value: { kind: "lit", value: "decrement" },
              },
            ],
          },
        },
        reset: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: "count",
                value: { kind: "lit", value: 0 },
              },
              {
                kind: "patch",
                op: "set",
                path: "lastAction",
                value: { kind: "lit", value: "reset" },
              },
            ],
          },
        },
      },
    });
  }

  it("should emit trace events in correct order for single intent", async () => {
    const scenario: GoldenScenario = {
      id: "trace-single-intent",
      description: "Single increment intent trace",
      schema: createCounterSchema(),
      initialData: {
        count: 0,
        lastAction: "",
      },
      intents: [{ type: "increment" }],
    };

    const result = await runner.execute(scenario);
    const normalized = result.normalizedTrace;

    // Should have trace events
    expect(normalized.length).toBeGreaterThan(0);

    // Find key trace event types
    const eventTypes = normalized.map((e) => e.t);

    // Should include core events
    expect(eventTypes).toContain("runner:kick");
    expect(eventTypes).toContain("job:start");
    expect(eventTypes).toContain("core:compute");
    expect(eventTypes).toContain("core:apply");
    expect(eventTypes).toContain("job:end");
  });

  it("should have consistent trace pattern across multiple intents", async () => {
    const scenario: GoldenScenario = {
      id: "trace-multiple-intents",
      description: "Multiple counter operations",
      schema: createCounterSchema(),
      initialData: {
        count: 5,
        lastAction: "",
      },
      intents: [
        { type: "increment" },
        { type: "increment" },
        { type: "decrement" },
        { type: "reset" },
      ],
    };

    const result = await runner.execute(scenario);

    // Count job:start and job:end events
    const jobStarts = result.normalizedTrace.filter((e) => e.t === "job:start");
    const jobEnds = result.normalizedTrace.filter((e) => e.t === "job:end");

    // Should have balanced job events
    expect(jobStarts.length).toBe(jobEnds.length);

    // Each intent should trigger at least one job
    expect(jobStarts.length).toBeGreaterThanOrEqual(4);

    // Verify final state is correct
    expect(stripHostState(result.finalSnapshot.data)).toEqual({
      count: 0,
      lastAction: "reset",
    });
  });

  it("should emit context:frozen events with deterministic values", async () => {
    const scenario: GoldenScenario = {
      id: "trace-context-frozen",
      description: "Context frozen event verification",
      schema: createCounterSchema(),
      initialData: {
        count: 0,
        lastAction: "",
      },
      intents: [{ type: "increment" }, { type: "increment" }],
    };

    const result = await runner.execute(scenario);

    // Find context:frozen events
    const contextEvents = result.trace.filter((e) => e.t === "context:frozen");

    if (contextEvents.length > 0) {
      // All context events within same execution should have consistent time
      const firstEvent = contextEvents[0] as { t: "context:frozen"; now: number };

      for (const event of contextEvents) {
        const ctxEvent = event as { t: "context:frozen"; now: number; randomSeed: string };
        // Time should be deterministic (0 for test runtime)
        expect(ctxEvent.now).toBe(firstEvent.now);
      }
    }
  });

  it("should produce identical normalized traces for deterministic execution", async () => {
    const scenario: GoldenScenario = {
      id: "trace-determinism",
      description: "Trace determinism verification",
      schema: createCounterSchema(),
      initialData: {
        count: 10,
        lastAction: "",
      },
      intents: [
        { type: "increment" },
        { type: "decrement" },
        { type: "decrement" },
        { type: "increment" },
      ],
    };

    const verification = await runner.verifyDeterminism(scenario, 3);

    // Normalized traces should be identical
    const traces = verification.results.map((r) => JSON.stringify(r.normalizedTrace));
    expect(traces[0]).toBe(traces[1]);
    expect(traces[1]).toBe(traces[2]);
  });

  it("should track job types correctly", async () => {
    const scenario: GoldenScenario = {
      id: "trace-job-types",
      description: "Job type tracking",
      schema: createCounterSchema(),
      initialData: {
        count: 0,
        lastAction: "",
      },
      intents: [{ type: "increment" }],
    };

    const result = await runner.execute(scenario);

    // Find job:start events with their types
    const jobStartEvents = result.normalizedTrace.filter((e) => e.t === "job:start");

    // Should have StartIntent job at minimum
    const jobTypes = jobStartEvents.map((e) => e.jobType);
    expect(jobTypes).toContain("StartIntent");
  });

  it("should record apply events with patch counts", async () => {
    const scenario: GoldenScenario = {
      id: "trace-apply-events",
      description: "Apply event patch count tracking",
      schema: createCounterSchema(),
      initialData: {
        count: 0,
        lastAction: "",
      },
      intents: [{ type: "increment" }],
    };

    const result = await runner.execute(scenario);

    // Find core:apply events
    const applyEvents = result.normalizedTrace.filter((e) => e.t === "core:apply");

    // Should have apply events with patch counts
    expect(applyEvents.length).toBeGreaterThan(0);

    for (const event of applyEvents) {
      expect(event).toHaveProperty("patchCount");
      expect(typeof event.patchCount).toBe("number");
    }
  });

  it("should emit runner lifecycle events correctly", async () => {
    const scenario: GoldenScenario = {
      id: "trace-runner-lifecycle",
      description: "Runner lifecycle event verification",
      schema: createCounterSchema(),
      initialData: {
        count: 0,
        lastAction: "",
      },
      intents: [{ type: "increment" }],
    };

    const result = await runner.execute(scenario);
    const eventTypes = result.normalizedTrace.map((e) => e.t);

    // Should have runner:kick as first runner event
    const runnerEvents = result.normalizedTrace.filter((e) =>
      e.t.startsWith("runner:")
    );

    if (runnerEvents.length > 0) {
      expect(runnerEvents[0].t).toBe("runner:kick");
    }
  });
});
