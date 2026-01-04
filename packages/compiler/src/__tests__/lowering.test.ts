/**
 * Lowering Tests
 *
 * Tests for MEL IR → Core IR lowering.
 *
 * @see SPEC v0.4.0 §17
 */

import { describe, it, expect } from "vitest";
import {
  lowerExprNode,
  lowerPatchFragments,
  DEFAULT_SCHEMA_CONTEXT,
  DEFAULT_ACTION_CONTEXT,
  EFFECT_ARGS_CONTEXT,
  DEFAULT_PATCH_CONTEXT,
  LoweringError,
  type MelExprNode,
  type MelPatchFragment,
} from "../lowering/index.js";

describe("lowerExprNode", () => {
  describe("lit", () => {
    it("should pass through literals", () => {
      const input: MelExprNode = { kind: "lit", value: 42 };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({ kind: "lit", value: 42 });
    });

    it("should handle null literals", () => {
      const input: MelExprNode = { kind: "lit", value: null };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({ kind: "lit", value: null });
    });

    it("should handle string literals", () => {
      const input: MelExprNode = { kind: "lit", value: "hello" };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({ kind: "lit", value: "hello" });
    });
  });

  describe("var", () => {
    it("should lower var(item) to get($item) in effect context", () => {
      const input: MelExprNode = { kind: "var", name: "item" };
      const result = lowerExprNode(input, EFFECT_ARGS_CONTEXT);
      expect(result).toEqual({ kind: "get", path: "$item" });
    });

    it("should throw in non-effect context", () => {
      const input: MelExprNode = { kind: "var", name: "item" };
      expect(() => lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT)).toThrow(
        LoweringError
      );
    });
  });

  describe("sys", () => {
    it("should lower sys([meta, intentId]) to get(meta.intentId)", () => {
      const input: MelExprNode = { kind: "sys", path: ["meta", "intentId"] };
      const result = lowerExprNode(input, DEFAULT_ACTION_CONTEXT);
      expect(result).toEqual({ kind: "get", path: "meta.intentId" });
    });

    it("should lower sys([input, title]) to get(input.title)", () => {
      const input: MelExprNode = { kind: "sys", path: ["input", "title"] };
      const result = lowerExprNode(input, DEFAULT_ACTION_CONTEXT);
      expect(result).toEqual({ kind: "get", path: "input.title" });
    });

    it("should throw for sys([system, ...]) in Translator path", () => {
      const input: MelExprNode = { kind: "sys", path: ["system", "uuid"] };
      expect(() => lowerExprNode(input, DEFAULT_ACTION_CONTEXT)).toThrow(
        LoweringError
      );
    });

    it("should throw for empty sys path", () => {
      const input: MelExprNode = { kind: "sys", path: [] };
      expect(() => lowerExprNode(input, DEFAULT_ACTION_CONTEXT)).toThrow(
        LoweringError
      );
    });
  });

  describe("get", () => {
    it("should convert PathNode[] to dot-notation", () => {
      const input: MelExprNode = {
        kind: "get",
        path: [{ kind: "prop", name: "user" }, { kind: "prop", name: "name" }],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({ kind: "get", path: "user.name" });
    });

    it("should handle single-segment paths", () => {
      const input: MelExprNode = {
        kind: "get",
        path: [{ kind: "prop", name: "count" }],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({ kind: "get", path: "count" });
    });

    it("should prefix $item for base=var(item) in effect context", () => {
      const input: MelExprNode = {
        kind: "get",
        base: { kind: "var", name: "item" },
        path: [{ kind: "prop", name: "id" }],
      };
      const result = lowerExprNode(input, EFFECT_ARGS_CONTEXT);
      expect(result).toEqual({ kind: "get", path: "$item.id" });
    });

    it("should throw for unsupported base", () => {
      const input: MelExprNode = {
        kind: "get",
        base: { kind: "lit", value: {} },
        path: [{ kind: "prop", name: "x" }],
      };
      expect(() => lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT)).toThrow(
        LoweringError
      );
    });
  });

  describe("call", () => {
    it("should lower binary operators", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "eq",
        args: [
          { kind: "get", path: [{ kind: "prop", name: "x" }] },
          { kind: "lit", value: 5 },
        ],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "eq",
        left: { kind: "get", path: "x" },
        right: { kind: "lit", value: 5 },
      });
    });

    it("should lower unary operators", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "not",
        args: [{ kind: "lit", value: true }],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "not",
        arg: { kind: "lit", value: true },
      });
    });

    it("should lower variadic operators", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "and",
        args: [
          { kind: "lit", value: true },
          { kind: "lit", value: false },
        ],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "and",
        args: [
          { kind: "lit", value: true },
          { kind: "lit", value: false },
        ],
      });
    });

    it("should lower if expression", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "if",
        args: [
          { kind: "lit", value: true },
          { kind: "lit", value: 1 },
          { kind: "lit", value: 0 },
        ],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "if",
        cond: { kind: "lit", value: true },
        then: { kind: "lit", value: 1 },
        else: { kind: "lit", value: 0 },
      });
    });

    it("should lower filter with predicate context", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "filter",
        args: [
          { kind: "get", path: [{ kind: "prop", name: "items" }] },
          {
            kind: "call",
            fn: "gt",
            args: [
              { kind: "var", name: "item" },
              { kind: "lit", value: 0 },
            ],
          },
        ],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "filter",
        array: { kind: "get", path: "items" },
        predicate: {
          kind: "gt",
          left: { kind: "get", path: "$item" },
          right: { kind: "lit", value: 0 },
        },
      });
    });

    it("should throw for unknown function", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "unknownFn",
        args: [],
      };
      expect(() => lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT)).toThrow(
        LoweringError
      );
    });
  });

  describe("obj", () => {
    it("should lower obj to object with Record fields", () => {
      const input: MelExprNode = {
        kind: "obj",
        fields: [
          { key: "x", value: { kind: "lit", value: 1 } },
          { key: "y", value: { kind: "lit", value: 2 } },
        ],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "object",
        fields: {
          x: { kind: "lit", value: 1 },
          y: { kind: "lit", value: 2 },
        },
      });
    });
  });

  describe("arr", () => {
    it("should lower all-literal arrays to lit", () => {
      const input: MelExprNode = {
        kind: "arr",
        elements: [
          { kind: "lit", value: 1 },
          { kind: "lit", value: 2 },
          { kind: "lit", value: 3 },
        ],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({ kind: "lit", value: [1, 2, 3] });
    });

    it("should lower mixed arrays to append", () => {
      const input: MelExprNode = {
        kind: "arr",
        elements: [
          { kind: "lit", value: 1 },
          { kind: "get", path: [{ kind: "prop", name: "x" }] },
        ],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "append",
        array: { kind: "lit", value: [] },
        items: [
          { kind: "lit", value: 1 },
          { kind: "get", path: "x" },
        ],
      });
    });

    it("should lower empty arrays to lit", () => {
      const input: MelExprNode = { kind: "arr", elements: [] };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({ kind: "lit", value: [] });
    });
  });
});

