/**
 * Expression Validation Tests
 *
 * TDD: Tests written first, implementation follows
 */

import { describe, it, expect } from "vitest";
import {
  validateExpression,
  type ValidationContext,
  type ExpressionValidationResult,
} from "./expression-validation";

// Helper to create context with defaults
function createContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    availablePaths: ["data.foo", "data.bar", "data.price", "data.quantity", "derived.total"],
    ...overrides,
  };
}

describe("expression-validation.ts - Expression Validation", () => {
  describe("literals", () => {
    it("should accept null literal", () => {
      const result = validateExpression(null, createContext());
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("should accept string literal", () => {
      const result = validateExpression("hello", createContext());
      expect(result.valid).toBe(true);
    });

    it("should accept number literal", () => {
      const result = validateExpression(42, createContext());
      expect(result.valid).toBe(true);
    });

    it("should accept boolean literal", () => {
      const result = validateExpression(true, createContext());
      expect(result.valid).toBe(true);
    });
  });

  describe("unknown operator", () => {
    it("should detect unknown operator", () => {
      const result = validateExpression(["unknownOp", 1, 2], createContext());

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNKNOWN_OPERATOR",
          message: expect.stringContaining("unknownOp"),
          path: [],
        })
      );
    });

    it("should provide severity error for unknown operator", () => {
      const result = validateExpression(["badOp"], createContext());

      expect(result.issues[0].severity).toBe("error");
    });

    it("should detect unknown operator in nested expression", () => {
      const result = validateExpression(
        ["+", ["unknownOp", 1], 2],
        createContext()
      );

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNKNOWN_OPERATOR",
          path: [1], // nested at index 1
        })
      );
    });
  });

  describe("arity mismatch", () => {
    it("should detect too few arguments for fixed arity operator", () => {
      // "!" (not) expects 1 argument
      const result = validateExpression(["!"], createContext());

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "ARITY_MISMATCH",
          message: expect.stringContaining("1"),
        })
      );
    });

    it("should detect too many arguments for fixed arity operator", () => {
      // "!" (not) expects 1 argument
      const result = validateExpression(["!", true, false], createContext());

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "ARITY_MISMATCH",
        })
      );
    });

    it("should accept correct arity for binary operator", () => {
      const result = validateExpression(["+", 1, 2], createContext());
      expect(result.valid).toBe(true);
    });

    it("should accept zero-arity operator", () => {
      // "now" takes no arguments
      const result = validateExpression(["now"], createContext());
      expect(result.valid).toBe(true);
    });

    it("should detect arity mismatch for ternary operator", () => {
      // "slice" expects 3 arguments: text, start, end
      const result = validateExpression(["slice", "hello", 0], createContext());

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "ARITY_MISMATCH",
          message: expect.stringContaining("3"),
        })
      );
    });

    it("should accept variadic operator with minimum args", () => {
      // "all" is variadic with minArgs: 1
      const result = validateExpression(["all", true], createContext());
      expect(result.valid).toBe(true);
    });

    it("should accept variadic operator with multiple args", () => {
      // "concat" is variadic with minArgs: 2
      const result = validateExpression(["concat", "a", "b", "c"], createContext());
      expect(result.valid).toBe(true);
    });

    it("should detect too few args for variadic operator", () => {
      // "concat" requires minArgs: 2
      const result = validateExpression(["concat", "a"], createContext());

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "ARITY_MISMATCH",
          message: expect.stringContaining("2"),
        })
      );
    });
  });

  describe("undefined path", () => {
    it("should detect undefined path in get expression", () => {
      const result = validateExpression(
        ["get", "data.nonexistent"],
        createContext({ availablePaths: ["data.foo", "data.bar"] })
      );

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNDEFINED_PATH",
          message: expect.stringContaining("data.nonexistent"),
          path: [],
        })
      );
    });

    it("should accept defined path", () => {
      const result = validateExpression(
        ["get", "data.foo"],
        createContext({ availablePaths: ["data.foo", "data.bar"] })
      );

      expect(result.valid).toBe(true);
    });

    it("should detect undefined path in nested expression", () => {
      const result = validateExpression(
        ["+", ["get", "data.missing"], 10],
        createContext({ availablePaths: ["data.foo"] })
      );

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNDEFINED_PATH",
          path: [1], // nested at argument index 1
        })
      );
    });

    it("should accept context variables ($, $index, $acc)", () => {
      const result = validateExpression(
        ["get", "$"],
        createContext()
      );

      expect(result.valid).toBe(true);
    });

    it("should accept $index context variable", () => {
      const result = validateExpression(
        ["get", "$index"],
        createContext()
      );

      expect(result.valid).toBe(true);
    });

    it("should accept $acc context variable", () => {
      const result = validateExpression(
        ["get", "$acc"],
        createContext()
      );

      expect(result.valid).toBe(true);
    });

    it("should accept nested context variable paths ($.field)", () => {
      const result = validateExpression(
        ["get", "$.name"],
        createContext()
      );

      expect(result.valid).toBe(true);
    });
  });

  describe("nested expressions", () => {
    it("should validate deeply nested expressions", () => {
      const result = validateExpression(
        ["+", ["*", ["get", "data.price"], ["get", "data.quantity"]], 10],
        createContext()
      );

      expect(result.valid).toBe(true);
    });

    it("should collect all errors in nested expressions", () => {
      const result = validateExpression(
        ["+", ["unknownOp", 1], ["get", "data.missing"]],
        createContext({ availablePaths: ["data.foo"] })
      );

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);

      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain("UNKNOWN_OPERATOR");
      expect(codes).toContain("UNDEFINED_PATH");
    });

    it("should report correct path for deeply nested errors", () => {
      const result = validateExpression(
        ["case", true, ["+", ["unknownOp"], 1], "default"],
        createContext()
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNKNOWN_OPERATOR",
          path: [2, 1], // case[2] = then, then[1] = first arg of +
        })
      );
    });
  });

  describe("complex expressions", () => {
    it("should validate map expression with context variable", () => {
      const result = validateExpression(
        ["map", ["get", "data.foo"], ["get", "$.name"]],
        createContext()
      );

      expect(result.valid).toBe(true);
    });

    it("should validate filter expression", () => {
      const result = validateExpression(
        ["filter", ["get", "data.foo"], [">", ["get", "$"], 10]],
        createContext()
      );

      expect(result.valid).toBe(true);
    });

    it("should validate reduce expression with accumulator", () => {
      const result = validateExpression(
        ["reduce", ["get", "data.foo"], ["+", ["get", "$acc"], ["get", "$"]], 0],
        createContext()
      );

      expect(result.valid).toBe(true);
    });

    it("should validate case expression", () => {
      const result = validateExpression(
        ["case", [">", ["get", "data.price"], 100], "expensive", "cheap"],
        createContext()
      );

      expect(result.valid).toBe(true);
    });

    it("should validate match expression", () => {
      const result = validateExpression(
        ["match", ["get", "data.foo"], "a", 1, "b", 2, "default"],
        createContext()
      );

      expect(result.valid).toBe(true);
    });
  });

  describe("special operators", () => {
    it("should accept case with 3 arguments (condition, then, else)", () => {
      const result = validateExpression(
        ["case", true, "yes", "no"],
        createContext()
      );

      expect(result.valid).toBe(true);
    });

    it("should accept match with odd number of args (target + pairs + default)", () => {
      const result = validateExpression(
        ["match", "x", "a", 1, "b", 2, "default"],
        createContext()
      );

      expect(result.valid).toBe(true);
    });

    it("should detect case with wrong number of arguments", () => {
      // case requires exactly 3 args: condition, then, else
      const result = validateExpression(
        ["case", true, "yes"],
        createContext()
      );

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "ARITY_MISMATCH",
        })
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty array as invalid", () => {
      const result = validateExpression([], createContext());

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "INVALID_EXPRESSION",
        })
      );
    });

    it("should handle array with non-string first element as invalid", () => {
      const result = validateExpression([123, "foo"], createContext());

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "INVALID_EXPRESSION",
        })
      );
    });

    it("should handle object as invalid", () => {
      const result = validateExpression({ foo: "bar" }, createContext());

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "INVALID_EXPRESSION",
        })
      );
    });

    it("should handle undefined as invalid", () => {
      const result = validateExpression(undefined, createContext());

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "INVALID_EXPRESSION",
        })
      );
    });
  });

  describe("result structure", () => {
    it("should return valid: true when no errors", () => {
      const result = validateExpression(["+", 1, 2], createContext());

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("should include severity in all issues", () => {
      const result = validateExpression(["unknownOp"], createContext());

      for (const issue of result.issues) {
        expect(issue.severity).toMatch(/^(error|warning)$/);
      }
    });

    it("should include path in all issues", () => {
      const result = validateExpression(["unknownOp"], createContext());

      for (const issue of result.issues) {
        expect(Array.isArray(issue.path)).toBe(true);
      }
    });
  });
});
