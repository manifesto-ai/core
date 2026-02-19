import { describe, it, expect } from "vitest";
import { compute, computeSync } from "./compute.js";
import { createSnapshot, createIntent } from "../factories.js";
import { hashSchemaSync } from "../utils/hash.js";
import type { DomainSchema } from "../schema/domain.js";

const BASE_STATE_FIELDS: DomainSchema["state"]["fields"] = {
  dummy: { type: "string", required: true },
  count: { type: "number", required: true },
  name: { type: "string", required: true },
  balance: { type: "number", required: true },
  a: { type: "number", required: true },
  b: { type: "number", required: true },
  loading: { type: "boolean", required: true },
  started: { type: "boolean", required: true },
  completed: { type: "boolean", required: true },
  value: { type: "string", required: true },
  todos: {
    type: "array",
    required: true,
    items: {
      type: "object",
      required: true,
      fields: {
        completed: { type: "boolean", required: true },
      },
    },
  },
  fromBalance: { type: "number", required: true },
  toBalance: { type: "number", required: true },
  done: { type: "boolean", required: true },
};

const BASE_COMPUTED_FIELDS: DomainSchema["computed"]["fields"] = {
  "computed.dummy": {
    expr: { kind: "get", path: "dummy" },
    deps: ["dummy"],
  },
};

