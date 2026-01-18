/**
 * Utils Tests
 */

import { describe, it, expect } from "vitest";
import {
  canonicalize,
  validateNoDuplicateKeys,
  parseAndCanonicalize,
  computeFragmentId,
  verifyFragmentId,
  generateIntentId,
  generateTraceId,
  deriveTypeIndex,
  getResolvedType,
  hasPath,
  getAllPaths,
} from "../utils/index.js";
import type { DomainSchema } from "../domain/index.js";

describe("canonicalize", () => {
  it("should sort object keys deterministically", () => {
    const obj = { z: 1, a: 2, m: 3 };
    const result = canonicalize(obj);
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it("should handle nested objects", () => {
    const obj = { b: { z: 1, a: 2 }, a: 1 };
    const result = canonicalize(obj);
    expect(result).toBe('{"a":1,"b":{"a":2,"z":1}}');
  });

  it("should handle arrays", () => {
    const obj = { arr: [3, 1, 2] };
    const result = canonicalize(obj);
    expect(result).toBe('{"arr":[3,1,2]}');
  });

  it("should handle null values", () => {
    const obj = { a: null, b: 1 };
    const result = canonicalize(obj);
    expect(result).toBe('{"a":null,"b":1}');
  });

  it("should handle boolean values", () => {
    const obj = { t: true, f: false };
    const result = canonicalize(obj);
    expect(result).toBe('{"f":false,"t":true}');
  });

  it("should produce same output for same input", () => {
    const obj1 = { z: 1, a: 2 };
    const obj2 = { a: 2, z: 1 };
    expect(canonicalize(obj1)).toBe(canonicalize(obj2));
  });
});

describe("validateNoDuplicateKeys", () => {
  it("should return true for valid objects", () => {
    const obj = { a: 1, b: 2 };
    expect(validateNoDuplicateKeys(obj)).toBe(true);
  });

  it("should return true for nested objects", () => {
    const obj = { a: { b: 1 }, c: 2 };
    expect(validateNoDuplicateKeys(obj)).toBe(true);
  });
});

describe("parseAndCanonicalize", () => {
  it("should parse and canonicalize JSON", () => {
    const json = '{"z":1,"a":2}';
    const result = parseAndCanonicalize(json);
    expect(result).toBe('{"a":2,"z":1}');
  });

  it("should throw for invalid JSON", () => {
    const json = "{invalid}";
    expect(() => parseAndCanonicalize(json)).toThrow();
  });
});

describe("fragmentId", () => {
  it("should compute deterministic fragment ID", () => {
    const intentId = "test-intent-123";
    const op = {
      kind: "addField" as const,
      path: "user.email",
      fieldType: { kind: "primitive" as const, name: "string" as const },
    };

    const id1 = computeFragmentId(intentId, op);
    const id2 = computeFragmentId(intentId, op);
    expect(id1).toBe(id2);
  });

  it("should produce different IDs for different ops", () => {
    const intentId = "test-intent-123";
    const op1 = {
      kind: "addField" as const,
      path: "user.email",
      fieldType: { kind: "primitive" as const, name: "string" as const },
    };
    const op2 = {
      kind: "addField" as const,
      path: "user.name",
      fieldType: { kind: "primitive" as const, name: "string" as const },
    };

    const id1 = computeFragmentId(intentId, op1);
    const id2 = computeFragmentId(intentId, op2);
    expect(id1).not.toBe(id2);
  });

  it("should verify correct fragment ID", () => {
    const intentId = "test-intent-123";
    const op = {
      kind: "addField" as const,
      path: "user.email",
      fieldType: { kind: "primitive" as const, name: "string" as const },
    };

    const fragmentId = computeFragmentId(intentId, op);
    expect(verifyFragmentId(fragmentId, intentId, op)).toBe(true);
  });

  it("should reject incorrect fragment ID", () => {
    const intentId = "test-intent-123";
    const op = {
      kind: "addField" as const,
      path: "user.email",
      fieldType: { kind: "primitive" as const, name: "string" as const },
    };

    expect(verifyFragmentId("wrong-id", intentId, op)).toBe(false);
  });
});

describe("generateIntentId", () => {
  it("should generate unique intent IDs", () => {
    const id1 = generateIntentId();
    const id2 = generateIntentId();
    expect(id1).not.toBe(id2);
  });

  it("should be a valid UUID format", () => {
    const id = generateIntentId();
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("generateTraceId", () => {
  it("should generate unique trace IDs", () => {
    const id1 = generateTraceId();
    const id2 = generateTraceId();
    expect(id1).not.toBe(id2);
  });

  it("should have correct prefix", () => {
    const id = generateTraceId();
    expect(id.startsWith("trace-")).toBe(true);
  });
});

describe("deriveTypeIndex", () => {
  it("should derive type index from schema with state fields", () => {
    const schema: DomainSchema = {
      id: "test",
      version: "1.0.0",
      hash: "test-hash",
      state: {
        fields: {
          user: {
            type: { kind: "object", fields: { name: { type: { kind: "primitive", name: "string" }, optional: false } } },
          },
        },
      },
      computed: {},
      actions: {},
      types: {},
    };

    const typeIndex = deriveTypeIndex(schema);
    expect(typeIndex).toBeDefined();
    expect(typeIndex["state.user"]).toBeDefined();
  });

  it("should handle empty schema", () => {
    const schema: DomainSchema = {
      id: "test",
      version: "1.0.0",
      hash: "test-hash",
      state: {},
      computed: {},
      actions: {},
      types: {},
    };

    const typeIndex = deriveTypeIndex(schema);
    expect(typeIndex).toBeDefined();
    expect(Object.keys(typeIndex).length).toBe(0);
  });
});

describe("hasPath", () => {
  it("should check if path exists in type index", () => {
    const typeIndex = {
      "user": { kind: "primitive" as const, name: "string" as const },
      "user.name": { kind: "primitive" as const, name: "string" as const },
    };

    expect(hasPath(typeIndex, "user")).toBe(true);
    expect(hasPath(typeIndex, "user.name")).toBe(true);
    expect(hasPath(typeIndex, "user.email")).toBe(false);
  });
});

describe("getAllPaths", () => {
  it("should return all paths from type index", () => {
    const typeIndex = {
      "user": { kind: "primitive" as const, name: "string" as const },
      "user.name": { kind: "primitive" as const, name: "string" as const },
    };

    const paths = getAllPaths(typeIndex);
    expect(paths).toContain("user");
    expect(paths).toContain("user.name");
  });
});
