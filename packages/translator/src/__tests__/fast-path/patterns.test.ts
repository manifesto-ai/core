/**
 * Fast Path Pattern Tests
 * TDD: Tests first, implementation follows
 */

import { describe, it, expect } from "vitest";
import type { Token, TypeIndex, ResolvedType, FastPathResult } from "../../types/index.js";
import {
  matchFastPath,
  COMPARATOR_PATTERN,
  RANGE_PATTERN,
  LENGTH_PATTERN,
  INCLUSION_PATTERN,
  REQUIRED_PATTERN,
  BOOLEAN_PATTERN,
} from "../../fast-path/index.js";

// Helper to create tokens
function createTokens(words: string[]): Token[] {
  let offset = 0;
  return words.map((word) => {
    const start = offset;
    const end = offset + word.length;
    offset = end + 1; // +1 for space
    return {
      original: word,
      normalized: word,
      pos: "NOUN",
      start,
      end,
    };
  });
}

// Helper to create a type index
function createTypeIndex(entries: Record<string, { baseKind: ResolvedType["baseKind"]; nullable?: boolean }>): TypeIndex {
  const index: TypeIndex = {};
  for (const [path, { baseKind, nullable = false }] of Object.entries(entries)) {
    index[path] = {
      resolved: { kind: "primitive", name: baseKind as "string" | "number" | "boolean" },
      nullable,
      baseKind,
    };
  }
  return index;
}

