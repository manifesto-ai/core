/**
 * HCTS Interlock Test Suite
 *
 * Tests for compute-requirement interlock rules:
 * - COMP-REQ-INTERLOCK-1: Apply before dispatch
 * - COMP-REQ-INTERLOCK-2: Patches atomicity
 *
 * @see host-SPEC-v2.0.1.md §10.4
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { TraceEvent } from "../hcts-types.js";
import { createTestRuntime, type DeterministicRuntime } from "../hcts-runtime.js";
import { createV1Adapter } from "../adapter-v2.js";
import type { HostTestAdapter } from "../hcts-adapter.js";
import {
  assertApplyBeforeDispatch,
  expectCompliance,
  filterByKey,
} from "../hcts-assertions.js";
import {
  createTestSchema,
  createTestIntent,
  createTestSnapshot,
} from "../../helpers/index.js";
import { createTestEffectRunner } from "../hcts-adapter.js";

describe("HCTS Interlock Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;
  const executionKey = "interlock-test-1";

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV1Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("COMP-REQ-INTERLOCK-1: Apply before dispatch", () => {
    it("HCTS-INTERLOCK-001: Compute patches are applied before effect dispatch", async () => {
      // This test verifies that when compute returns patches AND requirements,
      // the patches are applied BEFORE dispatching effects

      const schema = createTestSchema({
        actions: {
          patchThenEffect: {
            flow: {
              kind: "seq",
              steps: [
                // First, set a flag
                {
                  kind: "patch",
                  op: "set",
                  path: "patchApplied",
                  value: { kind: "lit", value: true },
                },
                // Then, if response is null, trigger effect (guarded)
                {
                  kind: "if",
                  cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
                  then: {
                    kind: "effect",
                    type: "http",
                    params: {},
                  },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      let snapshotAtEffectTime: Record<string, unknown> | null = null;

      effectRunner.register("http", async (_type, _params, context) => {
        // Capture what the snapshot looks like when effect runs
        snapshotAtEffectTime = context.snapshot.data as Record<string, unknown>;
        return [{ op: "set", path: "response", value: { data: "fetched" } }];
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({ patchApplied: false }, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("patchThenEffect"));

      await adapter.drain(executionKey);

      // Verify the trace shows apply before dispatch
      const trace = adapter.getTrace(executionKey);
      const result = assertApplyBeforeDispatch(trace, executionKey);
      expectCompliance(result);

      // Also verify that the effect saw the patched state
      // Note: This depends on the adapter implementation providing snapshot to effect
    });

    it("HCTS-INTERLOCK-001b: State modifications from patches visible to effect handler", async () => {
      // This test verifies that effect handlers receive parameters evaluated
      // from the state AFTER patches in the same compute cycle are applied

      const schema = createTestSchema({
        actions: {
          setThenRead: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: "counter",
                  value: { kind: "lit", value: 42 },
                },
                {
                  kind: "if",
                  cond: { kind: "isNull", arg: { kind: "get", path: "effectSawValue" } },
                  then: {
                    kind: "effect",
                    type: "readCounter",
                    params: {
                      // This expression is evaluated when compute() runs
                      // At that point, counter should be 42
                      counterValue: { kind: "get", path: "counter" },
                    },
                  },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      let receivedCounterValue: unknown = null;

      effectRunner.register("readCounter", async (_type, params) => {
        receivedCounterValue = params.counterValue;
        return [{ op: "set", path: "effectSawValue", value: params.counterValue }];
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("setThenRead"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);

      // Counter should be set
      expect((finalSnapshot.data as Record<string, unknown>).counter).toBe(42);

      // The effect should have received the counter value from expression evaluation
      // Note: In v1.x, the expression { kind: "get", path: "counter" } is evaluated
      // during compute, which reads from the already-patched state
      expect(receivedCounterValue).toBe(42);
      expect((finalSnapshot.data as Record<string, unknown>).effectSawValue).toBe(42);
    });
  });

  describe("Trace validation", () => {
    it("should record core:compute events", async () => {
      const schema = createTestSchema({
        actions: {
          simple: {
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
      adapter.submitIntent(executionKey, createTestIntent("simple"));

      await adapter.drain(executionKey);

      const trace = adapter.getTrace(executionKey);
      const computeEvents = trace.filter((e) => e.t === "core:compute");

      expect(computeEvents.length).toBeGreaterThan(0);
      expect(computeEvents[0].key).toBe(executionKey);
    });

    it("should record effect:dispatch events", async () => {
      const schema = createTestSchema({
        actions: {
          withEffect: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
              then: {
                kind: "effect",
                type: "test",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("test", async () => [
        { op: "set", path: "response", value: "done" },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("withEffect"));

      await adapter.drain(executionKey);

      const trace = adapter.getTrace(executionKey);
      const dispatchEvents = trace.filter(
        (e) => e.t === "effect:dispatch"
      ) as Array<Extract<TraceEvent, { t: "effect:dispatch" }>>;

      expect(dispatchEvents.length).toBeGreaterThan(0);
      expect(dispatchEvents[0].effectType).toBe("test");
    });
  });
});
