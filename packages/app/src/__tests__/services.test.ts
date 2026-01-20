/**
 * Services Tests
 *
 * @see SPEC §13 Services (Effect Handlers)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ServiceRegistry,
  createServiceRegistry,
  createServiceContext,
  createPatchHelpers,
} from "../runtime/services/index.js";
import { MissingServiceError, DynamicEffectTypeError, ReservedEffectTypeError } from "../errors/index.js";
import type { AppState, ServiceHandler, Patch } from "../core/types/index.js";

// Helper to create mock AppState
function createMockState<T>(data: T): AppState<T> {
  return {
    data,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    meta: {
      version: 1,
      timestamp: Date.now(),
      randomSeed: "test-seed",
      schemaHash: "test-schema-hash",
    },
  };
}

describe("Services", () => {
  describe("PatchHelpers", () => {
    it("should create set patch", () => {
      const helpers = createPatchHelpers();

      const patch = helpers.set("data.count", 5);

      expect(patch).toEqual({ op: "set", path: "data.count", value: 5 });
    });

    it("should create merge patch", () => {
      const helpers = createPatchHelpers();

      const patch = helpers.merge("data.user", { name: "Alice", age: 30 });

      expect(patch).toEqual({
        op: "merge",
        path: "data.user",
        value: { name: "Alice", age: 30 },
      });
    });

    it("should create unset patch", () => {
      const helpers = createPatchHelpers();

      const patch = helpers.unset("data.temp");

      expect(patch).toEqual({ op: "unset", path: "data.temp" });
    });

    it("should combine patches with many()", () => {
      const helpers = createPatchHelpers();

      const patches = helpers.many(
        helpers.set("data.a", 1),
        helpers.set("data.b", 2),
        [helpers.set("data.c", 3), helpers.set("data.d", 4)]
      );

      expect(patches).toHaveLength(4);
      expect(patches[0]).toEqual({ op: "set", path: "data.a", value: 1 });
      expect(patches[3]).toEqual({ op: "set", path: "data.d", value: 4 });
    });

    it("should create patches from record", () => {
      const helpers = createPatchHelpers();

      const patches = helpers.from({ count: 5, name: "test" });

      expect(patches).toHaveLength(2);
      expect(patches).toContainEqual({ op: "set", path: "count", value: 5 });
      expect(patches).toContainEqual({ op: "set", path: "name", value: "test" });
    });

    it("should create patches from record with basePath", () => {
      const helpers = createPatchHelpers();

      const patches = helpers.from({ count: 5 }, { basePath: "data.stats" });

      expect(patches).toEqual([
        { op: "set", path: "data.stats.count", value: 5 },
      ]);
    });
  });

  describe("ServiceContext", () => {
    it("should create context with all required fields", () => {
      const snapshot = createMockState({ count: 0 });

      const ctx = createServiceContext({
        snapshot,
        actorId: "user-123",
        worldId: "world-abc",
        branchId: "main",
      });

      expect(ctx.snapshot).toBe(snapshot);
      expect(ctx.actorId).toBe("user-123");
      expect(ctx.worldId).toBe("world-abc");
      expect(ctx.branchId).toBe("main");
      expect(ctx.signal).toBeDefined();
      expect(ctx.patch).toBeDefined();
    });

    it("should use provided AbortSignal", () => {
      const snapshot = createMockState({ count: 0 });
      const controller = new AbortController();

      const ctx = createServiceContext({
        snapshot,
        actorId: "user-123",
        worldId: "world-abc",
        branchId: "main",
        signal: controller.signal,
      });

      expect(ctx.signal).toBe(controller.signal);
    });

    it("should provide patch helpers", () => {
      const snapshot = createMockState({ count: 0 });

      const ctx = createServiceContext({
        snapshot,
        actorId: "user-123",
        worldId: "world-abc",
        branchId: "main",
      });

      const patch = ctx.patch.set("data.count", 5);
      expect(patch).toEqual({ op: "set", path: "data.count", value: 5 });
    });
  });

  describe("ServiceRegistry", () => {
    describe("Basic operations", () => {
      it("should register and check service existence", () => {
        const registry = createServiceRegistry({
          "api.fetch": async () => [],
        });

        expect(registry.has("api.fetch")).toBe(true);
        expect(registry.has("api.unknown")).toBe(false);
      });

      it("should get registered service handler", () => {
        const handler: ServiceHandler = async () => [];
        const registry = createServiceRegistry({
          "api.fetch": handler,
        });

        expect(registry.get("api.fetch")).toBe(handler);
        expect(registry.get("api.unknown")).toBeUndefined();
      });

      it("should list registered types", () => {
        const registry = createServiceRegistry({
          "api.fetch": async () => [],
          "api.post": async () => [],
          "db.query": async () => [],
        });

        const types = registry.getRegisteredTypes();

        expect(types).toContain("api.fetch");
        expect(types).toContain("api.post");
        expect(types).toContain("db.query");
        expect(types).toHaveLength(3);
      });
    });

    describe("SVC-1: Missing service at execution (lazy mode)", () => {
      it("should return error result when service is missing", async () => {
        const registry = createServiceRegistry({});
        const snapshot = createMockState({});

        const result = await registry.execute("api.unknown", {}, {
          snapshot,
          actorId: "user-123",
          worldId: "world-abc",
          branchId: "main",
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("MISSING_SERVICE");
        expect(result.error?.message).toContain("api.unknown");
      });
    });

    describe("SVC-2/3: Strict mode validation", () => {
      it("should throw MissingServiceError when service is missing in strict mode", () => {
        const registry = createServiceRegistry({}, {
          validationMode: "strict",
        });

        expect(() => {
          registry.validate(["api.fetch", "api.post"]);
        }).toThrow(MissingServiceError);
      });

      it("should pass validation when all services are registered", () => {
        const registry = createServiceRegistry({
          "api.fetch": async () => [],
          "api.post": async () => [],
        }, {
          validationMode: "strict",
        });

        expect(() => {
          registry.validate(["api.fetch", "api.post"]);
        }).not.toThrow();
      });

      it("should skip validation for system.get (SYSGET-4)", () => {
        const registry = createServiceRegistry({}, {
          validationMode: "strict",
        });

        expect(() => {
          registry.validate(["system.get"]);
        }).not.toThrow();
      });
    });

    describe("SVC-4: Dynamic effect type warning (strict+warn)", () => {
      it("should warn on dynamic effect type", async () => {
        const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const registry = createServiceRegistry({}, {
          validationMode: "strict+warn",
          knownEffectTypes: ["api.fetch"],
        });

        await registry.execute("api.unknown", {}, {
          snapshot: createMockState({}),
          actorId: "user-123",
          worldId: "world-abc",
          branchId: "main",
        });

        expect(consoleWarn).toHaveBeenCalled();
        consoleWarn.mockRestore();
      });
    });

    describe("SVC-5: Dynamic effect type error (strict+error)", () => {
      it("should throw DynamicEffectTypeError on dynamic effect type", async () => {
        const registry = createServiceRegistry({}, {
          validationMode: "strict+error",
          knownEffectTypes: ["api.fetch"],
        });

        await expect(
          registry.execute("api.unknown", {}, {
            snapshot: createMockState({}),
            actorId: "user-123",
            worldId: "world-abc",
            branchId: "main",
          })
        ).rejects.toThrow(DynamicEffectTypeError);
      });
    });

    describe("SYSGET-2/3: Reserved effect type", () => {
      it("should throw ReservedEffectTypeError when system.get is registered", () => {
        expect(() => {
          createServiceRegistry({
            "system.get": async () => [],
          });
        }).not.toThrow(); // Constructor doesn't throw

        const registry = createServiceRegistry({
          "system.get": async () => [],
        });

        expect(() => {
          registry.validate([]);
        }).toThrow(ReservedEffectTypeError);
      });

      it("should throw when merging services with system.get", () => {
        const registry = createServiceRegistry({
          "api.fetch": async () => [],
        });

        expect(() => {
          registry.merge({ "system.get": async () => [] });
        }).toThrow(ReservedEffectTypeError);
      });
    });

    describe("Service execution", () => {
      it("should execute handler and return patches", async () => {
        const handler: ServiceHandler = async (params, ctx) => {
          return ctx.patch.set("data.result", params.value);
        };

        const registry = createServiceRegistry({
          "api.fetch": handler,
        });

        const result = await registry.execute(
          "api.fetch",
          { value: 42 },
          {
            snapshot: createMockState({}),
            actorId: "user-123",
            worldId: "world-abc",
            branchId: "main",
          }
        );

        expect(result.success).toBe(true);
        expect(result.patches).toEqual([
          { op: "set", path: "data.result", value: 42 },
        ]);
      });

      it("should handle handler returning array of patches", async () => {
        const handler: ServiceHandler = async (params, ctx) => {
          return [
            ctx.patch.set("data.a", 1),
            ctx.patch.set("data.b", 2),
          ];
        };

        const registry = createServiceRegistry({ "test": handler });

        const result = await registry.execute("test", {}, {
          snapshot: createMockState({}),
          actorId: "user-123",
          worldId: "world-abc",
          branchId: "main",
        });

        expect(result.success).toBe(true);
        expect(result.patches).toHaveLength(2);
      });

      it("should handle handler returning { patches: [] }", async () => {
        const handler: ServiceHandler = async (params, ctx) => {
          return { patches: [ctx.patch.set("data.result", true)] };
        };

        const registry = createServiceRegistry({ "test": handler });

        const result = await registry.execute("test", {}, {
          snapshot: createMockState({}),
          actorId: "user-123",
          worldId: "world-abc",
          branchId: "main",
        });

        expect(result.success).toBe(true);
        expect(result.patches).toHaveLength(1);
      });

      it("should handle handler returning void", async () => {
        const handler: ServiceHandler = async () => {
          // No return value
        };

        const registry = createServiceRegistry({ "test": handler });

        const result = await registry.execute("test", {}, {
          snapshot: createMockState({}),
          actorId: "user-123",
          worldId: "world-abc",
          branchId: "main",
        });

        expect(result.success).toBe(true);
        expect(result.patches).toEqual([]);
      });
    });

    describe("SVC-ERR-1~5: Error handling", () => {
      it("SVC-ERR-2/3: Should catch handler exception and return failed result", async () => {
        const handler: ServiceHandler = async () => {
          throw new Error("Handler failed");
        };

        const registry = createServiceRegistry({ "test": handler });

        const result = await registry.execute("test", {}, {
          snapshot: createMockState({}),
          actorId: "user-123",
          worldId: "world-abc",
          branchId: "main",
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("SVC-ERR-4: Error should have code='SERVICE_HANDLER_THROW'", async () => {
        const handler: ServiceHandler = async () => {
          throw new Error("Handler failed");
        };

        const registry = createServiceRegistry({ "test": handler });

        const result = await registry.execute("test", {}, {
          snapshot: createMockState({}),
          actorId: "user-123",
          worldId: "world-abc",
          branchId: "main",
        });

        expect(result.error?.code).toBe("SERVICE_HANDLER_THROW");
      });

      it("SVC-ERR-5: Error message should be preserved", async () => {
        const handler: ServiceHandler = async () => {
          throw new Error("Specific error message");
        };

        const registry = createServiceRegistry({ "test": handler });

        const result = await registry.execute("test", {}, {
          snapshot: createMockState({}),
          actorId: "user-123",
          worldId: "world-abc",
          branchId: "main",
        });

        expect(result.error?.message).toBe("Specific error message");
      });

      it("Should include context in error", async () => {
        const handler: ServiceHandler = async () => {
          throw new Error("Failed");
        };

        const registry = createServiceRegistry({ "api.fetch": handler });

        const result = await registry.execute(
          "api.fetch",
          { url: "http://example.com" },
          {
            snapshot: createMockState({}),
            actorId: "user-123",
            worldId: "world-abc",
            branchId: "main",
          }
        );

        expect(result.error?.context).toEqual({
          effectType: "api.fetch",
          params: { url: "http://example.com" },
        });
      });
    });

    describe("merge()", () => {
      it("should merge services", () => {
        const registry = createServiceRegistry({
          "api.a": async () => [],
        });

        const merged = registry.merge({
          "api.b": async () => [],
        });

        expect(merged.has("api.a")).toBe(true);
        expect(merged.has("api.b")).toBe(true);
      });

      it("should override existing services", () => {
        const handler1: ServiceHandler = async () => [{ op: "set", path: "a", value: 1 }];
        const handler2: ServiceHandler = async () => [{ op: "set", path: "b", value: 2 }];

        const registry = createServiceRegistry({ "api.fetch": handler1 });
        const merged = registry.merge({ "api.fetch": handler2 });

        expect(merged.get("api.fetch")).toBe(handler2);
      });
    });

    describe("Sync handlers", () => {
      it("should support synchronous handlers", async () => {
        const handler: ServiceHandler = (params, ctx) => {
          return ctx.patch.set("data.result", "sync");
        };

        const registry = createServiceRegistry({ "sync.test": handler });

        const result = await registry.execute("sync.test", {}, {
          snapshot: createMockState({}),
          actorId: "user-123",
          worldId: "world-abc",
          branchId: "main",
        });

        expect(result.success).toBe(true);
        expect(result.patches).toEqual([
          { op: "set", path: "data.result", value: "sync" },
        ]);
      });
    });
  });
});