describe("Fast Path Patterns", () => {
  describe("Comparator Pattern", () => {
    const typeIndex = createTypeIndex({
      "User.age": { baseKind: "number" },
      "User.name": { baseKind: "string" },
    });

    it("matches 'User.age gte 18' for number types", () => {
      const canonical = "User.age gte 18";
      const tokens = createTokens(["User.age", "gte", "18"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe("comparator");
      expect(result.confidence).toBe(1.0);
      expect(result.fragment).toBeDefined();
      expect(result.fragment?.changes[0].kind).toBe("constraint");
    });

    it("matches various comparison operators", () => {
      const operators = ["gte", "lte", "gt", "lt", "eq", "neq"];

      for (const op of operators) {
        const canonical = `User.age ${op} 100`;
        const tokens = createTokens(["User.age", op, "100"]);

        const result = matchFastPath(canonical, tokens, typeIndex);
        expect(result.matched).toBe(true);
        expect(result.pattern).toBe("comparator");
      }
    });

    it("handles negative numbers", () => {
      const canonical = "User.age gte -5";
      const tokens = createTokens(["User.age", "gte", "-5"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(true);
      expect(result.fragment?.changes[0].kind).toBe("constraint");
    });

    it("rejects comparator on string types", () => {
      const canonical = "User.name gte 18";
      const tokens = createTokens(["User.name", "gte", "18"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      // Should not match because User.name is string type
      expect(result.matched).toBe(false);
    });

    it("returns matched false for unknown anchor", () => {
      const canonical = "Unknown.field gte 18";
      const tokens = createTokens(["Unknown.field", "gte", "18"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      // Unknown anchor without type info - should try pattern anyway
      // but may not match if strict type checking is enabled
      expect(result.matched).toBe(false);
    });
  });

  describe("Range Pattern", () => {
    const typeIndex = createTypeIndex({
      "User.age": { baseKind: "number" },
      "User.score": { baseKind: "number" },
    });

    it("matches 'age between 18 and 65'", () => {
      const canonical = "User.age between 18 and 65";
      const tokens = createTokens(["User.age", "between", "18", "and", "65"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe("range");
      expect(result.confidence).toBe(1.0);
    });

    it("rejects when min > max", () => {
      const canonical = "User.age between 65 and 18";
      const tokens = createTokens(["User.age", "between", "65", "and", "18"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      // Invalid range - should not match
      expect(result.matched).toBe(false);
    });

    it("applies only to number types", () => {
      const stringTypeIndex = createTypeIndex({
        "User.name": { baseKind: "string" },
      });

      const canonical = "User.name between 18 and 65";
      const tokens = createTokens(["User.name", "between", "18", "and", "65"]);

      const result = matchFastPath(canonical, tokens, stringTypeIndex);

      expect(result.matched).toBe(false);
    });
  });

  describe("Length Pattern", () => {
    const typeIndex = createTypeIndex({
      "User.password": { baseKind: "string" },
      "Order.items": { baseKind: "array" },
      "User.age": { baseKind: "number" },
    });

    it("matches 'password minLen 8' for string types", () => {
      const canonical = "User.password minLen 8";
      const tokens = createTokens(["User.password", "minLen", "8"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe("length");
      expect(result.confidence).toBe(1.0);
    });

    it("matches 'items maxLen 100' for array types", () => {
      const canonical = "Order.items maxLen 100";
      const tokens = createTokens(["Order.items", "maxLen", "100"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe("length");
    });

    it("rejects length constraint on number types", () => {
      const canonical = "User.age minLen 8";
      const tokens = createTokens(["User.age", "minLen", "8"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(false);
    });
  });

  describe("Inclusion Pattern", () => {
    const typeIndex = createTypeIndex({
      "Order.status": { baseKind: "string" },
      "User.role": { baseKind: "string" },
    });

    it("matches 'status in [pending, active, done]'", () => {
      const canonical = "Order.status in [pending, active, done]";
      const tokens = createTokens(["Order.status", "in", "[pending,", "active,", "done]"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe("inclusion");
      expect(result.confidence).toBe(1.0);
    });

    it("matches 'status notIn [deleted]'", () => {
      const canonical = "Order.status notIn [deleted]";
      const tokens = createTokens(["Order.status", "notIn", "[deleted]"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe("inclusion");
    });

    it("applies to any type", () => {
      const numberTypeIndex = createTypeIndex({
        "User.level": { baseKind: "number" },
      });

      const canonical = "User.level in [1, 2, 3]";
      const tokens = createTokens(["User.level", "in", "[1,", "2,", "3]"]);

      const result = matchFastPath(canonical, tokens, numberTypeIndex);

      expect(result.matched).toBe(true);
    });
  });

  describe("Required Pattern", () => {
    const typeIndex = createTypeIndex({
      "User.email": { baseKind: "string", nullable: true },
      "User.nickname": { baseKind: "string", nullable: true },
    });

    it("matches 'email required'", () => {
      const canonical = "User.email required";
      const tokens = createTokens(["User.email", "required"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe("required");
      expect(result.confidence).toBe(1.0);
    });

    it("matches 'nickname optional'", () => {
      const canonical = "User.nickname optional";
      const tokens = createTokens(["User.nickname", "optional"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe("required");
    });

    it("applies to any type", () => {
      const numberTypeIndex = createTypeIndex({
        "User.age": { baseKind: "number", nullable: true },
      });

      const canonical = "User.age required";
      const tokens = createTokens(["User.age", "required"]);

      const result = matchFastPath(canonical, tokens, numberTypeIndex);

      expect(result.matched).toBe(true);
    });
  });

  describe("Boolean Pattern", () => {
    const typeIndex = createTypeIndex({
      "User.isActive": { baseKind: "boolean" },
      "User.isDeleted": { baseKind: "boolean" },
      "User.name": { baseKind: "string" },
    });

    it("matches 'isActive must be true'", () => {
      const canonical = "User.isActive must be true";
      const tokens = createTokens(["User.isActive", "must", "be", "true"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe("boolean");
      expect(result.confidence).toBe(1.0);
    });

    it("matches 'isDeleted must be false'", () => {
      const canonical = "User.isDeleted must be false";
      const tokens = createTokens(["User.isDeleted", "must", "be", "false"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(true);
      expect(result.pattern).toBe("boolean");
    });

    it("rejects on non-boolean types", () => {
      const canonical = "User.name must be true";
      const tokens = createTokens(["User.name", "must", "be", "true"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.matched).toBe(false);
    });
  });

  describe("Pattern Selection by Type", () => {
    it("selects comparator/range for number baseKind", () => {
      const typeIndex = createTypeIndex({ "User.age": { baseKind: "number" } });

      // Comparator should match
      const result1 = matchFastPath("User.age gte 18", createTokens(["User.age", "gte", "18"]), typeIndex);
      expect(result1.matched).toBe(true);

      // Range should match
      const result2 = matchFastPath("User.age between 1 and 100", createTokens(["User.age", "between", "1", "and", "100"]), typeIndex);
      expect(result2.matched).toBe(true);
    });

    it("selects length for string/array baseKind", () => {
      const typeIndex = createTypeIndex({
        "User.password": { baseKind: "string" },
        "Order.items": { baseKind: "array" },
      });

      const result1 = matchFastPath("User.password minLen 8", createTokens(["User.password", "minLen", "8"]), typeIndex);
      expect(result1.matched).toBe(true);

      const result2 = matchFastPath("Order.items maxLen 10", createTokens(["Order.items", "maxLen", "10"]), typeIndex);
      expect(result2.matched).toBe(true);
    });

    it("selects boolean for boolean baseKind", () => {
      const typeIndex = createTypeIndex({ "User.isActive": { baseKind: "boolean" } });

      const result = matchFastPath("User.isActive must be true", createTokens(["User.isActive", "must", "be", "true"]), typeIndex);
      expect(result.matched).toBe(true);
    });
  });

  describe("Fragment Generation", () => {
    const typeIndex = createTypeIndex({
      "User.age": { baseKind: "number" },
    });

    it("generates valid PatchFragment for constraint", () => {
      const canonical = "User.age gte 18";
      const tokens = createTokens(["User.age", "gte", "18"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      expect(result.fragment).toBeDefined();
      expect(result.fragment?.id).toBeTruthy();
      expect(result.fragment?.description).toBeTruthy();
      expect(result.fragment?.changes[0].kind).toBe("constraint");
      expect(result.fragment?.metadata?.confidence).toBe(1.0);
    });

    it("generates constraint change with correct path", () => {
      const canonical = "User.age gte 18";
      const tokens = createTokens(["User.age", "gte", "18"]);

      const result = matchFastPath(canonical, tokens, typeIndex);

      const change = result.fragment?.changes[0];
      if (change?.kind === "constraint") {
        expect(change.path).toBe("User.age");
      }
    });
  });
});
