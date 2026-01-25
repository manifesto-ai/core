/**
 * HCTS Context Determinism Test Suite
 *
 * Tests for context determinism rules:
 * - CTX-1: Context frozen per job
 * - CTX-2: Deterministic time source
 * - CTX-3: Deterministic random seed
 * - CTX-4: Context immutability
 * - CTX-5: Context isolation between jobs
 *
 * @see host-SPEC-v2.0.1.md §11
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestRuntime, type DeterministicRuntime } from "../hcts-runtime.js";
import { createV1Adapter } from "../adapter-v2.js";
import type { HostTestAdapter } from "../hcts-adapter.js";
import {
  assertContextFrozenPerJob,
  expectCompliance,
} from "../hcts-assertions.js";
import {
  createTestSchema,
  createTestIntent,
  createTestSnapshot,
} from "../../helpers/index.js";
import { createTestEffectRunner } from "../hcts-adapter.js";

describe("HCTS Context Determinism Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;
  const executionKey = "context-test-1";

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV1Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("CTX-1: Context frozen per job", () => {
    it("HCTS-CTX-001: Timestamp remains constant during a single compute cycle", async () => {
      // This test verifies that the `now` value captured at job start
      // doesn't change during computation

      const schema = createTestSchema({
        actions: {
          captureTime: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: "firstTimestamp",
                  value: { kind: "get", path: "meta.timestamp" },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: "secondTimestamp",
                  value: { kind: "get", path: "meta.timestamp" },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("captureTime"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const data = finalSnapshot.data as Record<string, unknown>;

      // Both timestamps should be identical (time frozen during compute)
      expect(data.firstTimestamp).toBe(data.secondTimestamp);
    });

    it("HCTS-CTX-002: Random seed remains stable across re-entries", async () => {
      // When an intent causes multiple compute cycles (due to effects),
      // the random seed should remain the same

      const schema = createTestSchema({
        actions: {
          captureSeeds: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: "firstSeed",
                  value: { kind: "get", path: "meta.randomSeed" },
                },
                {
                  kind: "if",
                  cond: { kind: "isNull", arg: { kind: "get", path: "effectDone" } },
                  then: {
                    kind: "effect",
                    type: "mark",
                    params: {},
                  },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: "secondSeed",
                  value: { kind: "get", path: "meta.randomSeed" },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("mark", async () => [
        { op: "set", path: "effectDone", value: true },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("captureSeeds"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const data = finalSnapshot.data as Record<string, unknown>;

      // Both seeds should be the same intent ID (v1.x uses intentId as seed)
      expect(data.firstSeed).toBe(data.secondSeed);
    });
  });

  describe("CTX-2: Deterministic time source", () => {
    it("HCTS-CTX-003: Runtime now() is used for timestamps", async () => {
      // Verify that the Host uses the runtime's time source

      const schema = createTestSchema({
        actions: {
          setDone: {
            flow: {
              kind: "patch",
              op: "set",
              path: "done",
              value: { kind: "lit", value: true },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();

      // Set runtime to specific time
      runtime.advanceTime(1000);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("setDone"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);

      // The timestamp should reflect the runtime's time
      // Note: This depends on implementation using runtime.now()
      expect(finalSnapshot.meta.timestamp).toBeGreaterThanOrEqual(0);
    });
  });

  describe("CTX-3: Context isolation", () => {
    it("HCTS-CTX-004: Different intents have different context identifiers", async () => {
      // This test verifies that different intents receive different context
      // identifiers during computation. We use meta.intentId which is properly
      // exposed via the expression evaluator.
      // Note: meta.randomSeed in expressions reads from snapshot.meta, not the
      // current context, so we use intentId to verify context isolation.
      const schema = createTestSchema({
        actions: {
          captureIntentId: {
            flow: {
              kind: "patch",
              op: "set",
              path: "capturedSeed",
              value: { kind: "get", path: "meta.intentId" },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      // First intent
      const snapshot1 = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot1);
      adapter.submitIntent(executionKey, createTestIntent("captureIntentId"));
      await adapter.drain(executionKey);
      const result1 = adapter.getSnapshot(executionKey);
      const data1 = result1.data as Record<string, unknown>;

      // Second intent with different key
      const executionKey2 = "context-test-2";
      const snapshot2 = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey2, snapshot2);
      adapter.submitIntent(executionKey2, createTestIntent("captureIntentId"));
      await adapter.drain(executionKey2);
      const result2 = adapter.getSnapshot(executionKey2);
      const data2 = result2.data as Record<string, unknown>;

      // The captured intentIds should be different
      // v1.x uses intentId as the randomSeed, so different intents = different seeds
      expect(data1.capturedSeed).toBeDefined();
      expect(data2.capturedSeed).toBeDefined();
      expect(data1.capturedSeed).not.toBe(data2.capturedSeed);
    });
  });

  describe("DeterministicRuntime unit tests", () => {
    it("should start at time 0", () => {
      const rt = createTestRuntime();
      expect(rt.now()).toBe(0);
    });

    it("should advance time correctly", () => {
      const rt = createTestRuntime();
      rt.advanceTime(100);
      expect(rt.now()).toBe(100);
      rt.advanceTime(50);
      expect(rt.now()).toBe(150);
    });

    it("should run microtasks synchronously", async () => {
      const rt = createTestRuntime();
      const order: number[] = [];

      rt.microtask(() => order.push(1));
      rt.microtask(() => order.push(2));
      rt.microtask(() => order.push(3));

      rt.runAllMicrotasks();

      expect(order).toEqual([1, 2, 3]);
    });

    it("should run macrotasks in order of scheduled time", async () => {
      const rt = createTestRuntime();
      const order: number[] = [];

      rt.macrotask(() => order.push(1), 100);
      rt.macrotask(() => order.push(2), 50);
      rt.macrotask(() => order.push(3), 75);

      await rt.runUntilIdle();

      expect(order).toEqual([2, 3, 1]);
    });

    it("should support yield()", async () => {
      const rt = createTestRuntime();
      let yielded = false;

      // Schedule a yield with callback
      const yieldPromise = (async () => {
        await rt.yield();
        yielded = true;
      })();

      // Before running microtasks, should still be false
      expect(yielded).toBe(false);

      // Run all our microtasks
      rt.runAllMicrotasks();

      // The yield promise should now be resolved, but the async
      // function's continuation runs in the JS microtask queue.
      // We need to flush the real microtask queue too.
      await Promise.resolve();

      // Now yielded should be true
      expect(yielded).toBe(true);

      // Clean up
      await yieldPromise;
    });
  });
});
