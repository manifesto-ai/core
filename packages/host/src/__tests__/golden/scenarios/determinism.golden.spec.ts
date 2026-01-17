/**
 * Golden Test: Determinism Verification
 *
 * Comprehensive tests to verify Host execution determinism.
 * Same input MUST always produce same output (CTX-1~5, SPEC §11).
 *
 * Verifies:
 * - State determinism (same final state)
 * - Trace determinism (same event sequence)
 * - Context determinism (frozen context per job)
 * - Reproducibility across runs
 *
 * @see host-SPEC-v2.0.1.md §11 (Context Determinism)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createGoldenRunner,
  createGoldenSchema,
  compareGoldenResults,
  type GoldenRunner,
  type GoldenScenario,
} from "../helpers/index.js";

describe("Golden: Determinism Verification", () => {
  let runner: GoldenRunner;

  beforeEach(() => {
    runner = createGoldenRunner();
  });

  afterEach(async () => {
    await runner.dispose();
  });

  /**
   * Create a schema with various operations to test determinism
   */
  function createDeterminismSchema() {
    return createGoldenSchema({
      id: "golden:determinism",
      fields: {
        counter: { type: "number" },
        valueA: { type: "number" },
        valueB: { type: "number" },
        flag: { type: "boolean" },
        label: { type: "string" },
      },
      actions: {
        increment: {
          flow: {
            kind: "patch",
            op: "set",
            path: "counter",
            value: {
              kind: "add",
              left: {
                kind: "coalesce",
                args: [{ kind: "get", path: "counter" }, { kind: "lit", value: 0 }],
              },
              right: { kind: "lit", value: 1 },
            },
          },
        },
        addTen: {
          flow: {
            kind: "patch",
            op: "set",
            path: "counter",
            value: {
              kind: "add",
              left: { kind: "get", path: "counter" },
              right: { kind: "lit", value: 10 },
            },
          },
        },
        setValueA: {
          flow: {
            kind: "patch",
            op: "set",
            path: "valueA",
            value: { kind: "get", path: "input.value" },
          },
        },
        setValueB: {
          flow: {
            kind: "patch",
            op: "set",
            path: "valueB",
            value: { kind: "get", path: "input.value" },
          },
        },
        setFlag: {
          flow: {
            kind: "patch",
            op: "set",
            path: "flag",
            value: { kind: "get", path: "input.flag" },
          },
        },
        setLabel: {
          flow: {
            kind: "patch",
            op: "set",
            path: "label",
            value: { kind: "get", path: "input.label" },
          },
        },
        conditionalIncrement: {
          flow: {
            kind: "if",
            cond: {
              kind: "gt",
              left: { kind: "get", path: "counter" },
              right: { kind: "lit", value: 5 },
            },
            then: {
              kind: "patch",
              op: "set",
              path: "flag",
              value: { kind: "lit", value: true },
            },
            else: {
              kind: "patch",
              op: "set",
              path: "flag",
              value: { kind: "lit", value: false },
            },
          },
        },
        multiPatch: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: "counter",
                value: {
                  kind: "add",
                  left: { kind: "get", path: "counter" },
                  right: { kind: "lit", value: 5 },
                },
              },
              {
                kind: "patch",
                op: "set",
                path: "label",
                value: { kind: "lit", value: "multi-patched" },
              },
            ],
          },
        },
      },
    });
  }

  describe("State Determinism", () => {
    it("should produce identical final state across 5 runs", async () => {
      const scenario: GoldenScenario = {
        id: "state-determinism-5-runs",
        description: "5-run state determinism test",
        schema: createDeterminismSchema(),
        initialData: {
          counter: 0,
          valueA: 0,
          valueB: 0,
          flag: false,
          label: "",
        },
        intents: [
          { type: "increment" },
          { type: "setValueA", input: { value: 10 } },
          { type: "increment" },
          { type: "setValueB", input: { value: 20 } },
          { type: "multiPatch" },
        ],
      };

      const verification = await runner.verifyDeterminism(scenario, 5);

      expect(verification.deterministic).toBe(true);
      expect(verification.differences).toBeUndefined();

      // All final states should be identical
      const states = verification.results.map((r) =>
        JSON.stringify(r.finalSnapshot.data)
      );
      const uniqueStates = new Set(states);
      expect(uniqueStates.size).toBe(1);
    });

    it("should maintain state determinism with conditional logic", async () => {
      const scenario: GoldenScenario = {
        id: "state-determinism-conditional",
        description: "Conditional logic determinism",
        schema: createDeterminismSchema(),
        initialData: {
          counter: 3,
          valueA: 0,
          valueB: 0,
          flag: false,
          label: "",
        },
        intents: [
          { type: "conditionalIncrement" }, // counter=3 < 5, flag=false
          { type: "increment" },
          { type: "increment" },
          { type: "increment" }, // counter=6 > 5
          { type: "conditionalIncrement" }, // flag=true
        ],
      };

      const verification = await runner.verifyDeterminism(scenario, 3);
      expect(verification.deterministic).toBe(true);

      // Final state should have flag=true
      const finalState = verification.results[0].finalSnapshot.data as any;
      expect(finalState.flag).toBe(true);
      expect(finalState.counter).toBe(6);
    });

    it("should handle sequential patches deterministically", async () => {
      const scenario: GoldenScenario = {
        id: "state-determinism-sequential",
        description: "Sequential patches determinism",
        schema: createDeterminismSchema(),
        initialData: {
          counter: 5,
          valueA: 0,
          valueB: 0,
          flag: false,
          label: "",
        },
        intents: [
          { type: "multiPatch" },
          { type: "increment" },
          { type: "multiPatch" },
          { type: "increment" },
          { type: "multiPatch" },
        ],
      };

      const verification = await runner.verifyDeterminism(scenario, 3);
      expect(verification.deterministic).toBe(true);

      const finalState = verification.results[0].finalSnapshot.data as any;
      // 5 + 5 + 1 + 5 + 1 + 5 = 22
      expect(finalState.counter).toBe(22);
      expect(finalState.label).toBe("multi-patched");
    });
  });

  describe("Trace Determinism", () => {
    it("should produce identical normalized traces", async () => {
      const scenario: GoldenScenario = {
        id: "trace-determinism-basic",
        description: "Basic trace determinism",
        schema: createDeterminismSchema(),
        initialData: {
          counter: 0,
          valueA: 0,
          valueB: 0,
          flag: false,
          label: "",
        },
        intents: [
          { type: "increment" },
          { type: "setValueA", input: { value: 100 } },
        ],
      };

      const verification = await runner.verifyDeterminism(scenario, 3);

      // Compare normalized traces
      const traces = verification.results.map((r) =>
        JSON.stringify(r.normalizedTrace)
      );
      expect(traces[0]).toBe(traces[1]);
      expect(traces[1]).toBe(traces[2]);
    });

    it("should have consistent trace event count", async () => {
      const scenario: GoldenScenario = {
        id: "trace-determinism-count",
        description: "Trace event count consistency",
        schema: createDeterminismSchema(),
        initialData: {
          counter: 0,
          valueA: 0,
          valueB: 0,
          flag: false,
          label: "",
        },
        intents: [
          { type: "increment" },
          { type: "increment" },
          { type: "multiPatch" },
        ],
      };

      const verification = await runner.verifyDeterminism(scenario, 5);

      const eventCounts = verification.results.map((r) => r.trace.length);
      const uniqueCounts = new Set(eventCounts);
      expect(uniqueCounts.size).toBe(1);
    });

    it("should maintain event ordering across runs", async () => {
      const scenario: GoldenScenario = {
        id: "trace-determinism-ordering",
        description: "Trace event ordering consistency",
        schema: createDeterminismSchema(),
        initialData: {
          counter: 0,
          valueA: 0,
          valueB: 0,
          flag: false,
          label: "",
        },
        intents: [
          { type: "setValueA", input: { value: 1 } },
          { type: "setValueB", input: { value: 2 } },
          { type: "setLabel", input: { label: "test" } },
        ],
      };

      const verification = await runner.verifyDeterminism(scenario, 3);

      // Event type sequences should be identical
      const eventSequences = verification.results.map((r) =>
        r.normalizedTrace.map((e) => e.t).join(",")
      );
      expect(eventSequences[0]).toBe(eventSequences[1]);
      expect(eventSequences[1]).toBe(eventSequences[2]);
    });
  });

  describe("Reproducibility", () => {
    it("should reproduce identical results using compareGoldenResults", async () => {
      const scenario: GoldenScenario = {
        id: "reproducibility-compare",
        description: "Result comparison test",
        schema: createDeterminismSchema(),
        initialData: {
          counter: 10,
          valueA: 0,
          valueB: 0,
          flag: false,
          label: "initial",
        },
        intents: [
          { type: "increment" },
          { type: "setValueA", input: { value: 50 } },
          { type: "multiPatch" },
        ],
      };

      // Run twice and compare
      const result1 = await runner.execute(scenario);

      // Create fresh runner for second run
      await runner.dispose();
      runner = createGoldenRunner();
      const result2 = await runner.execute(scenario);

      const comparison = compareGoldenResults(result1, result2);
      expect(comparison.equal).toBe(true);
      expect(comparison.differences).toHaveLength(0);
    });

    it("should detect differences when initial state changes", async () => {
      const schema = createDeterminismSchema();

      const scenario1: GoldenScenario = {
        id: "reproducibility-diff-1",
        description: "First scenario",
        schema,
        initialData: {
          counter: 0,
          valueA: 0,
          valueB: 0,
          flag: false,
          label: "",
        },
        intents: [{ type: "increment" }],
      };

      const scenario2: GoldenScenario = {
        id: "reproducibility-diff-2",
        description: "Second scenario with different initial state",
        schema,
        initialData: {
          counter: 100, // Different!
          valueA: 0,
          valueB: 0,
          flag: false,
          label: "",
        },
        intents: [{ type: "increment" }],
      };

      const result1 = await runner.execute(scenario1);
      await runner.dispose();
      runner = createGoldenRunner();
      const result2 = await runner.execute(scenario2);

      const comparison = compareGoldenResults(result1, result2);
      expect(comparison.equal).toBe(false);
      expect(comparison.differences.length).toBeGreaterThan(0);
    });
  });

  describe("Execution Metadata Consistency", () => {
    it("should have consistent metadata across runs", async () => {
      const scenario: GoldenScenario = {
        id: "metadata-consistency",
        description: "Metadata consistency test",
        schema: createDeterminismSchema(),
        initialData: {
          counter: 0,
          valueA: 0,
          valueB: 0,
          flag: false,
          label: "",
        },
        intents: [
          { type: "increment" },
          { type: "setValueA", input: { value: 100 } },
          { type: "multiPatch" },
        ],
      };

      const verification = await runner.verifyDeterminism(scenario, 3);

      const metadatas = verification.results.map((r) => r.metadata);

      // All runs should report same intent count
      expect(metadatas.every((m) => m.intentCount === 3)).toBe(true);

      // All runs should have same scenario ID
      expect(metadatas.every((m) => m.scenarioId === "metadata-consistency")).toBe(true);

      // Trace event counts should be identical
      const traceCounts = metadatas.map((m) => m.totalTraceEvents);
      expect(new Set(traceCounts).size).toBe(1);
    });
  });

  describe("Long Sequence Determinism", () => {
    it("should maintain determinism over 20+ operations", async () => {
      const intents = [];
      for (let i = 0; i < 25; i++) {
        if (i % 3 === 0) {
          intents.push({ type: "increment" });
        } else if (i % 3 === 1) {
          intents.push({ type: "setValueA", input: { value: i * 10 } });
        } else {
          intents.push({ type: "multiPatch" });
        }
      }

      const scenario: GoldenScenario = {
        id: "long-sequence-determinism",
        description: "25-operation determinism test",
        schema: createDeterminismSchema(),
        initialData: {
          counter: 0,
          valueA: 0,
          valueB: 0,
          flag: false,
          label: "",
        },
        intents,
      };

      const verification = await runner.verifyDeterminism(scenario, 3);
      expect(verification.deterministic).toBe(true);
    });
  });
});
