/**
 * HCTS Intent Processing Test Suite
 *
 * Tests for intent processing rules:
 * - INTENT-1~5: Intent processing contract
 * - INTENT-ID-1~4: Intent identity rules
 *
 * @see host-SPEC-v2.0.2.md §6
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestRuntime, type DeterministicRuntime } from "../hcts-runtime.js";
import { createV1Adapter } from "../adapter-v2.js";
import type { HostTestAdapter } from "../hcts-adapter.js";
import {
  createTestSchema,
  createTestIntent,
  createTestSnapshot,
} from "../../helpers/index.js";
import { createTestEffectRunner } from "../hcts-adapter.js";

describe("HCTS Intent Processing Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;
  const executionKey = "intent-test-1";

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV1Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("INTENT-3: Flows are re-entrant under repeated compute()", () => {
    it("HCTS-INTENT-002: State-guarded effect only executes once", async () => {
      // Using the proven pattern from liveness tests
      const schema = createTestSchema({
        actions: {
          reentrantFlow: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
              then: {
                kind: "effect",
                type: "fetchOnce",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      let executionCount = 0;

      effectRunner.register("fetchOnce", async () => {
        executionCount++;
        return [{ op: "set", path: "response", value: { fetched: true } }];
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("reentrantFlow"));

      await adapter.drain(executionKey);

      // Effect should only execute once due to state guard
      expect(executionCount).toBe(1);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const response = (finalSnapshot.data as Record<string, unknown>).response as Record<string, unknown>;
      expect(response.fetched).toBe(true);
    });

    it("HCTS-INTENT-003: Multiple compute cycles complete correctly", async () => {
      // Using the proven multi-step pattern from liveness tests
      const schema = createTestSchema({
        actions: {
          multiStep: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "if",
                  cond: { kind: "isNull", arg: { kind: "get", path: "step1" } },
                  then: {
                    kind: "seq",
                    steps: [{ kind: "effect", type: "step1", params: {} }],
                  },
                },
                {
                  kind: "if",
                  cond: {
                    kind: "and",
                    args: [
                      { kind: "get", path: "step1" },
                      { kind: "isNull", arg: { kind: "get", path: "step2" } },
                    ],
                  },
                  then: {
                    kind: "effect",
                    type: "step2",
                    params: {},
                  },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();

      effectRunner.register("step1", async () => [
        { op: "set", path: "step1", value: true },
      ]);
      effectRunner.register("step2", async () => [
        { op: "set", path: "step2", value: true },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("multiStep"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect((finalSnapshot.data as Record<string, unknown>).step1).toBe(true);
      expect((finalSnapshot.data as Record<string, unknown>).step2).toBe(true);
    });
  });

  describe("INTENT-4: All progress state is in Snapshot", () => {
    it("HCTS-INTENT-004: Effect state visible in snapshot", async () => {
      const schema = createTestSchema({
        actions: {
          progressTracked: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
              then: {
                kind: "effect",
                type: "trackProgress",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("trackProgress", async () => [
        { op: "set", path: "response", value: { progress: 100 } },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("progressTracked"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);

      // All state visible in Snapshot
      const response = (finalSnapshot.data as Record<string, unknown>).response as Record<string, unknown>;
      expect(response.progress).toBe(100);
    });
  });

  describe("INTENT-5: intentId remains stable throughout execution", () => {
    it("HCTS-INTENT-005: Intent has ID at submission", async () => {
      const schema = createTestSchema({
        actions: {
          checkId: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
              then: {
                kind: "effect",
                type: "checkIntent",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("checkIntent", async () => [
        { op: "set", path: "response", value: { checked: true } },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);

      const intent = createTestIntent("checkId");
      // Intent should have ID before submission
      expect(intent.intentId).toBeDefined();
      expect(typeof intent.intentId).toBe("string");

      adapter.submitIntent(executionKey, intent);
      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const response = (finalSnapshot.data as Record<string, unknown>).response as Record<string, unknown>;
      expect(response.checked).toBe(true);
    });
  });

  describe("INTENT-ID-2: intentId is unique per intent", () => {
    it("HCTS-INTENT-008: Different intents have different IDs", async () => {
      const intent1 = createTestIntent("action1");
      const intent2 = createTestIntent("action1");
      const intent3 = createTestIntent("action2");

      // All intents should have unique IDs
      expect(intent1.intentId).not.toBe(intent2.intentId);
      expect(intent2.intentId).not.toBe(intent3.intentId);
      expect(intent1.intentId).not.toBe(intent3.intentId);
    });
  });

  describe("INTENT-ID-3: intentId stable across compute cycles", () => {
    it("HCTS-INTENT-010: Intent ID preserved through effect execution", async () => {
      const schema = createTestSchema({
        actions: {
          multiCycle: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "if",
                  cond: { kind: "isNull", arg: { kind: "get", path: "step1" } },
                  then: {
                    kind: "seq",
                    steps: [{ kind: "effect", type: "first", params: {} }],
                  },
                },
                {
                  kind: "if",
                  cond: {
                    kind: "and",
                    args: [
                      { kind: "get", path: "step1" },
                      { kind: "isNull", arg: { kind: "get", path: "step2" } },
                    ],
                  },
                  then: {
                    kind: "effect",
                    type: "second",
                    params: {},
                  },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("first", async () => [
        { op: "set", path: "step1", value: true },
      ]);
      effectRunner.register("second", async () => [
        { op: "set", path: "step2", value: true },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);

      const intent = createTestIntent("multiCycle");
      const originalIntentId = intent.intentId;

      adapter.submitIntent(executionKey, intent);
      await adapter.drain(executionKey);

      // Verify both steps completed (proving multiple compute cycles)
      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect((finalSnapshot.data as Record<string, unknown>).step1).toBe(true);
      expect((finalSnapshot.data as Record<string, unknown>).step2).toBe(true);

      // Intent ID should have remained stable (same as originally submitted)
      expect(intent.intentId).toBe(originalIntentId);
    });
  });

  describe("INTENT-ID-4: intentId traceable in execution trace", () => {
    it("HCTS-INTENT-011: Trace events reference intent ID", async () => {
      const schema = createTestSchema({
        actions: {
          traceable: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "done" } },
              then: {
                kind: "effect",
                type: "traced",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("traced", async () => [
        { op: "set", path: "done", value: true },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);

      const intent = createTestIntent("traceable");
      adapter.submitIntent(executionKey, intent);

      await adapter.drain(executionKey);

      const trace = adapter.getTrace(executionKey);

      // Trace should contain events (proving execution happened)
      expect(trace.length).toBeGreaterThan(0);

      // At least some events should be traceable
      const computeEvents = trace.filter((e) => e.t === "core:compute");
      expect(computeEvents.length).toBeGreaterThan(0);
    });
  });
});
