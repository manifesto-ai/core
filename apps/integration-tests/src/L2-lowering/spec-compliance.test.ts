/**
 * L2: SPEC v0.4.0 Compliance Tests
 *
 * Tests normative requirements from MEL Compiler SPEC v0.4.0.
 */

import { describe, it, expect } from "vitest";
import {
  lowerExprNode,
  lowerPatchFragments,
  evaluateExpr,
  evaluateConditionalPatchOps,
  createEvaluationContext,
  LoweringError,
  DEFAULT_ACTION_CONTEXT,
  EFFECT_ARGS_CONTEXT,
  type MelExprNode,
  type MelPatchFragment,
  type ExprLoweringContext,
} from "@manifesto-ai/compiler";
import { createEvaluationSnapshot } from "../fixtures/snapshots.js";

// =============================================================================
// L2: Lowering SPEC Compliance
// =============================================================================

describe("L2: SPEC v0.4.0 Compliance - Lowering", () => {
  describe("lowerPatchFragments", () => {
    it("should preserve conditions from PatchFragment", () => {
      const fragment: MelPatchFragment = {
        fragmentId: "frag-1",
        sourceIntentId: "intent-1",
        op: {
          kind: "setDefaultValue",
          path: "count",
          value: 10,
        },
        condition: {
          kind: "call",
          fn: "gt",
          args: [
            { kind: "get", path: [{ kind: "prop", name: "count" }] },
            { kind: "lit", value: 0 },
          ],
        },
        confidence: 0.9,
        evidence: ["test"],
        createdAt: new Date().toISOString(),
      };

      const result = lowerPatchFragments([fragment], {
        fnTableVersion: "1.0",
        allowSysPaths: { prefixes: ["meta", "input"] },
      });

      expect(result).toHaveLength(1);
      expect(result[0].condition).toBeDefined();
      expect(result[0].condition?.kind).toBe("gt");
    });
  });

  describe("sys lowering (§17.3.1)", () => {
    it("should lower sys([meta, intentId]) to get(meta.intentId)", () => {
      const expr: MelExprNode = {
        kind: "sys",
        path: ["meta", "intentId"],
      };

      const result = lowerExprNode(expr, DEFAULT_ACTION_CONTEXT);

      expect(result.kind).toBe("get");
      expect((result as { path: string }).path).toBe("meta.intentId");
    });

    it("should lower sys([input, title]) to get(input.title)", () => {
      const expr: MelExprNode = {
        kind: "sys",
        path: ["input", "title"],
      };

      const result = lowerExprNode(expr, DEFAULT_ACTION_CONTEXT);

      expect(result.kind).toBe("get");
      expect((result as { path: string }).path).toBe("input.title");
    });

    it("should reject sys([system, *]) with INVALID_SYS_PATH", () => {
      const expr: MelExprNode = {
        kind: "sys",
        path: ["system", "uuid"],
      };

      expect(() => {
        lowerExprNode(expr, DEFAULT_ACTION_CONTEXT);
      }).toThrow(LoweringError);
    });
  });

  describe("var lowering (§17.3.2)", () => {
    it("should only allow var(item) in effect.args context", () => {
      const expr: MelExprNode = {
        kind: "var",
        name: "item",
      };

      // Should succeed in effect.args context
      const result = lowerExprNode(expr, EFFECT_ARGS_CONTEXT);
      expect(result.kind).toBe("get");
      expect((result as { path: string }).path).toBe("$item");
    });

    it("should reject var(item) outside effect.args context", () => {
      const expr: MelExprNode = {
        kind: "var",
        name: "item",
      };

      expect(() => {
        lowerExprNode(expr, DEFAULT_ACTION_CONTEXT);
      }).toThrow(LoweringError);
    });
  });

  describe("get.base handling (§17.3.4)", () => {
    it("should support get.base with var(item)", () => {
      const expr: MelExprNode = {
        kind: "get",
        base: { kind: "var", name: "item" },
        path: [{ kind: "prop", name: "name" }],
      };

      const result = lowerExprNode(expr, EFFECT_ARGS_CONTEXT);

      expect(result.kind).toBe("get");
      expect((result as { path: string }).path).toBe("$item.name");
    });

    it("should reject unsupported get.base expressions", () => {
      const expr: MelExprNode = {
        kind: "get",
        base: { kind: "lit", value: "test" },
        path: [{ kind: "prop", name: "x" }],
      };

      expect(() => {
        lowerExprNode(expr, DEFAULT_ACTION_CONTEXT);
      }).toThrow(LoweringError);
    });
  });

  describe("call lowering (§17.3.5)", () => {
    it("should lower binary operators", () => {
      const expr: MelExprNode = {
        kind: "call",
        fn: "eq",
        args: [
          { kind: "lit", value: 1 },
          { kind: "lit", value: 1 },
        ],
      };

      const result = lowerExprNode(expr, DEFAULT_ACTION_CONTEXT);

      expect(result.kind).toBe("eq");
    });

    it("should lower unary operators", () => {
      const expr: MelExprNode = {
        kind: "call",
        fn: "not",
        args: [{ kind: "lit", value: true }],
      };

      const result = lowerExprNode(expr, DEFAULT_ACTION_CONTEXT);

      expect(result.kind).toBe("not");
    });
  });
});

