import { describe, it, expect, beforeEach, vi } from "vitest";
import { EffectExecutor, createEffectExecutor } from "./executor.js";
import { EffectHandlerRegistry, createEffectRegistry } from "./registry.js";
import type { EffectHandler } from "./types.js";
import type { Snapshot, Requirement, Patch } from "@manifesto-ai/core";

// Helper to create a minimal snapshot for testing
function createTestSnapshot(data: unknown = {}): Snapshot {
  return {
    data,
    system: {
      status: "idle",
      pendingRequirements: [],
      lastError: null,
      errors: [],
      currentAction: null,
    },
    meta: {
      version: 1,
      timestamp: Date.now(),
      schemaHash: "test-hash",
    },
    computed: {},
    input: undefined,
  };
}

// Helper to create a test requirement
function createTestRequirement(
  type: string,
  params: Record<string, unknown> = {},
  id?: string
): Requirement {
  return {
    id: id ?? `req-${type}-${Date.now()}`,
    type,
    params,
    actionId: "test-action",
    flowPosition: {
      nodePath: "root",
      snapshotVersion: 0,
    },
    createdAt: Date.now(),
  };
}

describe("EffectExecutor", () => {
  let registry: EffectHandlerRegistry;
  let executor: EffectExecutor;

  beforeEach(() => {
    registry = createEffectRegistry();
    executor = new EffectExecutor(registry);
  });

  describe("execute", () => {
    it("should execute a registered handler", async () => {
      const handler: EffectHandler = async (_type, _params, _context) => [
        { op: "set", path: "result", value: "success" },
      ];
      registry.register("test", handler);

      const requirement = createTestRequirement("test", { key: "value" });
      const snapshot = createTestSnapshot();

      const result = await executor.execute(requirement, snapshot);

      expect(result.success).toBe(true);
      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]).toEqual({
        op: "set",
        path: "result",
        value: "success",
      });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should return error for unknown effect type", async () => {
      const requirement = createTestRequirement("unknown");
      const snapshot = createTestSnapshot();

      const result = await executor.execute(requirement, snapshot);

      expect(result.success).toBe(false);
      expect(result.patches).toEqual([]);
      expect(result.error).toContain("Unknown effect type: unknown");
    });

    it("should provide correct context to handler", async () => {
      let receivedContext: any;
      const handler: EffectHandler = async (_type, _params, context) => {
        receivedContext = context;
        return [];
      };
      registry.register("test", handler);

      const requirement = createTestRequirement("test", { foo: "bar" });
      const snapshot = createTestSnapshot({ value: 42 });

      await executor.execute(requirement, snapshot);

      expect(receivedContext.snapshot).toEqual(snapshot);
      expect(receivedContext.requirement).toEqual(requirement);
    });

    it("should pass type and params to handler", async () => {
      let receivedType: string | undefined;
      let receivedParams: Record<string, unknown> | undefined;

      const handler: EffectHandler = async (type, params, _context) => {
        receivedType = type;
        receivedParams = params;
        return [];
      };
      registry.register("http", handler);

      const requirement = createTestRequirement("http", { url: "https://api.test.com" });
      await executor.execute(requirement, createTestSnapshot());

      expect(receivedType).toBe("http");
      expect(receivedParams).toEqual({ url: "https://api.test.com" });
    });

    it("should return multiple patches from handler", async () => {
      const patches: Patch[] = [
        { op: "set", path: "a", value: 1 },
        { op: "set", path: "b", value: 2 },
        { op: "set", path: "c", value: 3 },
      ];
      const handler: EffectHandler = async () => patches;
      registry.register("multi", handler);

      const result = await executor.execute(
        createTestRequirement("multi"),
        createTestSnapshot()
      );

      expect(result.success).toBe(true);
      expect(result.patches).toEqual(patches);
    });

    it("should catch and report handler errors", async () => {
      const handler: EffectHandler = async () => {
        throw new Error("Handler failed!");
      };
      registry.register("failing", handler);

      const result = await executor.execute(
        createTestRequirement("failing"),
        createTestSnapshot()
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Handler failed!");
    });

    it("should handle non-Error exceptions", async () => {
      const handler: EffectHandler = async () => {
        throw "String error"; // eslint-disable-line no-throw-literal
      };
      registry.register("throwing", handler);

      const result = await executor.execute(
        createTestRequirement("throwing"),
        createTestSnapshot()
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("String error");
    });

    it("should record duration", async () => {
      const handler: EffectHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [];
      };
      registry.register("slow", handler, { timeout: 5000 });

      const result = await executor.execute(
        createTestRequirement("slow"),
        createTestSnapshot()
      );

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(40); // Allow some tolerance
    });
  });

  describe("timeout", () => {
    it("should timeout slow handlers", async () => {
      const handler: EffectHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return [];
      };
      registry.register("slow", handler, { timeout: 50 });

      const result = await executor.execute(
        createTestRequirement("slow"),
        createTestSnapshot()
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
    });

    it("should not retry after timeout", async () => {
      let attempts = 0;
      const handler: EffectHandler = async () => {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 500));
        return [];
      };
      registry.register("timeout", handler, { timeout: 50, retries: 3 });

      await executor.execute(createTestRequirement("timeout"), createTestSnapshot());

      expect(attempts).toBe(1);
    });
  });

  describe("retry", () => {
    it("should retry on failure", async () => {
      let attempts = 0;
      const handler: EffectHandler = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Not yet");
        }
        return [{ op: "set", path: "success", value: true }];
      };
      registry.register("retry", handler, { retries: 3, retryDelay: 10 });

      const result = await executor.execute(
        createTestRequirement("retry"),
        createTestSnapshot()
      );

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it("should fail after max retries", async () => {
      let attempts = 0;
      const handler: EffectHandler = async () => {
        attempts++;
        throw new Error("Always fails");
      };
      registry.register("always-fail", handler, { retries: 2, retryDelay: 10 });

      const result = await executor.execute(
        createTestRequirement("always-fail"),
        createTestSnapshot()
      );

      expect(result.success).toBe(false);
      expect(attempts).toBe(3); // initial + 2 retries
      expect(result.error).toBe("Always fails");
    });

    it("should use retry delay between attempts", async () => {
      let timestamps: number[] = [];
      const handler: EffectHandler = async () => {
        timestamps.push(Date.now());
        if (timestamps.length < 3) {
          throw new Error("Retry needed");
        }
        return [];
      };
      registry.register("delayed", handler, { retries: 2, retryDelay: 50 });

      await executor.execute(createTestRequirement("delayed"), createTestSnapshot());

      expect(timestamps).toHaveLength(3);
      // Check delays between attempts
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay1).toBeGreaterThanOrEqual(40); // Allow tolerance
      expect(delay2).toBeGreaterThanOrEqual(40);
    });
  });

  describe("executeAll", () => {
    it("should execute multiple requirements", async () => {
      const handler: EffectHandler = async (type, params) => [
        { op: "set", path: params.key as string, value: params.value },
      ];
      registry.register("set", handler);

      const requirements = [
        createTestRequirement("set", { key: "a", value: 1 }, "req-1"),
        createTestRequirement("set", { key: "b", value: 2 }, "req-2"),
        createTestRequirement("set", { key: "c", value: 3 }, "req-3"),
      ];

      const { results, patches } = await executor.executeAll(
        requirements,
        createTestSnapshot()
      );

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(patches).toHaveLength(3);
    });

    it("should continue after failed effect", async () => {
      const successHandler: EffectHandler = async () => [
        { op: "set", path: "ok", value: true },
      ];
      const failHandler: EffectHandler = async () => {
        throw new Error("Failed");
      };

      registry.register("success", successHandler);
      registry.register("fail", failHandler);

      const requirements = [
        createTestRequirement("success", {}, "req-1"),
        createTestRequirement("fail", {}, "req-2"),
        createTestRequirement("success", {}, "req-3"),
      ];

      const { results, patches } = await executor.executeAll(
        requirements,
        createTestSnapshot()
      );

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
      expect(patches).toHaveLength(2); // Only successful patches
    });

    it("should execute sequentially", async () => {
      const executionOrder: number[] = [];
      const handler: EffectHandler = async (_type, params) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push(params.order as number);
        return [];
      };
      registry.register("ordered", handler);

      const requirements = [
        createTestRequirement("ordered", { order: 1 }, "req-1"),
        createTestRequirement("ordered", { order: 2 }, "req-2"),
        createTestRequirement("ordered", { order: 3 }, "req-3"),
      ];

      await executor.executeAll(requirements, createTestSnapshot());

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should return empty results for empty requirements", async () => {
      const { results, patches } = await executor.executeAll([], createTestSnapshot());

      expect(results).toEqual([]);
      expect(patches).toEqual([]);
    });
  });

  describe("getMissingHandlers", () => {
    it("should return missing handler types", () => {
      registry.register("http", async () => []);

      const requirements = [
        createTestRequirement("http"),
        createTestRequirement("storage"),
        createTestRequirement("email"),
      ];

      const missing = executor.getMissingHandlers(requirements);

      expect(missing).toHaveLength(2);
      expect(missing).toContain("storage");
      expect(missing).toContain("email");
    });

    it("should return empty array when all handlers present", () => {
      registry.register("http", async () => []);
      registry.register("storage", async () => []);

      const requirements = [
        createTestRequirement("http"),
        createTestRequirement("storage"),
      ];

      const missing = executor.getMissingHandlers(requirements);

      expect(missing).toEqual([]);
    });

    it("should deduplicate missing types", () => {
      const requirements = [
        createTestRequirement("unknown", {}, "req-1"),
        createTestRequirement("unknown", {}, "req-2"),
        createTestRequirement("unknown", {}, "req-3"),
      ];

      const missing = executor.getMissingHandlers(requirements);

      expect(missing).toEqual(["unknown"]);
    });

    it("should return empty for empty requirements", () => {
      const missing = executor.getMissingHandlers([]);
      expect(missing).toEqual([]);
    });
  });
});

describe("createEffectExecutor", () => {
  it("should create an executor with the given registry", () => {
    const registry = createEffectRegistry();
    const executor = createEffectExecutor(registry);

    expect(executor).toBeInstanceOf(EffectExecutor);

    // Verify registry is connected
    registry.register("test", async () => []);
    const missing = executor.getMissingHandlers([createTestRequirement("test")]);
    expect(missing).toEqual([]);
  });
});
