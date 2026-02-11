import { describe, it, expect } from "vitest";
import { createApp, createTestApp } from "@manifesto-ai/app";
import { hashSchemaSync, type DomainSchema, createIntent, createCore, createSnapshot } from "@manifesto-ai/core";
import { createHost, createTestHostContextProvider } from "@manifesto-ai/host";

const BASE_STATE_FIELDS: DomainSchema["state"]["fields"] = {
  value: { type: "number", required: false, default: 0 },
  effectDone: { type: "boolean", required: false, default: false },
};

function createTestSchema(): DomainSchema {
  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "test-schema",
    version: "1.0.0",
    types: {},
    state: { fields: BASE_STATE_FIELDS },
    computed: { fields: {} },
    actions: {
      "test.noop": {
        flow: { kind: "halt", reason: "noop" },
      },
    },
  };

  return {
    ...schemaWithoutHash,
    hash: hashSchemaSync(schemaWithoutHash),
  };
}

describe("Debug Executor", () => {
  it("should debug host directly", async () => {
    const schema = createTestSchema();
    console.log("1. Schema created");

    // Test Host directly
    const host = createHost(schema, { initialData: { value: 0 } });
    console.log("2. Host created");

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 10));

    // Check initial snapshot
    const initialSnapshot = await host.getSnapshot();
    console.log("3. Initial snapshot version:", initialSnapshot?.meta.version);

    // Dispatch intent (must provide intentId)
    const intent = createIntent("test.noop", {}, `test_${Date.now()}`);
    console.log("4. Intent created:", intent.intentId);

    const result = await host.dispatch(intent);
    console.log("5. Dispatch result status:", result.status);
    console.log("6. Result snapshot version:", result.snapshot.meta.version);
    if (result.error) {
      console.log("7. Error:", result.error.message);
    }

    expect(result.status).toBe("complete");
  });

  it("should debug the app executor", async () => {
    const schema = createTestSchema();
    console.log("Schema hash:", schema.hash);

    const app = createTestApp(schema);
    console.log("App status before ready:", app.status);

    await app.ready();
    console.log("App status after ready:", app.status);

    const handle = app.act("test.noop", {});
    console.log("Handle proposalId:", handle.proposalId);

    const result = await handle.result();
    console.log("Result status:", result.status);
    if (result.status === "failed") {
      console.log("Error:", JSON.stringify(result.error, null, 2));
    }

    expect(result.status).toBe("completed");
  });

  it("should debug patch flow via core.compute directly", async () => {
    const schemaWithPatch: Omit<DomainSchema, "hash"> = {
      id: "test-schema",
      version: "1.0.0",
      types: {},
      state: { fields: BASE_STATE_FIELDS },
      computed: { fields: {} },
      actions: {
        "test.setPatch": {
          flow: {
            kind: "patch",
            op: "set",
            path: "value",  // No "data." prefix - path is relative to state.fields
            value: { kind: "lit", value: 42 },
          },
        },
      },
    };
    const schema: DomainSchema = {
      ...schemaWithPatch,
      hash: hashSchemaSync(schemaWithPatch),
    };

    const core = createCore();
    const contextProvider = createTestHostContextProvider(0);
    const initialContext = contextProvider.createInitialContext("seed");
    const snapshot = createSnapshot({ value: 0 }, schema.hash, initialContext);
    const intent = createIntent("test.setPatch", {}, `test_${Date.now()}`);
    const ctx = contextProvider.createFrozenContext(intent.intentId);

    console.log("1. Schema:", JSON.stringify(schema.actions, null, 2));
    console.log("2. Snapshot:", JSON.stringify(snapshot, null, 2));
    console.log("3. Intent:", JSON.stringify(intent, null, 2));

    const result = await core.compute(schema, snapshot, intent, ctx);
    console.log("4. Result status:", result.status);
    console.log("5. Result snapshot.data:", JSON.stringify(result.snapshot.data, null, 2));
    if (result.status === "error") {
      console.log("6. Error:", JSON.stringify(result.snapshot.system.lastError, null, 2));
    }

    expect(result.status).not.toBe("error");
    expect((result.snapshot.data as { value: number }).value).toBe(42);
  });

  it("should debug effect execution via app", async () => {
    const schemaWithEffect: Omit<DomainSchema, "hash"> = {
      id: "test-schema",
      version: "1.0.0",
      types: {},
      state: { fields: BASE_STATE_FIELDS },
      computed: { fields: {} },
      actions: {
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
      },
    };
    const schema: DomainSchema = {
      ...schemaWithEffect,
      hash: hashSchemaSync(schemaWithEffect),
    };

    let handlerCalled = false;
    const mockHandler = async (params: unknown) => {
      handlerCalled = true;
      console.log("Effect handler called!", { params });
      // Must set both the result AND the guard value to prevent re-execution
      return [
        { op: "set" as const, path: "value", value: 99 },
        { op: "set" as const, path: "effectDone", value: true },
      ];
    };

    const app = createTestApp(schema, {
      effects: {
        "test.effect": mockHandler,
      },
    });
    await app.ready();

    const handle = app.act("test.withEffect", {});
    const result = await handle.result();

    console.log("Result status:", result.status);
    console.log("Handler called:", handlerCalled);
    if (result.status === "failed") {
      console.log("Error:", JSON.stringify(result.error, null, 2));
    }

    expect(result.status).toBe("completed");
    expect(handlerCalled).toBe(true);

    const state = app.getState<{ value: number }>();
    console.log("State value:", state.data.value);
    expect(state.data.value).toBe(99);
  });

  it("should debug patch flow via app", async () => {
    const schemaWithPatch: Omit<DomainSchema, "hash"> = {
      id: "test-schema",
      version: "1.0.0",
      types: {},
      state: { fields: BASE_STATE_FIELDS },
      computed: { fields: {} },
      actions: {
        "test.setPatch": {
          flow: {
            kind: "patch",
            op: "set",
            path: "value",  // No "data." prefix
            value: { kind: "lit", value: 42 },
          },
        },
      },
    };
    const schema: DomainSchema = {
      ...schemaWithPatch,
      hash: hashSchemaSync(schemaWithPatch),
    };

    const app = createTestApp(schema);
    await app.ready();

    const handle = app.act("test.setPatch", {});
    const result = await handle.result();

    console.log("Result status:", result.status);
    if (result.status === "failed") {
      console.log("Error:", JSON.stringify(result.error, null, 2));
    }

    expect(result.status).toBe("completed");

    const state = app.getState<{ value: number }>();
    console.log("State value:", state.data.value);
    expect(state.data.value).toBe(42);
  });
});
