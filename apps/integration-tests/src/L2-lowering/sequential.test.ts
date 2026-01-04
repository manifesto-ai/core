/**
 * L2: Sequential Evaluation Semantics Tests
 *
 * Tests SPEC v0.4.0 §18.5 sequential evaluation with working snapshot.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateConditionalPatchOps,
  createEvaluationContext,
} from "@manifesto-ai/compiler";
import { createEvaluationSnapshot } from "../fixtures/snapshots.js";

// =============================================================================
// L2: Sequential Evaluation Tests (FDR-MEL-070)
// =============================================================================

describe("L2: Sequential Evaluation Semantics", () => {
  describe("Working snapshot updates", () => {
    it("should use working snapshot for second patch condition", () => {
      // Initial: { a: 0, b: "no" }
      // Patch 1: set a = 1
      // Patch 2: if a === 1, set b = "yes"
      //
      // With sequential semantics:
      // - After patch 1: working snapshot { a: 1, b: "no" }
      // - Patch 2 condition evaluates against working snapshot
      // - a === 1 is true, so patch 2 applies

      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({ a: 0, b: "no" }),
      });

      const ops = [
        {
          fragmentId: "frag-1",
          op: { kind: "setDefaultValue" as const, path: "a", value: 1 },
          confidence: 1.0,
        },
        {
          fragmentId: "frag-2",
          condition: {
            kind: "eq" as const,
            left: { kind: "get" as const, path: "a" },
            right: { kind: "lit" as const, value: 1 },
          },
          op: { kind: "setDefaultValue" as const, path: "b", value: "yes" },
          confidence: 1.0,
        },
      ];

      const result = evaluateConditionalPatchOps(ops, ctx);

      // Both patches should be applied (working snapshot semantics)
      expect(result.patches).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);

      // Verify final snapshot - b should be "yes" because condition was true
      expect(result.finalSnapshot.data).toEqual({ a: 1, b: "yes" });
    });

    it("should skip second patch when first patch does not satisfy condition", () => {
      // Initial: { a: 5, b: "no" }
      // Patch 1: set a = 0
      // Patch 2: if a > 0, set b = "yes"
      //
      // After patch 1: { a: 0, b: "no" }
      // Patch 2 condition: 0 > 0 is false, skip

      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({ a: 5, b: "no" }),
      });

      const ops = [
        {
          fragmentId: "frag-1",
          op: { kind: "setDefaultValue" as const, path: "a", value: 0 },
          confidence: 1.0,
        },
        {
          fragmentId: "frag-2",
          condition: {
            kind: "gt" as const,
            left: { kind: "get" as const, path: "a" },
            right: { kind: "lit" as const, value: 0 },
          },
          op: { kind: "setDefaultValue" as const, path: "b", value: "yes" },
          confidence: 1.0,
        },
      ];

      const result = evaluateConditionalPatchOps(ops, ctx);

      // First patch applied, second skipped
      expect(result.patches).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].fragmentId).toBe("frag-2");
      expect(result.skipped[0].reason).toBe("false");
    });
  });

  describe("Order preservation", () => {
    it("should maintain input order in output patches", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({}),
      });

      const ops = [
        {
          fragmentId: "frag-1",
          op: { kind: "setDefaultValue" as const, path: "first", value: 1 },
          confidence: 1.0,
        },
        {
          fragmentId: "frag-2",
          op: { kind: "setDefaultValue" as const, path: "second", value: 2 },
          confidence: 1.0,
        },
        {
          fragmentId: "frag-3",
          op: { kind: "setDefaultValue" as const, path: "third", value: 3 },
          confidence: 1.0,
        },
      ];

      const result = evaluateConditionalPatchOps(ops, ctx);

      expect(result.patches).toHaveLength(3);
      expect(result.patches[0].fragmentId).toBe("frag-1");
      expect(result.patches[1].fragmentId).toBe("frag-2");
      expect(result.patches[2].fragmentId).toBe("frag-3");
    });

    it("should filter out skipped patches while preserving order", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({ x: 10 }),
      });

      const ops = [
        {
          fragmentId: "frag-1",
          op: { kind: "setDefaultValue" as const, path: "a", value: 1 },
          confidence: 1.0,
        },
        {
          fragmentId: "frag-2",
          condition: { kind: "lit" as const, value: false },
          op: { kind: "setDefaultValue" as const, path: "b", value: 2 },
          confidence: 1.0,
        },
        {
          fragmentId: "frag-3",
          op: { kind: "setDefaultValue" as const, path: "c", value: 3 },
          confidence: 1.0,
        },
      ];

      const result = evaluateConditionalPatchOps(ops, ctx);

      expect(result.patches).toHaveLength(2);
      expect(result.patches[0].fragmentId).toBe("frag-1");
      expect(result.patches[1].fragmentId).toBe("frag-3");
    });
  });

  describe("Chained dependencies", () => {
    it("should handle multiple dependent conditions", () => {
      // Each patch depends on the previous one
      // a=1 → b=a+1=2 → c=b+1=3

      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({ a: 0, b: 0, c: 0 }),
      });

      const ops = [
        {
          fragmentId: "set-a",
          op: { kind: "setDefaultValue" as const, path: "a", value: 1 },
          confidence: 1.0,
        },
        {
          fragmentId: "set-b",
          condition: {
            kind: "eq" as const,
            left: { kind: "get" as const, path: "a" },
            right: { kind: "lit" as const, value: 1 },
          },
          op: { kind: "setDefaultValue" as const, path: "b", value: 2 },
          confidence: 1.0,
        },
        {
          fragmentId: "set-c",
          condition: {
            kind: "eq" as const,
            left: { kind: "get" as const, path: "b" },
            right: { kind: "lit" as const, value: 2 },
          },
          op: { kind: "setDefaultValue" as const, path: "c", value: 3 },
          confidence: 1.0,
        },
      ];

      const result = evaluateConditionalPatchOps(ops, ctx);

      // All three patches should apply (working snapshot semantics - each condition evaluates against updated state)
      expect(result.patches).toHaveLength(3);
      expect(result.finalSnapshot.data).toEqual({ a: 1, b: 2, c: 3 });
    });
  });

  describe("No condition patches", () => {
    it("should always apply patches without conditions", () => {
      const ctx = createEvaluationContext({
        meta: { intentId: "test" },
        snapshot: createEvaluationSnapshot({}),
      });

      const ops = [
        {
          fragmentId: "frag-1",
          // No condition - should always apply
          op: { kind: "setDefaultValue" as const, path: "x", value: 42 },
          confidence: 1.0,
        },
      ];

      const result = evaluateConditionalPatchOps(ops, ctx);

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0].conditionEvaluated).toBe(false);
    });
  });
});
