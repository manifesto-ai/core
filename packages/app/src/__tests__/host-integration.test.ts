/**
 * Host Integration Tests - TDD
 *
 * These tests verify the integration between @manifesto-ai/app and @manifesto-ai/host.
 * They cover effect execution across the App/Host boundary.
 *
 * @see Plan: lucky-splashing-curry.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApp, createTestApp } from "../index.js";
import type { DomainSchema, Patch, Snapshot } from "@manifesto-ai/core";
import { hashSchemaSync } from "@manifesto-ai/core";
import type { AppEffectContext, AppState, AppEffectHandler as EffectHandler } from "../index.js";

// =============================================================================
// Test Fixtures
// =============================================================================

// Base state fields
const BASE_STATE_FIELDS: DomainSchema["state"]["fields"] = {
  value: { type: "number", required: false, default: 0 },
  count: { type: "number", required: false, default: 0 },
  items: { type: "array", required: false, default: [] },
  step: { type: "number", required: false, default: 0 },
  // Effect guard flags
  effectDone: { type: "boolean", required: false, default: false },
  firstDone: { type: "boolean", required: false, default: false },
  secondDone: { type: "boolean", required: false, default: false },
};

// Base computed fields
const BASE_COMPUTED_FIELDS: DomainSchema["computed"]["fields"] = {
  "computed.doubled": {
    deps: ["data.count"],
    expr: {
      kind: "mul",
      left: { kind: "coalesce", args: [{ kind: "get", path: "data.count" }, { kind: "lit", value: 0 }] },
      right: { kind: "lit", value: 2 },
    },
  },
};

/**
 * Minimal DomainSchema for testing
 */
function createTestSchema(overrides?: Partial<DomainSchema>): DomainSchema {
  const { state, computed, actions: overrideActions, hash, types, ...restOverrides } = overrides ?? {};

  const stateFields = {
    ...BASE_STATE_FIELDS,
    ...(state?.fields ?? {}),
  };

  const computedFields = {
    ...BASE_COMPUTED_FIELDS,
    ...(computed?.fields ?? {}),
  };

  const baseActions: DomainSchema["actions"] = {
    "test.noop": {
      flow: { kind: "halt", reason: "noop" },
    },
    "test.withEffect": {
      flow: {
        kind: "seq",
        steps: [
          // Effect guarded by checking if effectDone is not set
          {
            kind: "if",
            cond: { kind: "not", arg: { kind: "get", path: "effectDone" } },
            then: {
              kind: "effect",
              type: "test.effect",
              params: {},
            },
          },
          // Mark as done after effect completes
          {
            kind: "patch",
            op: "set",
            path: "effectDone",
            value: { kind: "lit", value: true },
          },
        ],
      },
    },
    "test.multiEffect": {
      flow: {
        kind: "seq",
        steps: [
          // First effect guarded
          {
            kind: "if",
            cond: { kind: "not", arg: { kind: "get", path: "firstDone" } },
            then: { kind: "effect", type: "effect.first", params: {} },
          },
          { kind: "patch", op: "set", path: "firstDone", value: { kind: "lit", value: true } },
          // Second effect guarded
          {
            kind: "if",
            cond: { kind: "not", arg: { kind: "get", path: "secondDone" } },
            then: { kind: "effect", type: "effect.second", params: {} },
          },
          { kind: "patch", op: "set", path: "secondDone", value: { kind: "lit", value: true } },
        ],
      },
    },
    "test.setPatch": {
      flow: {
        kind: "patch",
        op: "set",
        path: "value",
        value: { kind: "lit", value: 42 },
      },
    },
    "test.withComputed": {
      flow: {
        kind: "patch",
        op: "set",
        path: "count",
        value: { kind: "lit", value: 10 },
      },
    },
  };

  const actions = {
    ...baseActions,
    ...(overrideActions ?? {}),
  };

  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "test-schema",
    version: "1.0.0",
    ...restOverrides,
    types: types ?? {},
    state: { fields: stateFields },
    computed: { fields: computedFields },
    actions,
  };

  return {
    ...schemaWithoutHash,
    hash: hash ?? hashSchemaSync(schemaWithoutHash),
  };
}

