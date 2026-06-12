import { semanticPathToPatchPath } from "@manifesto-ai/core";
const pp = semanticPathToPatchPath;

import { describe, it, expect, beforeEach } from "vitest";
import { ManifestoHost, createHost, } from "../../host.js";
import { type DomainSchema, type Snapshot } from "@manifesto-ai/core";
import type { EffectHandler } from "../../effects/types.js";
import {
  createTestSchema,
  createTestIntent,
  createTestIntentWithId,
  stripHostState,
  DEFAULT_HOST_CONTEXT,
  createRestoreNormalizedSnapshot,
  createTestSnapshot,
} from "../helpers/index.js";

const _HOST_CONTEXT = DEFAULT_HOST_CONTEXT;

describe("ManifestoHost", () => {
  let schema: DomainSchema;

  beforeEach(() => {
    schema = createTestSchema({
      actions: {
        increment: {
          flow: {
            kind: "patch",
            op: "set", path: pp("count"),
            value: {
              kind: "add",
              left: { kind: "coalesce", args: [{ kind: "get", path: "count" }, { kind: "lit", value: 0 }] },
              right: { kind: "lit", value: 1 },
            },
          },
        },
        setName: {
          input: {
            type: "object",
            required: true,
            fields: {
              name: { type: "string", required: true },
            },
          },
          flow: {
            kind: "patch",
            op: "set", path: pp("name"),
            value: { kind: "get", path: "input.name" },
          },
        },
      },
    });
  });

  describe("createHost", () => {
    it("should create a ManifestoHost instance", () => {
      const host = createHost(schema, { initialData: {} });
      expect(host).toBeInstanceOf(ManifestoHost);
    });

    it("should use schema", () => {
      const host = createHost(schema, { initialData: {} });
      expect(host.getSchema()).toBe(schema);
    });

    it("should accept a canonical initialSnapshot", () => {
      const initialSnapshot = createTestSnapshot({ count: 2 }, schema.hash);
      const host = createHost(schema, { initialSnapshot });

      expect(host.getSnapshot()?.state).toEqual({ count: 2 });
      expect(host.getSnapshot()?.meta.schemaHash).toBe(schema.hash);
    });

    it("should reject ambiguous initialSnapshot and initialData options", () => {
      const initialSnapshot = createTestSnapshot({ count: 2 }, schema.hash);

      expect(() => createHost(schema, {
        initialSnapshot,
        initialData: { count: 2 },
      })).toThrow("either initialSnapshot or legacy initialData");
    });
  });

  describe("dispatch", () => {
    it("should process a simple intent", async () => {
      const host = createHost(schema, { initialData: { count: 0 } });

      const result = await host.dispatch(createTestIntent("increment"));

      expect(result.status).toBe("complete");
      expect(stripHostState(result.snapshot.state)).toEqual({ count: 1 });
    });

    it("should accumulate state across dispatches", async () => {
      const host = createHost(schema, { initialData: { count: 0 } });

      await host.dispatch(createTestIntent("increment"));
      await host.dispatch(createTestIntent("increment"));
      const result = await host.dispatch(createTestIntent("increment"));

      expect(result.status).toBe("complete");
      expect(stripHostState(result.snapshot.state)).toEqual({ count: 3 });
    });

    it("should handle intent with input", async () => {
      const host = createHost(schema, { initialData: {} });

      const result = await host.dispatch(createTestIntent("setName", { name: "Alice" }));

      expect(result.status).toBe("complete");
      expect(stripHostState(result.snapshot.state)).toEqual({ name: "Alice" });
    });

    it("should return error for unknown action", async () => {
      const host = createHost(schema, { initialData: {} });

      const result = await host.dispatch(createTestIntent("unknownAction"));

      expect(result.status).toBe("error");
    });

    it("should return error when no snapshot exists", async () => {
      const host = createHost(schema);
      // No initial data provided

      const result = await host.dispatch(createTestIntent("increment"));

      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("HOST_NOT_INITIALIZED");
    });
  });

  describe("Effect handlers", () => {
    it("should register and execute effect handlers", async () => {
      const schemaWithEffect = createTestSchema({
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

      const host = createHost(schemaWithEffect, { initialData: {} });

      const httpHandler: EffectHandler = async (_type, params) => {
        return [{ op: "set", path: pp("response"), value: { url: params.url } }];
      };
      host.registerEffect("http", httpHandler);

      const result = await host.dispatch(createTestIntent("fetchData"));

      expect(result.status).toBe("complete");
      expect(stripHostState(result.snapshot.state)).toEqual({
        response: { url: "https://api.test.com" },
      });
    });

    it("should check if effect handler exists", () => {
      const host = createHost(schema, { initialData: {} });

      expect(host.hasEffect("http")).toBe(false);

      host.registerEffect("http", async () => []);

      expect(host.hasEffect("http")).toBe(true);
    });

    it("should unregister effect handler", () => {
      const host = createHost(schema, { initialData: {} });
      host.registerEffect("http", async () => []);

      expect(host.hasEffect("http")).toBe(true);

      const removed = host.unregisterEffect("http");

      expect(removed).toBe(true);
      expect(host.hasEffect("http")).toBe(false);
    });

    it("should list registered effect types", () => {
      const host = createHost(schema, { initialData: {} });
      host.registerEffect("http", async () => []);
      host.registerEffect("storage", async () => []);
      host.registerEffect("email", async () => []);

      const types = host.getEffectTypes();

      expect(types).toHaveLength(3);
      expect(types).toContain("http");
      expect(types).toContain("storage");
      expect(types).toContain("email");
    });
  });

  describe("Snapshot management", () => {
    it("should get current snapshot", async () => {
      const host = createHost(schema, { initialData: { count: 5 } });

      const snapshot = await host.getSnapshot();

      expect(stripHostState(snapshot?.state ?? {})).toEqual({ count: 5 });
    });

    it("should persist snapshot after dispatch", async () => {
      const host = createHost(schema, { initialData: { count: 0 } });

      await host.dispatch(createTestIntent("increment"));
      const snapshot = await host.getSnapshot();

      expect(stripHostState(snapshot?.state ?? {})).toEqual({ count: 1 });
      expect(snapshot?.meta.version).toBe(2);
    });

    it("should reset to new initial state", async () => {
      const host = createHost(schema, { initialData: { count: 100 } });

      await host.dispatch(createTestIntent("increment"));
      expect(stripHostState((await host.getSnapshot())?.state ?? {})).toEqual({ count: 101 });

      await host.reset(createTestSnapshot({ count: 0 }, schema.hash, DEFAULT_HOST_CONTEXT));

      const snapshot = await host.getSnapshot();
      expect(stripHostState(snapshot?.state ?? {})).toEqual({ count: 0 });
      expect(snapshot?.meta.version).toBe(0);
    });

    it("should reset from a full Snapshot without dropping meta/system", async () => {
      const host = createHost(schema, { initialData: { count: 100 } });

      await host.dispatch(createTestIntent("increment"));
      const restored = await host.getSnapshot();

      expect(restored).not.toBeNull();
      if (!restored) return;

      const nextSnapshot: Snapshot = {
        ...restored,
        state: { count: 999 },
      };

      host.reset(nextSnapshot);

      const snapshot = await host.getSnapshot();
      expect(snapshot?.state).toEqual({ count: 999 });
      expect(snapshot?.meta.version).toBe(restored.meta.version);
      expect(snapshot?.meta.timestamp).toBe(restored.meta.timestamp);
      expect(snapshot?.meta.randomSeed).toBe(restored.meta.randomSeed);
      expect(snapshot?.meta.schemaHash).toBe(restored.meta.schemaHash);
      expect(snapshot?.system).toEqual(restored.system);
      expect(snapshot?.computed).toEqual(restored.computed);
      expect(snapshot?.input).toEqual(restored.input ?? null);
    });

    it("should resume from a restore-normalized snapshot with fresh per-job context", async () => {
      let now = 5;
      const runtime = {
        now: () => now,
        microtask: (fn: () => void) => queueMicrotask(fn),
        yield: () => Promise.resolve(),
      };
      const host = createHost(schema, { initialData: { count: 100 }, runtime });

      const restored = createRestoreNormalizedSnapshot(
        { count: 7, $host: { currentIntentId: "stale-intent" } },
        schema.hash,
        {
          runtime: {
            time: { timestamp: now },
            random: { seed: "restored-seed" },
          },
          external: {},
        }
      );

      host.reset(restored);
      now = 100;

      const result = await host.dispatch(createTestIntentWithId("increment", "intent-restore"));

      expect(stripHostState(result.snapshot.state)).toEqual({ count: 8 });
      expect(result.snapshot.meta.timestamp).toBe(100);
      expect(result.snapshot.meta.randomSeed).toBe("intent-restore");
      expect(result.snapshot.input).toBeNull();
      expect(result.snapshot.system.currentAction).toBeNull();
    });

    it("should reject partial snapshot on reset", async () => {
      const host = createHost(schema, { initialData: { count: 100 } });

      expect(() => {
        host.reset({ count: 0 });
      }).toThrowError();

      const snapshot = await host.getSnapshot();
      expect(snapshot).not.toBeNull();
    });

    it("should reject retired data-root snapshots on reset", async () => {
      const host = createHost(schema, { initialData: { count: 100 } });
      const legacySnapshot = {
        data: { count: 0 },
        computed: {},
        system: {
          status: "idle",
          lastError: null,
          pendingRequirements: [],
          currentAction: null,
        },
        input: null,
        meta: {
          version: 0,
          timestamp: 0,
          randomSeed: "seed",
          schemaHash: schema.hash,
        },
      };

      expect(() => {
        host.reset(legacySnapshot);
      }).toThrowError();

      const snapshot = await host.getSnapshot();
      expect(snapshot?.state).toEqual({ count: 100 });
    });

    it("should reject reserved state namespace keys on reset", async () => {
      const host = createHost(schema, { initialData: { count: 100 } });
      const snapshot = createTestSnapshot({ count: 0, $host: { stale: true } }, schema.hash, DEFAULT_HOST_CONTEXT);

      expect(() => {
        host.reset(snapshot);
      }).toThrowError();

      expect((await host.getSnapshot())?.state).toEqual({ count: 100 });
    });
  });

  describe("Schema validation", () => {
    it("should validate schema", () => {
      const host = createHost(schema, { initialData: {} });

      const result = host.validateSchema();

      expect(result.valid).toBe(true);
    });

    it("should get core instance", () => {
      const host = createHost(schema, { initialData: {} });

      const core = host.getCore();

      expect(core).toBeDefined();
      expect(typeof core.compute).toBe("function");
      expect(typeof core.apply).toBe("function");
    });
  });

  describe("Loop options", () => {
    it("should respect max iterations option", async () => {
      const schemaWithInfiniteEffect = createTestSchema({
        actions: {
          infinite: {
            flow: {
              kind: "effect",
              type: "loop",
              params: {},
            },
          },
        },
      });

      const host = createHost(schemaWithInfiniteEffect, {
        initialData: {},
        maxIterations: 3,
      });

      host.registerEffect("loop", async () => []);

      const result = await host.dispatch(createTestIntent("infinite"));

      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("LOOP_MAX_ITERATIONS");
    });

    it("should preserve effect execution errors instead of replacing them with loop-limit errors", async () => {
      const schemaWithFailingEffect = createTestSchema({
        actions: {
          load: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: pp("loading"),
                  value: { kind: "lit", value: true },
                },
                {
                  kind: "effect",
                  type: "api.fetch",
                  params: {},
                },
              ],
            },
          },
        },
      });

      const host = createHost(schemaWithFailingEffect, {
        initialData: { loading: false },
        maxIterations: 3,
      });

      host.registerEffect("api.fetch", async () => {
        throw new Error("effect exploded");
      });

      const result = await host.dispatch(createTestIntent("load"));
      const hostLastError = (result.snapshot.namespaces.host as {
        readonly lastError?: { readonly code?: string; readonly message?: string };
      } | undefined)?.lastError;

      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("EFFECT_EXECUTION_FAILED");
      expect((result.snapshot.state as Record<string, unknown>).loading).toBe(true);
      expect(result.snapshot.system.lastError).toBeNull();
      expect(hostLastError).toMatchObject({
        code: "EFFECT_EXECUTION_FAILED",
        message: "effect exploded",
      });
    });
  });

  describe("Complex workflows", () => {
    it("should handle a multi-step workflow", async () => {
      const workflowSchema = createTestSchema({
        computed: {
          fields: {
            "total": {
              expr: {
                kind: "add",
                left: { kind: "coalesce", args: [{ kind: "get", path: "itemsTotal" }, { kind: "lit", value: 0 }] },
                right: { kind: "coalesce", args: [{ kind: "get", path: "shipping" }, { kind: "lit", value: 0 }] },
              },
              deps: ["itemsTotal", "shipping"],
            },
          },
        },
        actions: {
          addItem: {
            input: {
              type: "object",
              required: true,
              fields: {
                price: { type: "number", required: true },
              },
            },
            flow: {
              kind: "patch",
              op: "set", path: pp("itemsTotal"),
              value: {
                kind: "add",
                left: { kind: "coalesce", args: [{ kind: "get", path: "itemsTotal" }, { kind: "lit", value: 0 }] },
                right: { kind: "get", path: "input.price" },
              },
            },
          },
          setShipping: {
            input: {
              type: "object",
              required: true,
              fields: {
                amount: { type: "number", required: true },
              },
            },
            flow: {
              kind: "patch",
              op: "set", path: pp("shipping"),
              value: { kind: "get", path: "input.amount" },
            },
          },
        },
      });

      const host = createHost(workflowSchema, { initialData: {} });

      await host.dispatch(createTestIntent("addItem", { price: 100 }));
      await host.dispatch(createTestIntent("addItem", { price: 50 }));
      await host.dispatch(createTestIntent("setShipping", { amount: 10 }));

      const snapshot = await host.getSnapshot();

      expect(stripHostState(snapshot?.state ?? {})).toEqual({ itemsTotal: 150, shipping: 10 });
      expect(snapshot?.computed["total"]).toBe(160);
    });

    it("should handle effect with retry on failure", async () => {
      const schemaWithEffect = createTestSchema({
        actions: {
          fetchWithRetry: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "data" } },
              then: { kind: "effect", type: "flaky", params: {} },
            },
          },
        },
      });

      const host = createHost(schemaWithEffect, { initialData: {} });

      let attempts = 0;
      const flakyHandler: EffectHandler = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Temporary failure");
        }
        return [{ op: "set", path: pp("data"), value: "success" }];
      };

      host.registerEffect("flaky", flakyHandler, { retries: 3, retryDelay: 10 });

      const result = await host.dispatch(createTestIntent("fetchWithRetry"));

      expect(result.status).toBe("complete");
      expect(stripHostState(result.snapshot.state)).toEqual({ data: "success" });
      expect(attempts).toBe(3);
    });
  });

  describe("Traces", () => {
    it("should emit trace events via onTrace callback", async () => {
      const traces: unknown[] = [];
      const host = createHost(schema, {
        initialData: { count: 0 },
        onTrace: (event) => traces.push(event),
      });

      await host.dispatch(createTestIntent("increment"));

      // v2.0.1 emits TraceEvent via onTrace callback
      expect(traces.length).toBeGreaterThan(0);
      // Should have job:start and job:end events at minimum
      const jobStartEvents = traces.filter((t: any) => t.t === "job:start");
      expect(jobStartEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Availability bypass scenarios (#134 review concern)", () => {
    it("SCENARIO: max-iterations preserves the progressed execution snapshot", async () => {
      // Setup: action "run" with available when isNull(pending),
      // maxIterations = 1 so the first dispatch exits before ContinueCompute.
      const lifecycleSchema = createTestSchema({
        state: {
          fields: {
            pending: { type: "string", required: false },
            result: { type: "string", required: false },
          },
        },
        actions: {
          run: {
            available: {
              kind: "isNull",
              arg: { kind: "get", path: "pending" },
            },
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "pending" } },
              then: {
                kind: "seq",
                steps: [
                  {
                    kind: "patch",
                    op: "set", path: pp("pending"),
                    value: { kind: "get", path: "$runtime.intent.id" },
                  },
                  {
                    kind: "effect",
                    type: "demo.exec",
                    params: {},
                  },
                ],
              },
            },
          },
        },
      });

      // maxIterations = 1: loop exits before FulfillEffect is processed
      const host = createHost(lifecycleSchema, {
        initialData: { pending: null, result: null },
        maxIterations: 1,
      });

      host.registerEffect("demo.exec", async () => [
        { op: "set", path: pp("result"), value: "done" },
      ]);

      // 1st dispatch: exits with LOOP_MAX_ITERATIONS.
      const result1 = await host.dispatch(
        { type: "run", intentId: "intent-A", input: undefined }
      );
      expect(result1.status).toBe("error");
      expect(result1.error?.code).toBe("LOOP_MAX_ITERATIONS");
      expect(result1.snapshot.system.status).toBe("pending");
      expect(result1.snapshot.system.currentAction).toBe("run");
      expect(result1.snapshot.system.pendingRequirements).toHaveLength(1);

      const snapshotAfter = host.getSnapshot();
      const currentAction = snapshotAfter?.system.currentAction;
      const pending = (snapshotAfter?.state as Record<string, unknown>)?.pending;
      const hostLastError = (snapshotAfter?.namespaces.host as {
        lastError?: { code?: string };
      } | undefined)?.lastError;

      expect(currentAction).toBe("run");
      expect(pending).toBe("intent-A");
      expect(hostLastError?.code).toBe("LOOP_MAX_ITERATIONS");

      // 2nd dispatch: same action type, different intentId
      const result2 = await host.dispatch(
        { type: "run", intentId: "intent-B", input: undefined }
      );

      expect(result2.status).toBe("error");
      expect(result2.error?.code).toBe("LOOP_MAX_ITERATIONS");
      expect(result2.snapshot.system.currentAction).toBeNull();
      expect((result2.snapshot.state as Record<string, unknown>).pending).toBe("intent-A");
    });

    it("SCENARIO: normal sequential dispatch does NOT leak currentAction", async () => {
      // Verify that normal (non-error) dispatch always resets currentAction.
      // This means the reviewer's concern is unreachable in normal operation.
      const lifecycleSchema = createTestSchema({
        state: {
          fields: {
            pending: { type: "string", required: false },
            result: { type: "string", required: false },
          },
        },
        actions: {
          run: {
            available: {
              kind: "isNull",
              arg: { kind: "get", path: "pending" },
            },
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "pending" } },
              then: {
                kind: "seq",
                steps: [
                  {
                    kind: "patch",
                    op: "set", path: pp("pending"),
                    value: { kind: "get", path: "$runtime.intent.id" },
                  },
                  {
                    kind: "effect",
                    type: "demo.exec",
                    params: {},
                  },
                ],
              },
            },
          },
        },
      });

      const host = createHost(lifecycleSchema, {
        initialData: { pending: null, result: null },
      });

      host.registerEffect("demo.exec", async () => [
        { op: "set", path: pp("result"), value: "done" },
      ]);

      const result1 = await host.dispatch(
        { type: "run", intentId: "intent-A", input: undefined }
      );
      expect(result1.status).toBe("complete");

      // After normal completion, currentAction MUST be null
      const snapshotAfter = host.getSnapshot();
      expect(snapshotAfter?.system.currentAction).toBeNull();
    });
  });
});

describe("createHost factory", () => {
  it("should create host with all options", () => {
    const schema = createTestSchema();

    const host = createHost(schema, {
      initialData: { value: 42 },
      maxIterations: 50,
    });

    expect(host.getSchema()).toBe(schema);
  });
});
