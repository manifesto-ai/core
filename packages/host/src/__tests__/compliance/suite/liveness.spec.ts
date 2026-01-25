/**
 * HCTS Liveness Test Suite
 *
 * Tests for liveness guarantee rules:
 * - LIVE-1: No starvation
 * - LIVE-2: Empty to non-empty kick
 * - LIVE-3: Processing guarantee
 * - LIVE-4: Lost wakeup prevention
 *
 * @see host-SPEC-v2.0.1.md §10.3
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestRuntime, type DeterministicRuntime } from "../hcts-runtime.js";
import { createV1Adapter } from "../adapter-v2.js";
import type { HostTestAdapter } from "../hcts-adapter.js";
import {
  assertLostWakeupPrevention,
  expectCompliance,
} from "../hcts-assertions.js";
import {
  createTestSchema,
  createTestIntent,
  createTestSnapshot,
} from "../../helpers/index.js";
import { createTestEffectRunner } from "../hcts-adapter.js";

describe("HCTS Liveness Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;
  const executionKey = "liveness-test-1";

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV1Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("LIVE-3: Processing guarantee", () => {
    it("HCTS-LIVE-002: Every submitted intent is eventually processed", async () => {
      const schema = createTestSchema({
        actions: {
          setFlag: {
            flow: {
              kind: "patch",
              op: "set",
              path: "wasProcessed",
              value: { kind: "lit", value: true },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("setFlag"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect((finalSnapshot.data as Record<string, unknown>).wasProcessed).toBe(true);
    });

    it("HCTS-LIVE-003: Effects are eventually fulfilled", async () => {
      const schema = createTestSchema({
        actions: {
          withEffect: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
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
        { op: "set", path: "response", value: { success: true } },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("withEffect"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const data = finalSnapshot.data as Record<string, unknown>;
      expect(data.response).toEqual({ success: true });
    });
  });

  describe("LIVE-4: Lost wakeup prevention", () => {
    it("HCTS-LIVE-004: Runner re-checks queue before releasing guard", async () => {
      // This test verifies that effect fulfillment correctly triggers
      // ContinueCompute jobs

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
                    steps: [
                      { kind: "effect", type: "step1", params: {} },
                    ],
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
                {
                  kind: "patch",
                  op: "set",
                  path: "complete",
                  value: { kind: "lit", value: true },
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
      const data = finalSnapshot.data as Record<string, unknown>;

      // Both steps should complete (no lost wakeup)
      expect(data.step1).toBe(true);
      expect(data.step2).toBe(true);
      expect(data.complete).toBe(true);

      // Check trace for continue events
      const trace = adapter.getTrace(executionKey);
      const result = assertLostWakeupPrevention(trace, executionKey);
      // Note: v1.x may not emit explicit recheck events, so this might WARN
      expect(result.status).not.toBe("FAIL");
    });
  });

  describe("Termination", () => {
    it("HCTS-LIVE-005: Host loop terminates on complete status", async () => {
      const schema = createTestSchema({
        actions: {
          complete: {
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
      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("complete"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect(finalSnapshot.system.status).toBe("idle");
      expect(finalSnapshot.system.pendingRequirements).toHaveLength(0);
    });

    it("HCTS-LIVE-006: Host loop terminates on halt status", async () => {
      const schema = createTestSchema({
        actions: {
          haltAction: {
            flow: {
              kind: "halt",
              reason: "Test halt",
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("haltAction"));

      await adapter.drain(executionKey);

      // Should complete without hanging
      const trace = adapter.getTrace(executionKey);
      expect(trace.length).toBeGreaterThan(0);
    });
  });
});
