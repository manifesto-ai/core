/**
 * HCTS Effect Handler Test Suite
 *
 * Tests for effect handler contract rules:
 * - HANDLER-1: Effect handlers return Patch[]
 * - HANDLER-2: Effect handlers MUST NOT throw
 * - HANDLER-3: Failures expressed as patches
 * - HANDLER-4: No domain logic in handlers
 * - HANDLER-5: Pure IO adapters
 *
 * @see host-SPEC-v2.0.2.md §7
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
import { getHostState } from "../../../types/host-state.js";

describe("HCTS Effect Handler Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;
  const executionKey = "handler-test-1";

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV1Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("HANDLER-1: Effect handlers return Patch[]", () => {
    it("HCTS-HANDLER-001: Handler returning Patch[] updates snapshot", async () => {
      const schema = createTestSchema({
        actions: {
          patchReturn: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
              then: {
                kind: "effect",
                type: "returnPatches",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("returnPatches", async () => [
        { op: "set", path: "response", value: { success: true, timestamp: 123 } },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("patchReturn"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const response = (finalSnapshot.data as Record<string, unknown>).response as Record<string, unknown>;

      expect(response.success).toBe(true);
      expect(response.timestamp).toBe(123);
    });
  });

  describe("HANDLER-2: Effect handlers MUST NOT throw", () => {
    it("HCTS-HANDLER-003: Throwing handler error is captured", async () => {
      const schema = createTestSchema({
        actions: {
          throwingHandler: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "$host.lastError" } },
              then: {
                kind: "effect",
                type: "thrower",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("thrower", async () => {
        throw new Error("Handler threw an exception");
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("throwingHandler"));

      // Should NOT throw - error should be captured
      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const hostState = getHostState(finalSnapshot.data);

      // Error should be recorded in host state
      expect(hostState?.errors?.length).toBeGreaterThan(0);
    });
  });

  describe("HANDLER-3: Failures expressed as patches", () => {
    it("HCTS-HANDLER-005: Error can be expressed as patch", async () => {
      const schema = createTestSchema({
        actions: {
          errorPatch: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
              then: {
                kind: "effect",
                type: "fetchData",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("fetchData", async () => {
        // Simulating a proper handler that returns error as patches
        return [
          { op: "set", path: "response", value: { error: true, message: "Network timeout" } },
        ];
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("errorPatch"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const response = (finalSnapshot.data as Record<string, unknown>).response as Record<string, unknown>;

      // Error expressed as data patches
      expect(response.error).toBe(true);
      expect(response.message).toBe("Network timeout");
    });
  });

  describe("HANDLER-5: Pure IO adapters", () => {
    it("HCTS-HANDLER-007: Handler receives params and returns patches", async () => {
      const schema = createTestSchema({
        actions: {
          pureIo: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
              then: {
                kind: "effect",
                type: "pureHandler",
                params: {
                  input: { kind: "lit", value: "test-input" },
                },
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      let receivedParams: Record<string, unknown> | null = null;

      effectRunner.register("pureHandler", async (_type, params) => {
        receivedParams = params;
        return [
          { op: "set", path: "response", value: { echoed: params.input } },
        ];
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("pureIo"));

      await adapter.drain(executionKey);

      // Handler received correct params
      expect(receivedParams).toEqual({ input: "test-input" });

      // Handler output applied correctly
      const finalSnapshot = adapter.getSnapshot(executionKey);
      const response = (finalSnapshot.data as Record<string, unknown>).response as Record<string, unknown>;
      expect(response.echoed).toBe("test-input");
    });
  });
});
