/**
 * HCTS Fulfillment Test Suite
 *
 * Tests for effect fulfillment lifecycle rules:
 * - REQ-CLEAR-1: Requirements cleared after fulfillment
 * - FULFILL-0: Stale fulfillment protection
 * - ERR-FE-1~2: Clear even on apply failure
 *
 * @see host-SPEC-v2.0.1.md §10.6
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCore, type ManifestoCore } from "@manifesto-ai/core";
import type { TraceEvent } from "../hcts-types.js";
import { createTestRuntime, type DeterministicRuntime } from "../hcts-runtime.js";
import { createV1Adapter, type V1HostAdapter } from "../adapter-v2.js";
import type { HostTestAdapter } from "../hcts-adapter.js";
import {
  assertRequirementCleared,
  assertNoInfiniteLoop,
  assertClearOnApplyFailure,
  expectCompliance,
} from "../hcts-assertions.js";
import {
  createTestSchema,
  createTestIntent,
  createTestSnapshot,
  createSnapshotWithRequirements,
  createTestRequirement,
} from "../../helpers/index.js";
import { createTestEffectRunner } from "../hcts-adapter.js";
import { getHostState } from "../../../types/host-state.js";

describe("HCTS Fulfillment Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;
  const executionKey = "test-key-1";

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV1Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("REQ-CLEAR-1: Requirement cleared after fulfillment", () => {
    it("HCTS-REQ-001: Requirements are removed from pendingRequirements after successful effect execution", async () => {
      // Setup: Schema with effect that sets data
      const schema = createTestSchema({
        actions: {
          fetchData: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
              then: {
                kind: "effect",
                type: "http",
                params: { url: { kind: "lit", value: "https://api.test.com" } },
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("http", async () => [
        { op: "set", path: "response", value: { data: "fetched" } },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      // Seed snapshot and submit intent
      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("fetchData"));

      // Drain to completion
      await adapter.drain(executionKey);

      // Verify: Requirements should be cleared
      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect(finalSnapshot.system.pendingRequirements).toHaveLength(0);
      expect(finalSnapshot.system.status).toBe("idle");
      expect((finalSnapshot.data as Record<string, unknown>).response).toEqual({ data: "fetched" });
    });

    it("HCTS-REQ-001b: Multiple requirements are cleared in sequence", async () => {
      const schema = createTestSchema({
        actions: {
          multiEffect: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "if",
                  cond: { kind: "not", arg: { kind: "get", path: "step1Done" } },
                  then: { kind: "effect", type: "step1", params: {} },
                },
                {
                  kind: "if",
                  cond: {
                    kind: "and",
                    args: [
                      { kind: "get", path: "step1Done" },
                      { kind: "not", arg: { kind: "get", path: "step2Done" } },
                    ],
                  },
                  then: { kind: "effect", type: "step2", params: {} },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("step1", async () => [
        { op: "set", path: "step1Done", value: true },
      ]);
      effectRunner.register("step2", async () => [
        { op: "set", path: "step2Done", value: true },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("multiEffect"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect(finalSnapshot.system.pendingRequirements).toHaveLength(0);
      expect((finalSnapshot.data as Record<string, unknown>).step1Done).toBe(true);
      expect((finalSnapshot.data as Record<string, unknown>).step2Done).toBe(true);
    });
  });

  describe("FULFILL-0: Stale fulfillment protection", () => {
    it("HCTS-FULFILL-001: Stale requirements from previous intents are not executed", async () => {
      // This tests the v1.x behavior where stale requirements are cleared before compute
      const schema = createTestSchema({
        actions: {
          checkStale: {
            flow: {
              kind: "patch",
              op: "set",
              path: "checked",
              value: { kind: "lit", value: true },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      let effectCalled = false;
      effectRunner.register("staleEffect", async () => {
        effectCalled = true;
        return [];
      });

      await adapter.create({ schema, effectRunner, runtime });

      // Seed snapshot with stale requirement from different action
      const staleRequirement = createTestRequirement("staleEffect", {}, {
        id: "stale-req-1",
        actionId: "differentAction",
      });
      const snapshot = createSnapshotWithRequirements(
        {},
        schema.hash,
        [staleRequirement]
      );
      adapter.seedSnapshot(executionKey, snapshot);

      // Submit a different intent
      adapter.submitIntent(executionKey, createTestIntent("checkStale"));
      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);

      // Verify stale effect was NOT executed (v1.x clears stale requirements)
      // Note: v1.x Host clears all pending requirements before computing new intent
      expect(effectCalled).toBe(false);
      expect(finalSnapshot.system.pendingRequirements).toHaveLength(0);
      expect((finalSnapshot.data as Record<string, unknown>).checked).toBe(true);
    });
  });

  describe("ERR-FE-1~2: Clear even on apply failure", () => {
    it("HCTS-FULFILL-002: Requirement is cleared even when effect handler throws", async () => {
      // This test verifies that when an effect handler throws, the requirement
      // is still cleared from pendingRequirements and the error is recorded.
      // The flow uses state-guard pattern to ensure completion after error.
      const schema = createTestSchema({
        actions: {
          failingEffect: {
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
        throw new Error("Effect handler failed!");
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("failingEffect"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);

      // Verify: Even with error, requirement should be cleared
      expect(finalSnapshot.system.pendingRequirements).toHaveLength(0);

      const hostState = getHostState(finalSnapshot.data);

      // The error should be recorded in the errors array
      expect(hostState?.errors?.length ?? 0).toBeGreaterThan(0);

      // Verify the error has the expected message
      const effectError = hostState?.errors?.find(
        (e) => e.code === "EFFECT_EXECUTION_FAILED"
      );
      expect(effectError).toBeDefined();
      expect(effectError?.message).toContain("Effect handler failed");
    });

    it("HCTS-FULFILL-002b: Unknown effect type clears requirement and records error", async () => {
      const schema = createTestSchema({
        actions: {
          unknownEffect: {
            flow: {
              kind: "if",
              cond: { kind: "get", path: "$host.lastError" },
              then: {
                kind: "patch",
                op: "set",
                path: "errorHandled",
                value: { kind: "lit", value: true },
              },
              else: {
                kind: "effect",
                type: "nonexistent",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      // Note: We don't register the "nonexistent" effect

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("unknownEffect"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);

      // Verify: Requirement cleared even for unknown effect
      expect(finalSnapshot.system.pendingRequirements).toHaveLength(0);
      const hostState = getHostState(finalSnapshot.data);
      expect(hostState?.errors?.length ?? 0).toBeGreaterThan(0);
      expect(hostState?.errors?.[0]?.code).toBe("UNKNOWN_EFFECT");
    });
  });

  describe("INV-RL-2: No infinite loop on requirement re-execution", () => {
    it("HCTS-REQ-002: Effect returning no patches does not cause infinite loop", async () => {
      // This test verifies that even when an effect returns empty patches,
      // the requirement is still cleared to prevent infinite loops
      const schema = createTestSchema({
        actions: {
          noopEffect: {
            flow: {
              kind: "effect",
              type: "noop",
              params: {},
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      let executionCount = 0;
      effectRunner.register("noop", async () => {
        executionCount++;
        return []; // Returns no patches
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("noopEffect"));

      await adapter.drain(executionKey);

      // Verify: Effect was not executed in an infinite loop
      // With proper REQ-CLEAR-1 implementation, the loop should hit max iterations
      // but not execute the same effect repeatedly
      const trace = adapter.getTrace(executionKey);
      const dispatchEvents = trace.filter((e) => e.t === "effect:dispatch");

      // Should not have excessive dispatches
      expect(dispatchEvents.length).toBeLessThanOrEqual(100);
    });
  });
});
