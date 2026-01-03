import { describe, it, expect, vi, beforeEach } from "vitest";
import { runHostLoop, type HostLoopOptions } from "./loop.js";
import { EffectHandlerRegistry, createEffectRegistry } from "./effects/registry.js";
import { EffectExecutor, createEffectExecutor } from "./effects/executor.js";
import {
  createCore,
  createSnapshot,
  createIntent,
  type DomainSchema,
  type ManifestoCore,
  hashSchemaSync,
} from "@manifesto-ai/core";
import type { EffectHandler } from "./effects/types.js";

const BASE_STATE_FIELDS: DomainSchema["state"]["fields"] = {
  dummy: { type: "string", required: true },
  count: { type: "number", required: true },
  loading: { type: "boolean", required: true },
  response: { type: "object", required: true },
  step1Done: { type: "boolean", required: true },
  step2Done: { type: "boolean", required: true },
  done: { type: "boolean", required: true },
  result: { type: "string", required: true },
  step: { type: "number", required: true },
  effectDone: { type: "boolean", required: true },
  fetched: { type: "boolean", required: true },
  skipped: { type: "boolean", required: true },
};

const BASE_COMPUTED_FIELDS: DomainSchema["computed"]["fields"] = {
  "computed.dummy": {
    expr: { kind: "get", path: "dummy" },
    deps: ["dummy"],
  },
};

const BASE_ACTIONS: DomainSchema["actions"] = {
  noop: { flow: { kind: "halt", reason: "noop" } },
};

