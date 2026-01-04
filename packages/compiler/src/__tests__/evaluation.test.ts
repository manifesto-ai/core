/**
 * Evaluation Tests
 *
 * Tests for Core IR expression and patch evaluation.
 *
 * @see SPEC v0.4.0 §18
 */

import { describe, it, expect } from "vitest";
import type { ExprNode } from "@manifesto-ai/core";
import {
  evaluateExpr,
  evaluateConditionalPatchOps,
  evaluateCondition,
  createEvaluationContext,
  type EvaluationContext,
} from "../evaluation/index.js";
import type { ConditionalPatchOp } from "../lowering/index.js";

// Test helpers
function createTestContext(
  overrides: Partial<EvaluationContext> = {}
): EvaluationContext {
  return createEvaluationContext({
    meta: { intentId: "test-intent-123" },
    snapshot: {
      data: { count: 10, name: "Alice", items: [1, 2, 3] },
      computed: { total: 100 },
    },
    input: { title: "Hello", value: 42 },
    ...overrides,
  });
}

describe("evaluateExpr", () => {
  describe("lit", () => {
    it("should return literal values", () => {
      const ctx = createTestContext();
      expect(evaluateExpr({ kind: "lit", value: 42 }, ctx)).toBe(42);
      expect(evaluateExpr({ kind: "lit", value: "hello" }, ctx)).toBe("hello");
      expect(evaluateExpr({ kind: "lit", value: null }, ctx)).toBe(null);
      expect(evaluateExpr({ kind: "lit", value: true }, ctx)).toBe(true);
    });
  });

  describe("get (path resolution)", () => {
    it("should resolve data paths", () => {
      const ctx = createTestContext();
      expect(evaluateExpr({ kind: "get", path: "count" }, ctx)).toBe(10);
      expect(evaluateExpr({ kind: "get", path: "name" }, ctx)).toBe("Alice");
    });

    it("should resolve meta paths", () => {
      const ctx = createTestContext();
      expect(evaluateExpr({ kind: "get", path: "meta.intentId" }, ctx)).toBe(
        "test-intent-123"
      );
    });

    it("should resolve input paths", () => {
      const ctx = createTestContext();
      expect(evaluateExpr({ kind: "get", path: "input.title" }, ctx)).toBe(
        "Hello"
      );
      expect(evaluateExpr({ kind: "get", path: "input.value" }, ctx)).toBe(42);
    });

    it("should resolve computed paths", () => {
      const ctx = createTestContext();
      expect(evaluateExpr({ kind: "get", path: "computed.total" }, ctx)).toBe(
        100
      );
    });

    it("should resolve $item paths", () => {
      const ctx = createTestContext({ item: { id: "item-1", val: 99 } });
      expect(evaluateExpr({ kind: "get", path: "$item" }, ctx)).toEqual({
        id: "item-1",
        val: 99,
      });
      expect(evaluateExpr({ kind: "get", path: "$item.id" }, ctx)).toBe(
        "item-1"
      );
    });

    it("should return null for missing paths", () => {
      const ctx = createTestContext();
      expect(evaluateExpr({ kind: "get", path: "nonexistent" }, ctx)).toBe(
        null
      );
      expect(evaluateExpr({ kind: "get", path: "meta.missing" }, ctx)).toBe(
        null
      );
    });
  });

  describe("comparison operators", () => {
    it("should evaluate eq", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "eq",
            left: { kind: "get", path: "count" },
            right: { kind: "lit", value: 10 },
          },
          ctx
        )
      ).toBe(true);
      expect(
        evaluateExpr(
          {
            kind: "eq",
            left: { kind: "lit", value: 5 },
            right: { kind: "lit", value: 5 },
          },
          ctx
        )
      ).toBe(true);
    });

    it("should evaluate neq", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "neq",
            left: { kind: "lit", value: 5 },
            right: { kind: "lit", value: 10 },
          },
          ctx
        )
      ).toBe(true);
    });

    it("should evaluate gt/gte/lt/lte", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "gt",
            left: { kind: "lit", value: 10 },
            right: { kind: "lit", value: 5 },
          },
          ctx
        )
      ).toBe(true);
      expect(
        evaluateExpr(
          {
            kind: "gte",
            left: { kind: "lit", value: 10 },
            right: { kind: "lit", value: 10 },
          },
          ctx
        )
      ).toBe(true);
      expect(
        evaluateExpr(
          {
            kind: "lt",
            left: { kind: "lit", value: 5 },
            right: { kind: "lit", value: 10 },
          },
          ctx
        )
      ).toBe(true);
      expect(
        evaluateExpr(
          {
            kind: "lte",
            left: { kind: "lit", value: 10 },
            right: { kind: "lit", value: 10 },
          },
          ctx
        )
      ).toBe(true);
    });

    it("should return null for non-numeric comparisons", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "gt",
            left: { kind: "lit", value: "a" },
            right: { kind: "lit", value: 5 },
          },
          ctx
        )
      ).toBe(null);
    });
  });

  describe("logical operators", () => {
    it("should evaluate and", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "and",
            args: [
              { kind: "lit", value: true },
              { kind: "lit", value: true },
            ],
          },
          ctx
        )
      ).toBe(true);
      expect(
        evaluateExpr(
          {
            kind: "and",
            args: [
              { kind: "lit", value: true },
              { kind: "lit", value: false },
            ],
          },
          ctx
        )
      ).toBe(false);
    });

    it("should evaluate or", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "or",
            args: [
              { kind: "lit", value: false },
              { kind: "lit", value: true },
            ],
          },
          ctx
        )
      ).toBe(true);
      expect(
        evaluateExpr(
          {
            kind: "or",
            args: [
              { kind: "lit", value: false },
              { kind: "lit", value: false },
            ],
          },
          ctx
        )
      ).toBe(false);
    });

    it("should evaluate not", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr({ kind: "not", arg: { kind: "lit", value: true } }, ctx)
      ).toBe(false);
      expect(
        evaluateExpr({ kind: "not", arg: { kind: "lit", value: false } }, ctx)
      ).toBe(true);
    });

    it("should return null for non-boolean operands", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr({ kind: "not", arg: { kind: "lit", value: "true" } }, ctx)
      ).toBe(null);
    });
  });

  describe("arithmetic operators", () => {
    it("should evaluate add/sub/mul", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "add",
            left: { kind: "lit", value: 5 },
            right: { kind: "lit", value: 3 },
          },
          ctx
        )
      ).toBe(8);
      expect(
        evaluateExpr(
          {
            kind: "sub",
            left: { kind: "lit", value: 10 },
            right: { kind: "lit", value: 4 },
          },
          ctx
        )
      ).toBe(6);
      expect(
        evaluateExpr(
          {
            kind: "mul",
            left: { kind: "lit", value: 6 },
            right: { kind: "lit", value: 7 },
          },
          ctx
        )
      ).toBe(42);
    });

    it("should return null for division by zero", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "div",
            left: { kind: "lit", value: 10 },
            right: { kind: "lit", value: 0 },
          },
          ctx
        )
      ).toBe(null);
    });

    it("should return null for non-numeric operands", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "add",
            left: { kind: "lit", value: "5" },
            right: { kind: "lit", value: 3 },
          },
          ctx
        )
      ).toBe(null);
    });
  });

  describe("string operators", () => {
    it("should evaluate concat", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "concat",
            args: [
              { kind: "lit", value: "Hello" },
              { kind: "lit", value: " " },
              { kind: "lit", value: "World" },
            ],
          },
          ctx
        )
      ).toBe("Hello World");
    });

    it("should evaluate trim", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          { kind: "trim", str: { kind: "lit", value: "  hello  " } },
          ctx
        )
      ).toBe("hello");
    });
  });

  describe("collection operators", () => {
    it("should evaluate len", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr({ kind: "len", arg: { kind: "get", path: "items" } }, ctx)
      ).toBe(3);
      expect(
        evaluateExpr(
          { kind: "len", arg: { kind: "lit", value: "hello" } },
          ctx
        )
      ).toBe(5);
    });

    it("should evaluate at", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "at",
            array: { kind: "get", path: "items" },
            index: { kind: "lit", value: 1 },
          },
          ctx
        )
      ).toBe(2);
    });

    it("should return null for out-of-bounds at", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "at",
            array: { kind: "get", path: "items" },
            index: { kind: "lit", value: 10 },
          },
          ctx
        )
      ).toBe(null);
    });

    it("should evaluate first/last", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          { kind: "first", array: { kind: "get", path: "items" } },
          ctx
        )
      ).toBe(1);
      expect(
        evaluateExpr(
          { kind: "last", array: { kind: "get", path: "items" } },
          ctx
        )
      ).toBe(3);
    });

    it("should evaluate filter", () => {
      const ctx = createTestContext();
      const result = evaluateExpr(
        {
          kind: "filter",
          array: { kind: "get", path: "items" },
          predicate: {
            kind: "gt",
            left: { kind: "get", path: "$item" },
            right: { kind: "lit", value: 1 },
          },
        },
        ctx
      );
      expect(result).toEqual([2, 3]);
    });

    it("should evaluate map", () => {
      const ctx = createTestContext();
      const result = evaluateExpr(
        {
          kind: "map",
          array: { kind: "get", path: "items" },
          mapper: {
            kind: "mul",
            left: { kind: "get", path: "$item" },
            right: { kind: "lit", value: 2 },
          },
        },
        ctx
      );
      expect(result).toEqual([2, 4, 6]);
    });
  });

  describe("type operators", () => {
    it("should evaluate typeof", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          { kind: "typeof", arg: { kind: "lit", value: 42 } },
          ctx
        )
      ).toBe("number");
      expect(
        evaluateExpr(
          { kind: "typeof", arg: { kind: "lit", value: "hello" } },
          ctx
        )
      ).toBe("string");
      expect(
        evaluateExpr(
          { kind: "typeof", arg: { kind: "lit", value: null } },
          ctx
        )
      ).toBe("null");
      expect(
        evaluateExpr(
          { kind: "typeof", arg: { kind: "get", path: "items" } },
          ctx
        )
      ).toBe("array");
    });

    it("should evaluate isNull", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          { kind: "isNull", arg: { kind: "lit", value: null } },
          ctx
        )
      ).toBe(true);
      expect(
        evaluateExpr(
          { kind: "isNull", arg: { kind: "lit", value: 0 } },
          ctx
        )
      ).toBe(false);
    });

    it("should evaluate coalesce", () => {
      const ctx = createTestContext();
      expect(
        evaluateExpr(
          {
            kind: "coalesce",
            args: [
              { kind: "lit", value: null },
              { kind: "lit", value: 42 },
            ],
          },
          ctx
        )
      ).toBe(42);
      expect(
        evaluateExpr(
          {
            kind: "coalesce",
            args: [
              { kind: "lit", value: "first" },
              { kind: "lit", value: "second" },
            ],
          },
          ctx
        )
      ).toBe("first");
    });
  });

  describe("total function semantics (A35)", () => {
    it("should never throw, return null on error", () => {
      const ctx = createTestContext();

      // Invalid operations should return null, not throw
      expect(
        evaluateExpr(
          {
            kind: "div",
            left: { kind: "lit", value: 1 },
            right: { kind: "lit", value: 0 },
          },
          ctx
        )
      ).toBe(null);

      expect(
        evaluateExpr(
          {
            kind: "at",
            array: { kind: "lit", value: [1, 2, 3] },
            index: { kind: "lit", value: -1 },
          },
          ctx
        )
      ).toBe(null);

      expect(evaluateExpr({ kind: "get", path: "missing.path" }, ctx)).toBe(
        null
      );
    });
  });
});

