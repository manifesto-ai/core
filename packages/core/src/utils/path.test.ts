import { describe, it, expect } from "vitest";
import {
  parsePath,
  joinPath,
  getByPath,
  setByPath,
  unsetByPath,
  mergeAtPath,
  hasPath,
  parentPath,
  lastSegment,
} from "./path.js";

describe("Path Utilities", () => {
  describe("parsePath", () => {
    it("should parse dot-separated path", () => {
      expect(parsePath("a.b.c")).toEqual(["a", "b", "c"]);
    });

    it("should return single segment for simple path", () => {
      expect(parsePath("name")).toEqual(["name"]);
    });

    it("should return empty array for empty path", () => {
      expect(parsePath("")).toEqual([]);
    });
  });

  describe("joinPath", () => {
    it("should join segments with dots", () => {
      expect(joinPath("a", "b", "c")).toBe("a.b.c");
    });

    it("should filter empty segments", () => {
      expect(joinPath("a", "", "b")).toBe("a.b");
    });

    it("should handle single segment", () => {
      expect(joinPath("a")).toBe("a");
    });
  });

  describe("getByPath", () => {
    it("should get value at path", () => {
      const obj = { a: { b: { c: 42 } } };
      expect(getByPath(obj, "a.b.c")).toBe(42);
    });

    it("should get nested object", () => {
      const obj = { a: { b: { c: 42 } } };
      expect(getByPath(obj, "a.b")).toEqual({ c: 42 });
    });

    it("should return undefined for non-existent path", () => {
      const obj = { a: { b: 1 } };
      expect(getByPath(obj, "a.c")).toBeUndefined();
    });

    it("should return undefined for path through non-object", () => {
      const obj = { a: 1 };
      expect(getByPath(obj, "a.b")).toBeUndefined();
    });

    it("should return object for empty path", () => {
      const obj = { a: 1 };
      expect(getByPath(obj, "")).toEqual({ a: 1 });
    });

    it("should handle null values", () => {
      const obj = { a: null };
      expect(getByPath(obj, "a")).toBeNull();
      expect(getByPath(obj, "a.b")).toBeUndefined();
    });

    it("should get array elements", () => {
      const obj = { items: [1, 2, 3] };
      expect(getByPath(obj, "items")).toEqual([1, 2, 3]);
    });
  });

  describe("setByPath", () => {
    it("should set value at path", () => {
      const obj = { a: { b: 1 } };
      const result = setByPath(obj, "a.b", 2);
      expect(result).toEqual({ a: { b: 2 } });
    });

    it("should not mutate original object", () => {
      const obj = { a: { b: 1 } };
      setByPath(obj, "a.b", 2);
      expect(obj).toEqual({ a: { b: 1 } });
    });

    it("should create intermediate objects", () => {
      const obj = {};
      const result = setByPath(obj, "a.b.c", 42);
      expect(result).toEqual({ a: { b: { c: 42 } } });
    });

    it("should replace non-object with object when needed", () => {
      const obj = { a: 1 };
      const result = setByPath(obj, "a.b", 2);
      expect(result).toEqual({ a: { b: 2 } });
    });

    it("should replace root for empty path", () => {
      const obj = { a: 1 };
      const result = setByPath(obj, "", "new");
      expect(result).toBe("new");
    });

    it("should preserve other keys", () => {
      const obj = { a: 1, b: { c: 2, d: 3 } };
      const result = setByPath(obj, "b.c", 10);
      expect(result).toEqual({ a: 1, b: { c: 10, d: 3 } });
    });
  });

  describe("unsetByPath", () => {
    it("should remove value at path", () => {
      const obj = { a: 1, b: 2 };
      const result = unsetByPath(obj, "a");
      expect(result).toEqual({ b: 2 });
    });

    it("should not mutate original object", () => {
      const obj = { a: 1, b: 2 };
      unsetByPath(obj, "a");
      expect(obj).toEqual({ a: 1, b: 2 });
    });

    it("should remove nested value", () => {
      const obj = { a: { b: 1, c: 2 } };
      const result = unsetByPath(obj, "a.b");
      expect(result).toEqual({ a: { c: 2 } });
    });

    it("should return undefined for empty path", () => {
      const obj = { a: 1 };
      const result = unsetByPath(obj, "");
      expect(result).toBeUndefined();
    });

    it("should handle non-existent path gracefully", () => {
      const obj = { a: 1 };
      const result = unsetByPath(obj, "b.c");
      expect(result).toEqual({ a: 1 });
    });
  });

  describe("mergeAtPath", () => {
    it("should merge objects at path", () => {
      const obj = { a: { b: 1, c: 2 } };
      const result = mergeAtPath(obj, "a", { c: 3, d: 4 });
      expect(result).toEqual({ a: { b: 1, c: 3, d: 4 } });
    });

    it("should not mutate original object", () => {
      const obj = { a: { b: 1 } };
      mergeAtPath(obj, "a", { c: 2 });
      expect(obj).toEqual({ a: { b: 1 } });
    });

    it("should create path if it does not exist", () => {
      const obj = {};
      const result = mergeAtPath(obj, "a", { b: 1 });
      expect(result).toEqual({ a: { b: 1 } });
    });

    it("should replace non-object with merged value", () => {
      const obj = { a: 1 };
      const result = mergeAtPath(obj, "a", { b: 2 });
      expect(result).toEqual({ a: { b: 2 } });
    });

    it("should merge at root for empty path", () => {
      const obj = { a: 1 };
      const result = mergeAtPath(obj, "", { b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe("hasPath", () => {
    it("should return true for existing path", () => {
      const obj = { a: { b: 1 } };
      expect(hasPath(obj, "a.b")).toBe(true);
    });

    it("should return true for path to null value", () => {
      const obj = { a: null };
      expect(hasPath(obj, "a")).toBe(true);
    });

    it("should return false for non-existent path", () => {
      const obj = { a: { b: 1 } };
      expect(hasPath(obj, "a.c")).toBe(false);
    });

    it("should return false for path through non-object", () => {
      const obj = { a: 1 };
      expect(hasPath(obj, "a.b")).toBe(false);
    });

    it("should return true for empty path if object exists", () => {
      const obj = { a: 1 };
      expect(hasPath(obj, "")).toBe(true);
    });

    it("should return false for undefined value", () => {
      expect(hasPath(undefined, "")).toBe(false);
    });
  });

  describe("parentPath", () => {
    it("should return parent path", () => {
      expect(parentPath("a.b.c")).toBe("a.b");
    });

    it("should return empty string for single segment", () => {
      expect(parentPath("a")).toBe("");
    });

    it("should return empty string for empty path", () => {
      expect(parentPath("")).toBe("");
    });
  });

  describe("lastSegment", () => {
    it("should return last segment", () => {
      expect(lastSegment("a.b.c")).toBe("c");
    });

    it("should return segment for single segment path", () => {
      expect(lastSegment("a")).toBe("a");
    });

    it("should return empty string for empty path", () => {
      expect(lastSegment("")).toBe("");
    });
  });
});
