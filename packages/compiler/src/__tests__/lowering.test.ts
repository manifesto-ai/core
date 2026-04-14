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
  lowerRuntimePatches,
  DEFAULT_SCHEMA_CONTEXT,
  DEFAULT_ACTION_CONTEXT,
  EFFECT_ARGS_CONTEXT,
  DEFAULT_PATCH_CONTEXT,
  LoweringError,
  type MelIRPatchPath,
  type MelExprNode,
  type MelPatchFragment,
  type MelRuntimePatch,
} from "../lowering/index.js";

const irp = (...segments: string[]): MelIRPatchPath =>
  segments.map((name) => ({ kind: "prop" as const, name }));

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

  describe("field", () => {
    it("should flatten simple get(field) access to a longer get path", () => {
      const input: MelExprNode = {
        kind: "field",
        object: {
          kind: "get",
          path: [{ kind: "prop", name: "user" }],
        },
        property: "name",
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({ kind: "get", path: "user.name" });
    });
  });

  describe("obj", () => {
    it("should lower object fields in Unicode code-point order with stable duplicate handling", () => {
      const input: MelExprNode = {
        kind: "obj",
        fields: [
          { key: "b", value: { kind: "lit", value: 1 } },
          { key: "ä", value: { kind: "lit", value: 2 } },
          { key: "a", value: { kind: "lit", value: 3 } },
          { key: "b", value: { kind: "lit", value: 4 } },
        ],
      };

      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "object",
        fields: {
          a: { kind: "lit", value: 3 },
          b: { kind: "lit", value: 4 },
          ä: { kind: "lit", value: 2 },
        },
      });
      expect(Object.keys((result as { kind: "object"; fields: Record<string, unknown> }).fields)).toEqual([
        "a",
        "b",
        "ä",
      ]);
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
        fn: "cond",
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

    it("should lower field access on computed object", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "field",
        args: [
          {
            kind: "call",
            fn: "at",
            args: [
              { kind: "get", path: [{ kind: "prop", name: "records" }] },
              { kind: "lit", value: 0 },
            ],
          },
          { kind: "lit", value: "title" },
        ],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "field",
        object: {
          kind: "at",
          array: { kind: "get", path: "records" },
          index: { kind: "lit", value: 0 },
        },
        property: "title",
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

    it("should lower merge() expression call", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "merge",
        args: [
          { kind: "get", path: [{ kind: "prop", name: "base" }] },
          {
            kind: "obj",
            fields: [
              { key: "status", value: { kind: "lit", value: "active" } },
            ],
          },
        ],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "merge",
        objects: [
          { kind: "get", path: "base" },
          { kind: "object", fields: { status: { kind: "lit", value: "active" } } },
        ],
      });
    });

    it("should lower absDiff(), clamp(), idiv(), and streak() as bounded sugar", () => {
      expect(
        lowerExprNode(
          {
            kind: "call",
            fn: "absDiff",
            args: [
              { kind: "get", path: [{ kind: "prop", name: "observed" }] },
              { kind: "get", path: [{ kind: "prop", name: "predicted" }] },
            ],
          },
          DEFAULT_SCHEMA_CONTEXT
        )
      ).toEqual({
        kind: "abs",
        arg: {
          kind: "sub",
          left: { kind: "get", path: "observed" },
          right: { kind: "get", path: "predicted" },
        },
      });

      expect(
        lowerExprNode(
          {
            kind: "call",
            fn: "clamp",
            args: [
              { kind: "get", path: [{ kind: "prop", name: "score" }] },
              { kind: "lit", value: 0 },
              { kind: "lit", value: 10 },
            ],
          },
          DEFAULT_SCHEMA_CONTEXT
        )
      ).toEqual({
        kind: "min",
        args: [
          {
            kind: "max",
            args: [
              { kind: "get", path: "score" },
              { kind: "lit", value: 0 },
            ],
          },
          { kind: "lit", value: 10 },
        ],
      });

      expect(
        lowerExprNode(
          {
            kind: "call",
            fn: "idiv",
            args: [
              { kind: "get", path: [{ kind: "prop", name: "total" }] },
              { kind: "lit", value: 2 },
            ],
          },
          DEFAULT_SCHEMA_CONTEXT
        )
      ).toEqual({
        kind: "floor",
        arg: {
          kind: "div",
          left: { kind: "get", path: "total" },
          right: { kind: "lit", value: 2 },
        },
      });

      expect(
        lowerExprNode(
          {
            kind: "call",
            fn: "streak",
            args: [
              { kind: "get", path: [{ kind: "prop", name: "prev" }] },
              { kind: "get", path: [{ kind: "prop", name: "flag" }] },
            ],
          },
          DEFAULT_SCHEMA_CONTEXT
        )
      ).toEqual({
        kind: "if",
        cond: { kind: "get", path: "flag" },
        then: {
          kind: "add",
          left: { kind: "get", path: "prev" },
          right: { kind: "lit", value: 1 },
        },
        else: { kind: "lit", value: 0 },
      });
    });

    it("should lower match() into nested if/eq expressions in source order", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "match",
        args: [
          { kind: "get", path: [{ kind: "prop", name: "status" }] },
          { kind: "arr", elements: [{ kind: "lit", value: "open" }, { kind: "lit", value: 1 }] },
          { kind: "arr", elements: [{ kind: "lit", value: "closed" }, { kind: "lit", value: 0 }] },
          { kind: "lit", value: -1 },
        ],
      };

      expect(lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT)).toEqual({
        kind: "if",
        cond: {
          kind: "eq",
          left: { kind: "get", path: "status" },
          right: { kind: "lit", value: "open" },
        },
        then: { kind: "lit", value: 1 },
        else: {
          kind: "if",
          cond: {
            kind: "eq",
            left: { kind: "get", path: "status" },
            right: { kind: "lit", value: "closed" },
          },
          then: { kind: "lit", value: 0 },
          else: { kind: "lit", value: -1 },
        },
      });
    });

    it("should lower argmax()/argmin() into deterministic selection trees", () => {
      const argmax = lowerExprNode(
        {
          kind: "call",
          fn: "argmax",
          args: [
            { kind: "arr", elements: [{ kind: "lit", value: "a" }, { kind: "get", path: [{ kind: "prop", name: "aOk" }] }, { kind: "get", path: [{ kind: "prop", name: "aScore" }] }] },
            { kind: "arr", elements: [{ kind: "lit", value: "b" }, { kind: "get", path: [{ kind: "prop", name: "bOk" }] }, { kind: "get", path: [{ kind: "prop", name: "bScore" }] }] },
            { kind: "lit", value: "first" },
          ],
        },
        DEFAULT_SCHEMA_CONTEXT
      );
      const argmin = lowerExprNode(
        {
          kind: "call",
          fn: "argmin",
          args: [
            { kind: "arr", elements: [{ kind: "lit", value: "a" }, { kind: "get", path: [{ kind: "prop", name: "aOk" }] }, { kind: "get", path: [{ kind: "prop", name: "aScore" }] }] },
            { kind: "arr", elements: [{ kind: "lit", value: "b" }, { kind: "get", path: [{ kind: "prop", name: "bOk" }] }, { kind: "get", path: [{ kind: "prop", name: "bScore" }] }] },
            { kind: "lit", value: "last" },
          ],
        },
        DEFAULT_SCHEMA_CONTEXT
      );

      expect(argmax).toEqual({
        kind: "if",
        cond: {
          kind: "and",
          args: [
            { kind: "get", path: "aOk" },
            {
              kind: "or",
              args: [
                {
                  kind: "not",
                  arg: { kind: "get", path: "bOk" },
                },
                {
                  kind: "gte",
                  left: { kind: "get", path: "aScore" },
                  right: { kind: "get", path: "bScore" },
                },
              ],
            },
          ],
        },
        then: { kind: "lit", value: "a" },
        else: {
          kind: "if",
          cond: { kind: "get", path: "bOk" },
          then: { kind: "lit", value: "b" },
          else: { kind: "lit", value: null },
        },
      });

      expect(argmin).toEqual({
        kind: "if",
        cond: {
          kind: "and",
          args: [
            { kind: "get", path: "aOk" },
            {
              kind: "or",
              args: [
                {
                  kind: "not",
                  arg: { kind: "get", path: "bOk" },
                },
                {
                  kind: "lt",
                  left: { kind: "get", path: "aScore" },
                  right: { kind: "get", path: "bScore" },
                },
              ],
            },
          ],
        },
        then: { kind: "lit", value: "a" },
        else: {
          kind: "if",
          cond: { kind: "get", path: "bOk" },
          then: { kind: "lit", value: "b" },
          else: { kind: "lit", value: null },
        },
      });
    });

    it("should lower variadic merge() with 3+ objects", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "merge",
        args: [
          { kind: "get", path: [{ kind: "prop", name: "defaults" }] },
          { kind: "get", path: [{ kind: "prop", name: "overrides" }] },
          { kind: "obj", fields: [{ key: "extra", value: { kind: "lit", value: true } }] },
        ],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "merge",
        objects: [
          { kind: "get", path: "defaults" },
          { kind: "get", path: "overrides" },
          { kind: "object", fields: { extra: { kind: "lit", value: true } } },
        ],
      });
    });

    it("should lower keys() expression call", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "keys",
        args: [{ kind: "get", path: [{ kind: "prop", name: "tasks" }] }],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "keys",
        obj: { kind: "get", path: "tasks" },
      });
    });

    it("should lower values() expression call", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "values",
        args: [{ kind: "get", path: [{ kind: "prop", name: "tasks" }] }],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "values",
        obj: { kind: "get", path: "tasks" },
      });
    });

    it("should lower entries() expression call", () => {
      const input: MelExprNode = {
        kind: "call",
        fn: "entries",
        args: [{ kind: "get", path: [{ kind: "prop", name: "tasks" }] }],
      };
      const result = lowerExprNode(input, DEFAULT_SCHEMA_CONTEXT);
      expect(result).toEqual({
        kind: "entries",
        obj: { kind: "get", path: "tasks" },
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

describe("lowerRuntimePatches", () => {
  it("should lower set operations with literal values", () => {
    const patches: MelRuntimePatch[] = [
      {
        op: "set",
        path: irp("count"),
        value: { kind: "lit", value: 42 },
      },
    ];

    const result = lowerRuntimePatches(patches, DEFAULT_ACTION_CONTEXT);

    expect(result).toHaveLength(1);
    expect(result[0].op).toBe("set");
    expect(result[0].path).toEqual(irp("count"));
    expect(result[0].value).toEqual({ kind: "lit", value: 42 });
    expect(result[0].condition).toBeUndefined();
  });

  it("should lower unset operations", () => {
    const patches: MelRuntimePatch[] = [
      {
        op: "unset",
        path: irp("obsoleteField"),
      },
    ];

    const result = lowerRuntimePatches(patches, DEFAULT_ACTION_CONTEXT);

    expect(result).toHaveLength(1);
    expect(result[0].op).toBe("unset");
    expect(result[0].path).toEqual(irp("obsoleteField"));
    expect(result[0].value).toBeUndefined();
  });

  it("should lower merge operations", () => {
    const patches: MelRuntimePatch[] = [
      {
        op: "merge",
        path: irp("user"),
        value: {
          kind: "obj",
          fields: [
            { key: "name", value: { kind: "lit", value: "Alice" } },
          ],
        },
      },
    ];

    const result = lowerRuntimePatches(patches, DEFAULT_ACTION_CONTEXT);

    expect(result).toHaveLength(1);
    expect(result[0].op).toBe("merge");
    expect(result[0].path).toEqual(irp("user"));
    expect(result[0].value).toEqual({
      kind: "object",
      fields: { name: { kind: "lit", value: "Alice" } },
    });
  });

  it("should lower conditions", () => {
    const patches: MelRuntimePatch[] = [
      {
        op: "set",
        path: irp("status"),
        value: { kind: "lit", value: "completed" },
        condition: {
          kind: "call",
          fn: "isNull",
          args: [{ kind: "get", path: [{ kind: "prop", name: "status" }] }],
        },
      },
    ];

    const result = lowerRuntimePatches(patches, DEFAULT_ACTION_CONTEXT);

    expect(result).toHaveLength(1);
    expect(result[0].condition).toEqual({
      kind: "isNull",
      arg: { kind: "get", path: "status" },
    });
  });

  it("should lower value expressions with input references", () => {
    const patches: MelRuntimePatch[] = [
      {
        op: "set",
        path: irp("title"),
        value: { kind: "sys", path: ["input", "newTitle"] },
      },
    ];

    const result = lowerRuntimePatches(patches, DEFAULT_ACTION_CONTEXT);

    expect(result).toHaveLength(1);
    expect(result[0].value).toEqual({ kind: "get", path: "input.newTitle" });
  });

  it("should lower value expressions with meta references", () => {
    const patches: MelRuntimePatch[] = [
      {
        op: "set",
        path: irp("lastUpdatedBy"),
        value: { kind: "sys", path: ["meta", "intentId"] },
      },
    ];

    const result = lowerRuntimePatches(patches, DEFAULT_ACTION_CONTEXT);

    expect(result).toHaveLength(1);
    expect(result[0].value).toEqual({ kind: "get", path: "meta.intentId" });
  });

  it("should lower complex expressions", () => {
    const patches: MelRuntimePatch[] = [
      {
        op: "set",
        path: irp("total"),
        value: {
          kind: "call",
          fn: "add",
          args: [
            { kind: "get", path: [{ kind: "prop", name: "count" }] },
            { kind: "lit", value: 1 },
          ],
        },
      },
    ];

    const result = lowerRuntimePatches(patches, DEFAULT_ACTION_CONTEXT);

    expect(result).toHaveLength(1);
    expect(result[0].value).toEqual({
      kind: "add",
      left: { kind: "get", path: "count" },
      right: { kind: "lit", value: 1 },
    });
  });

  it("should throw for forbidden $system paths", () => {
    const patches: MelRuntimePatch[] = [
      {
        op: "set",
        path: irp("uuid"),
        value: { kind: "sys", path: ["system", "uuid"] },
      },
    ];

    expect(() => lowerRuntimePatches(patches, DEFAULT_ACTION_CONTEXT)).toThrow(
      LoweringError
    );
  });

  it("should lower multiple patches", () => {
    const patches: MelRuntimePatch[] = [
      { op: "set", path: irp("a"), value: { kind: "lit", value: 1 } },
      { op: "set", path: irp("b"), value: { kind: "lit", value: 2 } },
      { op: "unset", path: irp("c") },
    ];

    const result = lowerRuntimePatches(patches, DEFAULT_ACTION_CONTEXT);

    expect(result).toHaveLength(3);
    expect(result[0].path).toEqual(irp("a"));
    expect(result[1].path).toEqual(irp("b"));
    expect(result[2].path).toEqual(irp("c"));
    expect(result[2].op).toBe("unset");
  });
});