describe("evaluateCondition", () => {
  it("should return true for undefined condition", () => {
    const ctx = createTestContext();
    expect(evaluateCondition(undefined, ctx)).toBe(true);
  });

  it("should return true only for boolean true", () => {
    const ctx = createTestContext();
    expect(
      evaluateCondition({ kind: "lit", value: true }, ctx)
    ).toBe(true);
    expect(
      evaluateCondition({ kind: "lit", value: false }, ctx)
    ).toBe(false);
    expect(
      evaluateCondition({ kind: "lit", value: 1 }, ctx)
    ).toBe(false);
    expect(
      evaluateCondition({ kind: "lit", value: "true" }, ctx)
    ).toBe(false);
  });
});

describe("evaluateConditionalPatchOps", () => {
  it("should include patches without conditions", () => {
    const ctx = createTestContext();
    const ops: ConditionalPatchOp[] = [
      {
        fragmentId: "frag-1",
        op: {
          kind: "addType",
          typeName: "User",
          typeExpr: {
            kind: "object",
            fields: [{ name: "id", type: { kind: "primitive", name: "string" } }],
          },
        },
        confidence: 0.9,
      },
    ];

    const result = evaluateConditionalPatchOps(ops, ctx);

    expect(result.patches).toHaveLength(1);
    expect(result.patches[0].fragmentId).toBe("frag-1");
    expect(result.skipped).toHaveLength(0);
  });

  it("should include patches with true conditions", () => {
    const ctx = createTestContext();
    const ops: ConditionalPatchOp[] = [
      {
        fragmentId: "frag-1",
        condition: { kind: "lit", value: true },
        op: {
          kind: "addType",
          typeName: "User",
          typeExpr: { kind: "primitive", name: "string" },
        },
        confidence: 0.9,
      },
    ];

    const result = evaluateConditionalPatchOps(ops, ctx);

    expect(result.patches).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it("should skip patches with false conditions", () => {
    const ctx = createTestContext();
    const ops: ConditionalPatchOp[] = [
      {
        fragmentId: "frag-1",
        condition: { kind: "lit", value: false },
        op: {
          kind: "addType",
          typeName: "User",
          typeExpr: { kind: "primitive", name: "string" },
        },
        confidence: 0.9,
      },
    ];

    const result = evaluateConditionalPatchOps(ops, ctx);

    expect(result.patches).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe("false");
  });

  it("should skip patches with null conditions", () => {
    const ctx = createTestContext();
    const ops: ConditionalPatchOp[] = [
      {
        fragmentId: "frag-1",
        condition: { kind: "get", path: "nonexistent" }, // returns null
        op: {
          kind: "addType",
          typeName: "User",
          typeExpr: { kind: "primitive", name: "string" },
        },
        confidence: 0.9,
      },
    ];

    const result = evaluateConditionalPatchOps(ops, ctx);

    expect(result.patches).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe("null");
  });

  it("should implement sequential evaluation semantics", () => {
    // Create context with initial data
    const ctx = createEvaluationContext({
      meta: { intentId: "test" },
      snapshot: { data: { value: 0 }, computed: {} },
      input: {},
    });

    const ops: ConditionalPatchOp[] = [
      {
        fragmentId: "frag-1",
        op: {
          kind: "setDefaultValue",
          path: "value",
          value: 10, // Sets value to 10
        },
        confidence: 0.9,
      },
      {
        fragmentId: "frag-2",
        // This condition should see value=10 from the previous patch
        condition: {
          kind: "eq",
          left: { kind: "get", path: "value" },
          right: { kind: "lit", value: 10 },
        },
        op: {
          kind: "setDefaultValue",
          path: "result",
          value: "success",
        },
        confidence: 0.9,
      },
    ];

    const result = evaluateConditionalPatchOps(ops, ctx);

    expect(result.patches).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(result.finalSnapshot.data).toEqual({
      value: 10,
      result: "success",
    });
  });
});
