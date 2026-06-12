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

import { semanticPathToPatchPath } from "@manifesto-ai/core";
const pp = semanticPathToPatchPath;

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestRuntime, type DeterministicRuntime } from "../hcts-runtime.js";
import { createV2Adapter } from "../adapter-v2.js";
import type { HostTestAdapter } from "../hcts-adapter.js";
import { createTestSchema, createTestIntent, createTestSnapshot } from "../../helpers/index.js";
import { createTestEffectRunner } from "../hcts-adapter.js";

describe("HCTS Context Determinism Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;
  const executionKey = "context-test-1";

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV2Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("CTX-1: Context frozen per job", () => {
    it("HCTS-CTX-001: Timestamp remains constant during a single compute cycle", async () => {
      // This test verifies that the runtime timestamp captured at job start
      // doesn't change during computation.

      const schema = createTestSchema({
        actions: {
          captureTime: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: pp("firstTimestamp"),
                  value: { kind: "get", path: "$runtime.time.timestamp" },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: pp("secondTimestamp"),
                  value: { kind: "get", path: "$runtime.time.timestamp" },
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
      const data = finalSnapshot.state as Record<string, unknown>;

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
                  path: pp("firstSeed"),
                  value: { kind: "get", path: "$runtime.random.seed" },
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
                  path: pp("secondSeed"),
                  value: { kind: "get", path: "$runtime.random.seed" },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("mark", async () => [
        { op: "set", path: pp("effectDone"), value: true },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("captureSeeds"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const data = finalSnapshot.state as Record<string, unknown>;

      // Both seeds should come from the frozen context for the same intent job.
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
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: pp("done"),
                  value: { kind: "lit", value: true },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: pp("capturedTimestamp"),
                  value: { kind: "get", path: "$runtime.time.timestamp" },
                },
              ],
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

      const data = finalSnapshot.state as Record<string, unknown>;

      // The runtime expression should reflect the runtime's time source.
      expect(data.capturedTimestamp).toBe(1000);
    });
  });

  describe("CTX-3: Context isolation", () => {
    it("HCTS-CTX-004: Different intents have different context identifiers", async () => {
      // This test verifies that different intents receive different runtime
      // intent identifiers during computation.
      const schema = createTestSchema({
        actions: {
          captureIntentId: {
            flow: {
              kind: "patch",
              op: "set",
              path: pp("capturedSeed"),
              value: { kind: "get", path: "$runtime.intent.id" },
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
      const data1 = result1.state as Record<string, unknown>;

      // Second intent with different key
      const executionKey2 = "context-test-2";
      const snapshot2 = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey2, snapshot2);
      adapter.submitIntent(executionKey2, createTestIntent("captureIntentId"));
      await adapter.drain(executionKey2);
      const result2 = adapter.getSnapshot(executionKey2);
      const data2 = result2.state as Record<string, unknown>;

      // The captured intentIds should be different.
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