// =============================================================================
// L2: Evaluation SPEC Compliance
// =============================================================================

describe("L2: SPEC v0.4.0 Compliance - Evaluation", () => {
  describe("Total function principle (A35)", () => {
    it("should return null for division by zero, not throw", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({ count: 10 }),
      });

      const expr = {
        kind: "div" as const,
        left: { kind: "lit" as const, value: 10 },
        right: { kind: "lit" as const, value: 0 },
      };

      const result = evaluateExpr(expr, ctx);

      expect(result).toBeNull();
    });

    it("should return null for type mismatch (add string + number)", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({}),
      });

      const expr = {
        kind: "add" as const,
        left: { kind: "lit" as const, value: "hello" },
        right: { kind: "lit" as const, value: 5 },
      };

      const result = evaluateExpr(expr, ctx);

      expect(result).toBeNull();
    });

    it("should return null for path not found", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({}),
      });

      const expr = {
        kind: "get" as const,
        path: "nonexistent.path",
      };

      const result = evaluateExpr(expr, ctx);

      expect(result).toBeNull();
    });
  });

  describe("Boolean-only conditions (§18.6)", () => {
    it("should apply patch when condition is exactly true", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({ count: 5 }),
      });

      const ops = [
        {
          fragmentId: "frag-1",
          condition: {
            kind: "gt" as const,
            left: { kind: "get" as const, path: "count" },
            right: { kind: "lit" as const, value: 0 },
          },
          op: { kind: "setDefaultValue" as const, path: "result", value: "yes" },
          confidence: 0.9,
        },
      ];

      const result = evaluateConditionalPatchOps(ops, ctx);

      expect(result.patches).toHaveLength(1);
    });

    it("should skip patch when condition is false", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({ count: 0 }),
      });

      const ops = [
        {
          fragmentId: "frag-1",
          condition: {
            kind: "gt" as const,
            left: { kind: "get" as const, path: "count" },
            right: { kind: "lit" as const, value: 0 },
          },
          op: { kind: "setDefaultValue" as const, path: "result", value: "yes" },
          confidence: 0.9,
        },
      ];

      const result = evaluateConditionalPatchOps(ops, ctx);

      expect(result.patches).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toBe("false");
    });

    it("should skip patch when condition is null (non-boolean)", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({}),
      });

      // Condition evaluates to null (path not found)
      const ops = [
        {
          fragmentId: "frag-1",
          condition: {
            kind: "get" as const,
            path: "nonexistent",
          },
          op: { kind: "setDefaultValue" as const, path: "result", value: "yes" },
          confidence: 0.9,
        },
      ];

      const result = evaluateConditionalPatchOps(ops, ctx);

      expect(result.patches).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toBe("null");
    });
  });

  describe("Path resolution (§18.7)", () => {
    it("should resolve meta.* paths", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test-intent-123" },
        snapshot: createEvaluationSnapshot({}),
      });

      const expr = { kind: "get" as const, path: "meta.intentId" };
      const result = evaluateExpr(expr, ctx);

      expect(result).toBe("test-intent-123");
    });

    it("should resolve input.* paths", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        input: { title: "My Title" },
        snapshot: createEvaluationSnapshot({}),
      });

      const expr = { kind: "get" as const, path: "input.title" };
      const result = evaluateExpr(expr, ctx);

      expect(result).toBe("My Title");
    });

    it("should resolve $item.* paths in item context", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({}),
        item: { name: "Test Item", value: 42 },
      });

      const nameExpr = { kind: "get" as const, path: "$item.name" };
      const valueExpr = { kind: "get" as const, path: "$item.value" };

      expect(evaluateExpr(nameExpr, ctx)).toBe("Test Item");
      expect(evaluateExpr(valueExpr, ctx)).toBe(42);
    });

    it("should resolve default paths to snapshot.data", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({ user: { name: "John" } }),
      });

      const expr = { kind: "get" as const, path: "user.name" };
      const result = evaluateExpr(expr, ctx);

      expect(result).toBe("John");
    });
  });
});
