import { describe, it, expect } from "vitest";
import { evaluateExpr } from "./expr.js";
import { createContext } from "./context.js";
import type { ExprNode } from "../schema/expr.js";
import type { Snapshot } from "../schema/snapshot.js";
import type { DomainSchema } from "../schema/domain.js";
import { isOk, isErr } from "../schema/common.js";

// Helper to create a minimal test context
function createTestContext(
  data: unknown = {},
  input?: unknown,
  meta?: { intentId: string; actionName: string | null; timestamp: number }
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
      timestamp: meta?.timestamp ?? 0,
      randomSeed: "seed",
      schemaHash: "test-hash",
    },
  };

  const schema: DomainSchema = {
    id: "manifesto:test",
    version: "1.0.0",
    hash: "test-hash",
    types: {},
    state: { fields: {} },
    computed: { fields: {} },
    actions: {},
  };

  return createContext(
    snapshot,
    schema,
    meta?.actionName ?? null,
    "test",
    meta?.intentId,
    meta?.timestamp ?? 0
  );
}

// Helper to evaluate and unwrap result
function evaluate(expr: ExprNode, ctx = createTestContext()): unknown {
  const result = evaluateExpr(expr, ctx);
  if (!isOk(result)) {
    throw new Error(`Evaluation failed: ${result.error.message}`);
  }
  return result.value;
}

