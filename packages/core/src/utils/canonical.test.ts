import { describe, it, expect } from "vitest";
import { sortKeys, toCanonical, fromCanonical, canonicalEqual } from "./canonical.js";

describe("Canonical Utilities", () => {
  describe("sortKeys", () => {
    it("should sort object keys alphabetically", () => {
      const obj = { c: 1, a: 2, b: 3 };
      const result = sortKeys(obj);
      expect(Object.keys(result as object)).toEqual(["a", "b", "c"]);
    });

    it("should sort nested object keys", () => {
      const obj = { z: { c: 1, a: 2 }, a: { z: 1, a: 2 } };
      const result = sortKeys(obj) as Record<string, Record<string, number>>;
      expect(Object.keys(result)).toEqual(["a", "z"]);
      expect(Object.keys(result.z)).toEqual(["a", "c"]);
      expect(Object.keys(result.a)).toEqual(["a", "z"]);
    });

    it("should remove undefined values", () => {
      const obj = { a: 1, b: undefined, c: 3 };
      const result = sortKeys(obj);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it("should preserve null values", () => {
      const obj = { a: 1, b: null, c: 3 };
      const result = sortKeys(obj);
      expect(result).toEqual({ a: 1, b: null, c: 3 });
    });

    it("should handle arrays", () => {
      const obj = [{ b: 1, a: 2 }, { d: 3, c: 4 }];
      const result = sortKeys(obj) as Array<Record<string, number>>;
      expect(result).toHaveLength(2);
      expect(Object.keys(result[0])).toEqual(["a", "b"]);
      expect(Object.keys(result[1])).toEqual(["c", "d"]);
    });

    it("should handle arrays inside objects", () => {
      const obj = { items: [{ z: 1, a: 2 }] };
      const result = sortKeys(obj) as { items: Array<Record<string, number>> };
      expect(Object.keys(result.items[0])).toEqual(["a", "z"]);
    });

    it("should return null for null input", () => {
      expect(sortKeys(null)).toBeNull();
    });

    it("should return undefined for undefined input", () => {
      expect(sortKeys(undefined)).toBeUndefined();
    });

    it("should return primitives unchanged", () => {
      expect(sortKeys(42)).toBe(42);
      expect(sortKeys("hello")).toBe("hello");
      expect(sortKeys(true)).toBe(true);
    });
  });

  describe("toCanonical", () => {
    it("should produce sorted JSON string", () => {
      const obj = { c: 1, a: 2, b: 3 };
      expect(toCanonical(obj)).toBe('{"a":2,"b":3,"c":1}');
    });

    it("should produce consistent output for same data", () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 2, a: 1 };
      expect(toCanonical(obj1)).toBe(toCanonical(obj2));
    });

    it("should remove undefined values", () => {
      const obj = { a: 1, b: undefined };
      expect(toCanonical(obj)).toBe('{"a":1}');
    });

    it("should preserve null values", () => {
      const obj = { a: null };
      expect(toCanonical(obj)).toBe('{"a":null}');
    });

    it("should handle nested structures", () => {
      const obj = { z: { b: 1, a: 2 }, a: 3 };
      expect(toCanonical(obj)).toBe('{"a":3,"z":{"a":2,"b":1}}');
    });

    it("should handle arrays", () => {
      const obj = [3, 1, 2];
      expect(toCanonical(obj)).toBe("[3,1,2]"); // Arrays preserve order
    });

    it("should handle primitives", () => {
      expect(toCanonical(42)).toBe("42");
      expect(toCanonical("hello")).toBe('"hello"');
      expect(toCanonical(true)).toBe("true");
      expect(toCanonical(null)).toBe("null");
    });
  });

  describe("fromCanonical", () => {
    it("should parse canonical JSON string", () => {
      const canonical = '{"a":1,"b":2}';
      expect(fromCanonical(canonical)).toEqual({ a: 1, b: 2 });
    });

    it("should handle arrays", () => {
      const canonical = "[1,2,3]";
      expect(fromCanonical(canonical)).toEqual([1, 2, 3]);
    });

    it("should handle primitives", () => {
      expect(fromCanonical("42")).toBe(42);
      expect(fromCanonical('"hello"')).toBe("hello");
      expect(fromCanonical("true")).toBe(true);
      expect(fromCanonical("null")).toBeNull();
    });
  });

  describe("canonicalEqual", () => {
    it("should return true for equal objects with different key order", () => {
      const a = { x: 1, y: 2 };
      const b = { y: 2, x: 1 };
      expect(canonicalEqual(a, b)).toBe(true);
    });

    it("should return false for different objects", () => {
      const a = { x: 1, y: 2 };
      const b = { x: 1, y: 3 };
      expect(canonicalEqual(a, b)).toBe(false);
    });

    it("should treat undefined as missing", () => {
      const a = { x: 1 };
      const b = { x: 1, y: undefined };
      expect(canonicalEqual(a, b)).toBe(true);
    });

    it("should handle nested objects", () => {
      const a = { outer: { b: 1, a: 2 } };
      const b = { outer: { a: 2, b: 1 } };
      expect(canonicalEqual(a, b)).toBe(true);
    });

    it("should distinguish null from undefined", () => {
      const a = { x: null };
      const b = { x: undefined };
      expect(canonicalEqual(a, b)).toBe(false);
    });
  });

  describe("Deterministic Hashing", () => {
    it("should produce same canonical form regardless of property order", () => {
      // Simulate objects created in different orders
      const obj1: Record<string, unknown> = {};
      obj1.alpha = 1;
      obj1.beta = 2;
      obj1.gamma = 3;

      const obj2: Record<string, unknown> = {};
      obj2.gamma = 3;
      obj2.alpha = 1;
      obj2.beta = 2;

      expect(toCanonical(obj1)).toBe(toCanonical(obj2));
    });

    it("should handle deeply nested structures consistently", () => {
      const obj1 = {
        z: { y: { x: { w: 1 } } },
        a: { b: { c: 2 } },
      };

      const obj2 = {
        a: { b: { c: 2 } },
        z: { y: { x: { w: 1 } } },
      };

      expect(toCanonical(obj1)).toBe(toCanonical(obj2));
    });
  });
});
