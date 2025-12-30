import { describe, it, expect } from "vitest";
import { sha256, hashSchema, generateRequirementId, generateTraceId } from "./hash.js";

describe("Hash Utilities", () => {
  describe("sha256", () => {
    it("should produce consistent hash for same input", async () => {
      const hash1 = await sha256("hello world");
      const hash2 = await sha256("hello world");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hash for different input", async () => {
      const hash1 = await sha256("hello");
      const hash2 = await sha256("world");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce 64 character hex string", async () => {
      const hash = await sha256("test");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle empty string", async () => {
      const hash = await sha256("");
      expect(hash).toHaveLength(64);
    });

    it("should handle unicode characters", async () => {
      const hash = await sha256("안녕하세요");
      expect(hash).toHaveLength(64);
    });

    it("should match known SHA-256 hash", async () => {
      // "test" hashes to this known value
      const hash = await sha256("test");
      expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
    });
  });

  describe("hashSchema", () => {
    it("should produce consistent hash for same schema", async () => {
      const schema = {
        id: "test",
        version: "1.0.0",
        state: { fields: {} },
        computed: { fields: {} },
        actions: {},
      };

      const hash1 = await hashSchema(schema);
      const hash2 = await hashSchema(schema);
      expect(hash1).toBe(hash2);
    });

    it("should produce same hash regardless of key order", async () => {
      const schema1 = {
        id: "test",
        version: "1.0.0",
        state: { fields: {} },
        computed: { fields: {} },
        actions: {},
      };

      const schema2 = {
        actions: {},
        computed: { fields: {} },
        state: { fields: {} },
        version: "1.0.0",
        id: "test",
      };

      const hash1 = await hashSchema(schema1);
      const hash2 = await hashSchema(schema2);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hash for different schemas", async () => {
      const schema1 = {
        id: "test1",
        version: "1.0.0",
        state: { fields: {} },
        computed: { fields: {} },
        actions: {},
      };

      const schema2 = {
        id: "test2",
        version: "1.0.0",
        state: { fields: {} },
        computed: { fields: {} },
        actions: {},
      };

      const hash1 = await hashSchema(schema1);
      const hash2 = await hashSchema(schema2);
      expect(hash1).not.toBe(hash2);
    });

    it("should detect changes in nested structures", async () => {
      const schema1 = {
        id: "test",
        version: "1.0.0",
        state: { fields: { count: { type: "number", required: true } } },
        computed: { fields: {} },
        actions: {},
      };

      const schema2 = {
        id: "test",
        version: "1.0.0",
        state: { fields: { count: { type: "string", required: true } } },
        computed: { fields: {} },
        actions: {},
      };

      const hash1 = await hashSchema(schema1 as Parameters<typeof hashSchema>[0]);
      const hash2 = await hashSchema(schema2 as Parameters<typeof hashSchema>[0]);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("generateRequirementId", () => {
    it("should produce consistent ID for same inputs", async () => {
      const id1 = await generateRequirementId("schema-hash", "intent-1", "action", "path");
      const id2 = await generateRequirementId("schema-hash", "intent-1", "action", "path");
      expect(id1).toBe(id2);
    });

    it("should produce different ID for different inputs", async () => {
      const id1 = await generateRequirementId("schema-hash", "intent-1", "action", "path");
      const id2 = await generateRequirementId("schema-hash", "intent-2", "action", "path");
      expect(id1).not.toBe(id2);
    });

    it("should produce ID with req- prefix", async () => {
      const id = await generateRequirementId("hash", "intent", "action", "path");
      expect(id).toMatch(/^req-[a-f0-9]{16}$/);
    });

    it("should produce 20 character ID (req- + 16 hex chars)", async () => {
      const id = await generateRequirementId("hash", "intent", "action", "path");
      expect(id).toHaveLength(20);
    });
  });

  describe("generateTraceId", () => {
    it("should produce unique IDs", () => {
      const id1 = generateTraceId();
      const id2 = generateTraceId();
      expect(id1).not.toBe(id2);
    });

    it("should produce ID with trace- prefix", () => {
      const id = generateTraceId();
      expect(id).toMatch(/^trace-\d+-[a-z0-9]+$/);
    });

    it("should include timestamp", () => {
      const before = Date.now();
      const id = generateTraceId();
      const after = Date.now();

      const parts = id.split("-");
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });
});