// Helper to create a minimal domain schema
function createTestSchema(overrides: Partial<DomainSchema> = {}): DomainSchema {
  const { state, computed, actions: overrideActions, hash, types, ...restOverrides } = overrides;
  const stateFields = {
    ...BASE_STATE_FIELDS,
    ...(state?.fields ?? {}),
  };
  const computedFields = {
    ...BASE_COMPUTED_FIELDS,
    ...(computed?.fields ?? {}),
  };
  const actions = {
    ...BASE_ACTIONS,
    ...(overrideActions ?? {}),
  };

  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "manifesto:test",
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

const HOST_CONTEXT = { now: 0, randomSeed: "seed" };
let intentCounter = 0;
const nextIntentId = () => `intent-${intentCounter++}`;
const createTestIntent = (type: string, input?: unknown) =>
  input === undefined
    ? createIntent(type, nextIntentId())
    : createIntent(type, input, nextIntentId());
const createTestSnapshot = (data: unknown, schemaHash: string) =>
  createSnapshot(data, schemaHash, HOST_CONTEXT);

describe("runHostLoop", () => {
  let core: ManifestoCore;
  let registry: EffectHandlerRegistry;
  let executor: EffectExecutor;

  beforeEach(() => {
    core = createCore();
    registry = createEffectRegistry();
    executor = createEffectExecutor(registry);
  });

  describe("Basic Loop Execution", () => {
    it("should complete simple action without effects", async () => {
      const schema = createTestSchema({
        actions: {
          increment: {
            flow: {
              kind: "patch",
              op: "set",
              path: "count",
              value: {
                kind: "add",
                left: { kind: "coalesce", args: [{ kind: "get", path: "count" }, { kind: "lit", value: 0 }] },
                right: { kind: "lit", value: 1 },
              },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({ count: 5 }, schema.hash);
      const intent = createTestIntent("increment");

      const result = await runHostLoop(core, schema, snapshot, intent, executor);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({ count: 6 });
      expect(result.iterations).toBe(1);
      expect(result.traces).toHaveLength(1);
    });

    it("should handle halted status", async () => {
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

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("haltAction");

      const result = await runHostLoop(core, schema, snapshot, intent, executor);

      expect(result.status).toBe("halted");
      expect(result.iterations).toBe(1);
    });

    it("should handle error status from core", async () => {
      const schema = createTestSchema({
        actions: {
          errorAction: {
            flow: {
              kind: "fail",
              code: "TEST_ERROR",
              message: { kind: "lit", value: "Test error message" },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("errorAction");

      const result = await runHostLoop(core, schema, snapshot, intent, executor);

      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("EFFECT_EXECUTION_FAILED");
    });

    it("should clear stale pending requirements before compute", async () => {
      let handlerCalled = false;
      registry.register("noop", async () => {
        handlerCalled = true;
        return [];
      });

      const schema = createTestSchema({
        actions: {
          checkPending: {
            flow: {
              kind: "if",
              cond: {
                kind: "eq",
                left: { kind: "len", arg: { kind: "get", path: "system.pendingRequirements" } },
                right: { kind: "lit", value: 0 },
              },
              then: {
                kind: "patch",
                op: "set",
                path: "skipped",
                value: { kind: "lit", value: true },
              },
              else: {
                kind: "patch",
                op: "set",
                path: "skipped",
                value: { kind: "lit", value: false },
              },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({ skipped: false }, schema.hash);
      const pendingSnapshot = {
        ...snapshot,
        system: {
          ...snapshot.system,
          status: "pending" as const,
          pendingRequirements: [
            {
              id: "req-1",
              type: "noop",
              params: {},
              actionId: "checkPending",
              flowPosition: { nodePath: "actions.checkPending.flow", snapshotVersion: 0 },
              createdAt: 0,
            },
          ],
        },
      };
      const intent = createTestIntent("checkPending");

      const result = await runHostLoop(core, schema, pendingSnapshot, intent, executor);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({ skipped: true });
      expect(result.snapshot.system.pendingRequirements).toEqual([]);
      expect(handlerCalled).toBe(false);
    });

    it("should handle unknown action", async () => {
      const schema = createTestSchema();
      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("unknownAction");

      const result = await runHostLoop(core, schema, snapshot, intent, executor);

      expect(result.status).toBe("error");
    });

    it("should reject intent without intentId", async () => {
      const schema = createTestSchema();
      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = { type: "noop", input: undefined, intentId: "" };

      const result = await runHostLoop(core, schema, snapshot, intent, executor);

      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("INVALID_STATE");
    });
  });

  describe("Effect Handling", () => {
    it("should execute effect handler and resume computation", async () => {
      // Flow design: Check if response exists before triggering effect
      // First compute: no response -> trigger effect -> pending
      // Effect sets response
      // Second compute: response exists -> skip effect -> complete
      const schema = createTestSchema({
        actions: {
          fetchData: {
            flow: {
              kind: "seq",
              steps: [
                { kind: "patch", op: "set", path: "loading", value: { kind: "lit", value: true } },
                {
                  kind: "if",
                  cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
                  then: {
                    kind: "effect",
                    type: "http",
                    params: {
                      url: { kind: "lit", value: "https://api.test.com/data" },
                    },
                  },
                },
                { kind: "patch", op: "set", path: "loading", value: { kind: "lit", value: false } },
              ],
            },
          },
        },
      });

      const httpHandler: EffectHandler = async (_type, _params, _context) => {
        return [{ op: "set", path: "response", value: { data: "fetched" } }];
      };
      registry.register("http", httpHandler);

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("fetchData");

      const result = await runHostLoop(core, schema, snapshot, intent, executor);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({
        loading: false,
        response: { data: "fetched" },
      });
      expect(result.snapshot.system.pendingRequirements).toEqual([]);
      expect(result.snapshot.system.status).toBe("idle");
      expect(result.iterations).toBe(2); // First compute returns pending, second completes
    });

    it("should handle multiple effects in sequence", async () => {
      // Each effect is guarded by a condition to prevent re-execution
      const schema = createTestSchema({
        actions: {
          multiEffect: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "if",
                  cond: { kind: "not", arg: { kind: "get", path: "step1Done" } },
                  then: {
                    kind: "effect",
                    type: "step1",
                    params: {},
                  },
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
                  then: {
                    kind: "effect",
                    type: "step2",
                    params: {},
                  },
                },
              ],
            },
          },
        },
      });

      const executionOrder: string[] = [];

      registry.register("step1", async () => {
        executionOrder.push("step1");
        return [{ op: "set", path: "step1Done", value: true }];
      });
      registry.register("step2", async () => {
        executionOrder.push("step2");
        return [{ op: "set", path: "step2Done", value: true }];
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("multiEffect");

      const result = await runHostLoop(core, schema, snapshot, intent, executor);

      expect(result.status).toBe("complete");
      expect(executionOrder).toEqual(["step1", "step2"]);
      expect(result.snapshot.data).toEqual({ step1Done: true, step2Done: true });
    });

    it("should re-compute after unknown effect type", async () => {
      const schema = createTestSchema({
        actions: {
          unknownEffect: {
            flow: {
              kind: "if",
              cond: { kind: "get", path: "system.lastError" },
              then: {
                kind: "patch",
                op: "set",
                path: "skipped",
                value: { kind: "lit", value: true },
              },
              else: {
                kind: "effect",
                type: "unknown_type",
                params: {},
              },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("unknownEffect");

      const result = await runHostLoop(core, schema, snapshot, intent, executor);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({ skipped: true });
      expect(result.snapshot.system.pendingRequirements).toEqual([]);
      expect(result.snapshot.system.errors).toHaveLength(1);
      expect(result.snapshot.system.errors[0]?.code).toBe("UNKNOWN_EFFECT");
      expect(result.snapshot.system.errors[0]?.message).toContain("Unknown effect type");
      expect(result.iterations).toBe(2);
    });

    it("should re-compute after effect handler fails", async () => {
      const schema = createTestSchema({
        actions: {
          failingEffect: {
            flow: {
              kind: "if",
              cond: { kind: "get", path: "system.lastError" },
              then: {
                kind: "patch",
                op: "set",
                path: "skipped",
                value: { kind: "lit", value: true },
              },
              else: {
                kind: "effect",
                type: "failing",
                params: {},
              },
            },
          },
        },
      });

      registry.register("failing", async () => {
        throw new Error("Effect handler error");
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("failingEffect");

      const result = await runHostLoop(core, schema, snapshot, intent, executor);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({ skipped: true });
      expect(result.snapshot.system.pendingRequirements).toEqual([]);
      expect(result.snapshot.system.errors).toHaveLength(1);
      expect(result.snapshot.system.errors[0]?.code).toBe("INTERNAL_ERROR");
      expect(result.snapshot.system.errors[0]?.message).toContain("Effect handler error");
      expect(result.iterations).toBe(2);
    });
  });

  describe("Max Iterations", () => {
    it("should stop when effect failure repeats", async () => {
      const schema = createTestSchema({
        actions: {
          failingLoop: {
            flow: {
              kind: "effect",
              type: "missing",
              params: {},
            },
          },
        },
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("failingLoop");

      const result = await runHostLoop(core, schema, snapshot, intent, executor, {
        maxIterations: 3,
      });

      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("LOOP_MAX_ITERATIONS");
      expect(result.iterations).toBe(3);
    });

    it("should respect max iterations limit", async () => {
      // Create an effect that always returns to pending state
      const schema = createTestSchema({
        actions: {
          infiniteEffect: {
            flow: {
              kind: "effect",
              type: "loop",
              params: {},
            },
          },
        },
      });

      // This handler returns patches that trigger the effect again
      registry.register("loop", async () => {
        return []; // No patches, but we need the loop to continue
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("infiniteEffect");

      const result = await runHostLoop(core, schema, snapshot, intent, executor, {
        maxIterations: 5,
      });

      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("LOOP_MAX_ITERATIONS");
      expect(result.iterations).toBe(5);
    });

    it("should use default max iterations when not specified", async () => {
      const schema = createTestSchema({
        actions: {
          infiniteEffect: {
            flow: {
              kind: "effect",
              type: "loop",
              params: {},
            },
          },
        },
      });

      registry.register("loop", async () => []);

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("infiniteEffect");

      const result = await runHostLoop(core, schema, snapshot, intent, executor);

      expect(result.status).toBe("error");
      expect(result.iterations).toBe(100); // Default max
    });
  });

  describe("Callbacks", () => {
    it("should call onBeforeCompute before each iteration", async () => {
      const schema = createTestSchema({
        actions: {
          withEffect: {
            flow: {
              kind: "seq",
              steps: [
                { kind: "effect", type: "test", params: {} },
              ],
            },
          },
        },
      });

      registry.register("test", async () => []);

      const beforeComputeCalls: Array<{ iteration: number; version: number }> = [];

      const options: HostLoopOptions = {
        maxIterations: 3,
        onBeforeCompute: (iteration, snapshot) => {
          beforeComputeCalls.push({ iteration, version: snapshot.meta.version });
        },
      };

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("withEffect");

      await runHostLoop(core, schema, snapshot, intent, executor, options);

      expect(beforeComputeCalls.length).toBeGreaterThanOrEqual(2);
      expect(beforeComputeCalls[0]).toEqual({ iteration: 1, version: 0 });
    });

    it("should call onAfterCompute after each iteration", async () => {
      const schema = createTestSchema({
        actions: {
          simple: {
            flow: { kind: "patch", op: "set", path: "done", value: { kind: "lit", value: true } },
          },
        },
      });

      const afterComputeCalls: Array<{ iteration: number; status: string }> = [];

      const options: HostLoopOptions = {
        onAfterCompute: (iteration, result) => {
          afterComputeCalls.push({ iteration, status: result.status });
        },
      };

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("simple");

      await runHostLoop(core, schema, snapshot, intent, executor, options);

      expect(afterComputeCalls).toHaveLength(1);
      expect(afterComputeCalls[0]).toEqual({ iteration: 1, status: "complete" });
    });

    it("should call onBeforeEffect and onAfterEffect for each effect", async () => {
      // Guard effect with condition to prevent infinite loop
      const schema = createTestSchema({
        actions: {
          withEffect: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "result" } },
              then: { kind: "effect", type: "test", params: { key: { kind: "lit", value: "value" } } },
            },
          },
        },
      });

      registry.register("test", async () => [{ op: "set", path: "result", value: "done" }]);

      const beforeEffectCalls: string[] = [];
      const afterEffectCalls: Array<{ type: string; patchCount: number }> = [];

      const options: HostLoopOptions = {
        onBeforeEffect: (req) => {
          beforeEffectCalls.push(req.type);
        },
        onAfterEffect: (req, patches, error) => {
          afterEffectCalls.push({ type: req.type, patchCount: patches.length });
        },
      };

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("withEffect");

      await runHostLoop(core, schema, snapshot, intent, executor, options);

      expect(beforeEffectCalls).toEqual(["test"]);
      expect(afterEffectCalls).toEqual([{ type: "test", patchCount: 1 }]);
    });
  });

  describe("Trace Collection", () => {
    it("should collect traces from all iterations", async () => {
      // Guard effect to prevent infinite loop
      const schema = createTestSchema({
        actions: {
          withEffect: {
            flow: {
              kind: "seq",
              steps: [
                { kind: "patch", op: "set", path: "step", value: { kind: "lit", value: 1 } },
                {
                  kind: "if",
                  cond: { kind: "isNull", arg: { kind: "get", path: "effectDone" } },
                  then: { kind: "effect", type: "test", params: {} },
                },
                { kind: "patch", op: "set", path: "step", value: { kind: "lit", value: 2 } },
              ],
            },
          },
        },
      });

      registry.register("test", async () => [{ op: "set", path: "effectDone", value: true }]);

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("withEffect");

      const result = await runHostLoop(core, schema, snapshot, intent, executor);

      expect(result.status).toBe("complete");
      expect(result.traces).toHaveLength(2); // 2 iterations
      expect(result.traces[0].intent.type).toBe("withEffect");
      expect(result.traces[1].intent.type).toBe("withEffect");
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle conditional effects", async () => {
      // Guard effect to prevent infinite loop when shouldFetch is true
      const schema = createTestSchema({
        actions: {
          conditionalFetch: {
            flow: {
              kind: "if",
              cond: { kind: "get", path: "input.shouldFetch" },
              then: {
                kind: "if",
                cond: { kind: "isNull", arg: { kind: "get", path: "fetched" } },
                then: { kind: "effect", type: "http", params: {} },
              },
              else: {
                kind: "patch",
                op: "set",
                path: "skipped",
                value: { kind: "lit", value: true },
              },
            },
          },
        },
      });

      registry.register("http", async () => [{ op: "set", path: "fetched", value: true }]);

      // With fetch
      const snapshot1 = createTestSnapshot({}, schema.hash);
      const intent1 = createTestIntent("conditionalFetch", { shouldFetch: true });
      const result1 = await runHostLoop(core, schema, snapshot1, intent1, executor);

      expect(result1.status).toBe("complete");
      expect(result1.snapshot.data).toEqual({ fetched: true });

      // Without fetch
      const snapshot2 = createTestSnapshot({}, schema.hash);
      const intent2 = createTestIntent("conditionalFetch", { shouldFetch: false });
      const result2 = await runHostLoop(core, schema, snapshot2, intent2, executor);

      expect(result2.status).toBe("complete");
      expect(result2.snapshot.data).toEqual({ skipped: true });
    });

    it("should pass effect params correctly", async () => {
      const schema = createTestSchema({
        actions: {
          fetchUser: {
            flow: {
              kind: "effect",
              type: "http",
              params: {
                url: { kind: "lit", value: "https://api.test.com/users" },
                userId: { kind: "get", path: "input.userId" },
              },
            },
          },
        },
      });

      let receivedParams: Record<string, unknown> | undefined;
      registry.register("http", async (_type, params) => {
        receivedParams = params;
        return [];
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("fetchUser", { userId: 42 });

      await runHostLoop(core, schema, snapshot, intent, executor);

      expect(receivedParams?.url).toBe("https://api.test.com/users");
      expect(receivedParams?.userId).toBe(42);
    });
  });

  describe("HostContext", () => {
    it("should keep randomSeed stable across re-entries", async () => {
      const schema = createTestSchema({
        actions: {
          runOnce: {
            flow: {
              kind: "if",
              cond: { kind: "not", arg: { kind: "get", path: "effectDone" } },
              then: {
                kind: "effect",
                type: "mark",
                params: {},
              },
              else: {
                kind: "patch",
                op: "set",
                path: "done",
                value: { kind: "lit", value: true },
              },
            },
          },
        },
      });

      registry.register("mark", async () => [
        { op: "set", path: "effectDone", value: true },
      ]);

      const snapshot = createTestSnapshot({ effectDone: false, done: false }, schema.hash);
      const intent = createTestIntent("runOnce");

      let seedCalls = 0;
      let lastSeed = "";
      const result = await runHostLoop(core, schema, snapshot, intent, executor, {
        context: {
          randomSeed: () => {
            seedCalls += 1;
            lastSeed = `seed-${seedCalls}`;
            return lastSeed;
          },
        },
      });

      expect(seedCalls).toBe(1);
      expect(result.snapshot.meta.randomSeed).toBe(lastSeed);
      expect(result.snapshot.data).toEqual({ effectDone: true, done: true });
    });
  });
});