describe("lowerPatchFragments", () => {
  it("should lower fragments with conditions", () => {
    const fragments: MelPatchFragment[] = [
      {
        fragmentId: "frag-1",
        sourceIntentId: "intent-1",
        op: {
          kind: "addComputed",
          name: "total",
          expr: {
            kind: "call",
            fn: "add",
            args: [
              { kind: "get", path: [{ kind: "prop", name: "a" }] },
              { kind: "get", path: [{ kind: "prop", name: "b" }] },
            ],
          },
        },
        condition: {
          kind: "call",
          fn: "gt",
          args: [
            { kind: "sys", path: ["meta", "intentId"] },
            { kind: "lit", value: "" },
          ],
        },
        confidence: 0.9,
        evidence: ["test"],
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const result = lowerPatchFragments(fragments, DEFAULT_PATCH_CONTEXT);

    expect(result).toHaveLength(1);
    expect(result[0].fragmentId).toBe("frag-1");
    expect(result[0].condition).toEqual({
      kind: "gt",
      left: { kind: "get", path: "meta.intentId" },
      right: { kind: "lit", value: "" },
    });
    expect(result[0].op.kind).toBe("addComputed");
    expect((result[0].op as { expr: unknown }).expr).toEqual({
      kind: "add",
      left: { kind: "get", path: "a" },
      right: { kind: "get", path: "b" },
    });
  });

  it("should preserve fragment metadata", () => {
    const fragments: MelPatchFragment[] = [
      {
        fragmentId: "frag-2",
        sourceIntentId: "intent-2",
        op: {
          kind: "addType",
          typeName: "User",
          typeExpr: {
            kind: "object",
            fields: [
              { name: "id", type: { kind: "primitive", name: "string" } },
            ],
          },
        },
        confidence: 0.85,
        evidence: ["schema"],
        createdAt: "2024-01-02T00:00:00Z",
      },
    ];

    const result = lowerPatchFragments(fragments, DEFAULT_PATCH_CONTEXT);

    expect(result[0].fragmentId).toBe("frag-2");
    expect(result[0].confidence).toBe(0.85);
    expect(result[0].condition).toBeUndefined();
  });
});
