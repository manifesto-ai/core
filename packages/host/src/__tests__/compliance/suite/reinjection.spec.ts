/**
 * HCTS Reinjection Test Suite
 *
 * Tests for effect result reinjection rules:
 * - REINJ-1: Effect results reinjected as FulfillEffect jobs
 * - REINJ-2: Direct application from callback forbidden
 * - REINJ-3: Effect runner enqueues result to mailbox
 * - REINJ-4: Effect runner triggers mailbox processing
 *
 * @see host-SPEC-v2.0.2.md §10.4
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestRuntime, type DeterministicRuntime } from "../hcts-runtime.js";
import { createV1Adapter } from "../adapter-v2.js";
import type { HostTestAdapter } from "../hcts-adapter.js";
import type { TraceEvent } from "../hcts-types.js";
import {
  createTestSchema,
  createTestIntent,
  createTestSnapshot,
} from "../../helpers/index.js";
import { createTestEffectRunner } from "../hcts-adapter.js";

describe("HCTS Reinjection Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;
  const executionKey = "reinjection-test-1";

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV1Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("REINJ-1: Effect results reinjected as FulfillEffect jobs", () => {
    it("HCTS-REINJ-001: Effect completion triggers FulfillEffect processing", async () => {
      const schema = createTestSchema({
        actions: {
          effectAction: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "result" } },
              then: {
                kind: "effect",
                type: "async",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("async", async () => [
        { op: "set", path: "result", value: "completed" },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("effectAction"));

      await adapter.drain(executionKey);

      const trace = adapter.getTrace(executionKey);

      // Should see effect dispatch followed by requirement clear
      const dispatchEvents = trace.filter((e) => e.t === "effect:dispatch");
      const clearEvents = trace.filter((e) => e.t === "requirement:clear");

      expect(dispatchEvents.length).toBeGreaterThan(0);
      expect(clearEvents.length).toBeGreaterThan(0);

      // Result should be applied
      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect((finalSnapshot.data as Record<string, unknown>).result).toBe("completed");
    });
  });

  describe("REINJ-3: Effect runner enqueues result to mailbox", () => {
    it("HCTS-REINJ-002: Effect result triggers continue:enqueue", async () => {
      const schema = createTestSchema({
        actions: {
          enqueuingEffect: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "effectDone" } },
              then: {
                kind: "effect",
                type: "enqueuing",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("enqueuing", async () => [
        { op: "set", path: "effectDone", value: true },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("enqueuingEffect"));

      await adapter.drain(executionKey);

      const trace = adapter.getTrace(executionKey);

      // Should see continue:enqueue event(s) after effect completion
      const continueEvents = trace.filter((e) => e.t === "continue:enqueue");
      expect(continueEvents.length).toBeGreaterThan(0);

      // Effect should have been executed
      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect((finalSnapshot.data as Record<string, unknown>).effectDone).toBe(true);
    });
  });

  describe("REINJ-4: Effect runner triggers mailbox processing", () => {
    it("HCTS-REINJ-003: Multiple effects properly chain through reinjection", async () => {
      const schema = createTestSchema({
        actions: {
          chainedEffects: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "if",
                  cond: { kind: "isNull", arg: { kind: "get", path: "step1" } },
                  then: {
                    kind: "effect",
                    type: "step1Effect",
                    params: {},
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
                    type: "step2Effect",
                    params: {},
                  },
                },
                {
                  kind: "if",
                  cond: {
                    kind: "and",
                    args: [
                      { kind: "get", path: "step2" },
                      { kind: "isNull", arg: { kind: "get", path: "step3" } },
                    ],
                  },
                  then: {
                    kind: "effect",
                    type: "step3Effect",
                    params: {},
                  },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      const executionOrder: string[] = [];

      effectRunner.register("step1Effect", async () => {
        executionOrder.push("step1");
        return [{ op: "set", path: "step1", value: true }];
      });
      effectRunner.register("step2Effect", async () => {
        executionOrder.push("step2");
        return [{ op: "set", path: "step2", value: true }];
      });
      effectRunner.register("step3Effect", async () => {
        executionOrder.push("step3");
        return [{ op: "set", path: "step3", value: true }];
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("chainedEffects"));

      await adapter.drain(executionKey);

      // All effects should execute in order
      expect(executionOrder).toEqual(["step1", "step2", "step3"]);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect((finalSnapshot.data as Record<string, unknown>).step1).toBe(true);
      expect((finalSnapshot.data as Record<string, unknown>).step2).toBe(true);
      expect((finalSnapshot.data as Record<string, unknown>).step3).toBe(true);
    });
  });

  describe("Effect fulfillment lifecycle", () => {
    it("HCTS-REINJ-004: Complete lifecycle: dispatch -> execute -> apply -> clear -> continue", async () => {
      // Using the same pattern as liveness tests which are known to work
      const schema = createTestSchema({
        actions: {
          fullLifecycle: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
              then: {
                kind: "effect",
                type: "lifecycle",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("lifecycle", async () => [
        { op: "set", path: "response", value: { executed: true } },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("fullLifecycle"));

      await adapter.drain(executionKey);

      const trace = adapter.getTrace(executionKey);

      // Verify lifecycle phases occurred
      const phases = {
        compute: trace.filter((e) => e.t === "core:compute").length,
        dispatch: trace.filter((e) => e.t === "effect:dispatch").length,
        clear: trace.filter((e) => e.t === "requirement:clear").length,
        continue: trace.filter((e) => e.t === "continue:enqueue").length,
      };

      // All phases should have occurred (core execution lifecycle)
      expect(phases.compute).toBeGreaterThan(0);
      expect(phases.dispatch).toBeGreaterThan(0);
      expect(phases.clear).toBeGreaterThan(0);
      expect(phases.continue).toBeGreaterThan(0);

      // Effect result should be applied
      const finalSnapshot = adapter.getSnapshot(executionKey);
      const response = (finalSnapshot.data as Record<string, unknown>).response as Record<string, unknown>;
      expect(response.executed).toBe(true);
      expect(finalSnapshot.system.pendingRequirements).toHaveLength(0);
    });
  });

  describe("Error handling in reinjection", () => {
    it("HCTS-REINJ-005: Effect error still triggers proper lifecycle", async () => {
      const schema = createTestSchema({
        actions: {
          errorEffect: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "$host.lastError" } },
              then: {
                kind: "effect",
                type: "failing",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("failing", async () => {
        throw new Error("Effect failed");
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("errorEffect"));

      await adapter.drain(executionKey);

      // Even with error, requirement should be cleared
      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect(finalSnapshot.system.pendingRequirements).toHaveLength(0);

      // Trace should still show lifecycle events
      const trace = adapter.getTrace(executionKey);
      const dispatchEvents = trace.filter((e) => e.t === "effect:dispatch");
      expect(dispatchEvents.length).toBeGreaterThan(0);
    });
  });
});
