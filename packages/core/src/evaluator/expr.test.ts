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

function createRecordingObject(
  entries: ReadonlyArray<readonly [string, unknown]>,
  accessLog: string[]
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get() {
        accessLog.push(key);
        return value;
      },
    });
  }
  return obj;
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

    it("and/or - should preserve observable left-to-right evaluation order", () => {
      const accesses: string[] = [];
      const ctx = createTestContext({
        flags: createRecordingObject(
          [
            ["left", false],
            ["right", true],
          ],
          accesses
        ),
      });

      expect(evaluate({
        kind: "and",
        args: [
          { kind: "get", path: "flags.left" },
          { kind: "get", path: "flags.right" },
        ],
      }, ctx)).toBe(false);
      expect(accesses).toEqual(["left"]);

      accesses.length = 0;

      expect(evaluate({
        kind: "or",
        args: [
          { kind: "get", path: "flags.right" },
          { kind: "get", path: "flags.left" },
        ],
      }, ctx)).toBe(true);
      expect(accesses).toEqual(["right"]);
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

    it("if - should evaluate only the selected branch", () => {
      const accesses: string[] = [];
      const ctx = createTestContext({
        branches: createRecordingObject(
          [
            ["then", "yes"],
            ["else", "no"],
          ],
          accesses
        ),
      });

      expect(evaluate({
        kind: "if",
        cond: { kind: "lit", value: true },
        then: { kind: "get", path: "branches.then" },
        else: { kind: "get", path: "branches.else" },
      }, ctx)).toBe("yes");
      expect(accesses).toEqual(["then"]);
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

    it("at - should lookup record by string key", () => {
      const record = { "item-1": { status: "open" }, "item-2": { status: "closed" } };
      expect(evaluate({
        kind: "at",
        array: { kind: "lit", value: record },
        index: { kind: "lit", value: "item-1" },
      })).toEqual({ status: "open" });
    });

    it("at - should return null for missing record key", () => {
      expect(evaluate({
        kind: "at",
        array: { kind: "lit", value: { a: 1 } },
        index: { kind: "lit", value: "missing" },
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

    it("object evaluation and traversal - should use Unicode code-point order", () => {
      const accesses: string[] = [];
      const ctx = createTestContext({
        source: createRecordingObject(
          [
            ["b", 1],
            ["ä", 2],
            ["a", 3],
          ],
          accesses
        ),
        obj: { "ä": 2, b: 1, a: 3 },
      });

      expect(evaluate({
        kind: "object",
        fields: {
          b: { kind: "get", path: "source.b" },
          ä: { kind: "get", path: "source.ä" },
          a: { kind: "get", path: "source.a" },
        },
      }, ctx)).toEqual({ a: 3, b: 1, ä: 2 });
      expect(accesses).toEqual(["a", "b", "ä"]);

      expect(evaluate({ kind: "keys", obj: { kind: "get", path: "obj" } }, ctx)).toEqual(["a", "b", "ä"]);
      expect(evaluate({ kind: "values", obj: { kind: "get", path: "obj" } }, ctx)).toEqual([3, 1, 2]);
      expect(evaluate({ kind: "entries", obj: { kind: "get", path: "obj" } }, ctx)).toEqual([
        ["a", 3],
        ["b", 1],
        ["ä", 2],
      ]);
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

    it("merge - should handle variadic (3+ objects)", () => {
      expect(evaluate({
        kind: "merge",
        objects: [
          { kind: "lit", value: { a: 1 } },
          { kind: "lit", value: { b: 2 } },
          { kind: "lit", value: { a: 3, c: 3 } },
        ],
      })).toEqual({ a: 3, b: 2, c: 3 });
    });

    it("merge - should skip non-object arguments", () => {
      expect(evaluate({
        kind: "merge",
        objects: [
          { kind: "lit", value: { a: 1 } },
          { kind: "lit", value: null },
          { kind: "lit", value: 42 },
          { kind: "lit", value: { b: 2 } },
        ],
      })).toEqual({ a: 1, b: 2 });
    });

    it("merge - should skip array arguments", () => {
      expect(evaluate({
        kind: "merge",
        objects: [
          { kind: "lit", value: { a: 1 } },
          { kind: "lit", value: [1, 2, 3] },
        ],
      })).toEqual({ a: 1 });
    });

    it("merge - should return empty object for no valid args", () => {
      expect(evaluate({
        kind: "merge",
        objects: [],
      })).toEqual({});

      expect(evaluate({
        kind: "merge",
        objects: [
          { kind: "lit", value: null },
          { kind: "lit", value: "string" },
        ],
      })).toEqual({});
    });

    it("object ops - should handle non-objects", () => {
      expect(evaluate({ kind: "keys", obj: { kind: "lit", value: null } })).toEqual([]);
      expect(evaluate({ kind: "values", obj: { kind: "lit", value: 42 } })).toEqual([]);
    });

    it("field - should access object property by static key", () => {
      expect(evaluate({
        kind: "field",
        object: { kind: "lit", value: { status: "open", priority: 1 } },
        property: "status",
      })).toBe("open");
    });

    it("field - should return null for missing property", () => {
      expect(evaluate({
        kind: "field",
        object: { kind: "lit", value: { status: "open" } },
        property: "missing",
      })).toBe(null);
    });

    it("field - should return null for non-object base", () => {
      expect(evaluate({
        kind: "field",
        object: { kind: "lit", value: null },
        property: "status",
      })).toBe(null);
      expect(evaluate({
        kind: "field",
        object: { kind: "lit", value: [1, 2, 3] },
        property: "status",
      })).toBe(null);
      expect(evaluate({
        kind: "field",
        object: { kind: "lit", value: 42 },
        property: "status",
      })).toBe(null);
    });

    it("field - should work on result of at() (Issue #135)", () => {
      // Simulates at(items, id).status where items is a record
      const items = { "item-1": { status: "open" }, "item-2": { status: "closed" } };
      expect(evaluate({
        kind: "field",
        object: {
          kind: "at",
          array: { kind: "lit", value: items },
          index: { kind: "lit", value: "item-1" },
        },
        property: "status",
      })).toBe("open");
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

  // ============================================================
  // SPEC v2.0.0 §7.2 — Missing Arithmetic Primitives
  // ============================================================

  describe("Arithmetic Extended (SPEC v2.0.0)", () => {
    // --- floor ---
    it("floor - should round down to nearest integer", () => {
      expect(evaluate({ kind: "floor", arg: { kind: "lit", value: 4.7 } })).toBe(4);
      expect(evaluate({ kind: "floor", arg: { kind: "lit", value: 4.2 } })).toBe(4);
      expect(evaluate({ kind: "floor", arg: { kind: "lit", value: 4.0 } })).toBe(4);
    });

    it("floor - should handle negative numbers", () => {
      expect(evaluate({ kind: "floor", arg: { kind: "lit", value: -2.3 } })).toBe(-3);
      expect(evaluate({ kind: "floor", arg: { kind: "lit", value: -2.0 } })).toBe(-2);
    });

    it("floor - should coerce non-number input", () => {
      expect(evaluate({ kind: "floor", arg: { kind: "lit", value: "3.7" } })).toBe(3);
      expect(evaluate({ kind: "floor", arg: { kind: "lit", value: true } })).toBe(1);
      expect(evaluate({ kind: "floor", arg: { kind: "lit", value: null } })).toBe(0);
    });

    // --- ceil ---
    it("ceil - should round up to nearest integer", () => {
      expect(evaluate({ kind: "ceil", arg: { kind: "lit", value: 4.2 } })).toBe(5);
      expect(evaluate({ kind: "ceil", arg: { kind: "lit", value: 4.7 } })).toBe(5);
      expect(evaluate({ kind: "ceil", arg: { kind: "lit", value: 4.0 } })).toBe(4);
    });

    it("ceil - should handle negative numbers", () => {
      expect(evaluate({ kind: "ceil", arg: { kind: "lit", value: -2.3 } })).toBe(-2);
      expect(evaluate({ kind: "ceil", arg: { kind: "lit", value: -2.0 } })).toBe(-2);
    });

    it("ceil - should coerce non-number input", () => {
      expect(evaluate({ kind: "ceil", arg: { kind: "lit", value: "3.2" } })).toBe(4);
      expect(evaluate({ kind: "ceil", arg: { kind: "lit", value: null } })).toBe(0);
    });

    // --- round ---
    it("round - should round to nearest integer", () => {
      expect(evaluate({ kind: "round", arg: { kind: "lit", value: 4.5 } })).toBe(5);
      expect(evaluate({ kind: "round", arg: { kind: "lit", value: 4.4 } })).toBe(4);
      expect(evaluate({ kind: "round", arg: { kind: "lit", value: 4.6 } })).toBe(5);
      expect(evaluate({ kind: "round", arg: { kind: "lit", value: -2.5 } })).toBe(-2); // Math.round(-2.5) = -2
    });

    it("round - should coerce non-number input", () => {
      expect(evaluate({ kind: "round", arg: { kind: "lit", value: "3.6" } })).toBe(4);
      expect(evaluate({ kind: "round", arg: { kind: "lit", value: null } })).toBe(0);
    });

    // --- sqrt ---
    it("sqrt - should compute square root", () => {
      expect(evaluate({ kind: "sqrt", arg: { kind: "lit", value: 9 } })).toBe(3);
      expect(evaluate({ kind: "sqrt", arg: { kind: "lit", value: 0 } })).toBe(0);
      expect(evaluate({ kind: "sqrt", arg: { kind: "lit", value: 2 } })).toBeCloseTo(1.4142135);
    });

    it("sqrt - should return null for negative numbers (totality: no NaN)", () => {
      expect(evaluate({ kind: "sqrt", arg: { kind: "lit", value: -1 } })).toBe(null);
      expect(evaluate({ kind: "sqrt", arg: { kind: "lit", value: -100 } })).toBe(null);
    });

    it("sqrt - should coerce non-number input", () => {
      expect(evaluate({ kind: "sqrt", arg: { kind: "lit", value: "16" } })).toBe(4);
      expect(evaluate({ kind: "sqrt", arg: { kind: "lit", value: null } })).toBe(0); // sqrt(0) = 0
    });

    // --- pow ---
    it("pow - should compute exponentiation", () => {
      expect(evaluate({
        kind: "pow",
        base: { kind: "lit", value: 2 },
        exponent: { kind: "lit", value: 10 },
      })).toBe(1024);
      expect(evaluate({
        kind: "pow",
        base: { kind: "lit", value: 3 },
        exponent: { kind: "lit", value: 0 },
      })).toBe(1);
      expect(evaluate({
        kind: "pow",
        base: { kind: "lit", value: 5 },
        exponent: { kind: "lit", value: 2 },
      })).toBe(25);
    });

    it("pow - should handle negative exponents", () => {
      expect(evaluate({
        kind: "pow",
        base: { kind: "lit", value: 2 },
        exponent: { kind: "lit", value: -1 },
      })).toBe(0.5);
    });

    it("pow - should return null for non-finite results (totality)", () => {
      // 0^(-1) = Infinity -> null
      expect(evaluate({
        kind: "pow",
        base: { kind: "lit", value: 0 },
        exponent: { kind: "lit", value: -1 },
      })).toBe(null);
    });

    it("pow - should coerce non-number inputs", () => {
      expect(evaluate({
        kind: "pow",
        base: { kind: "lit", value: "2" },
        exponent: { kind: "lit", value: "3" },
      })).toBe(8);
    });
  });

  // ============================================================
  // SPEC v2.0.0 §7.2 — Array Aggregation Primitives
  // ============================================================

  describe("Array Aggregation (SPEC v2.0.0)", () => {
    // --- sumArray ---
    it("sumArray - should sum numeric array", () => {
      expect(evaluate({ kind: "sumArray", array: { kind: "lit", value: [1, 2, 3, 4, 5] } })).toBe(15);
      expect(evaluate({ kind: "sumArray", array: { kind: "lit", value: [10, -5, 3] } })).toBe(8);
    });

    it("sumArray - should return 0 for empty array", () => {
      expect(evaluate({ kind: "sumArray", array: { kind: "lit", value: [] } })).toBe(0);
    });

    it("sumArray - should coerce non-numeric elements", () => {
      expect(evaluate({ kind: "sumArray", array: { kind: "lit", value: [1, "2", true] } })).toBe(4); // 1 + 2 + 1
    });

    it("sumArray - should return 0 for non-array input", () => {
      expect(evaluate({ kind: "sumArray", array: { kind: "lit", value: "not array" } })).toBe(0);
      expect(evaluate({ kind: "sumArray", array: { kind: "lit", value: null } })).toBe(0);
    });

    // --- minArray ---
    it("minArray - should find minimum in numeric array", () => {
      expect(evaluate({ kind: "minArray", array: { kind: "lit", value: [5, 1, 3, 2, 4] } })).toBe(1);
      expect(evaluate({ kind: "minArray", array: { kind: "lit", value: [-10, 0, 10] } })).toBe(-10);
    });

    it("minArray - should return null for empty array", () => {
      expect(evaluate({ kind: "minArray", array: { kind: "lit", value: [] } })).toBe(null);
    });

    it("minArray - should return null for non-array input", () => {
      expect(evaluate({ kind: "minArray", array: { kind: "lit", value: null } })).toBe(null);
    });

    // --- maxArray ---
    it("maxArray - should find maximum in numeric array", () => {
      expect(evaluate({ kind: "maxArray", array: { kind: "lit", value: [5, 1, 3, 2, 4] } })).toBe(5);
      expect(evaluate({ kind: "maxArray", array: { kind: "lit", value: [-10, 0, 10] } })).toBe(10);
    });

    it("maxArray - should return null for empty array", () => {
      expect(evaluate({ kind: "maxArray", array: { kind: "lit", value: [] } })).toBe(null);
    });

    it("maxArray - should return null for non-array input", () => {
      expect(evaluate({ kind: "maxArray", array: { kind: "lit", value: null } })).toBe(null);
    });
  });

  // ============================================================
  // SPEC v2.0.0 §7.2 — String Primitives
  // ============================================================

  describe("String Operations (SPEC v2.0.0)", () => {
    // --- toLowerCase ---
    it("toLowerCase - should convert string to lower case", () => {
      expect(evaluate({ kind: "toLowerCase", str: { kind: "lit", value: "HELLO WORLD" } })).toBe("hello world");
      expect(evaluate({ kind: "toLowerCase", str: { kind: "lit", value: "Hello" } })).toBe("hello");
      expect(evaluate({ kind: "toLowerCase", str: { kind: "lit", value: "already lower" } })).toBe("already lower");
    });

    it("toLowerCase - should coerce non-string input", () => {
      expect(evaluate({ kind: "toLowerCase", str: { kind: "lit", value: 42 } })).toBe("42");
      expect(evaluate({ kind: "toLowerCase", str: { kind: "lit", value: null } })).toBe("");
      expect(evaluate({ kind: "toLowerCase", str: { kind: "lit", value: true } })).toBe("true");
    });

    // --- toUpperCase ---
    it("toUpperCase - should convert string to upper case", () => {
      expect(evaluate({ kind: "toUpperCase", str: { kind: "lit", value: "hello world" } })).toBe("HELLO WORLD");
      expect(evaluate({ kind: "toUpperCase", str: { kind: "lit", value: "Hello" } })).toBe("HELLO");
      expect(evaluate({ kind: "toUpperCase", str: { kind: "lit", value: "ALREADY UPPER" } })).toBe("ALREADY UPPER");
    });

    it("toUpperCase - should coerce non-string input", () => {
      expect(evaluate({ kind: "toUpperCase", str: { kind: "lit", value: 42 } })).toBe("42");
      expect(evaluate({ kind: "toUpperCase", str: { kind: "lit", value: null } })).toBe("");
    });

    // --- strLen ---
    it("strLen - should return string length", () => {
      expect(evaluate({ kind: "strLen", str: { kind: "lit", value: "hello" } })).toBe(5);
      expect(evaluate({ kind: "strLen", str: { kind: "lit", value: "" } })).toBe(0);
      expect(evaluate({ kind: "strLen", str: { kind: "lit", value: "abc def" } })).toBe(7);
    });

    it("strLen - should coerce non-string input", () => {
      expect(evaluate({ kind: "strLen", str: { kind: "lit", value: 12345 } })).toBe(5); // "12345".length
      expect(evaluate({ kind: "strLen", str: { kind: "lit", value: null } })).toBe(0); // "".length
      expect(evaluate({ kind: "strLen", str: { kind: "lit", value: true } })).toBe(4); // "true".length
    });
  });

  // ============================================================
  // SPEC v2.0.0 §7.2 + v2.0.3 — Conversion Primitives
  // ============================================================

  describe("Conversion (SPEC v2.0.0 + v2.0.3)", () => {
    // --- toString (SPEC v2.0.0) ---
    it("toString - should convert values to string", () => {
      expect(evaluate({ kind: "toString", arg: { kind: "lit", value: 42 } })).toBe("42");
      expect(evaluate({ kind: "toString", arg: { kind: "lit", value: true } })).toBe("true");
      expect(evaluate({ kind: "toString", arg: { kind: "lit", value: false } })).toBe("false");
      expect(evaluate({ kind: "toString", arg: { kind: "lit", value: "hello" } })).toBe("hello");
    });

    it("toString - should handle null/undefined", () => {
      expect(evaluate({ kind: "toString", arg: { kind: "lit", value: null } })).toBe("");
      expect(evaluate({ kind: "toString", arg: { kind: "lit", value: undefined } })).toBe("");
    });

    // --- toNumber (SPEC v2.0.3) ---
    it("toNumber - should convert numeric string to number", () => {
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: "42" } })).toBe(42);
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: "3.14" } })).toBe(3.14);
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: "-10" } })).toBe(-10);
    });

    it("toNumber - should return identity for numbers", () => {
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: 42 } })).toBe(42);
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: 0 } })).toBe(0);
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: -3.5 } })).toBe(-3.5);
    });

    it("toNumber - should convert booleans: true=1, false=0", () => {
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: true } })).toBe(1);
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: false } })).toBe(0);
    });

    it("toNumber - should return 0 for null/undefined", () => {
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: null } })).toBe(0);
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: undefined } })).toBe(0);
    });

    it("toNumber - MUST return 0 for non-numeric strings (never NaN)", () => {
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: "hello" } })).toBe(0);
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: "" } })).toBe(0);
    });

    it("toNumber - should return 0 for objects/arrays", () => {
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: { a: 1 } } })).toBe(0);
      expect(evaluate({ kind: "toNumber", arg: { kind: "lit", value: [1, 2] } })).toBe(0);
    });

    // --- toBoolean (SPEC v2.0.3) ---
    it("toBoolean - should return identity for booleans", () => {
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: true } })).toBe(true);
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: false } })).toBe(false);
    });

    it("toBoolean - should convert null/undefined to false", () => {
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: null } })).toBe(false);
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: undefined } })).toBe(false);
    });

    it("toBoolean - should convert numbers: 0=false, all others=true", () => {
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: 0 } })).toBe(false);
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: 1 } })).toBe(true);
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: -1 } })).toBe(true);
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: 42 } })).toBe(true);
    });

    it("toBoolean - should convert strings: empty=false, non-empty=true", () => {
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: "" } })).toBe(false);
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: "hello" } })).toBe(true);
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: "false" } })).toBe(true); // non-empty = true
    });

    it("toBoolean - should convert objects/arrays to true (always truthy)", () => {
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: {} } })).toBe(true);
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: [] } })).toBe(true);
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: { a: 1 } } })).toBe(true);
      expect(evaluate({ kind: "toBoolean", arg: { kind: "lit", value: [1, 2] } })).toBe(true);
    });
  });

  // ============================================================
  // SPEC v2.0.3 §1.1 — String Extensions
  // ============================================================

  describe("String Extensions (SPEC v2.0.3)", () => {
    // --- startsWith ---
    it("startsWith - should check if string starts with prefix", () => {
      expect(evaluate({
        kind: "startsWith",
        str: { kind: "lit", value: "hello world" },
        prefix: { kind: "lit", value: "hello" },
      })).toBe(true);
      expect(evaluate({
        kind: "startsWith",
        str: { kind: "lit", value: "hello world" },
        prefix: { kind: "lit", value: "world" },
      })).toBe(false);
    });

    it("startsWith - should handle empty prefix (always true)", () => {
      expect(evaluate({
        kind: "startsWith",
        str: { kind: "lit", value: "hello" },
        prefix: { kind: "lit", value: "" },
      })).toBe(true);
    });

    it("startsWith - should coerce non-string inputs", () => {
      expect(evaluate({
        kind: "startsWith",
        str: { kind: "lit", value: 12345 },
        prefix: { kind: "lit", value: "123" },
      })).toBe(true);
      expect(evaluate({
        kind: "startsWith",
        str: { kind: "lit", value: null },
        prefix: { kind: "lit", value: "" },
      })).toBe(true); // "" starts with ""
    });

    // --- endsWith ---
    it("endsWith - should check if string ends with suffix", () => {
      expect(evaluate({
        kind: "endsWith",
        str: { kind: "lit", value: "hello world" },
        suffix: { kind: "lit", value: "world" },
      })).toBe(true);
      expect(evaluate({
        kind: "endsWith",
        str: { kind: "lit", value: "hello world" },
        suffix: { kind: "lit", value: "hello" },
      })).toBe(false);
    });

    it("endsWith - should handle empty suffix (always true)", () => {
      expect(evaluate({
        kind: "endsWith",
        str: { kind: "lit", value: "hello" },
        suffix: { kind: "lit", value: "" },
      })).toBe(true);
    });

    it("endsWith - should coerce non-string inputs", () => {
      expect(evaluate({
        kind: "endsWith",
        str: { kind: "lit", value: 12345 },
        suffix: { kind: "lit", value: "45" },
      })).toBe(true);
    });

    // --- strIncludes ---
    it("strIncludes - should check if string contains search", () => {
      expect(evaluate({
        kind: "strIncludes",
        str: { kind: "lit", value: "hello world" },
        search: { kind: "lit", value: "lo wo" },
      })).toBe(true);
      expect(evaluate({
        kind: "strIncludes",
        str: { kind: "lit", value: "hello world" },
        search: { kind: "lit", value: "xyz" },
      })).toBe(false);
    });

    it("strIncludes - should handle empty search (always true)", () => {
      expect(evaluate({
        kind: "strIncludes",
        str: { kind: "lit", value: "hello" },
        search: { kind: "lit", value: "" },
      })).toBe(true);
    });

    it("strIncludes - should coerce non-string inputs", () => {
      expect(evaluate({
        kind: "strIncludes",
        str: { kind: "lit", value: null },
        search: { kind: "lit", value: "" },
      })).toBe(true); // "" includes ""
    });

    // --- indexOf ---
    it("indexOf - should return index of search string", () => {
      expect(evaluate({
        kind: "indexOf",
        str: { kind: "lit", value: "hello world" },
        search: { kind: "lit", value: "world" },
      })).toBe(6);
      expect(evaluate({
        kind: "indexOf",
        str: { kind: "lit", value: "hello world" },
        search: { kind: "lit", value: "hello" },
      })).toBe(0);
    });

    it("indexOf - MUST return -1 when search not found", () => {
      expect(evaluate({
        kind: "indexOf",
        str: { kind: "lit", value: "hello world" },
        search: { kind: "lit", value: "xyz" },
      })).toBe(-1);
    });

    it("indexOf - should find first occurrence", () => {
      expect(evaluate({
        kind: "indexOf",
        str: { kind: "lit", value: "abcabc" },
        search: { kind: "lit", value: "bc" },
      })).toBe(1); // First occurrence at index 1
    });

    it("indexOf - should coerce non-string inputs", () => {
      expect(evaluate({
        kind: "indexOf",
        str: { kind: "lit", value: 12345 },
        search: { kind: "lit", value: "34" },
      })).toBe(2);
    });

    // --- replace ---
    it("replace - MUST replace only first occurrence", () => {
      expect(evaluate({
        kind: "replace",
        str: { kind: "lit", value: "aaa bbb aaa" },
        search: { kind: "lit", value: "aaa" },
        replacement: { kind: "lit", value: "ccc" },
      })).toBe("ccc bbb aaa"); // Only first "aaa" replaced
    });

    it("replace - should return original string if no match", () => {
      expect(evaluate({
        kind: "replace",
        str: { kind: "lit", value: "hello world" },
        search: { kind: "lit", value: "xyz" },
        replacement: { kind: "lit", value: "replaced" },
      })).toBe("hello world");
    });

    it("replace - should handle empty search (prepend replacement)", () => {
      expect(evaluate({
        kind: "replace",
        str: { kind: "lit", value: "hello" },
        search: { kind: "lit", value: "" },
        replacement: { kind: "lit", value: "X" },
      })).toBe("Xhello"); // JS behavior: "hello".replace("", "X") = "Xhello"
    });

    it("replace - should coerce non-string inputs", () => {
      expect(evaluate({
        kind: "replace",
        str: { kind: "lit", value: 12345 },
        search: { kind: "lit", value: "23" },
        replacement: { kind: "lit", value: "XX" },
      })).toBe("1XX45");
    });

    // --- split ---
    it("split - should split string by delimiter", () => {
      expect(evaluate({
        kind: "split",
        str: { kind: "lit", value: "a,b,c" },
        delimiter: { kind: "lit", value: "," },
      })).toEqual(["a", "b", "c"]);
    });

    it("split - MUST always return at least one element", () => {
      // When no delimiter found, returns array with original string
      expect(evaluate({
        kind: "split",
        str: { kind: "lit", value: "hello" },
        delimiter: { kind: "lit", value: "," },
      })).toEqual(["hello"]);
    });

    it("split - should split by empty string into characters", () => {
      expect(evaluate({
        kind: "split",
        str: { kind: "lit", value: "abc" },
        delimiter: { kind: "lit", value: "" },
      })).toEqual(["a", "b", "c"]);
    });

    it("split - should handle empty string input", () => {
      expect(evaluate({
        kind: "split",
        str: { kind: "lit", value: "" },
        delimiter: { kind: "lit", value: "," },
      })).toEqual([""]);
    });

    it("split - should coerce non-string inputs", () => {
      expect(evaluate({
        kind: "split",
        str: { kind: "lit", value: null },
        delimiter: { kind: "lit", value: "," },
      })).toEqual([""]); // toString(null) = ""
    });

    it("split - should return non-empty array for empty string with empty delimiter", () => {
      // JS returns [] for "".split(""), but SPEC requires at least one element
      expect(evaluate({
        kind: "split",
        str: { kind: "lit", value: "" },
        delimiter: { kind: "lit", value: "" },
      })).toEqual([""]);
    });
  });

  // ============================================================
  // SPEC v2.0.3 §1.2 — Collection Extensions
  // ============================================================

  describe("Collection Extensions (SPEC v2.0.3)", () => {
    // --- reverse ---
    it("reverse - should reverse array element order", () => {
      expect(evaluate({ kind: "reverse", array: { kind: "lit", value: [1, 2, 3] } })).toEqual([3, 2, 1]);
      expect(evaluate({ kind: "reverse", array: { kind: "lit", value: ["a", "b", "c"] } })).toEqual(["c", "b", "a"]);
    });

    it("reverse - should handle empty array", () => {
      expect(evaluate({ kind: "reverse", array: { kind: "lit", value: [] } })).toEqual([]);
    });

    it("reverse - should handle single-element array", () => {
      expect(evaluate({ kind: "reverse", array: { kind: "lit", value: [42] } })).toEqual([42]);
    });

    it("reverse - should return [] for non-array input", () => {
      expect(evaluate({ kind: "reverse", array: { kind: "lit", value: null } })).toEqual([]);
      expect(evaluate({ kind: "reverse", array: { kind: "lit", value: "not array" } })).toEqual([]);
      expect(evaluate({ kind: "reverse", array: { kind: "lit", value: 42 } })).toEqual([]);
    });

    // --- unique ---
    it("unique - should remove duplicates keeping first occurrence", () => {
      expect(evaluate({ kind: "unique", array: { kind: "lit", value: [1, 2, 1, 3, 2] } })).toEqual([1, 2, 3]);
    });

    it("unique - MUST preserve first-occurrence order", () => {
      expect(evaluate({ kind: "unique", array: { kind: "lit", value: [3, 1, 2, 1, 3] } })).toEqual([3, 1, 2]);
    });

    it("unique - MUST use strict equality (===)", () => {
      // 1 !== "1" in strict equality
      expect(evaluate({ kind: "unique", array: { kind: "lit", value: [1, "1", 1, "1"] } })).toEqual([1, "1"]);
      // null !== undefined
      expect(evaluate({ kind: "unique", array: { kind: "lit", value: [null, undefined, null] } })).toEqual([null, undefined]);
    });

    it("unique - should handle empty array", () => {
      expect(evaluate({ kind: "unique", array: { kind: "lit", value: [] } })).toEqual([]);
    });

    it("unique - should handle array with no duplicates", () => {
      expect(evaluate({ kind: "unique", array: { kind: "lit", value: [1, 2, 3] } })).toEqual([1, 2, 3]);
    });

    it("unique - should return [] for non-array input", () => {
      expect(evaluate({ kind: "unique", array: { kind: "lit", value: null } })).toEqual([]);
      expect(evaluate({ kind: "unique", array: { kind: "lit", value: "string" } })).toEqual([]);
    });

    // --- flat ---
    it("flat - MUST flatten exactly one level", () => {
      expect(evaluate({ kind: "flat", array: { kind: "lit", value: [[1, 2], [3, 4]] } })).toEqual([1, 2, 3, 4]);
      expect(evaluate({ kind: "flat", array: { kind: "lit", value: [[1, 2], [3], [4, 5, 6]] } })).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("flat - should NOT flatten deeper than one level", () => {
      // [[1, [2]], [3]] -> [1, [2], 3] (only one level flattened)
      expect(evaluate({ kind: "flat", array: { kind: "lit", value: [[1, [2]], [3]] } })).toEqual([1, [2], 3]);
    });

    it("flat - should handle mixed nested and non-nested elements", () => {
      expect(evaluate({ kind: "flat", array: { kind: "lit", value: [1, [2, 3], 4] } })).toEqual([1, 2, 3, 4]);
    });

    it("flat - should handle empty array", () => {
      expect(evaluate({ kind: "flat", array: { kind: "lit", value: [] } })).toEqual([]);
    });

    it("flat - should handle array of empty arrays", () => {
      expect(evaluate({ kind: "flat", array: { kind: "lit", value: [[], [], []] } })).toEqual([]);
    });

    it("flat - should return [] for non-array input", () => {
      expect(evaluate({ kind: "flat", array: { kind: "lit", value: null } })).toEqual([]);
      expect(evaluate({ kind: "flat", array: { kind: "lit", value: 42 } })).toEqual([]);
    });
  });

  // ============================================================
  // SPEC v2.0.3 §1.3 — Object Extensions
  // ============================================================

  describe("Object Extensions (SPEC v2.0.3)", () => {
    // --- hasKey ---
    it("hasKey - should check if key exists in object", () => {
      expect(evaluate({
        kind: "hasKey",
        obj: { kind: "lit", value: { a: 1, b: 2 } },
        key: { kind: "lit", value: "a" },
      })).toBe(true);
      expect(evaluate({
        kind: "hasKey",
        obj: { kind: "lit", value: { a: 1, b: 2 } },
        key: { kind: "lit", value: "c" },
      })).toBe(false);
    });

    it("hasKey - should detect keys with null/undefined values", () => {
      expect(evaluate({
        kind: "hasKey",
        obj: { kind: "lit", value: { a: null, b: undefined } },
        key: { kind: "lit", value: "a" },
      })).toBe(true);
    });

    it("hasKey - should return false for non-object", () => {
      expect(evaluate({
        kind: "hasKey",
        obj: { kind: "lit", value: null },
        key: { kind: "lit", value: "a" },
      })).toBe(false);
      expect(evaluate({
        kind: "hasKey",
        obj: { kind: "lit", value: [1, 2, 3] },
        key: { kind: "lit", value: "0" },
      })).toBe(false);
      expect(evaluate({
        kind: "hasKey",
        obj: { kind: "lit", value: 42 },
        key: { kind: "lit", value: "a" },
      })).toBe(false);
    });

    // --- pick ---
    it("pick - should select only listed keys", () => {
      expect(evaluate({
        kind: "pick",
        obj: { kind: "lit", value: { a: 1, b: 2, c: 3 } },
        keys: { kind: "lit", value: ["a", "c"] },
      })).toEqual({ a: 1, c: 3 });
    });

    it("pick - should skip keys that do not exist", () => {
      expect(evaluate({
        kind: "pick",
        obj: { kind: "lit", value: { a: 1, b: 2 } },
        keys: { kind: "lit", value: ["a", "x", "y"] },
      })).toEqual({ a: 1 });
    });

    it("pick - MUST ignore non-string keys in keys array", () => {
      expect(evaluate({
        kind: "pick",
        obj: { kind: "lit", value: { a: 1, b: 2 } },
        keys: { kind: "lit", value: ["a", 42, null, "b"] },
      })).toEqual({ a: 1, b: 2 });
    });

    it("pick - should return {} for non-object", () => {
      expect(evaluate({
        kind: "pick",
        obj: { kind: "lit", value: null },
        keys: { kind: "lit", value: ["a"] },
      })).toEqual({});
    });

    it("pick - should treat non-array keys as empty array", () => {
      expect(evaluate({
        kind: "pick",
        obj: { kind: "lit", value: { a: 1, b: 2 } },
        keys: { kind: "lit", value: "not-array" },
      })).toEqual({});
    });

    // --- omit ---
    it("omit - should exclude listed keys", () => {
      expect(evaluate({
        kind: "omit",
        obj: { kind: "lit", value: { a: 1, b: 2, c: 3 } },
        keys: { kind: "lit", value: ["b"] },
      })).toEqual({ a: 1, c: 3 });
    });

    it("omit - should handle keys that do not exist", () => {
      expect(evaluate({
        kind: "omit",
        obj: { kind: "lit", value: { a: 1, b: 2 } },
        keys: { kind: "lit", value: ["x", "y"] },
      })).toEqual({ a: 1, b: 2 });
    });

    it("omit - MUST ignore non-string keys in keys array", () => {
      expect(evaluate({
        kind: "omit",
        obj: { kind: "lit", value: { a: 1, b: 2, c: 3 } },
        keys: { kind: "lit", value: ["b", 42, null] },
      })).toEqual({ a: 1, c: 3 });
    });

    it("omit - should return {} for non-object", () => {
      expect(evaluate({
        kind: "omit",
        obj: { kind: "lit", value: null },
        keys: { kind: "lit", value: ["a"] },
      })).toEqual({});
    });

    it("omit - should treat non-array keys as empty array (return all keys)", () => {
      expect(evaluate({
        kind: "omit",
        obj: { kind: "lit", value: { a: 1, b: 2 } },
        keys: { kind: "lit", value: "not-array" },
      })).toEqual({ a: 1, b: 2 });
    });

    // --- fromEntries ---
    it("fromEntries - should convert entries array to object", () => {
      expect(evaluate({
        kind: "fromEntries",
        entries: { kind: "lit", value: [["a", 1], ["b", 2], ["c", 3]] },
      })).toEqual({ a: 1, b: 2, c: 3 });
    });

    it("fromEntries - MUST skip entries that are not 2-element arrays", () => {
      expect(evaluate({
        kind: "fromEntries",
        entries: { kind: "lit", value: [["a", 1], "invalid", [42], ["b", 2]] },
      })).toEqual({ a: 1, b: 2 });
    });

    it("fromEntries - should handle empty array", () => {
      expect(evaluate({
        kind: "fromEntries",
        entries: { kind: "lit", value: [] },
      })).toEqual({});
    });

    it("fromEntries - should return {} for non-array input", () => {
      expect(evaluate({
        kind: "fromEntries",
        entries: { kind: "lit", value: null },
      })).toEqual({});
      expect(evaluate({
        kind: "fromEntries",
        entries: { kind: "lit", value: "not array" },
      })).toEqual({});
    });

    it("fromEntries - last entry wins for duplicate keys", () => {
      expect(evaluate({
        kind: "fromEntries",
        entries: { kind: "lit", value: [["a", 1], ["a", 2]] },
      })).toEqual({ a: 2 });
    });
  });

  // ============================================================
  // Determinism Compliance (§7.5 Requirements)
  // ============================================================

  describe("Determinism Compliance", () => {
    it("replace - determinism: same input produces same output", () => {
      const expr: ExprNode = {
        kind: "replace",
        str: { kind: "lit", value: "aaa bbb aaa" },
        search: { kind: "lit", value: "aaa" },
        replacement: { kind: "lit", value: "ccc" },
      };
      const result1 = evaluate(expr);
      const result2 = evaluate(expr);
      expect(result1).toBe(result2);
    });

    it("unique - determinism: same input produces same output with same order", () => {
      const expr: ExprNode = {
        kind: "unique",
        array: { kind: "lit", value: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5] },
      };
      const result1 = evaluate(expr);
      const result2 = evaluate(expr);
      expect(result1).toEqual(result2);
      expect(result1).toEqual([3, 1, 4, 5, 9, 2, 6]);
    });

    it("all new kinds - totality: always return a value, never throw", () => {
      // All new kinds must be total - test with null/undefined/wrong-type inputs
      const totalityTests: ExprNode[] = [
        { kind: "floor", arg: { kind: "lit", value: null } },
        { kind: "ceil", arg: { kind: "lit", value: undefined } },
        { kind: "round", arg: { kind: "lit", value: "not a number" } },
        { kind: "sqrt", arg: { kind: "lit", value: null } },
        { kind: "sumArray", array: { kind: "lit", value: null } },
        { kind: "minArray", array: { kind: "lit", value: null } },
        { kind: "maxArray", array: { kind: "lit", value: null } },
        { kind: "toLowerCase", str: { kind: "lit", value: null } },
        { kind: "toUpperCase", str: { kind: "lit", value: null } },
        { kind: "strLen", str: { kind: "lit", value: null } },
        { kind: "toString", arg: { kind: "lit", value: null } },
        { kind: "toNumber", arg: { kind: "lit", value: null } },
        { kind: "toBoolean", arg: { kind: "lit", value: null } },
        { kind: "startsWith", str: { kind: "lit", value: null }, prefix: { kind: "lit", value: null } },
        { kind: "endsWith", str: { kind: "lit", value: null }, suffix: { kind: "lit", value: null } },
        { kind: "strIncludes", str: { kind: "lit", value: null }, search: { kind: "lit", value: null } },
        { kind: "indexOf", str: { kind: "lit", value: null }, search: { kind: "lit", value: null } },
        { kind: "replace", str: { kind: "lit", value: null }, search: { kind: "lit", value: null }, replacement: { kind: "lit", value: null } },
        { kind: "split", str: { kind: "lit", value: null }, delimiter: { kind: "lit", value: null } },
        { kind: "reverse", array: { kind: "lit", value: null } },
        { kind: "unique", array: { kind: "lit", value: null } },
        { kind: "flat", array: { kind: "lit", value: null } },
        { kind: "hasKey", obj: { kind: "lit", value: null }, key: { kind: "lit", value: "a" } },
        { kind: "pick", obj: { kind: "lit", value: null }, keys: { kind: "lit", value: ["a"] } },
        { kind: "omit", obj: { kind: "lit", value: null }, keys: { kind: "lit", value: ["a"] } },
        { kind: "fromEntries", entries: { kind: "lit", value: null } },
        { kind: "pow", base: { kind: "lit", value: null }, exponent: { kind: "lit", value: null } },
      ];

      for (const expr of totalityTests) {
        // Should not throw — all expressions must be total
        expect(() => evaluate(expr)).not.toThrow();
      }
    });
  });
});