const BASE_ACTIONS: DomainSchema["actions"] = {
  noop: {
    flow: { kind: "halt", reason: "noop" },
  },
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
const computeWithContext = (
  schema: DomainSchema,
  snapshot: ReturnType<typeof createSnapshot>,
  intent: ReturnType<typeof createIntent>
) => compute(schema, snapshot, intent, HOST_CONTEXT);

describe("compute", () => {
  describe("Basic Intent Processing", () => {
    it("should process a simple action", async () => {
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

      const snapshot = createTestSnapshot({ count: 0 }, schema.hash);
      const intent = createTestIntent("increment");

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({ count: 1 });
      expect(result.snapshot.meta.version).toBe(1);
    });

    it("should handle unknown action", async () => {
      const schema = createTestSchema();
      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("nonexistent");

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("error");
      expect(result.snapshot.system.lastError?.code).toBe("UNKNOWN_ACTION");
    });

    it("should handle action with input", async () => {
      const schema = createTestSchema({
        actions: {
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

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("setName", { name: "Alice" });

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({ name: "Alice" });
    });

    it("should reject intent without intentId", async () => {
      const schema = createTestSchema({
        actions: {
          increment: {
            flow: {
              kind: "patch",
              op: "set",
              path: "count",
              value: { kind: "lit", value: 1 },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({ count: 0 }, schema.hash);
      const intent = { type: "increment", input: undefined, intentId: "" };

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("error");
      expect(result.snapshot.system.lastError?.code).toBe("INVALID_INPUT");
    });
  });

  describe("Meta Access", () => {
    it("should expose meta intentId without mutating input", async () => {
      const schema = createTestSchema({
        actions: {
          markIntent: {
            flow: {
              kind: "patch",
              op: "set",
              path: "value",
              value: { kind: "get", path: "meta.intentId" },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("markIntent", { name: "Alice" });

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({ value: intent.intentId });
      expect(result.snapshot.input).toEqual({ name: "Alice" });
    });
  });

  describe("Availability Check", () => {
    it("should check availability condition", async () => {
      const schema = createTestSchema({
        actions: {
          withdraw: {
            available: {
              kind: "gt",
              left: { kind: "get", path: "balance" },
              right: { kind: "lit", value: 0 },
            },
            flow: {
              kind: "patch",
              op: "set",
              path: "balance",
              value: {
                kind: "sub",
                left: { kind: "get", path: "balance" },
                right: { kind: "get", path: "input.amount" },
              },
            },
          },
        },
      });

      // Should succeed when balance > 0
      const snapshot1 = createTestSnapshot({ balance: 100 }, schema.hash);
      const intent1 = createTestIntent("withdraw", { amount: 50 });
      const result1 = await computeWithContext(schema, snapshot1, intent1);

      expect(result1.status).toBe("complete");
      expect(result1.snapshot.data).toEqual({ balance: 50 });

      // Should fail when balance = 0
      const snapshot2 = createTestSnapshot({ balance: 0 }, schema.hash);
      const intent2 = createTestIntent("withdraw", { amount: 50 });
      const result2 = await computeWithContext(schema, snapshot2, intent2);

      expect(result2.status).toBe("error");
      expect(result2.snapshot.system.lastError?.code).toBe("ACTION_UNAVAILABLE");
    });

    it("should fail when availability does not return boolean", async () => {
      const schema = createTestSchema({
        actions: {
          invalidAvailable: {
            available: {
              kind: "add",
              left: { kind: "lit", value: 1 },
              right: { kind: "lit", value: 2 },
            },
            flow: {
              kind: "patch",
              op: "set",
              path: "count",
              value: { kind: "lit", value: 1 },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({ count: 0 }, schema.hash);
      const intent = createTestIntent("invalidAvailable");

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("error");
      expect(result.snapshot.system.lastError?.code).toBe("TYPE_MISMATCH");
    });
  });

  describe("Input Validation", () => {
    it("should reject invalid input types", async () => {
      const schema = createTestSchema({
        actions: {
          setCount: {
            input: {
              type: "object",
              required: true,
              fields: {
                value: { type: "number", required: true },
              },
            },
            flow: {
              kind: "patch",
              op: "set",
              path: "count",
              value: { kind: "get", path: "input.value" },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({ count: 0 }, schema.hash);
      const intent = createTestIntent("setCount", { value: "not-a-number" });

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("error");
      expect(result.snapshot.system.lastError?.code).toBe("INVALID_INPUT");
    });

    it("should reject missing required input fields", async () => {
      const schema = createTestSchema({
        actions: {
          setCount: {
            input: {
              type: "object",
              required: true,
              fields: {
                value: { type: "number", required: true },
              },
            },
            flow: {
              kind: "patch",
              op: "set",
              path: "count",
              value: { kind: "get", path: "input.value" },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({ count: 0 }, schema.hash);
      const intent = createTestIntent("setCount", {});

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("error");
      expect(result.snapshot.system.lastError?.code).toBe("INVALID_INPUT");
    });

    it("should reject unknown input fields", async () => {
      const schema = createTestSchema({
        actions: {
          setCount: {
            input: {
              type: "object",
              required: true,
              fields: {
                value: { type: "number", required: true },
              },
            },
            flow: {
              kind: "patch",
              op: "set",
              path: "count",
              value: { kind: "get", path: "input.value" },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({ count: 0 }, schema.hash);
      const intent = createTestIntent("setCount", { value: 1, extra: 2 });

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("error");
      expect(result.snapshot.system.lastError?.code).toBe("INVALID_INPUT");
    });
  });

  describe("Computed Values", () => {
    it("should recompute computed values after action", async () => {
      const schema = createTestSchema({
        computed: {
          fields: {
            "computed.total": {
              expr: {
                kind: "add",
                left: { kind: "coalesce", args: [{ kind: "get", path: "a" }, { kind: "lit", value: 0 }] },
                right: { kind: "coalesce", args: [{ kind: "get", path: "b" }, { kind: "lit", value: 0 }] },
              },
              deps: ["a", "b"],
            },
          },
        },
        actions: {
          setA: {
            flow: {
              kind: "patch",
              op: "set",
              path: "a",
              value: { kind: "get", path: "input.value" },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({ a: 10, b: 20 }, schema.hash);
      const intent = createTestIntent("setA", { value: 100 });

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({ a: 100, b: 20 });
      expect(result.snapshot.computed["computed.total"]).toBe(120);
    });
  });

  describe("Effects (Pending Status)", () => {
    it("should return pending status when effect is encountered", async () => {
      const schema = createTestSchema({
        actions: {
          fetchData: {
            flow: {
              kind: "seq",
              steps: [
                { kind: "patch", op: "set", path: "loading", value: { kind: "lit", value: true } },
                {
                  kind: "effect",
                  type: "http",
                  params: {
                    url: { kind: "lit", value: "https://api.example.com/data" },
                  },
                },
              ],
            },
          },
        },
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("fetchData");

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("pending");
      expect(result.snapshot.data).toEqual({ loading: true });
      expect(result.snapshot.system.pendingRequirements).toHaveLength(1);
      expect(result.snapshot.system.pendingRequirements[0].type).toBe("http");
    });
  });

  describe("Halt", () => {
    it("should return halted status when halt is encountered", async () => {
      const schema = createTestSchema({
        actions: {
          conditionalHalt: {
            flow: {
              kind: "seq",
              steps: [
                { kind: "patch", op: "set", path: "started", value: { kind: "lit", value: true } },
                {
                  kind: "if",
                  cond: { kind: "get", path: "input.shouldHalt" },
                  then: { kind: "halt", reason: "User requested halt" },
                },
                { kind: "patch", op: "set", path: "completed", value: { kind: "lit", value: true } },
              ],
            },
          },
        },
      });

      // With halt
      const snapshot1 = createTestSnapshot({}, schema.hash);
      const intent1 = createTestIntent("conditionalHalt", { shouldHalt: true });
      const result1 = await computeWithContext(schema, snapshot1, intent1);

      expect(result1.status).toBe("halted");
      expect(result1.snapshot.data).toEqual({ started: true });

      // Without halt
      const snapshot2 = createTestSnapshot({}, schema.hash);
      const intent2 = createTestIntent("conditionalHalt", { shouldHalt: false });
      const result2 = await computeWithContext(schema, snapshot2, intent2);

      expect(result2.status).toBe("complete");
      expect(result2.snapshot.data).toEqual({ started: true, completed: true });
    });
  });

  describe("Error Handling", () => {
    it("should handle fail flow", async () => {
      const schema = createTestSchema({
        actions: {
          validateInput: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "input.value" } },
              then: { kind: "fail", code: "MISSING_VALUE", message: { kind: "lit", value: "Value is required" } },
              else: { kind: "patch", op: "set", path: "value", value: { kind: "get", path: "input.value" } },
            },
          },
        },
      });

      // With null input
      const snapshot1 = createTestSnapshot({}, schema.hash);
      const intent1 = createTestIntent("validateInput", { value: null });
      const result1 = await computeWithContext(schema, snapshot1, intent1);

      expect(result1.status).toBe("error");
      expect(result1.snapshot.system.lastError?.message).toBe("Value is required");

      // With valid input
      const snapshot2 = createTestSnapshot({}, schema.hash);
      const intent2 = createTestIntent("validateInput", { value: "test" });
      const result2 = await computeWithContext(schema, snapshot2, intent2);

      expect(result2.status).toBe("complete");
      expect(result2.snapshot.data).toEqual({ value: "test" });
    });
  });

  describe("Trace Generation", () => {
    it("should generate trace graph", async () => {
      const schema = createTestSchema({
        actions: {
          simpleAction: {
            flow: {
              kind: "seq",
              steps: [
                { kind: "patch", op: "set", path: "a", value: { kind: "lit", value: 1 } },
                { kind: "patch", op: "set", path: "b", value: { kind: "lit", value: 2 } },
              ],
            },
          },
        },
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("simpleAction");

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.trace).toBeDefined();
      expect(result.trace.intent).toEqual({ type: "simpleAction", input: undefined });
      expect(result.trace.baseVersion).toBe(0);
      expect(result.trace.resultVersion).toBe(1);
      expect(result.trace.duration).toBeGreaterThanOrEqual(0);
      expect(result.trace.terminatedBy).toBe("complete");
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle a todo app workflow", async () => {
      const schema = createTestSchema({
        computed: {
          fields: {
            "computed.activeCount": {
              expr: {
                kind: "len",
                arg: {
                  kind: "filter",
                  array: { kind: "coalesce", args: [{ kind: "get", path: "todos" }, { kind: "lit", value: [] }] },
                  predicate: { kind: "not", arg: { kind: "get", path: "$item.completed" } },
                },
              },
              deps: ["todos"],
            },
          },
        },
        actions: {
          addTodo: {
            flow: {
              kind: "patch",
              op: "set",
              path: "todos",
              value: {
                kind: "coalesce",
                args: [
                  {
                    kind: "if",
                    cond: { kind: "isNull", arg: { kind: "get", path: "todos" } },
                    then: { kind: "lit", value: [] },
                    else: { kind: "get", path: "todos" },
                  },
                  { kind: "lit", value: [] },
                ],
              },
            },
          },
        },
      });

      // First add - initialize todos array
      const snapshot = createTestSnapshot({}, schema.hash);
      const intent = createTestIntent("addTodo", { text: "Test todo" });

      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("complete");
      expect(result.snapshot.computed["computed.activeCount"]).toBe(0);
    });

    it("should handle sequential operations with state dependencies", async () => {
      const schema = createTestSchema({
        actions: {
          transfer: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: "fromBalance",
                  value: {
                    kind: "sub",
                    left: { kind: "get", path: "fromBalance" },
                    right: { kind: "get", path: "input.amount" },
                  },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: "toBalance",
                  value: {
                    kind: "add",
                    left: { kind: "get", path: "toBalance" },
                    right: { kind: "get", path: "input.amount" },
                  },
                },
              ],
            },
          },
        },
      });

      const snapshot = createTestSnapshot({
        fromBalance: 100,
        toBalance: 50,
      }, schema.hash);

      const intent = createTestIntent("transfer", { amount: 30 });
      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({
        fromBalance: 70,
        toBalance: 80,
      });
    });
  });

  describe("Version Management", () => {
    it("should increment version on each compute", async () => {
      const schema = createTestSchema({
        actions: {
          noop: {
            flow: { kind: "seq", steps: [] },
          },
        },
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      expect(snapshot.meta.version).toBe(0);

      const result1 = await computeWithContext(schema, snapshot, createTestIntent("noop"));
      expect(result1.snapshot.meta.version).toBe(1);

      const result2 = await computeWithContext(schema, result1.snapshot, createTestIntent("noop"));
      expect(result2.snapshot.meta.version).toBe(2);
    });
  });

  describe("System State", () => {
    it("should track errors in system.errors", async () => {
      const schema = createTestSchema({
        actions: {
          fail: {
            flow: { kind: "fail", code: "TEST_ERROR" },
          },
        },
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const result1 = await computeWithContext(schema, snapshot, createTestIntent("fail"));

      expect(result1.snapshot.system.errors).toHaveLength(1);
      expect(result1.snapshot.system.lastError?.code).toBe("VALIDATION_ERROR");

      // Run again to accumulate errors
      const result2 = await computeWithContext(schema, result1.snapshot, createTestIntent("fail"));
      expect(result2.snapshot.system.errors).toHaveLength(2);
    });

    it("should reset currentAction after completion", async () => {
      const schema = createTestSchema({
        actions: {
          test: {
            flow: { kind: "patch", op: "set", path: "done", value: { kind: "lit", value: true } },
          },
        },
      });

      const snapshot = createTestSnapshot({}, schema.hash);
      const result = await computeWithContext(schema, snapshot, createTestIntent("test"));

      expect(result.snapshot.system.currentAction).toBeNull();
      expect(result.snapshot.system.status).toBe("idle");
    });
  });

  describe("Determinism", () => {
    it("should produce identical results for same inputs", async () => {
      const schema = createTestSchema({
        actions: {
          increment: {
            flow: {
              kind: "patch",
              op: "set",
              path: "count",
              value: {
                kind: "add",
                left: { kind: "get", path: "count" },
                right: { kind: "lit", value: 1 },
              },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({ count: 1 }, schema.hash);
      const intent = createIntent("increment", "intent-fixed");

      const result1 = await compute(schema, snapshot, intent, HOST_CONTEXT);
      const result2 = await compute(schema, snapshot, intent, HOST_CONTEXT);

      expect(result1).toEqual(result2);
    });
  });

  describe("Availability on Re-Entry (#134)", () => {
    it("should keep action valid when re-entering after effect mutates available fields", async () => {
      const schema = createTestSchema({
        state: {
          fields: {
            pending: { type: "string", required: false },
            result: { type: "string", required: false },
          },
        },
        actions: {
          run: {
            available: {
              kind: "and",
              args: [
                { kind: "isNull", arg: { kind: "get", path: "pending" } },
                { kind: "isNull", arg: { kind: "get", path: "result" } },
              ],
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
                    params: {
                      into: { kind: "lit", value: "result" },
                    },
                  },
                ],
              },
            },
          },
        },
      });

      const pending = createTestSnapshot({ pending: null, result: null }, schema.hash);
      const intent = createIntent("run", "intent-run-1");

      const first = await compute(schema, pending, intent, HOST_CONTEXT);
      expect(first.status).toBe("pending");
      expect(first.snapshot.system.currentAction).toBe("run");

      const afterEffect = {
        ...first.snapshot,
        data: { ...(first.snapshot.data as Record<string, unknown>), result: "done" },
        system: {
          ...first.snapshot.system,
          pendingRequirements: [],
        },
      };

      const second = await compute(schema, afterEffect, intent, HOST_CONTEXT);

      expect(second.status).toBe("complete");
      expect(second.snapshot.system.lastError?.code).toBeUndefined();
    });

    it("should skip availability check on re-entry when currentAction matches", async () => {
      // Simulates the issue #134 scenario:
      // Action `run` has `available when and(isNull(result), isNull(pending))`
      // First compute: available passes, patches pending, declares effect → status "pending"
      // After effect fulfillment, Host calls compute again with updated snapshot
      // where pending and result are non-null. Without the fix, this would fail
      // with ACTION_UNAVAILABLE because `available` re-evaluates to false.
      const schema = createTestSchema({
        state: {
          fields: {
            pending: { type: "string", required: false },
            result: { type: "string", required: false },
          },
        },
        actions: {
          run: {
            available: {
              kind: "and",
              args: [
                { kind: "isNull", arg: { kind: "get", path: "pending" } },
                { kind: "isNull", arg: { kind: "get", path: "result" } },
              ],
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
                    params: {
                      into: { kind: "lit", value: "result" },
                    },
                  },
                ],
              },
            },
          },
        },
      });

      // 1st compute: initial invocation — available passes, effect declared
      const snapshot1 = createTestSnapshot({ pending: null, result: null }, schema.hash);
      const intent = createIntent("run", "intent-run-1");
      const result1 = await compute(schema, snapshot1, intent, HOST_CONTEXT);

      expect(result1.status).toBe("pending");
      expect(result1.snapshot.data).toEqual(
        expect.objectContaining({ pending: "intent-run-1" })
      );
      expect(result1.snapshot.system.currentAction).toBe("run");

      // 2nd compute: simulate re-entry after effect fulfillment
      // Host applied effect patches (result is now set) and calls compute again.
      // The snapshot has currentAction === "run" (set during 1st compute pending).
      const reEntrySnapshot = {
        ...result1.snapshot,
        data: { ...result1.snapshot.data as Record<string, unknown>, result: "done" },
        system: {
          ...result1.snapshot.system,
          // currentAction remains "run" — this signals re-entry
          pendingRequirements: [],
        },
      };

      const result2 = await compute(schema, reEntrySnapshot, intent, HOST_CONTEXT);

      // Should NOT fail with ACTION_UNAVAILABLE — availability is skipped on re-entry
      expect(result2.status).not.toBe("error");
      expect(result2.snapshot.system.lastError?.code).not.toBe("ACTION_UNAVAILABLE");
    });

    it("SCENARIO: different intentId same action type on pending snapshot bypasses availability", async () => {
      // Models the reviewer's concern:
      // Intent A (type "run") → pending → currentAction = "run"
      // Then Intent B (type "run", DIFFERENT intentId) arrives on that snapshot.
      // With current fix (type-only guard), B skips availability.
      // This test documents whether this is reachable and what happens.
      const schema = createTestSchema({
        state: {
          fields: {
            pending: { type: "string", required: false },
            result: { type: "string", required: false },
          },
        },
        actions: {
          run: {
            available: {
              kind: "and",
              args: [
                { kind: "isNull", arg: { kind: "get", path: "pending" } },
                { kind: "isNull", arg: { kind: "get", path: "result" } },
              ],
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
                    params: {
                      into: { kind: "lit", value: "result" },
                    },
                  },
                ],
              },
            },
          },
        },
      });

      // Intent A: pending → currentAction = "run"
      const snapshot1 = createTestSnapshot({ pending: null, result: null }, schema.hash);
      const intentA = createIntent("run", "intent-A");
      const resultA = await compute(schema, snapshot1, intentA, HOST_CONTEXT);

      expect(resultA.status).toBe("pending");
      expect(resultA.snapshot.system.currentAction).toBe("run");

      // Intent B: different intentId, same action type, on A's pending snapshot
      const intentB = createIntent("run", "intent-B");
      const resultB = await compute(schema, resultA.snapshot, intentB, HOST_CONTEXT);

      // With type-only guard, availability IS skipped (isReEntry = true).
      // But the flow's own state guard (if isNull(pending)) prevents double-patching.
      // pending is already "intent-A", so the if-branch is skipped → no patches, no effects.
      // Result: completes as no-op, does NOT corrupt state.
      expect(resultB.snapshot.system.lastError?.code).not.toBe("ACTION_UNAVAILABLE");
      expect((resultB.snapshot.data as Record<string, unknown>).pending).toBe("intent-A"); // unchanged
    });

    it("SCENARIO: different action type on pending snapshot still checks availability", async () => {
      // Ensure that a DIFFERENT action type is NOT treated as re-entry
      // even when currentAction is set from a previous pending action.
      const schema = createTestSchema({
        state: {
          fields: {
            pending: { type: "string", required: false },
            result: { type: "string", required: false },
            count: { type: "number", required: false },
          },
        },
        actions: {
          run: {
            available: {
              kind: "isNull",
              arg: { kind: "get", path: "pending" },
            },
            flow: {
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
          increment: {
            available: {
              kind: "isNull",
              arg: { kind: "get", path: "pending" },
            },
            flow: {
              kind: "patch",
              op: "set",
              path: "count",
              value: { kind: "lit", value: 1 },
            },
          },
        },
      });

      // "run" → pending → currentAction = "run"
      const snapshot1 = createTestSnapshot({ pending: null, result: null, count: 0 }, schema.hash);
      const intentRun = createIntent("run", "intent-run");
      const resultRun = await compute(schema, snapshot1, intentRun, HOST_CONTEXT);

      expect(resultRun.status).toBe("pending");
      expect(resultRun.snapshot.system.currentAction).toBe("run");

      // "increment" on the pending snapshot — different type, should NOT skip availability
      const intentInc = createIntent("increment", "intent-inc");
      const resultInc = await compute(schema, resultRun.snapshot, intentInc, HOST_CONTEXT);

      // currentAction is "run" but intent type is "increment" → isReEntry = false
      // available when isNull(pending) → pending is "intent-run" → false → ACTION_UNAVAILABLE
      expect(resultInc.status).toBe("error");
      expect(resultInc.snapshot.system.lastError?.code).toBe("ACTION_UNAVAILABLE");
    });

    it("should still check availability on fresh invocation", async () => {
      // Ensure the fix doesn't accidentally skip availability on initial calls
      const schema = createTestSchema({
        state: {
          fields: {
            pending: { type: "string", required: false },
            result: { type: "string", required: false },
          },
        },
        actions: {
          run: {
            available: {
              kind: "and",
              args: [
                { kind: "isNull", arg: { kind: "get", path: "pending" } },
                { kind: "isNull", arg: { kind: "get", path: "result" } },
              ],
            },
            flow: {
              kind: "patch",
              op: "set",
              path: "pending",
              value: { kind: "get", path: "meta.intentId" },
            },
          },
        },
      });

      // Fresh invocation where available condition is false — should still fail
      const snapshot = createTestSnapshot(
        { pending: "already-set", result: null },
        schema.hash
      );
      const intent = createTestIntent("run");
      const result = await computeWithContext(schema, snapshot, intent);

      expect(result.status).toBe("error");
      expect(result.snapshot.system.lastError?.code).toBe("ACTION_UNAVAILABLE");
    });
  });

  describe("computeSync", () => {
    it("should match async compute for the same inputs", async () => {
      const schema = createTestSchema({
        actions: {
          increment: {
            flow: {
              kind: "patch",
              op: "set",
              path: "count",
              value: {
                kind: "add",
                left: { kind: "get", path: "count" },
                right: { kind: "lit", value: 1 },
              },
            },
          },
        },
      });

      const snapshot = createTestSnapshot({ count: 1 }, schema.hash);
      const intent = createIntent("increment", "intent-sync-1");

      const asyncResult = await compute(schema, snapshot, intent, HOST_CONTEXT);
      const syncResult = computeSync(schema, snapshot, intent, HOST_CONTEXT);

      expect(syncResult).toEqual(asyncResult);
    });
  });
});
