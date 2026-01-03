/**
 * Verifier Tests
 *
 * Tests for Verifier implementations.
 * All verifiers MUST be pure (M-8).
 */
import { describe, it, expect } from "vitest";
import type { World } from "@manifesto-ai/world";
import {
  ExistenceVerifier,
  createExistenceVerifier,
  HashVerifier,
  createHashVerifier,
} from "../verifier/index.js";
import type { MemoryRef } from "../schema/ref.js";

// Helper to create a mock World
function createMockWorld(worldId: string): World {
  return {
    worldId: worldId as any,
    schemaHash: "schema:abc123",
    snapshotHash: "snapshot:def456",
    createdAt: Date.now(),
    createdBy: null,
  };
}

describe("ExistenceVerifier", () => {
  const verifier = createExistenceVerifier();

  describe("prove()", () => {
    it("should return valid=true for existing World", () => {
      const memory: MemoryRef = { worldId: "world-123" as any };
      const world = createMockWorld("world-123");

      const result = verifier.prove(memory, world);

      expect(result.valid).toBe(true);
      expect(result.proof).toBeDefined();
      expect(result.proof?.method).toBe("existence");
      expect(result.error).toBeUndefined();
    });

    it("should return valid=false for null World", () => {
      const memory: MemoryRef = { worldId: "world-123" as any };

      const result = verifier.prove(memory, null as any);

      expect(result.valid).toBe(false);
      expect(result.proof).toBeUndefined();
      expect(result.error).toBe("World not found");
    });

    it("should return valid=false for undefined World", () => {
      const memory: MemoryRef = { worldId: "world-123" as any };

      const result = verifier.prove(memory, undefined as any);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("World not found");
    });

    it("should be pure: same inputs produce same outputs", () => {
      const memory: MemoryRef = { worldId: "world-123" as any };
      const world = createMockWorld("world-123");

      const result1 = verifier.prove(memory, world);
      const result2 = verifier.prove(memory, world);

      expect(result1.valid).toBe(result2.valid);
      expect(result1.proof?.method).toBe(result2.proof?.method);
    });
  });

  describe("verifyProof()", () => {
    it("should return true for existence proof", () => {
      const proof = { method: "existence" as const };

      const result = verifier.verifyProof(proof);

      expect(result).toBe(true);
    });

    it("should return false for non-existence proof", () => {
      const proof = { method: "hash" as const };

      const result = verifier.verifyProof(proof);

      expect(result).toBe(false);
    });
  });
});

describe("HashVerifier", () => {
  const verifier = createHashVerifier();

  describe("prove()", () => {
    it("should return valid=true for existing World with hashes", () => {
      const memory: MemoryRef = { worldId: "world-123" as any };
      const world = createMockWorld("world-123");

      const result = verifier.prove(memory, world);

      expect(result.valid).toBe(true);
      expect(result.proof).toBeDefined();
      expect(result.proof?.method).toBe("hash");
      expect(result.proof?.proof).toBeDefined();
    });

    it("should return valid=false for null World", () => {
      const memory: MemoryRef = { worldId: "world-123" as any };

      const result = verifier.prove(memory, null as any);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("World not found");
    });

    it("should be pure: same inputs produce same outputs", () => {
      const memory: MemoryRef = { worldId: "world-123" as any };
      const world = createMockWorld("world-123");

      const result1 = verifier.prove(memory, world);
      const result2 = verifier.prove(memory, world);

      expect(result1.valid).toBe(result2.valid);
      expect(result1.proof?.method).toBe(result2.proof?.method);
      expect(JSON.stringify(result1.proof?.proof)).toBe(
        JSON.stringify(result2.proof?.proof)
      );
    });
  });

  describe("verifyProof()", () => {
    it("should return true for hash proof with valid structure", () => {
      const proof = {
        method: "hash" as const,
        proof: { computedHash: "hash:abc123" },
      };

      const result = verifier.verifyProof(proof);

      expect(result).toBe(true);
    });

    it("should return false for non-hash proof", () => {
      const proof = { method: "existence" as const };

      const result = verifier.verifyProof(proof);

      expect(result).toBe(false);
    });

    it("should return false for hash proof without data", () => {
      const proof = { method: "hash" as const };

      const result = verifier.verifyProof(proof);

      expect(result).toBe(false);
    });
  });
});
