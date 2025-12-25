/**
 * Domain Serializer Tests
 *
 * Tests for domain export/import (serialization/deserialization).
 * TDD: Tests written first, implementation follows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  serializeDomain,
  deserializeDomain,
  type DomainExport,
  type DomainState,
} from "./domain-serializer";
import type { EditorSource, EditorDerived } from "@/domain";

// Helper to create sample domain state
function createDomainState(overrides: Partial<DomainState> = {}): DomainState {
  return {
    domain: {
      id: "test-domain",
      name: "Test Domain",
      description: "A test domain",
    },
    sources: {},
    derived: {},
    ...overrides,
  };
}

// Helper to create sample source
function createSource(overrides: Partial<EditorSource> & { id: string; path: string }): EditorSource {
  return {
    schemaType: "string",
    description: "",
    ...overrides,
  };
}

// Helper to create sample derived
function createDerived(
  overrides: Partial<EditorDerived> & { id: string; path: string; deps: string[] }
): EditorDerived {
  return {
    expr: null,
    description: "",
    ...overrides,
  };
}

describe("domain-serializer.ts - Domain Serialization", () => {
  describe("serializeDomain", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should include version field", () => {
      const state = createDomainState();
      const result = serializeDomain(state);

      expect(result.version).toBe("1.0");
    });

    it("should include domain metadata", () => {
      const state = createDomainState({
        domain: {
          id: "my-domain",
          name: "My Domain",
          description: "Description here",
        },
      });

      const result = serializeDomain(state);

      expect(result.domain.id).toBe("my-domain");
      expect(result.domain.name).toBe("My Domain");
      expect(result.domain.description).toBe("Description here");
    });

    it("should include exportedAt timestamp", () => {
      const state = createDomainState();
      const result = serializeDomain(state);

      expect(result.exportedAt).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should serialize sources as array", () => {
      const state = createDomainState({
        sources: {
          s1: createSource({ id: "s1", path: "data.name", schemaType: "string" }),
          s2: createSource({ id: "s2", path: "data.age", schemaType: "number" }),
        },
      });

      const result = serializeDomain(state);

      expect(result.sources).toHaveLength(2);
      expect(result.sources).toContainEqual(
        expect.objectContaining({ id: "s1", path: "data.name" })
      );
      expect(result.sources).toContainEqual(
        expect.objectContaining({ id: "s2", path: "data.age" })
      );
    });

    it("should serialize derived as array", () => {
      const state = createDomainState({
        derived: {
          d1: createDerived({
            id: "d1",
            path: "derived.doubled",
            deps: ["data.value"],
            expr: ["*", ["get", "data.value"], 2],
          }),
        },
      });

      const result = serializeDomain(state);

      expect(result.derived).toHaveLength(1);
      expect(result.derived[0]).toEqual(
        expect.objectContaining({
          id: "d1",
          path: "derived.doubled",
          deps: ["data.value"],
          expr: ["*", ["get", "data.value"], 2],
        })
      );
    });

    it("should handle empty sources and derived", () => {
      const state = createDomainState();
      const result = serializeDomain(state);

      expect(result.sources).toEqual([]);
      expect(result.derived).toEqual([]);
    });
  });

  describe("deserializeDomain", () => {
    it("should return success for valid export", () => {
      const exportData: DomainExport = {
        version: "1.0",
        domain: {
          id: "test",
          name: "Test",
          description: "",
        },
        sources: [],
        derived: [],
        exportedAt: "2024-01-15T10:30:00.000Z",
      };

      const result = deserializeDomain(exportData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
      }
    });

    it("should deserialize domain metadata", () => {
      const exportData: DomainExport = {
        version: "1.0",
        domain: {
          id: "my-domain",
          name: "My Domain",
          description: "Test description",
        },
        sources: [],
        derived: [],
        exportedAt: "2024-01-15T10:30:00.000Z",
      };

      const result = deserializeDomain(exportData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.domain.id).toBe("my-domain");
        expect(result.data.domain.name).toBe("My Domain");
        expect(result.data.domain.description).toBe("Test description");
      }
    });

    it("should convert sources array to record", () => {
      const exportData: DomainExport = {
        version: "1.0",
        domain: { id: "test", name: "Test", description: "" },
        sources: [
          { id: "s1", path: "data.name", schemaType: "string", description: "" },
          { id: "s2", path: "data.age", schemaType: "number", description: "" },
        ],
        derived: [],
        exportedAt: "2024-01-15T10:30:00.000Z",
      };

      const result = deserializeDomain(exportData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sources.s1).toBeDefined();
        expect(result.data.sources.s2).toBeDefined();
        expect(result.data.sources.s1.path).toBe("data.name");
      }
    });

    it("should convert derived array to record", () => {
      const exportData: DomainExport = {
        version: "1.0",
        domain: { id: "test", name: "Test", description: "" },
        sources: [],
        derived: [
          {
            id: "d1",
            path: "derived.total",
            deps: ["data.x"],
            expr: ["get", "data.x"],
            description: "",
          },
        ],
        exportedAt: "2024-01-15T10:30:00.000Z",
      };

      const result = deserializeDomain(exportData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.derived.d1).toBeDefined();
        expect(result.data.derived.d1.path).toBe("derived.total");
      }
    });

    it("should return error for invalid JSON structure", () => {
      const result = deserializeDomain("not an object");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it("should return error for missing version", () => {
      const result = deserializeDomain({
        domain: { id: "test", name: "Test", description: "" },
        sources: [],
        derived: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_FORMAT");
      }
    });

    it("should return error for missing domain metadata", () => {
      const result = deserializeDomain({
        version: "1.0",
        sources: [],
        derived: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_FORMAT");
      }
    });

    it("should return error for invalid source", () => {
      const result = deserializeDomain({
        version: "1.0",
        domain: { id: "test", name: "Test", description: "" },
        sources: [{ invalid: true }], // Missing required fields
        derived: [],
        exportedAt: "2024-01-15T10:30:00.000Z",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_SOURCE");
      }
    });

    it("should return error for invalid derived", () => {
      const result = deserializeDomain({
        version: "1.0",
        domain: { id: "test", name: "Test", description: "" },
        sources: [],
        derived: [{ id: "d1" }], // Missing required fields
        exportedAt: "2024-01-15T10:30:00.000Z",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_DERIVED");
      }
    });

    it("should return error for unsupported version", () => {
      const result = deserializeDomain({
        version: "2.0",
        domain: { id: "test", name: "Test", description: "" },
        sources: [],
        derived: [],
        exportedAt: "2024-01-15T10:30:00.000Z",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNSUPPORTED_VERSION");
      }
    });
  });

  describe("roundtrip", () => {
    it("should preserve data through serialize/deserialize", () => {
      const original = createDomainState({
        domain: {
          id: "roundtrip-test",
          name: "Roundtrip Test",
          description: "Testing roundtrip",
        },
        sources: {
          s1: createSource({
            id: "s1",
            path: "data.price",
            schemaType: "number",
            description: "Product price",
            defaultValue: 0,
          }),
        },
        derived: {
          d1: createDerived({
            id: "d1",
            path: "derived.withTax",
            deps: ["data.price"],
            expr: ["*", ["get", "data.price"], 1.1],
            description: "Price with tax",
          }),
        },
      });

      const exported = serializeDomain(original);
      const result = deserializeDomain(exported);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.domain).toEqual(original.domain);
        expect(result.data.sources.s1).toEqual(original.sources.s1);
        expect(result.data.derived.d1).toEqual(original.derived.d1);
      }
    });
  });
});
