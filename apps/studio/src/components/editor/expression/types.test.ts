import { describe, it, expect } from "vitest";
import {
  isLiteral,
  isGetExpr,
  isOperatorExpr,
  getOperator,
  getArgs,
} from "./types";

describe("types.ts - Expression Type Helpers", () => {
  describe("isLiteral", () => {
    it("should return true for null", () => {
      expect(isLiteral(null)).toBe(true);
    });

    it("should return true for string", () => {
      expect(isLiteral("hello")).toBe(true);
      expect(isLiteral("")).toBe(true);
    });

    it("should return true for number", () => {
      expect(isLiteral(42)).toBe(true);
      expect(isLiteral(0)).toBe(true);
      expect(isLiteral(-1.5)).toBe(true);
    });

    it("should return true for boolean", () => {
      expect(isLiteral(true)).toBe(true);
      expect(isLiteral(false)).toBe(true);
    });

    it("should return false for undefined", () => {
      expect(isLiteral(undefined)).toBe(false);
    });

    it("should return false for arrays", () => {
      expect(isLiteral([])).toBe(false);
      expect(isLiteral(["get", "data.foo"])).toBe(false);
    });

    it("should return false for objects", () => {
      expect(isLiteral({})).toBe(false);
      expect(isLiteral({ key: "value" })).toBe(false);
    });
  });

  describe("isGetExpr", () => {
    it("should return true for valid get expressions", () => {
      expect(isGetExpr(["get", "data.foo"])).toBe(true);
      expect(isGetExpr(["get", "derived.bar"])).toBe(true);
      expect(isGetExpr(["get", "$"])).toBe(true);
      expect(isGetExpr(["get", "$index"])).toBe(true);
    });

    it("should return false for get with non-string path", () => {
      expect(isGetExpr(["get", 123])).toBe(false);
      expect(isGetExpr(["get", null])).toBe(false);
    });

    it("should return false for get with wrong arity", () => {
      expect(isGetExpr(["get"])).toBe(false);
      expect(isGetExpr(["get", "foo", "bar"])).toBe(false);
    });

    it("should return false for non-get operators", () => {
      expect(isGetExpr(["add", 1, 2])).toBe(false);
      expect(isGetExpr(["eq", "a", "b"])).toBe(false);
    });

    it("should return false for literals", () => {
      expect(isGetExpr("hello")).toBe(false);
      expect(isGetExpr(42)).toBe(false);
      expect(isGetExpr(null)).toBe(false);
    });
  });

  describe("isOperatorExpr", () => {
    it("should return true for operator expressions", () => {
      expect(isOperatorExpr(["get", "data.foo"])).toBe(true);
      expect(isOperatorExpr(["add", 1, 2])).toBe(true);
      expect(isOperatorExpr(["eq", "a", "b"])).toBe(true);
      expect(isOperatorExpr(["if", true, "yes", "no"])).toBe(true);
    });

    it("should return true for operator with no args", () => {
      // Single element array is still a valid operator expression
      expect(isOperatorExpr(["now"])).toBe(true);
    });

    it("should return false for empty array", () => {
      expect(isOperatorExpr([])).toBe(false);
    });

    it("should return false if first element is not string", () => {
      expect(isOperatorExpr([123, "foo"])).toBe(false);
      expect(isOperatorExpr([null, "foo"])).toBe(false);
    });

    it("should return false for non-arrays", () => {
      expect(isOperatorExpr("hello")).toBe(false);
      expect(isOperatorExpr(42)).toBe(false);
      expect(isOperatorExpr(null)).toBe(false);
      expect(isOperatorExpr({})).toBe(false);
    });
  });

  describe("getOperator", () => {
    it("should return operator name for valid expressions", () => {
      expect(getOperator(["get", "data.foo"])).toBe("get");
      expect(getOperator(["add", 1, 2])).toBe("add");
      expect(getOperator(["if", true, "a", "b"])).toBe("if");
    });

    it("should return null for non-operator expressions", () => {
      expect(getOperator("hello")).toBe(null);
      expect(getOperator(42)).toBe(null);
      expect(getOperator(null)).toBe(null);
      expect(getOperator([])).toBe(null);
    });
  });

  describe("getArgs", () => {
    it("should return arguments for operator expressions", () => {
      expect(getArgs(["get", "data.foo"])).toEqual(["data.foo"]);
      expect(getArgs(["add", 1, 2])).toEqual([1, 2]);
      expect(getArgs(["if", true, "yes", "no"])).toEqual([true, "yes", "no"]);
    });

    it("should return empty array for operator with no args", () => {
      expect(getArgs(["now"])).toEqual([]);
    });

    it("should return empty array for non-operator expressions", () => {
      expect(getArgs("hello")).toEqual([]);
      expect(getArgs(42)).toEqual([]);
      expect(getArgs(null)).toEqual([]);
    });

    it("should handle nested expressions in args", () => {
      const nested = ["add", ["get", "data.a"], ["get", "data.b"]];
      expect(getArgs(nested)).toEqual([
        ["get", "data.a"],
        ["get", "data.b"],
      ]);
    });
  });
});
