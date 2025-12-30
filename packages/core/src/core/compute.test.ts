import { describe, it, expect } from "vitest";
import { compute } from "./compute.js";
import { createSnapshot, createIntent } from "../factories.js";
import type { DomainSchema } from "../schema/domain.js";

// Helper to create a minimal domain schema
function createTestSchema(overrides: Partial<DomainSchema> = {}): DomainSchema {
  return {
    id: "test",
    version: "1.0.0",
    hash: "test-hash",
    state: { fields: {} },
    computed: { fields: {} },
    actions: {},
    ...overrides,
  };
}

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

      const snapshot = createSnapshot({ count: 0 }, "test-hash");
      const intent = createIntent("increment");

      const result = await compute(schema, snapshot, intent);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({ count: 1 });
      expect(result.snapshot.meta.version).toBe(1);
    });

    it("should handle unknown action", async () => {
      const schema = createTestSchema();
      const snapshot = createSnapshot({}, "test-hash");
      const intent = createIntent("nonexistent");

      const result = await compute(schema, snapshot, intent);

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

      const snapshot = createSnapshot({}, "test-hash");
      const intent = createIntent("setName", { name: "Alice" });

      const result = await compute(schema, snapshot, intent);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data).toEqual({ name: "Alice" });
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
      const snapshot1 = createSnapshot({ balance: 100 }, "test-hash");
      const intent1 = createIntent("withdraw", { amount: 50 });
      const result1 = await compute(schema, snapshot1, intent1);

      expect(result1.status).toBe("complete");
      expect(result1.snapshot.data).toEqual({ balance: 50 });

      // Should fail when balance = 0
      const snapshot2 = createSnapshot({ balance: 0 }, "test-hash");
      const intent2 = createIntent("withdraw", { amount: 50 });
      const result2 = await compute(schema, snapshot2, intent2);

      expect(result2.status).toBe("error");
      expect(result2.snapshot.system.lastError?.code).toBe("ACTION_UNAVAILABLE");
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

      const snapshot = createSnapshot({ a: 10, b: 20 }, "test-hash");
      const intent = createIntent("setA", { value: 100 });

      const result = await compute(schema, snapshot, intent);

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

      const snapshot = createSnapshot({}, "test-hash");
      const intent = createIntent("fetchData");

      const result = await compute(schema, snapshot, intent);

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
      const snapshot1 = createSnapshot({}, "test-hash");
      const intent1 = createIntent("conditionalHalt", { shouldHalt: true });
      const result1 = await compute(schema, snapshot1, intent1);

      expect(result1.status).toBe("halted");
      expect(result1.snapshot.data).toEqual({ started: true });

      // Without halt
      const snapshot2 = createSnapshot({}, "test-hash");
      const intent2 = createIntent("conditionalHalt", { shouldHalt: false });
      const result2 = await compute(schema, snapshot2, intent2);

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
      const snapshot1 = createSnapshot({}, "test-hash");
      const intent1 = createIntent("validateInput", { value: null });
      const result1 = await compute(schema, snapshot1, intent1);

      expect(result1.status).toBe("error");
      expect(result1.snapshot.system.lastError?.message).toBe("Value is required");

      // With valid input
      const snapshot2 = createSnapshot({}, "test-hash");
      const intent2 = createIntent("validateInput", { value: "test" });
      const result2 = await compute(schema, snapshot2, intent2);

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

      const snapshot = createSnapshot({}, "test-hash");
      const intent = createIntent("simpleAction");

      const result = await compute(schema, snapshot, intent);

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
      const snapshot = createSnapshot({}, "test-hash");
      const intent = createIntent("addTodo", { text: "Test todo" });

      const result = await compute(schema, snapshot, intent);

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

      const snapshot = createSnapshot({
        fromBalance: 100,
        toBalance: 50,
      }, "test-hash");

      const intent = createIntent("transfer", { amount: 30 });
      const result = await compute(schema, snapshot, intent);

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

      const snapshot = createSnapshot({}, "test-hash");
      expect(snapshot.meta.version).toBe(0);

      const result1 = await compute(schema, snapshot, createIntent("noop"));
      expect(result1.snapshot.meta.version).toBe(1);

      const result2 = await compute(schema, result1.snapshot, createIntent("noop"));
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

      const snapshot = createSnapshot({}, "test-hash");
      const result1 = await compute(schema, snapshot, createIntent("fail"));

      expect(result1.snapshot.system.errors).toHaveLength(1);
      expect(result1.snapshot.system.lastError?.code).toBe("VALIDATION_ERROR");

      // Run again to accumulate errors
      const result2 = await compute(schema, result1.snapshot, createIntent("fail"));
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

      const snapshot = createSnapshot({}, "test-hash");
      const result = await compute(schema, snapshot, createIntent("test"));

      expect(result.snapshot.system.currentAction).toBeNull();
      expect(result.snapshot.system.status).toBe("idle");
    });
  });
});