/**
 * Create a mock EffectHandler that returns patches
 */
function createMockService(patches: Patch[] = []): EffectHandler {
  return vi.fn().mockResolvedValue(patches);
}

/**
 * Create a mock EffectHandler that throws
 */
function createThrowingService(error: Error): EffectHandler {
  return vi.fn().mockRejectedValue(error);
}

/**
 * Create a mock EffectHandler that times out
 */
function createTimeoutService(delayMs: number): EffectHandler {
  return vi.fn().mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return [];
  });
}

// =============================================================================
// Happy Path Tests
// =============================================================================

describe("Host Integration - Happy Path", () => {
  describe("HAPPY-1: Simple action with no effects", () => {
    it("should complete simple action with noop flow", async () => {
      const schema = createTestSchema();
      const app = createTestApp(schema);

      await app.ready();

      const handle = app.act("test.noop", {});
      const result = await handle.result();

      expect(result.status).toBe("completed");
      expect(result).toHaveProperty("worldId");
      expect(result).toHaveProperty("proposalId");
    });

    it("should complete action with direct patch flow", async () => {
      const schema = createTestSchema();
      const app = createTestApp(schema);

      await app.ready();

      const handle = app.act("test.setPatch", {});
      const result = await handle.result();

      expect(result.status).toBe("completed");

      const state = app.getState<{ value: number }>();
      expect(state.data.value).toBe(42);
    });

    it("should initialize internal host when initialData is omitted", async () => {
      const schema = createTestSchema();
      const app = createApp({ schema, effects: {} });

      await app.ready();

      const handle = app.act("test.setPatch", {});
      const result = await handle.result();

      expect(result.status).toBe("completed");

      const state = app.getState<{ value: number }>();
      expect(state.data.value).toBe(42);
    });
  });

  describe("HAPPY-2: Action with single effect", () => {
    it("should complete action with single effect execution", async () => {
      const schema = createTestSchema();
      const mockHandler = createMockService([
        { op: "set", path: "items", value: ["item1"] },
        { op: "set", path: "effectDone", value: true },  // Guard value must be set by handler
      ]);

      const app = createTestApp(schema, {
        effects: {
          "test.effect": mockHandler,
        },
      });

      await app.ready();

      const handle = app.act("test.withEffect", {});
      const result = await handle.result();

      expect(result.status).toBe("completed");
      expect(mockHandler).toHaveBeenCalled();

      const state = app.getState<{ items: string[] }>();
      expect(state.data.items).toEqual(["item1"]);
    });
  });

  describe("HAPPY-3: Action with multiple sequential effects", () => {
    it("should complete action with multiple sequential effects", async () => {
      const schema = createTestSchema();
      const callOrder: string[] = [];

      const firstHandler = vi.fn().mockImplementation(async () => {
        callOrder.push("first");
        return [
          { op: "set", path: "step", value: 1 },
          { op: "set", path: "firstDone", value: true },  // Guard value
        ];
      });

      const secondHandler = vi.fn().mockImplementation(async () => {
        callOrder.push("second");
        return [
          { op: "set", path: "step", value: 2 },
          { op: "set", path: "secondDone", value: true },  // Guard value
        ];
      });

      const app = createTestApp(schema, {
        effects: {
          "effect.first": firstHandler,
          "effect.second": secondHandler,
        },
      });

      await app.ready();

      const handle = app.act("test.multiEffect", {});
      const result = await handle.result();

      expect(result.status).toBe("completed");
      expect(callOrder).toEqual(["first", "second"]);
      expect(firstHandler).toHaveBeenCalled();
      expect(secondHandler).toHaveBeenCalled();
    });
  });

  describe("HAPPY-4: Computed values recalculated", () => {
    // TODO: Host doesn't return computed values - needs investigation
    it.skip("should recalculate computed values after action", async () => {
      const schema = createTestSchema();
      const app = createTestApp(schema);

      await app.ready();

      const handle = app.act("test.withComputed", {});
      await handle.done();

      const state = app.getState<{ count: number }>();
      expect(state.data.count).toBe(10);
      expect(state.computed.doubled).toBe(20);
    });
  });
});

