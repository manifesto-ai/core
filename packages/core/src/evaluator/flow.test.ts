import { describe, it, expect } from "vitest";
import { evaluateFlow, createFlowState, type FlowState } from "./flow.js";
import { createContext } from "./context.js";
import type { FlowNode } from "../schema/flow.js";
import type { Snapshot } from "../schema/snapshot.js";
import type { DomainSchema } from "../schema/domain.js";

const BASE_STATE_FIELDS: DomainSchema["state"]["fields"] = {
  a: { type: "number", required: true },
  b: { type: "number", required: true },
  count: { type: "number", required: true },
  result: { type: "string", required: true },
  enabled: { type: "boolean", required: true },
  toRemove: { type: "string", required: true },
  doubled: { type: "number", required: true },
  fromHelper: { type: "boolean", required: true },
  before: { type: "boolean", required: true },
  after: { type: "boolean", required: true },
  x: { type: "number", required: true },
  value: { type: "number", required: true },
  category: { type: "string", required: true },
  activeItems: { type: "array", required: true, items: { type: "object", required: true } },
  activeCount: { type: "number", required: true },
  items: {
    type: "array",
    required: true,
    items: {
      type: "object",
      required: true,
      fields: {
        active: { type: "boolean", required: true },
      },
    },
  },
  user: {
    type: "object",
    required: true,
    fields: {
      name: { type: "string", required: true },
      age: { type: "number", required: true },
      city: { type: "string", required: true },
    },
  },
};

// Helper to create a minimal test context
function createTestContext(
  data: unknown = {},
  input?: unknown,
  actions: DomainSchema["actions"] = {}
): ReturnType<typeof createContext> {
  const snapshot: Snapshot = {
    data,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    input,
    meta: {
      version: 0,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "test-hash",
    },
  };

  const schema: DomainSchema = {
    id: "manifesto:test",
    version: "1.0.0",
    hash: "test-hash",
    types: {},
    state: { fields: BASE_STATE_FIELDS },
    computed: { fields: {} },
    actions,
  };

  return createContext(snapshot, schema, "testAction", "test", "test-intent-id", 0);
}

function createTestFlowState(data: unknown = {}): FlowState {
  const snapshot: Snapshot = {
    data,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    input: undefined,
    meta: {
      version: 0,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "test-hash",
    },
  };
  return createFlowState(snapshot);
}

