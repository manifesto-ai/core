/**
 * HCTS Job Test Suite
 *
 * Tests for job lifecycle rules:
 * - JOB-1: Run to completion
 * - JOB-2: No interleaving
 * - JOB-3: FIFO ordering within runner
 * - JOB-4: Atomic state transitions
 * - JOB-5: Job types
 *
 * @see host-SPEC-v2.0.1.md §10.4
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestRuntime, type DeterministicRuntime } from "../hcts-runtime.js";
import { createV1Adapter } from "../adapter-v2.js";
import type { HostTestAdapter } from "../hcts-adapter.js";
import {
  assertRunToCompletion,
  expectCompliance,
} from "../hcts-assertions.js";
import {
  createTestSchema,
  createTestIntent,
  createTestSnapshot,
} from "../../helpers/index.js";
import { createTestEffectRunner } from "../hcts-adapter.js";

describe("HCTS Job Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;
  const executionKey = "job-test-1";

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV1Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("JOB-1: Run to completion", () => {
    it("HCTS-JOB-001: Jobs run to completion without interleaving", async () => {
      // In v1.x, jobs run synchronously so this is satisfied by design
      // This test validates that pattern holds

      const schema = createTestSchema({
        actions: {
          multiStep: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: "step1",
                  value: { kind: "lit", value: true },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: "step2",
                  value: { kind: "lit", value: true },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: "step3",
                  value: { kind: "lit", value: true },
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
      adapter.submitIntent(executionKey, createTestIntent("multiStep"));

      await adapter.drain(executionKey);

      const trace = adapter.getTrace(executionKey);
      const result = assertRunToCompletion(trace, executionKey);
      expectCompliance(result);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const data = finalSnapshot.data as Record<string, unknown>;
      expect(data.step1).toBe(true);
      expect(data.step2).toBe(true);
      expect(data.step3).toBe(true);
    });
  });

  describe("JOB-4: Atomic state transitions", () => {
    it("HCTS-JOB-002: All patches from a compute are applied atomically", async () => {
      const schema = createTestSchema({
        actions: {
          atomicUpdate: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: "a",
                  value: { kind: "lit", value: 1 },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: "b",
                  value: { kind: "lit", value: 2 },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: "c",
                  value: { kind: "lit", value: 3 },
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
      adapter.submitIntent(executionKey, createTestIntent("atomicUpdate"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const data = finalSnapshot.data as Record<string, unknown>;

      // All patches applied together
      expect(data.a).toBe(1);
      expect(data.b).toBe(2);
      expect(data.c).toBe(3);

      // Version should increment by the number of patch applications
      // (depends on implementation, but should be consistent)
      expect(finalSnapshot.meta.version).toBeGreaterThan(0);
    });
  });

  describe("JOB-5: Job types", () => {
    it("HCTS-JOB-003: StartIntent job processes initial intent", async () => {
      const schema = createTestSchema({
        actions: {
          start: {
            flow: {
              kind: "patch",
              op: "set",
              path: "started",
              value: { kind: "lit", value: true },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("start"));

      await adapter.drain(executionKey);

      const trace = adapter.getTrace(executionKey);
      const jobStartEvents = trace.filter(
        (e) => e.t === "job:start" && e.jobType === "StartIntent"
      );

      expect(jobStartEvents.length).toBeGreaterThan(0);
    });

    it("HCTS-JOB-004: ContinueCompute job resumes after effect", async () => {
      const schema = createTestSchema({
        actions: {
          withEffect: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "if",
                  cond: { kind: "isNull", arg: { kind: "get", path: "effectDone" } },
                  then: {
                    kind: "effect",
                    type: "async",
                    params: {},
                  },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: "continued",
                  value: { kind: "lit", value: true },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("async", async () => [
        { op: "set", path: "effectDone", value: true },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("withEffect"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const data = finalSnapshot.data as Record<string, unknown>;

      // The flow should have continued after effect
      expect(data.effectDone).toBe(true);
      expect(data.continued).toBe(true);

      // Check for continue:enqueue in trace
      const trace = adapter.getTrace(executionKey);
      const continueEvents = trace.filter((e) => e.t === "continue:enqueue");
      expect(continueEvents.length).toBeGreaterThan(0);
    });
  });
});