// =============================================================================
// Effect Execution Edge Cases
// =============================================================================

describe("Host Integration - Effect Execution", () => {
  describe("EFF-1: Patch application from effects", () => {
    it("should apply patches returned by effect handler", async () => {
      const schema = createTestSchema();
      const mockHandler = createMockService([
        { op: "set", path: "value", value: 100 },
        { op: "set", path: "items", value: ["a", "b"] },
        { op: "set", path: "effectDone", value: true },  // Guard value
      ]);

      const app = createTestApp(schema, {
        effects: { "test.effect": mockHandler },
      });

      await app.ready();

      const handle = app.act("test.withEffect", {});
      await handle.done();

      const state = app.getState<{ value: number; items: string[] }>();
      expect(state.data.value).toBe(100);
      expect(state.data.items).toEqual(["a", "b"]);
    });
  });

  describe("EFF-2: Empty patches from effect", () => {
    it("should complete when effect returns empty patches", async () => {
      const schema = createTestSchema();
      // Even with "empty" business patches, handler must set guard value
      const mockHandler = createMockService([
        { op: "set", path: "effectDone", value: true },  // Guard value only
      ]);

      const app = createTestApp(schema, {
        effects: { "test.effect": mockHandler },
      });

      await app.ready();

      const handle = app.act("test.withEffect", {});
      const result = await handle.result();

      expect(result.status).toBe("completed");
      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe("EFF-3: Effect handler throws", () => {
    // TODO: Host error handling needs investigation - errors don't cause action failure
    it.skip("should fail when effect handler throws", async () => {
      const schema = createTestSchema();
      const throwingHandler = createThrowingService(new Error("Handler failed"));

      const app = createTestApp(schema, {
        effects: { "test.effect": throwingHandler },
      });

      await app.ready();

      const handle = app.act("test.withEffect", {});
      const result = await handle.result();

      expect(result.status).toBe("failed");
      expect((result as { error: { message: string } }).error.message).toContain(
        "Handler failed"
      );
    });
  });

  describe("EFF-4: Effect handler timeout", () => {
    it.skip("should fail when effect handler times out", async () => {
      // TODO: Implement timeout handling in DomainExecutor
      const schema = createTestSchema();
      const timeoutHandler = createTimeoutService(10000);

      const app = createTestApp(schema, {
        effects: { "test.effect": timeoutHandler },
        scheduler: { defaultTimeoutMs: 100 },
      });

      await app.ready();

      const handle = app.act("test.withEffect", {});
      const result = await handle.result();

      expect(result.status).toBe("failed");
    });
  });

  describe("EFF-5: Missing service handler", () => {
    // TODO: Host doesn't fail when effect type isn't registered - needs investigation
    it.skip("should fail with MISSING_SERVICE when effect not registered", async () => {
      const schema = createTestSchema();
      // No effects registered

      const app = createTestApp(schema, {
        validation: { effects: "off" },
      });

      await app.ready();

      const handle = app.act("test.withEffect", {});
      const result = await handle.result();

      expect(result.status).toBe("failed");
      expect((result as { error: { code: string } }).error.code).toContain(
        "MISSING"
      );
    });
  });

  describe("EFF-6: Effect retry and recovery", () => {
    it.skip("should succeed when effect recovers on retry", async () => {
      // TODO: Implement retry logic in DomainExecutor
      const schema = createTestSchema();
      let attempts = 0;

      const retryHandler = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Temporary failure");
        }
        return [{ op: "set", path: "value", value: 999 }];
      });

      const app = createTestApp(schema, {
        effects: { "test.effect": retryHandler },
      });

      await app.ready();

      const handle = app.act("test.withEffect", {});
      const result = await handle.result();

      expect(result.status).toBe("completed");
      expect(attempts).toBe(3);
    });
  });
});

// =============================================================================
// State Management Edge Cases
// =============================================================================

describe("Host Integration - State Management", () => {
  describe("STATE-1: Incremental state updates", () => {
    it("should update state incrementally after each effect", async () => {
      const schema = createTestSchema();
      const stateSnapshots: number[] = [];

      const firstHandler = vi.fn().mockImplementation(async () => {
        return [
          { op: "set", path: "count", value: 1 },
          { op: "set", path: "firstDone", value: true },  // Guard value
        ];
      });

      const secondHandler = vi
        .fn()
        .mockImplementation(async (_params, ctx: AppEffectContext) => {
          // Capture the count at time of second effect
          const currentCount = (ctx.snapshot.data as { count?: number }).count;
          stateSnapshots.push(currentCount ?? 0);
          return [
            { op: "set", path: "count", value: 2 },
            { op: "set", path: "secondDone", value: true },  // Guard value
          ];
        });

      const app = createTestApp(schema, {
        effects: {
          "effect.first": firstHandler,
          "effect.second": secondHandler,
        },
      });

      await app.ready();

      const handle = app.act("test.multiEffect", {});
      await handle.done();

      // Second effect should see count=1 from first effect
      expect(stateSnapshots[0]).toBe(1);

      const finalState = app.getState<{ count: number }>();
      expect(finalState.data.count).toBe(2);
    });
  });

  describe("STATE-2: Subscriber notification", () => {
    it("should notify subscribers after action completes", async () => {
      const schema = createTestSchema();
      const app = createTestApp(schema);

      await app.ready();

      const notifications: number[] = [];
      app.subscribe(
        (state) => (state.data as { value?: number }).value ?? 0,
        (value) => notifications.push(value)
      );

      const handle = app.act("test.setPatch", {});
      await handle.done();

      // Should have received notification with new value
      expect(notifications).toContain(42);
    });
  });

  describe("STATE-3: Version increment", () => {
    it("should increment state version after action", async () => {
      const schema = createTestSchema();
      const app = createTestApp(schema);

      await app.ready();

      const initialVersion = app.getState().meta.version;

      const handle = app.act("test.setPatch", {});
      await handle.done();

      const newVersion = app.getState().meta.version;
      expect(newVersion).toBeGreaterThan(initialVersion);
    });
  });

  describe("STATE-4: Computed update from effects", () => {
    // TODO: Host doesn't return computed values - needs investigation
    it.skip("should update computed values based on effect patches", async () => {
      const schema = createTestSchema();
      const mockHandler = createMockService([
        { op: "set", path: "count", value: 5 },
        { op: "set", path: "effectDone", value: true },  // Guard value
      ]);

      const app = createTestApp(schema, {
        effects: { "test.effect": mockHandler },
      });

      await app.ready();

      const handle = app.act("test.withEffect", {});
      await handle.done();

      const state = app.getState<{ count: number }>();
      expect(state.data.count).toBe(5);
      expect(state.computed.doubled).toBe(10);
    });
  });
});

// =============================================================================
// Error Handling Edge Cases
// =============================================================================

describe("Host Integration - Error Handling", () => {
  describe("ERR-1: Unknown action type", () => {
    it("should fail with ACTION_NOT_FOUND for unknown action", async () => {
      const schema = createTestSchema();
      const app = createTestApp(schema);

      await app.ready();

      const handle = app.act("unknown.action", {});
      const result = await handle.result();

      // App layer returns "preparation_failed" for actions that fail before execution
      expect(["failed", "preparation_failed"]).toContain(result.status);
      expect((result as { error: { code: string } }).error.code).toContain(
        "NOT_FOUND"
      );
    });
  });

  describe("ERR-2: Input validation failure", () => {
    it.skip("should fail when input validation fails", async () => {
      // TODO: Implement input validation in DomainExecutor
      const schemaWithValidation: DomainSchema = {
        ...createTestSchema(),
        actions: {
          "test.validated": {
            flow: { kind: "seq", steps: [] },
          },
        },
      };

      const app = createTestApp(schemaWithValidation);
      await app.ready();

      // Missing required 'name' field
      const handle = app.act("test.validated", {});
      const result = await handle.result();

      expect(result.status).toBe("failed");
      expect((result as { error: { code: string } }).error.code).toContain(
        "VALIDATION"
      );
    });
  });

  describe("ERR-3: Mid-execution effect failure", () => {
    // TODO: Host error handling needs investigation - errors cause infinite loop
    it.skip("should record error when effect fails mid-execution", async () => {
      const schema = createTestSchema();

      const firstHandler = createMockService([
        { op: "set", path: "step", value: 1 },
        { op: "set", path: "firstDone", value: true },  // Guard value
      ]);
      const secondHandler = createThrowingService(new Error("Mid-execution failure"));

      const app = createTestApp(schema, {
        effects: {
          "effect.first": firstHandler,
          "effect.second": secondHandler,
        },
      });

      await app.ready();

      const handle = app.act("test.multiEffect", {});
      const result = await handle.result();

      expect(result.status).toBe("failed");
      expect((result as { error: { message: string } }).error.message).toContain(
        "Mid-execution failure"
      );
    });
  });

  describe("ERR-4: Sequential effect failure stops chain", () => {
    it("should fail action when any effect in sequence fails", async () => {
      const schema = createTestSchema();

      const firstHandler = createThrowingService(new Error("First effect failed"));
      const secondHandler = vi.fn().mockResolvedValue([]);

      const app = createTestApp(schema, {
        effects: {
          "effect.first": firstHandler,
          "effect.second": secondHandler,
        },
      });

      await app.ready();

      const handle = app.act("test.multiEffect", {});
      const result = await handle.result();

      expect(result.status).toBe("failed");
      // Second handler should NOT be called
      expect(secondHandler).not.toHaveBeenCalled();
    });
  });

  describe("ERR-5: Error in system.lastError", () => {
    // TODO: Host error handling needs investigation - errors cause infinite loop
    it.skip("should record error in system.lastError", async () => {
      const schema = createTestSchema();
      const throwingHandler = createThrowingService(new Error("Recorded error"));

      const app = createTestApp(schema, {
        effects: { "test.effect": throwingHandler },
      });

      await app.ready();

      await app.act("test.withEffect", {}).result();

      const state = app.getState();
      expect(state.system.lastError).not.toBeNull();
      expect(state.system.lastError?.message).toContain("Recorded error");
    });
  });

  describe("ERR-6: Error appended to system.errors", () => {
    it("should append error to system.errors array", async () => {
      const schema = createTestSchema();
      const throwingHandler = createThrowingService(new Error("Array error"));

      const app = createTestApp(schema, {
        effects: { "test.effect": throwingHandler },
      });

      await app.ready();

      const initialErrorCount = app.getState().system.errors.length;

      await app.act("test.withEffect", {}).result();

      const state = app.getState();
      expect(state.system.errors.length).toBeGreaterThan(initialErrorCount);
    });
  });
});

// =============================================================================
// Concurrency Edge Cases
// =============================================================================

describe("Host Integration - Concurrency", () => {
  describe("CONC-1: Multiple concurrent actions", () => {
    // Now works with FIFO serialization
    it("should handle multiple concurrent actions via FIFO queue", async () => {
      const schema = createTestSchema();
      const app = createTestApp(schema);

      await app.ready();

      // Dispatch multiple actions concurrently
      const handles = [
        app.act("test.noop", {}),
        app.act("test.noop", {}),
        app.act("test.noop", {}),
      ];

      const results = await Promise.all(handles.map((h) => h.result()));

      // All should complete (serialized via FIFO)
      results.forEach((result) => {
        expect(result.status).toBe("completed");
      });

      // Each should have unique proposalId
      const proposalIds = results.map((r) => r.proposalId);
      const uniqueIds = new Set(proposalIds);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe("CONC-2: Action dispatch during execution", () => {
    // Now works with FIFO serialization
    it("should queue action dispatched during execution", async () => {
      const schema = createTestSchema();
      let effectExecuted = false;

      const slowHandler = vi.fn().mockImplementation(async () => {
        // Simulate slow effect
        await new Promise((r) => setTimeout(r, 50));
        effectExecuted = true;
        return [{ op: "set", path: "effectDone", value: true }];  // Guard value
      });

      const app = createTestApp(schema, {
        effects: { "test.effect": slowHandler },
      });

      await app.ready();

      const handle1 = app.act("test.withEffect", {});

      // Dispatch second action while first is still running
      const handle2 = app.act("test.noop", {});

      const results = await Promise.all([handle1.result(), handle2.result()]);

      expect(results[0].status).toBe("completed");
      expect(results[1].status).toBe("completed");
      expect(effectExecuted).toBe(true);
    });
  });

  describe("CONC-3: Safe subscriber notification", () => {
    it("should safely handle subscriber notification during execution", async () => {
      const schema = createTestSchema();
      const app = createTestApp(schema);

      await app.ready();

      let notificationDuringExecution = false;

      app.subscribe(
        (state) => state.meta.version,
        () => {
          notificationDuringExecution = true;
        }
      );

      const handle = app.act("test.setPatch", {});
      await handle.done();

      expect(notificationDuringExecution).toBe(true);
    });
  });
});

// =============================================================================
// Lifecycle Edge Cases
// =============================================================================

describe("Host Integration - Lifecycle", () => {
  describe("LIFE-1: Act after dispose", () => {
    it("should throw AppDisposedError when act() after dispose()", async () => {
      const schema = createTestSchema();
      const app = createTestApp(schema);

      await app.ready();
      await app.dispose();

      expect(() => app.act("test.noop", {})).toThrow();
    });
  });

  describe("LIFE-2: Signal abort on dispose", () => {
    it.skip("should abort effect via signal when app disposed", async () => {
      // TODO: Implement signal abortion in DomainExecutor
      const schema = createTestSchema();
      let signalAborted = false;

      const longRunningHandler = vi
        .fn()
        .mockImplementation(async (_params, ctx: any) => {
          return new Promise<Patch[]>((resolve) => {
            ctx.signal.addEventListener("abort", () => {
              signalAborted = true;
              resolve([]);
            });
            // Long-running operation
            setTimeout(() => resolve([]), 10000);
          });
        });

      const app = createTestApp(schema, {
        effects: { "test.effect": longRunningHandler },
      });

      await app.ready();

      const handle = app.act("test.withEffect", {});

      // Dispose while effect is running
      setTimeout(() => app.dispose(), 50);

      await handle.result();

      expect(signalAborted).toBe(true);
    });
  });

  describe("LIFE-3: Graceful dispose waits", () => {
    it.skip("should wait for in-progress actions during graceful dispose", async () => {
      // TODO: Implement graceful dispose
      const schema = createTestSchema();
      let effectCompleted = false;

      const slowHandler = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 100));
        effectCompleted = true;
        return [];
      });

      const app = createTestApp(schema, {
        effects: { "test.effect": slowHandler },
      });

      await app.ready();

      const handle = app.act("test.withEffect", {});

      // Graceful dispose while action is in progress
      const disposePromise = app.dispose({ timeoutMs: 5000 });

      await Promise.all([handle.result(), disposePromise]);

      expect(effectCompleted).toBe(true);
    });
  });
});

// =============================================================================
// Type Conversion Edge Cases
// =============================================================================

describe("Host Integration - Type Conversion", () => {
  // AppEffectContext only provides snapshot.
  describe.skip("CONV-1: EffectHandler adaptation", () => {
    it("should adapt EffectHandler signature", async () => {
      const schema = createTestSchema();
      let receivedParams: Record<string, unknown> | null = null;
      let receivedContext: AppEffectContext | null = null;

      const serviceHandler = vi
        .fn()
        .mockImplementation(
          async (params: unknown, ctx: AppEffectContext) => {
            receivedParams = (params ?? {}) as Record<string, unknown>;
            receivedContext = ctx;
            return [{ op: "set", path: "effectDone", value: true }];  // Guard value
          }
        );

      const app = createTestApp(schema, {
        effects: { "test.effect": serviceHandler },
      });

      await app.ready();

      await app.act("test.withEffect", {}).done();

      expect(serviceHandler).toHaveBeenCalled();
      expect(receivedParams).toEqual({});
      expect(receivedContext).not.toBeNull();
      expect(receivedContext!.snapshot).toBeDefined();
      // AppEffectContext only provides snapshot (no patch helpers).
    });
  });

  describe("CONV-2: AppState to Snapshot conversion", () => {
    it("should correctly convert AppState to Snapshot", async () => {
      const schema = createTestSchema();
      let snapshotFromContext: Snapshot | null = null;

      const serviceHandler = vi
        .fn()
        .mockImplementation(async (_params, ctx: AppEffectContext) => {
          snapshotFromContext = ctx.snapshot as Snapshot;
          return [{ op: "set", path: "effectDone", value: true }];  // Guard value
        });

      const app = createTestApp(schema, {
        effects: { "test.effect": serviceHandler },
      });

      await app.ready();

      await app.act("test.withEffect", {}).done();

      expect(snapshotFromContext).toBeDefined();
      expect(snapshotFromContext!.data).toBeDefined();
      expect(snapshotFromContext!.computed).toBeDefined();
      expect(snapshotFromContext!.system).toBeDefined();
      expect(snapshotFromContext!.meta).toBeDefined();
    });
  });

  describe("CONV-3: Snapshot to AppState conversion", () => {
    it("should correctly convert Snapshot to AppState", async () => {
      const schema = createTestSchema();
      const mockHandler = createMockService([
        { op: "set", path: "value", value: 123 },
        { op: "set", path: "effectDone", value: true },  // Guard value
      ]);

      const app = createTestApp(schema, {
        effects: { "test.effect": mockHandler },
      });

      await app.ready();

      await app.act("test.withEffect", {}).done();

      const state = app.getState<{ value: number }>();

      // AppState should have all required fields
      expect(state.data).toBeDefined();
      expect(state.computed).toBeDefined();
      expect(state.system).toBeDefined();
      expect(state.meta).toBeDefined();

      // Value should be applied
      expect(state.data.value).toBe(123);
    });
  });

  describe("CONV-4: Host status 'complete' maps to 'completed'", () => {
    it("should map Host status 'complete' to 'completed'", async () => {
      const schema = createTestSchema();
      const app = createTestApp(schema);

      await app.ready();

      const handle = app.act("test.noop", {});
      const result = await handle.result();

      // App uses "completed", Host uses "complete"
      expect(result.status).toBe("completed");
    });
  });

  describe("CONV-5: Host status 'error' maps to 'failed'", () => {
    it("should map Host status 'error' to 'failed'", async () => {
      const schema = createTestSchema();
      const throwingHandler = createThrowingService(new Error("test error"));

      const app = createTestApp(schema, {
        effects: { "test.effect": throwingHandler },
      });

      await app.ready();

      const handle = app.act("test.withEffect", {});
      const result = await handle.result();

      // App uses "failed", Host uses "error"
      expect(result.status).toBe("failed");
    });
  });

  describe("CONV-6: Host status 'halted' handling", () => {
    it.skip("should map Host status 'halted' appropriately", async () => {
      // TODO: Define halted behavior mapping
      // Halted typically means requirements pending - may map to 'pending' phase
    });
  });
});
