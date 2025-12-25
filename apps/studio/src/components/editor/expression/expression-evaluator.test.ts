/**
 * Expression Evaluator Tests
 *
 * Tests for evaluating Expression DSL expressions.
 * TDD: Tests written first, implementation follows.
 */

import { describe, it, expect } from "vitest";
import { evaluateExpression, type EvaluationContext } from "./expression-evaluator";

// Helper to create context
function createContext(values: Record<string, unknown> = {}): EvaluationContext {
  return { values };
}

describe("expression-evaluator.ts - Expression Evaluation", () => {
  describe("literals", () => {
    it("should return null literal as-is", () => {
      const result = evaluateExpression(null, createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe(null);
    });

    it("should return string literal as-is", () => {
      const result = evaluateExpression("hello", createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe("hello");
    });

    it("should return number literal as-is", () => {
      const result = evaluateExpression(42, createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it("should return boolean literal as-is", () => {
      const result = evaluateExpression(true, createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe("get operator", () => {
    it("should get value from context", () => {
      const result = evaluateExpression(
        ["get", "data.name"],
        createContext({ "data.name": "Alice" })
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe("Alice");
    });

    it("should return null for missing path", () => {
      const result = evaluateExpression(
        ["get", "data.missing"],
        createContext({ "data.foo": "bar" })
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe(null);
    });

    it("should get nested path", () => {
      const result = evaluateExpression(
        ["get", "derived.total"],
        createContext({ "derived.total": 100 })
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe(100);
    });
  });

  describe("arithmetic operators", () => {
    it("should add two numbers", () => {
      const result = evaluateExpression(["+", 1, 2], createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe(3);
    });

    it("should subtract two numbers", () => {
      const result = evaluateExpression(["-", 10, 3], createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe(7);
    });

    it("should multiply two numbers", () => {
      const result = evaluateExpression(["*", 4, 5], createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe(20);
    });

    it("should divide two numbers", () => {
      const result = evaluateExpression(["/", 20, 4], createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe(5);
    });

    it("should calculate modulo", () => {
      const result = evaluateExpression(["%", 10, 3], createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe(1);
    });

    it("should work with nested expressions", () => {
      const result = evaluateExpression(
        ["+", ["*", 2, 3], ["get", "data.x"]],
        createContext({ "data.x": 4 })
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe(10);
    });
  });

  describe("comparison operators", () => {
    it("should compare equality", () => {
      expect(evaluateExpression(["==", 5, 5], createContext()).value).toBe(true);
      expect(evaluateExpression(["==", 5, 3], createContext()).value).toBe(false);
      expect(evaluateExpression(["==", "a", "a"], createContext()).value).toBe(true);
    });

    it("should compare inequality", () => {
      expect(evaluateExpression(["!=", 5, 3], createContext()).value).toBe(true);
      expect(evaluateExpression(["!=", 5, 5], createContext()).value).toBe(false);
    });

    it("should compare greater than", () => {
      expect(evaluateExpression([">", 5, 3], createContext()).value).toBe(true);
      expect(evaluateExpression([">", 3, 5], createContext()).value).toBe(false);
    });

    it("should compare greater or equal", () => {
      expect(evaluateExpression([">=", 5, 5], createContext()).value).toBe(true);
      expect(evaluateExpression([">=", 5, 3], createContext()).value).toBe(true);
      expect(evaluateExpression([">=", 3, 5], createContext()).value).toBe(false);
    });

    it("should compare less than", () => {
      expect(evaluateExpression(["<", 3, 5], createContext()).value).toBe(true);
      expect(evaluateExpression(["<", 5, 3], createContext()).value).toBe(false);
    });

    it("should compare less or equal", () => {
      expect(evaluateExpression(["<=", 5, 5], createContext()).value).toBe(true);
      expect(evaluateExpression(["<=", 3, 5], createContext()).value).toBe(true);
      expect(evaluateExpression(["<=", 5, 3], createContext()).value).toBe(false);
    });
  });

  describe("logic operators", () => {
    it("should negate boolean", () => {
      expect(evaluateExpression(["!", true], createContext()).value).toBe(false);
      expect(evaluateExpression(["!", false], createContext()).value).toBe(true);
    });

    it("should evaluate all (AND)", () => {
      expect(evaluateExpression(["all", true, true], createContext()).value).toBe(true);
      expect(evaluateExpression(["all", true, false], createContext()).value).toBe(false);
      expect(evaluateExpression(["all", true, true, true], createContext()).value).toBe(true);
    });

    it("should evaluate any (OR)", () => {
      expect(evaluateExpression(["any", false, true], createContext()).value).toBe(true);
      expect(evaluateExpression(["any", false, false], createContext()).value).toBe(false);
      expect(evaluateExpression(["any", false, false, true], createContext()).value).toBe(true);
    });
  });

  describe("string operators", () => {
    it("should concatenate strings", () => {
      const result = evaluateExpression(["concat", "Hello", " ", "World"], createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe("Hello World");
    });

    it("should convert to uppercase", () => {
      const result = evaluateExpression(["upper", "hello"], createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe("HELLO");
    });

    it("should convert to lowercase", () => {
      const result = evaluateExpression(["lower", "HELLO"], createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe("hello");
    });

    it("should trim whitespace", () => {
      const result = evaluateExpression(["trim", "  hello  "], createContext());
      expect(result.success).toBe(true);
      expect(result.value).toBe("hello");
    });

    it("should get length", () => {
      expect(evaluateExpression(["length", "hello"], createContext()).value).toBe(5);
      expect(evaluateExpression(["length", [1, 2, 3]], createContext()).value).toBe(3);
    });
  });

  describe("conditional operators", () => {
    it("should evaluate case (if-else)", () => {
      const result1 = evaluateExpression(["case", true, "yes", "no"], createContext());
      expect(result1.value).toBe("yes");

      const result2 = evaluateExpression(["case", false, "yes", "no"], createContext());
      expect(result2.value).toBe("no");
    });

    it("should evaluate case with expression condition", () => {
      const result = evaluateExpression(
        ["case", [">", ["get", "data.x"], 10], "big", "small"],
        createContext({ "data.x": 15 })
      );
      expect(result.value).toBe("big");
    });

    it("should evaluate coalesce (first non-null)", () => {
      const result = evaluateExpression(
        ["coalesce", null, null, "default"],
        createContext()
      );
      expect(result.value).toBe("default");
    });

    it("should return first non-null in coalesce", () => {
      const result = evaluateExpression(
        ["coalesce", null, "found", "default"],
        createContext()
      );
      expect(result.value).toBe("found");
    });
  });

  describe("type operators", () => {
    it("should check isNull", () => {
      expect(evaluateExpression(["isNull", null], createContext()).value).toBe(true);
      expect(evaluateExpression(["isNull", "text"], createContext()).value).toBe(false);
    });

    it("should check isNumber", () => {
      expect(evaluateExpression(["isNumber", 42], createContext()).value).toBe(true);
      expect(evaluateExpression(["isNumber", "42"], createContext()).value).toBe(false);
    });

    it("should check isString", () => {
      expect(evaluateExpression(["isString", "text"], createContext()).value).toBe(true);
      expect(evaluateExpression(["isString", 42], createContext()).value).toBe(false);
    });

    it("should check isArray", () => {
      expect(evaluateExpression(["isArray", [1, 2]], createContext()).value).toBe(true);
      expect(evaluateExpression(["isArray", "text"], createContext()).value).toBe(false);
    });

    it("should convert toNumber", () => {
      expect(evaluateExpression(["toNumber", "42"], createContext()).value).toBe(42);
      expect(evaluateExpression(["toNumber", "3.14"], createContext()).value).toBe(3.14);
    });

    it("should convert toString", () => {
      expect(evaluateExpression(["toString", 42], createContext()).value).toBe("42");
    });
  });

  describe("number operators", () => {
    it("should calculate sum", () => {
      const result = evaluateExpression(["sum", [1, 2, 3, 4]], createContext());
      expect(result.value).toBe(10);
    });

    it("should find min", () => {
      const result = evaluateExpression(["min", [5, 2, 8, 1]], createContext());
      expect(result.value).toBe(1);
    });

    it("should find max", () => {
      const result = evaluateExpression(["max", [5, 2, 8, 1]], createContext());
      expect(result.value).toBe(8);
    });

    it("should calculate average", () => {
      const result = evaluateExpression(["avg", [2, 4, 6]], createContext());
      expect(result.value).toBe(4);
    });

    it("should round number", () => {
      expect(evaluateExpression(["round", 3.7], createContext()).value).toBe(4);
      expect(evaluateExpression(["round", 3.2], createContext()).value).toBe(3);
    });

    it("should floor number", () => {
      expect(evaluateExpression(["floor", 3.9], createContext()).value).toBe(3);
    });

    it("should ceil number", () => {
      expect(evaluateExpression(["ceil", 3.1], createContext()).value).toBe(4);
    });

    it("should get absolute value", () => {
      expect(evaluateExpression(["abs", -5], createContext()).value).toBe(5);
      expect(evaluateExpression(["abs", 5], createContext()).value).toBe(5);
    });
  });

  describe("array operators", () => {
    it("should get element at index", () => {
      const result = evaluateExpression(["at", [10, 20, 30], 1], createContext());
      expect(result.value).toBe(20);
    });

    it("should get first element", () => {
      const result = evaluateExpression(["first", [10, 20, 30]], createContext());
      expect(result.value).toBe(10);
    });

    it("should get last element", () => {
      const result = evaluateExpression(["last", [10, 20, 30]], createContext());
      expect(result.value).toBe(30);
    });

    it("should check includes", () => {
      expect(evaluateExpression(["includes", [1, 2, 3], 2], createContext()).value).toBe(true);
      expect(evaluateExpression(["includes", [1, 2, 3], 5], createContext()).value).toBe(false);
    });

    it("should reverse array", () => {
      const result = evaluateExpression(["reverse", [1, 2, 3]], createContext());
      expect(result.value).toEqual([3, 2, 1]);
    });
  });

  describe("error handling", () => {
    it("should return error for unknown operator", () => {
      const result = evaluateExpression(["unknownOp", 1, 2], createContext());
      expect(result.success).toBe(false);
      expect(result.error).toContain("unknownOp");
    });

    it("should return error for invalid expression structure", () => {
      const result = evaluateExpression({}, createContext());
      expect(result.success).toBe(false);
    });
  });

  describe("complex expressions", () => {
    it("should evaluate nested arithmetic with context", () => {
      const result = evaluateExpression(
        ["*", ["+", ["get", "data.price"], 10], ["get", "data.quantity"]],
        createContext({
          "data.price": 90,
          "data.quantity": 2,
        })
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe(200);
    });

    it("should evaluate conditional based on comparison", () => {
      const expr = [
        "case",
        [">=", ["get", "data.score"], 90],
        "A",
        "B",
      ];

      const result1 = evaluateExpression(expr, createContext({ "data.score": 95 }));
      expect(result1.value).toBe("A");

      const result2 = evaluateExpression(expr, createContext({ "data.score": 85 }));
      expect(result2.value).toBe("B");
    });
  });
});