describe("Flow Evaluator", () => {
  describe("seq", () => {
    it("should execute steps in order", async () => {
      const flow: FlowNode = {
        kind: "seq",
        steps: [
          { kind: "patch", op: "set", path: "a", value: { kind: "lit", value: 1 } },
          { kind: "patch", op: "set", path: "b", value: { kind: "lit", value: 2 } },
        ],
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.status).toBe("running");
      expect(result.state.snapshot.data).toEqual({ a: 1, b: 2 });
      expect(result.state.patches).toHaveLength(2);
    });

    it("should stop on halt", async () => {
      const flow: FlowNode = {
        kind: "seq",
        steps: [
          { kind: "patch", op: "set", path: "a", value: { kind: "lit", value: 1 } },
          { kind: "halt", reason: "stopped" },
          { kind: "patch", op: "set", path: "b", value: { kind: "lit", value: 2 } },
        ],
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.status).toBe("halted");
      expect(result.state.snapshot.data).toEqual({ a: 1 });
      expect(result.state.patches).toHaveLength(1);
    });

    it("should stop on error", async () => {
      const flow: FlowNode = {
        kind: "seq",
        steps: [
          { kind: "patch", op: "set", path: "a", value: { kind: "lit", value: 1 } },
          { kind: "fail", code: "TEST_ERROR" },
          { kind: "patch", op: "set", path: "b", value: { kind: "lit", value: 2 } },
        ],
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.status).toBe("error");
      expect(result.state.snapshot.data).toEqual({ a: 1 });
      expect(result.state.error).not.toBeNull();
    });

    it("should stop on effect", async () => {
      const flow: FlowNode = {
        kind: "seq",
        steps: [
          { kind: "patch", op: "set", path: "a", value: { kind: "lit", value: 1 } },
          { kind: "effect", type: "http", params: { url: { kind: "lit", value: "http://example.com" } } },
          { kind: "patch", op: "set", path: "b", value: { kind: "lit", value: 2 } },
        ],
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.status).toBe("pending");
      expect(result.state.snapshot.data).toEqual({ a: 1 });
      expect(result.state.requirements).toHaveLength(1);
    });
  });

  describe("if", () => {
    it("should execute then branch when condition is true", async () => {
      const flow: FlowNode = {
        kind: "if",
        cond: { kind: "lit", value: true },
        then: { kind: "patch", op: "set", path: "result", value: { kind: "lit", value: "then" } },
        else: { kind: "patch", op: "set", path: "result", value: { kind: "lit", value: "else" } },
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.data).toEqual({ result: "then" });
    });

    it("should execute else branch when condition is false", async () => {
      const flow: FlowNode = {
        kind: "if",
        cond: { kind: "lit", value: false },
        then: { kind: "patch", op: "set", path: "result", value: { kind: "lit", value: "then" } },
        else: { kind: "patch", op: "set", path: "result", value: { kind: "lit", value: "else" } },
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.data).toEqual({ result: "else" });
    });

    it("should skip else when not provided and condition is false", async () => {
      const flow: FlowNode = {
        kind: "if",
        cond: { kind: "lit", value: false },
        then: { kind: "patch", op: "set", path: "result", value: { kind: "lit", value: "then" } },
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.data).toEqual({});
      expect(result.state.status).toBe("running");
    });

    it("should evaluate condition from snapshot data", async () => {
      const flow: FlowNode = {
        kind: "if",
        cond: { kind: "get", path: "enabled" },
        then: { kind: "patch", op: "set", path: "result", value: { kind: "lit", value: "enabled" } },
        else: { kind: "patch", op: "set", path: "result", value: { kind: "lit", value: "disabled" } },
      };

      const ctx = createTestContext({ enabled: true });
      const state = createTestFlowState({ enabled: true });
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.data).toEqual({ enabled: true, result: "enabled" });
    });
  });

  describe("patch", () => {
    it("should set a value", async () => {
      const flow: FlowNode = {
        kind: "patch",
        op: "set",
        path: "count",
        value: { kind: "lit", value: 42 },
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.data).toEqual({ count: 42 });
      expect(result.state.patches).toEqual([{ op: "set", path: "count", value: 42 }]);
    });

    it("should set a nested value", async () => {
      const flow: FlowNode = {
        kind: "patch",
        op: "set",
        path: "user.name",
        value: { kind: "lit", value: "Alice" },
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.data).toEqual({ user: { name: "Alice" } });
    });

    it("should allow patching system fields", async () => {
      const flow: FlowNode = {
        kind: "patch",
        op: "set",
        path: "system.status",
        value: { kind: "lit", value: "error" },
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.system.status).toBe("error");
      expect(result.state.snapshot.data).toEqual({});
    });

    it("should unset a value", async () => {
      const flow: FlowNode = {
        kind: "patch",
        op: "unset",
        path: "toRemove",
      };

      const ctx = createTestContext({ toRemove: "value", keep: "this" });
      const state = createTestFlowState({ toRemove: "value", keep: "this" });
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.data).toEqual({ keep: "this" });
    });

    it("should merge objects", async () => {
      const flow: FlowNode = {
        kind: "patch",
        op: "merge",
        path: "user",
        value: { kind: "lit", value: { age: 30, city: "Seoul" } },
      };

      const ctx = createTestContext({ user: { name: "Alice" } });
      const state = createTestFlowState({ user: { name: "Alice" } });
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.data).toEqual({ user: { name: "Alice", age: 30, city: "Seoul" } });
    });

    it("should evaluate expression for value", async () => {
      const flow: FlowNode = {
        kind: "patch",
        op: "set",
        path: "doubled",
        value: {
          kind: "mul",
          left: { kind: "get", path: "input.value" },
          right: { kind: "lit", value: 2 },
        },
      };

      const ctx = createTestContext({}, { value: 21 });
      const state = createFlowState({
        data: {},
        computed: {},
        system: {
          status: "idle",
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        input: { value: 21 },
        meta: { version: 0, timestamp: 0, randomSeed: "seed", schemaHash: "test-hash" },
      });
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.data).toEqual({ doubled: 42 });
    });
  });

  describe("effect", () => {
    it("should create a requirement and set status to pending", async () => {
      const flow: FlowNode = {
        kind: "effect",
        type: "http",
        params: {
          url: { kind: "lit", value: "https://api.example.com" },
          method: { kind: "lit", value: "GET" },
        },
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.status).toBe("pending");
      expect(result.state.requirements).toHaveLength(1);
      expect(result.state.requirements[0].type).toBe("http");
      expect(result.state.requirements[0].params).toEqual({
        url: "https://api.example.com",
        method: "GET",
      });
    });

    it("should generate deterministic requirement ID", async () => {
      const flow: FlowNode = {
        kind: "effect",
        type: "http",
        params: { url: { kind: "lit", value: "http://example.com" } },
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result1 = await evaluateFlow(flow, ctx, state, "test");
      const result2 = await evaluateFlow(flow, ctx, state, "test");

      expect(result1.state.requirements[0].id).toBe(result2.state.requirements[0].id);
    });
  });

  describe("call", () => {
    it("should call another flow", async () => {
      const helperAction = {
        flow: { kind: "patch", op: "set", path: "fromHelper", value: { kind: "lit", value: true } } as FlowNode,
      };

      const flow: FlowNode = {
        kind: "seq",
        steps: [
          { kind: "patch", op: "set", path: "before", value: { kind: "lit", value: true } },
          { kind: "call", flow: "helper" },
          { kind: "patch", op: "set", path: "after", value: { kind: "lit", value: true } },
        ],
      };

      const ctx = createTestContext({}, undefined, { helper: helperAction });
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.data).toEqual({
        before: true,
        fromHelper: true,
        after: true,
      });
    });

    it("should error on unknown flow", async () => {
      const flow: FlowNode = {
        kind: "call",
        flow: "nonexistent",
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.status).toBe("error");
      expect(result.state.error?.code).toBe("UNKNOWN_FLOW");
    });
  });

  describe("halt", () => {
    it("should stop execution with halted status", async () => {
      const flow: FlowNode = {
        kind: "halt",
        reason: "Manual stop",
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.status).toBe("halted");
      expect(result.trace.kind).toBe("halt");
    });
  });

  describe("fail", () => {
    it("should stop execution with error status", async () => {
      const flow: FlowNode = {
        kind: "fail",
        code: "VALIDATION_FAILED",
        message: { kind: "lit", value: "Invalid input" },
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.status).toBe("error");
      expect(result.state.error?.code).toBe("VALIDATION_ERROR");
      expect(result.state.error?.message).toBe("Invalid input");
    });

    it("should use code as message if no message provided", async () => {
      const flow: FlowNode = {
        kind: "fail",
        code: "SIMPLE_ERROR",
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.error?.message).toBe("SIMPLE_ERROR");
    });
  });

  describe("Trace Generation", () => {
    it("should generate trace for seq", async () => {
      const flow: FlowNode = {
        kind: "seq",
        steps: [
          { kind: "patch", op: "set", path: "a", value: { kind: "lit", value: 1 } },
          { kind: "patch", op: "set", path: "b", value: { kind: "lit", value: 2 } },
        ],
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.trace.kind).toBe("flow");
      expect(result.trace.children).toHaveLength(2);
      expect(result.trace.children[0].kind).toBe("patch");
      expect(result.trace.children[1].kind).toBe("patch");
    });

    it("should generate trace for if", async () => {
      const flow: FlowNode = {
        kind: "if",
        cond: { kind: "lit", value: true },
        then: { kind: "patch", op: "set", path: "x", value: { kind: "lit", value: 1 } },
      };

      const ctx = createTestContext();
      const state = createTestFlowState();
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.trace.kind).toBe("branch");
      expect(result.trace.inputs).toEqual({ cond: true });
      expect(result.trace.children).toHaveLength(1);
    });
  });

  describe("Complex Flows", () => {
    it("should handle nested conditionals", async () => {
      const flow: FlowNode = {
        kind: "if",
        cond: { kind: "gt", left: { kind: "get", path: "value" }, right: { kind: "lit", value: 10 } },
        then: {
          kind: "if",
          cond: { kind: "gt", left: { kind: "get", path: "value" }, right: { kind: "lit", value: 20 } },
          then: { kind: "patch", op: "set", path: "category", value: { kind: "lit", value: "high" } },
          else: { kind: "patch", op: "set", path: "category", value: { kind: "lit", value: "medium" } },
        },
        else: { kind: "patch", op: "set", path: "category", value: { kind: "lit", value: "low" } },
      };

      const ctx1 = createTestContext({ value: 25 });
      const state1 = createTestFlowState({ value: 25 });
      const result1 = await evaluateFlow(flow, ctx1, state1, "test");
      expect(result1.state.snapshot.data).toEqual({ value: 25, category: "high" });

      const ctx2 = createTestContext({ value: 15 });
      const state2 = createTestFlowState({ value: 15 });
      const result2 = await evaluateFlow(flow, ctx2, state2, "test");
      expect(result2.state.snapshot.data).toEqual({ value: 15, category: "medium" });

      const ctx3 = createTestContext({ value: 5 });
      const state3 = createTestFlowState({ value: 5 });
      const result3 = await evaluateFlow(flow, ctx3, state3, "test");
      expect(result3.state.snapshot.data).toEqual({ value: 5, category: "low" });
    });

    it("should handle loop-like pattern with filter/map", async () => {
      // Process items and store count
      const flow: FlowNode = {
        kind: "seq",
        steps: [
          {
            kind: "patch",
            op: "set",
            path: "activeItems",
            value: {
              kind: "filter",
              array: { kind: "get", path: "items" },
              predicate: { kind: "get", path: "$item.active" },
            },
          },
          {
            kind: "patch",
            op: "set",
            path: "activeCount",
            value: {
              kind: "len",
              arg: { kind: "get", path: "activeItems" },
            },
          },
        ],
      };

      const ctx = createTestContext({ items: [{ active: true }, { active: false }, { active: true }] });
      const state = createTestFlowState({ items: [{ active: true }, { active: false }, { active: true }] });
      const result = await evaluateFlow(flow, ctx, state, "test");

      expect(result.state.snapshot.data).toMatchObject({
        activeItems: [{ active: true }, { active: true }],
        activeCount: 2,
      });
    });
  });
});
