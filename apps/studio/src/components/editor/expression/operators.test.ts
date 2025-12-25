import { describe, it, expect } from "vitest";
import {
  OPERATORS,
  OPERATOR_GROUPS,
  CATEGORY_NAMES,
  CATEGORY_COLORS,
  getOperatorMeta,
  createDefaultExpr,
} from "./operators";
import type { OperatorCategory } from "./types";

describe("operators.ts - Operator Metadata", () => {
  describe("OPERATORS structure", () => {
    it("should have required fields for all operators", () => {
      for (const [op, meta] of Object.entries(OPERATORS)) {
        expect(meta.name).toBeDefined();
        expect(meta.category).toBeDefined();
        expect(meta.arity).toBeDefined();
        expect(meta.description).toBeDefined();
        expect(meta.example).toBeDefined();
      }
    });

    it("should have valid arity values", () => {
      for (const [op, meta] of Object.entries(OPERATORS)) {
        expect(
          typeof meta.arity === "number" ||
            meta.arity === "variadic" ||
            meta.arity === "special"
        ).toBe(true);
      }
    });

    it("should have minArgs for variadic operators", () => {
      for (const [op, meta] of Object.entries(OPERATORS)) {
        if (meta.arity === "variadic") {
          expect(meta.minArgs).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it("should have argLabels matching arity for fixed-arity operators", () => {
      for (const [op, meta] of Object.entries(OPERATORS)) {
        if (typeof meta.arity === "number" && meta.arity > 0 && meta.argLabels) {
          expect(meta.argLabels.length).toBe(meta.arity);
        }
      }
    });
  });

  describe("OPERATOR_GROUPS consistency", () => {
    it("should include all operators from OPERATORS", () => {
      const allGroupedOps = Object.values(OPERATOR_GROUPS).flat();
      const allOps = Object.keys(OPERATORS);

      for (const op of allOps) {
        expect(allGroupedOps).toContain(op);
      }
    });

    it("should not have duplicate operators across groups", () => {
      const allGroupedOps = Object.values(OPERATOR_GROUPS).flat();
      const uniqueOps = new Set(allGroupedOps);
      expect(uniqueOps.size).toBe(allGroupedOps.length);
    });

    it("should have operators in correct category", () => {
      for (const [category, ops] of Object.entries(OPERATOR_GROUPS)) {
        for (const op of ops) {
          const meta = OPERATORS[op];
          expect(meta?.category).toBe(category);
        }
      }
    });
  });

  describe("CATEGORY_NAMES", () => {
    it("should have names for all categories", () => {
      const categories = Object.keys(OPERATOR_GROUPS) as OperatorCategory[];
      for (const category of categories) {
        expect(CATEGORY_NAMES[category]).toBeDefined();
        expect(typeof CATEGORY_NAMES[category]).toBe("string");
      }
    });
  });

  describe("CATEGORY_COLORS", () => {
    it("should have colors for all categories", () => {
      const categories = Object.keys(OPERATOR_GROUPS) as OperatorCategory[];
      for (const category of categories) {
        expect(CATEGORY_COLORS[category]).toBeDefined();
        expect(CATEGORY_COLORS[category]).toMatch(/^text-/);
      }
    });
  });

  describe("getOperatorMeta", () => {
    it("should return metadata for valid operators", () => {
      expect(getOperatorMeta("get")).toEqual(OPERATORS.get);
      expect(getOperatorMeta("==")).toEqual(OPERATORS["=="]);
      expect(getOperatorMeta("all")).toEqual(OPERATORS.all);
    });

    it("should return undefined for invalid operators", () => {
      expect(getOperatorMeta("invalid")).toBeUndefined();
      expect(getOperatorMeta("")).toBeUndefined();
      expect(getOperatorMeta("foo")).toBeUndefined();
    });
  });

  describe("createDefaultExpr", () => {
    it("should return null for unknown operators", () => {
      expect(createDefaultExpr("unknown")).toBe(null);
    });

    describe("arity 0 operators", () => {
      it("should create expression with no args", () => {
        expect(createDefaultExpr("now")).toEqual(["now"]);
      });
    });

    describe("arity 1 operators", () => {
      it("should create expression with one null arg", () => {
        expect(createDefaultExpr("!")).toEqual(["!", null]);
        expect(createDefaultExpr("upper")).toEqual(["upper", null]);
        expect(createDefaultExpr("length")).toEqual(["length", null]);
      });
    });

    describe("arity 2 operators", () => {
      it("should create expression with two null args", () => {
        expect(createDefaultExpr("==")).toEqual(["==", null, null]);
        expect(createDefaultExpr("+")).toEqual(["+", null, null]);
        expect(createDefaultExpr("at")).toEqual(["at", null, null]);
      });
    });

    describe("arity 3 operators", () => {
      it("should create expression with three null args", () => {
        expect(createDefaultExpr("slice")).toEqual(["slice", null, null, null]);
        expect(createDefaultExpr("replace")).toEqual(["replace", null, null, null]);
        expect(createDefaultExpr("clamp")).toEqual(["clamp", null, null, null]);
      });
    });

    describe("variadic operators", () => {
      it("should create expression with minArgs null args", () => {
        expect(createDefaultExpr("all")).toEqual(["all", null]); // minArgs: 1
        expect(createDefaultExpr("any")).toEqual(["any", null]); // minArgs: 1
        expect(createDefaultExpr("concat")).toEqual(["concat", null, null]); // minArgs: 2
        expect(createDefaultExpr("coalesce")).toEqual(["coalesce", null, null]); // minArgs: 2
      });
    });

    describe("special arity operators", () => {
      it("should create case expression", () => {
        expect(createDefaultExpr("case")).toEqual(["case", null, null, null]);
      });

      it("should create match expression", () => {
        expect(createDefaultExpr("match")).toEqual(["match", null, null, null, null]);
      });
    });

    describe("get operator", () => {
      it("should create get expression with null path", () => {
        expect(createDefaultExpr("get")).toEqual(["get", null]);
      });
    });
  });

  describe("operator examples", () => {
    it("should have valid example expressions", () => {
      for (const [op, meta] of Object.entries(OPERATORS)) {
        const example = meta.example;

        // Example should be an array starting with the operator
        if (Array.isArray(example)) {
          expect(example[0]).toBe(op);
        } else {
          // For literals in examples (unlikely but possible)
          expect(example).toBeDefined();
        }
      }
    });
  });
});