describe("Expression Evaluator", () => {
  describe("Literals", () => {
    it("lit - should return literal values", () => {
      expect(evaluate({ kind: "lit", value: 42 })).toBe(42);
      expect(evaluate({ kind: "lit", value: "hello" })).toBe("hello");
      expect(evaluate({ kind: "lit", value: true })).toBe(true);
      expect(evaluate({ kind: "lit", value: null })).toBe(null);
      expect(evaluate({ kind: "lit", value: [1, 2, 3] })).toEqual([1, 2, 3]);
      expect(evaluate({ kind: "lit", value: { a: 1 } })).toEqual({ a: 1 });
    });

    it("get - should get values from data", () => {
      const ctx = createTestContext({ count: 10, user: { name: "Alice" } });
      expect(evaluate({ kind: "get", path: "count" }, ctx)).toBe(10);
      expect(evaluate({ kind: "get", path: "user.name" }, ctx)).toBe("Alice");
      expect(evaluate({ kind: "get", path: "nonexistent" }, ctx)).toBeUndefined();
    });

    it("get - should get values from input", () => {
      const ctx = createTestContext({}, { amount: 100 });
      expect(evaluate({ kind: "get", path: "input.amount" }, ctx)).toBe(100);
      expect(evaluate({ kind: "get", path: "input" }, ctx)).toEqual({ amount: 100 });
    });

    it("get - should get values from system", () => {
      const ctx = createTestContext();
      expect(evaluate({ kind: "get", path: "system.status" }, ctx)).toBe("idle");
    });

    it("get - should get values from meta", () => {
      const ctx = createTestContext({}, undefined, {
        intentId: "intent-123",
        actionName: "testAction",
        timestamp: 1234,
      });
      expect(evaluate({ kind: "get", path: "meta.intentId" }, ctx)).toBe("intent-123");
      expect(evaluate({ kind: "get", path: "meta.actionName" }, ctx)).toBe("testAction");
      expect(evaluate({ kind: "get", path: "meta.timestamp" }, ctx)).toBe(1234);
    });
  });

  describe("Comparison", () => {
    it("eq - should compare equality", () => {
      expect(evaluate({ kind: "eq", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 5 } })).toBe(true);
      expect(evaluate({ kind: "eq", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 3 } })).toBe(false);
      expect(evaluate({ kind: "eq", left: { kind: "lit", value: "a" }, right: { kind: "lit", value: "a" } })).toBe(true);
    });

    it("neq - should compare inequality", () => {
      expect(evaluate({ kind: "neq", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 3 } })).toBe(true);
      expect(evaluate({ kind: "neq", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 5 } })).toBe(false);
    });

    it("gt - should compare greater than", () => {
      expect(evaluate({ kind: "gt", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 3 } })).toBe(true);
      expect(evaluate({ kind: "gt", left: { kind: "lit", value: 3 }, right: { kind: "lit", value: 5 } })).toBe(false);
      expect(evaluate({ kind: "gt", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 5 } })).toBe(false);
    });

    it("gte - should compare greater than or equal", () => {
      expect(evaluate({ kind: "gte", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 3 } })).toBe(true);
      expect(evaluate({ kind: "gte", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 5 } })).toBe(true);
      expect(evaluate({ kind: "gte", left: { kind: "lit", value: 3 }, right: { kind: "lit", value: 5 } })).toBe(false);
    });

    it("lt - should compare less than", () => {
      expect(evaluate({ kind: "lt", left: { kind: "lit", value: 3 }, right: { kind: "lit", value: 5 } })).toBe(true);
      expect(evaluate({ kind: "lt", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 3 } })).toBe(false);
    });

    it("lte - should compare less than or equal", () => {
      expect(evaluate({ kind: "lte", left: { kind: "lit", value: 3 }, right: { kind: "lit", value: 5 } })).toBe(true);
      expect(evaluate({ kind: "lte", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 5 } })).toBe(true);
      expect(evaluate({ kind: "lte", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 3 } })).toBe(false);
    });
  });

  describe("Logical", () => {
    it("and - should perform logical AND", () => {
      expect(evaluate({ kind: "and", args: [{ kind: "lit", value: true }, { kind: "lit", value: true }] })).toBe(true);
      expect(evaluate({ kind: "and", args: [{ kind: "lit", value: true }, { kind: "lit", value: false }] })).toBe(false);
      expect(evaluate({ kind: "and", args: [{ kind: "lit", value: false }, { kind: "lit", value: true }] })).toBe(false);
      expect(evaluate({ kind: "and", args: [] })).toBe(true); // Empty AND is true
    });

    it("or - should perform logical OR", () => {
      expect(evaluate({ kind: "or", args: [{ kind: "lit", value: true }, { kind: "lit", value: false }] })).toBe(true);
      expect(evaluate({ kind: "or", args: [{ kind: "lit", value: false }, { kind: "lit", value: true }] })).toBe(true);
      expect(evaluate({ kind: "or", args: [{ kind: "lit", value: false }, { kind: "lit", value: false }] })).toBe(false);
      expect(evaluate({ kind: "or", args: [] })).toBe(false); // Empty OR is false
    });

    it("not - should perform logical NOT", () => {
      expect(evaluate({ kind: "not", arg: { kind: "lit", value: true } })).toBe(false);
      expect(evaluate({ kind: "not", arg: { kind: "lit", value: false } })).toBe(true);
      expect(evaluate({ kind: "not", arg: { kind: "lit", value: 0 } })).toBe(true);
      expect(evaluate({ kind: "not", arg: { kind: "lit", value: 1 } })).toBe(false);
    });

    it("and/or - should short-circuit", () => {
      // AND short-circuits on first false
      expect(evaluate({
        kind: "and",
        args: [{ kind: "lit", value: false }, { kind: "lit", value: true }]
      })).toBe(false);

      // OR short-circuits on first true
      expect(evaluate({
        kind: "or",
        args: [{ kind: "lit", value: true }, { kind: "lit", value: false }]
      })).toBe(true);
    });
  });

  describe("Conditional", () => {
    it("if - should evaluate then branch when condition is true", () => {
      expect(evaluate({
        kind: "if",
        cond: { kind: "lit", value: true },
        then: { kind: "lit", value: "yes" },
        else: { kind: "lit", value: "no" },
      })).toBe("yes");
    });

    it("if - should evaluate else branch when condition is false", () => {
      expect(evaluate({
        kind: "if",
        cond: { kind: "lit", value: false },
        then: { kind: "lit", value: "yes" },
        else: { kind: "lit", value: "no" },
      })).toBe("no");
    });

    it("if - should handle truthy/falsy values", () => {
      expect(evaluate({
        kind: "if",
        cond: { kind: "lit", value: 1 },
        then: { kind: "lit", value: "truthy" },
        else: { kind: "lit", value: "falsy" },
      })).toBe("truthy");

      expect(evaluate({
        kind: "if",
        cond: { kind: "lit", value: 0 },
        then: { kind: "lit", value: "truthy" },
        else: { kind: "lit", value: "falsy" },
      })).toBe("falsy");
    });
  });

  describe("Arithmetic", () => {
    it("add - should add numbers", () => {
      expect(evaluate({ kind: "add", left: { kind: "lit", value: 2 }, right: { kind: "lit", value: 3 } })).toBe(5);
      expect(evaluate({ kind: "add", left: { kind: "lit", value: -1 }, right: { kind: "lit", value: 1 } })).toBe(0);
    });

    it("sub - should subtract numbers", () => {
      expect(evaluate({ kind: "sub", left: { kind: "lit", value: 5 }, right: { kind: "lit", value: 3 } })).toBe(2);
      expect(evaluate({ kind: "sub", left: { kind: "lit", value: 3 }, right: { kind: "lit", value: 5 } })).toBe(-2);
    });

    it("mul - should multiply numbers", () => {
      expect(evaluate({ kind: "mul", left: { kind: "lit", value: 4 }, right: { kind: "lit", value: 3 } })).toBe(12);
      expect(evaluate({ kind: "mul", left: { kind: "lit", value: -2 }, right: { kind: "lit", value: 3 } })).toBe(-6);
    });

    it("div - should divide numbers", () => {
      expect(evaluate({ kind: "div", left: { kind: "lit", value: 10 }, right: { kind: "lit", value: 2 } })).toBe(5);
      expect(evaluate({ kind: "div", left: { kind: "lit", value: 7 }, right: { kind: "lit", value: 2 } })).toBe(3.5);
    });

    it("div - should return null for division by zero", () => {
      expect(evaluate({ kind: "div", left: { kind: "lit", value: 10 }, right: { kind: "lit", value: 0 } })).toBe(null);
    });

    it("mod - should compute modulo", () => {
      expect(evaluate({ kind: "mod", left: { kind: "lit", value: 10 }, right: { kind: "lit", value: 3 } })).toBe(1);
      expect(evaluate({ kind: "mod", left: { kind: "lit", value: 9 }, right: { kind: "lit", value: 3 } })).toBe(0);
    });

    it("mod - should return null for modulo by zero", () => {
      expect(evaluate({ kind: "mod", left: { kind: "lit", value: 10 }, right: { kind: "lit", value: 0 } })).toBe(null);
    });

    it("arithmetic - should coerce types", () => {
      expect(evaluate({ kind: "add", left: { kind: "lit", value: "5" }, right: { kind: "lit", value: 3 } })).toBe(8);
      expect(evaluate({ kind: "add", left: { kind: "lit", value: true }, right: { kind: "lit", value: 1 } })).toBe(2);
    });
  });

  describe("String", () => {
    it("concat - should concatenate strings", () => {
      expect(evaluate({
        kind: "concat",
        args: [{ kind: "lit", value: "hello" }, { kind: "lit", value: " " }, { kind: "lit", value: "world" }]
      })).toBe("hello world");
    });

    it("concat - should coerce non-strings", () => {
      expect(evaluate({
        kind: "concat",
        args: [{ kind: "lit", value: "value: " }, { kind: "lit", value: 42 }]
      })).toBe("value: 42");
    });

    it("substring - should extract substring", () => {
      expect(evaluate({
        kind: "substring",
        str: { kind: "lit", value: "hello world" },
        start: { kind: "lit", value: 0 },
        end: { kind: "lit", value: 5 },
      })).toBe("hello");
    });

    it("substring - should handle no end parameter", () => {
      expect(evaluate({
        kind: "substring",
        str: { kind: "lit", value: "hello world" },
        start: { kind: "lit", value: 6 },
      })).toBe("world");
    });
  });

  describe("Collection", () => {
    it("len - should return array length", () => {
      expect(evaluate({ kind: "len", arg: { kind: "lit", value: [1, 2, 3] } })).toBe(3);
      expect(evaluate({ kind: "len", arg: { kind: "lit", value: [] } })).toBe(0);
    });

    it("len - should return string length", () => {
      expect(evaluate({ kind: "len", arg: { kind: "lit", value: "hello" } })).toBe(5);
    });

    it("len - should return object key count", () => {
      expect(evaluate({ kind: "len", arg: { kind: "lit", value: { a: 1, b: 2 } } })).toBe(2);
    });

    it("at - should get array element by index", () => {
      expect(evaluate({
        kind: "at",
        array: { kind: "lit", value: [10, 20, 30] },
        index: { kind: "lit", value: 1 },
      })).toBe(20);
    });

    it("at - should return null for out of bounds", () => {
      expect(evaluate({
        kind: "at",
        array: { kind: "lit", value: [10, 20, 30] },
        index: { kind: "lit", value: 10 },
      })).toBe(null);
    });

    it("first - should get first element", () => {
      expect(evaluate({ kind: "first", array: { kind: "lit", value: [1, 2, 3] } })).toBe(1);
      expect(evaluate({ kind: "first", array: { kind: "lit", value: [] } })).toBe(null);
    });

    it("last - should get last element", () => {
      expect(evaluate({ kind: "last", array: { kind: "lit", value: [1, 2, 3] } })).toBe(3);
      expect(evaluate({ kind: "last", array: { kind: "lit", value: [] } })).toBe(null);
    });

    it("slice - should slice array", () => {
      expect(evaluate({
        kind: "slice",
        array: { kind: "lit", value: [1, 2, 3, 4, 5] },
        start: { kind: "lit", value: 1 },
        end: { kind: "lit", value: 4 },
      })).toEqual([2, 3, 4]);
    });

    it("slice - should handle no end parameter", () => {
      expect(evaluate({
        kind: "slice",
        array: { kind: "lit", value: [1, 2, 3, 4, 5] },
        start: { kind: "lit", value: 2 },
      })).toEqual([3, 4, 5]);
    });

    it("includes - should check if array includes item", () => {
      expect(evaluate({
        kind: "includes",
        array: { kind: "lit", value: [1, 2, 3] },
        item: { kind: "lit", value: 2 },
      })).toBe(true);
      expect(evaluate({
        kind: "includes",
        array: { kind: "lit", value: [1, 2, 3] },
        item: { kind: "lit", value: 5 },
      })).toBe(false);
    });

    it("filter - should filter array with predicate", () => {
      expect(evaluate({
        kind: "filter",
        array: { kind: "lit", value: [1, 2, 3, 4, 5] },
        predicate: { kind: "gt", left: { kind: "get", path: "$item" }, right: { kind: "lit", value: 2 } },
      })).toEqual([3, 4, 5]);
    });

    it("map - should map array with mapper", () => {
      expect(evaluate({
        kind: "map",
        array: { kind: "lit", value: [1, 2, 3] },
        mapper: { kind: "mul", left: { kind: "get", path: "$item" }, right: { kind: "lit", value: 2 } },
      })).toEqual([2, 4, 6]);
    });

    it("find - should find first matching element", () => {
      expect(evaluate({
        kind: "find",
        array: { kind: "lit", value: [1, 2, 3, 4, 5] },
        predicate: { kind: "gt", left: { kind: "get", path: "$item" }, right: { kind: "lit", value: 3 } },
      })).toBe(4);
    });

    it("find - should return null if not found", () => {
      expect(evaluate({
        kind: "find",
        array: { kind: "lit", value: [1, 2, 3] },
        predicate: { kind: "gt", left: { kind: "get", path: "$item" }, right: { kind: "lit", value: 10 } },
      })).toBe(null);
    });

    it("every - should check if all elements match", () => {
      expect(evaluate({
        kind: "every",
        array: { kind: "lit", value: [2, 4, 6] },
        predicate: { kind: "eq", left: { kind: "mod", left: { kind: "get", path: "$item" }, right: { kind: "lit", value: 2 } }, right: { kind: "lit", value: 0 } },
      })).toBe(true);
      expect(evaluate({
        kind: "every",
        array: { kind: "lit", value: [2, 3, 6] },
        predicate: { kind: "eq", left: { kind: "mod", left: { kind: "get", path: "$item" }, right: { kind: "lit", value: 2 } }, right: { kind: "lit", value: 0 } },
      })).toBe(false);
    });

    it("some - should check if any element matches", () => {
      expect(evaluate({
        kind: "some",
        array: { kind: "lit", value: [1, 2, 3] },
        predicate: { kind: "eq", left: { kind: "get", path: "$item" }, right: { kind: "lit", value: 2 } },
      })).toBe(true);
      expect(evaluate({
        kind: "some",
        array: { kind: "lit", value: [1, 2, 3] },
        predicate: { kind: "eq", left: { kind: "get", path: "$item" }, right: { kind: "lit", value: 5 } },
      })).toBe(false);
    });

    it("collection ops - should provide $index", () => {
      expect(evaluate({
        kind: "map",
        array: { kind: "lit", value: ["a", "b", "c"] },
        mapper: { kind: "get", path: "$index" },
      })).toEqual([0, 1, 2]);
    });
  });

  describe("Object", () => {
    it("keys - should return object keys", () => {
      expect(evaluate({ kind: "keys", obj: { kind: "lit", value: { a: 1, b: 2 } } })).toEqual(["a", "b"]);
    });

    it("values - should return object values", () => {
      expect(evaluate({ kind: "values", obj: { kind: "lit", value: { a: 1, b: 2 } } })).toEqual([1, 2]);
    });

    it("entries - should return object entries", () => {
      expect(evaluate({ kind: "entries", obj: { kind: "lit", value: { a: 1, b: 2 } } })).toEqual([["a", 1], ["b", 2]]);
    });

    it("merge - should merge objects", () => {
      expect(evaluate({
        kind: "merge",
        objects: [
          { kind: "lit", value: { a: 1, b: 2 } },
          { kind: "lit", value: { b: 3, c: 4 } },
        ],
      })).toEqual({ a: 1, b: 3, c: 4 });
    });

    it("object ops - should handle non-objects", () => {
      expect(evaluate({ kind: "keys", obj: { kind: "lit", value: null } })).toEqual([]);
      expect(evaluate({ kind: "values", obj: { kind: "lit", value: 42 } })).toEqual([]);
    });
  });

  describe("Type", () => {
    it("typeof - should return type name", () => {
      expect(evaluate({ kind: "typeof", arg: { kind: "lit", value: 42 } })).toBe("number");
      expect(evaluate({ kind: "typeof", arg: { kind: "lit", value: "hello" } })).toBe("string");
      expect(evaluate({ kind: "typeof", arg: { kind: "lit", value: true } })).toBe("boolean");
      expect(evaluate({ kind: "typeof", arg: { kind: "lit", value: null } })).toBe("null");
      expect(evaluate({ kind: "typeof", arg: { kind: "lit", value: [1, 2] } })).toBe("array");
      expect(evaluate({ kind: "typeof", arg: { kind: "lit", value: { a: 1 } } })).toBe("object");
    });

    it("isNull - should check for null/undefined", () => {
      expect(evaluate({ kind: "isNull", arg: { kind: "lit", value: null } })).toBe(true);
      expect(evaluate({ kind: "isNull", arg: { kind: "lit", value: undefined } })).toBe(true);
      expect(evaluate({ kind: "isNull", arg: { kind: "lit", value: 0 } })).toBe(false);
      expect(evaluate({ kind: "isNull", arg: { kind: "lit", value: "" } })).toBe(false);
    });

    it("coalesce - should return first non-null value", () => {
      expect(evaluate({
        kind: "coalesce",
        args: [{ kind: "lit", value: null }, { kind: "lit", value: undefined }, { kind: "lit", value: 42 }],
      })).toBe(42);
      expect(evaluate({
        kind: "coalesce",
        args: [{ kind: "lit", value: "first" }, { kind: "lit", value: "second" }],
      })).toBe("first");
      expect(evaluate({
        kind: "coalesce",
        args: [{ kind: "lit", value: null }, { kind: "lit", value: null }],
      })).toBe(null);
    });
  });

  describe("String Extended", () => {
    it("trim - should remove whitespace", () => {
      expect(evaluate({ kind: "trim", str: { kind: "lit", value: "  hello  " } })).toBe("hello");
      expect(evaluate({ kind: "trim", str: { kind: "lit", value: "\t\nhello\t\n" } })).toBe("hello");
      expect(evaluate({ kind: "trim", str: { kind: "lit", value: "hello" } })).toBe("hello");
    });

    it("trim - should coerce non-strings", () => {
      expect(evaluate({ kind: "trim", str: { kind: "lit", value: 42 } })).toBe("42");
      expect(evaluate({ kind: "trim", str: { kind: "lit", value: null } })).toBe("");
    });
  });

  describe("Nested Expressions", () => {
    it("should evaluate complex nested expressions", () => {
      // (2 + 3) * 4 = 20
      expect(evaluate({
        kind: "mul",
        left: {
          kind: "add",
          left: { kind: "lit", value: 2 },
          right: { kind: "lit", value: 3 },
        },
        right: { kind: "lit", value: 4 },
      })).toBe(20);
    });

    it("should evaluate complex conditional", () => {
      const ctx = createTestContext({ items: [1, 2, 3, 4, 5] });

      // if len(items) > 3 then first(items) else last(items)
      expect(evaluate({
        kind: "if",
        cond: {
          kind: "gt",
          left: { kind: "len", arg: { kind: "get", path: "items" } },
          right: { kind: "lit", value: 3 },
        },
        then: { kind: "first", array: { kind: "get", path: "items" } },
        else: { kind: "last", array: { kind: "get", path: "items" } },
      }, ctx)).toBe(1);
    });
  });
});
