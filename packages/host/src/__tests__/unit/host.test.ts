import { describe, it, expect, beforeEach } from "vitest";
import { ManifestoHost, createHost, type HostOptions } from "../../host.js";
import { createSnapshot, type DomainSchema } from "@manifesto-ai/core";
import type { EffectHandler } from "../../effects/types.js";
import {
  createTestSchema,
  createTestIntent,
  stripHostState,
  DEFAULT_HOST_CONTEXT,
} from "../helpers/index.js";

const HOST_CONTEXT = DEFAULT_HOST_CONTEXT;

describe("ManifestoHost", () => {
  let schema: DomainSchema;

  beforeEach(() => {
    schema = createTestSchema({
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
        setName: {
          flow: {
            kind: "patch",
            op: "set",
            path: "name",
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
  });

  describe("dispatch", () => {
    it("should process a simple intent", async () => {
      const host = createHost(schema, { initialData: { count: 0 } });

      const result = await host.dispatch(createTestIntent("increment"));

      expect(result.status).toBe("complete");
      expect(stripHostState(result.snapshot.data)).toEqual({ count: 1 });
    });

    it("should accumulate state across dispatches", async () => {
      const host = createHost(schema, { initialData: { count: 0 } });

      await host.dispatch(createTestIntent("increment"));
      await host.dispatch(createTestIntent("increment"));
      const result = await host.dispatch(createTestIntent("increment"));

      expect(result.status).toBe("complete");
      expect(stripHostState(result.snapshot.data)).toEqual({ count: 3 });
    });

    it("should handle intent with input", async () => {
      const host = createHost(schema, { initialData: {} });

      const result = await host.dispatch(createTestIntent("setName", { name: "Alice" }));

      expect(result.status).toBe("complete");
      expect(stripHostState(result.snapshot.data)).toEqual({ name: "Alice" });
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
        return [{ op: "set", path: "response", value: { url: params.url } }];
      };
      host.registerEffect("http", httpHandler);

      const result = await host.dispatch(createTestIntent("fetchData"));

      expect(result.status).toBe("complete");
      expect(stripHostState(result.snapshot.data)).toEqual({
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

      expect(stripHostState(snapshot?.data ?? {})).toEqual({ count: 5 });
    });

    it("should persist snapshot after dispatch", async () => {
      const host = createHost(schema, { initialData: { count: 0 } });

      await host.dispatch(createTestIntent("increment"));
      const snapshot = await host.getSnapshot();

      expect(stripHostState(snapshot?.data ?? {})).toEqual({ count: 1 });
      expect(snapshot?.meta.version).toBe(2);
    });

    it("should reset to new initial state", async () => {
      const host = createHost(schema, { initialData: { count: 100 } });

      await host.dispatch(createTestIntent("increment"));
      expect(stripHostState((await host.getSnapshot())?.data ?? {})).toEqual({ count: 101 });

      await host.reset({ count: 0 });

      const snapshot = await host.getSnapshot();
      expect(stripHostState(snapshot?.data ?? {})).toEqual({ count: 0 });
      expect(snapshot?.meta.version).toBe(0);
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
  });

  describe("Complex workflows", () => {
    it("should handle a multi-step workflow", async () => {
      const workflowSchema = createTestSchema({
        computed: {
          fields: {
            "computed.total": {
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
            flow: {
              kind: "patch",
              op: "set",
              path: "itemsTotal",
              value: {
                kind: "add",
                left: { kind: "coalesce", args: [{ kind: "get", path: "itemsTotal" }, { kind: "lit", value: 0 }] },
                right: { kind: "get", path: "input.price" },
              },
            },
          },
          setShipping: {
            flow: {
              kind: "patch",
              op: "set",
              path: "shipping",
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

      expect(stripHostState(snapshot?.data ?? {})).toEqual({ itemsTotal: 150, shipping: 10 });
      expect(snapshot?.computed["computed.total"]).toBe(160);
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
        return [{ op: "set", path: "data", value: "success" }];
      };

      host.registerEffect("flaky", flakyHandler, { retries: 3, retryDelay: 10 });

      const result = await host.dispatch(createTestIntent("fetchWithRetry"));

      expect(result.status).toBe("complete");
      expect(stripHostState(result.snapshot.data)).toEqual({ data: "success" });
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
    it("SCENARIO: sequential dispatch after max-iterations leaves currentAction in snapshot", async () => {
      // This tests the reviewer's concern: can a second dispatch of the same
      // action type skip availability because the first dispatch left
      // currentAction set in the shared snapshot?
      //
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
                    op: "set",
                    path: "pending",
                    value: { kind: "get", path: "meta.intentId" },
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
        { op: "set", path: "result", value: "done" },
      ]);

      // 1st dispatch: exits with LOOP_MAX_ITERATIONS, currentAction may be set
      const result1 = await host.dispatch(
        { type: "run", intentId: "intent-A", input: undefined }
      );
      expect(result1.status).toBe("error");
      expect(result1.error?.code).toBe("LOOP_MAX_ITERATIONS");

      // Check what the shared snapshot looks like after a max-iterations error
      const snapshotAfter = host.getSnapshot();
      const currentAction = snapshotAfter?.system.currentAction;
      const pending = (snapshotAfter?.data as Record<string, unknown>)?.pending;

      // Log the actual state for documentation
      // currentAction may or may not be "run" depending on Host's cleanup behavior
      // pending should be "intent-A" (patched by the first compute)

      // 2nd dispatch: same action type, different intentId
      const result2 = await host.dispatch(
        { type: "run", intentId: "intent-B", input: undefined }
      );

      // VERIFIED: max-iterations exit DOES leak currentAction into shared snapshot.
      // This confirms the reviewer's concern is technically reachable.
      expect(currentAction).toBe("run");
      expect(pending).toBe("intent-A");

      // Intent B arrives on this dirty snapshot — type-only guard treats it as re-entry.
      // Availability IS bypassed. But the flow's state guard prevents harmful side effects:
      // pending is "intent-A" → if isNull(pending) is false → branch skipped → no-op.
      expect(result2.snapshot.system.lastError?.code).not.toBe("ACTION_UNAVAILABLE");
      expect((result2.snapshot.data as Record<string, unknown>).pending).toBe("intent-A");
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
                    op: "set",
                    path: "pending",
                    value: { kind: "get", path: "meta.intentId" },
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
        { op: "set", path: "result", value: "done" },
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
