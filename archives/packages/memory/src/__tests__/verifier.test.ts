/**
 * Verifier Tests
 *
 * Tests for ExistenceVerifier, HashVerifier, and MerkleVerifier.
 * Verifies M-8 purity requirements.
 */
import { describe, it, expect } from "vitest";
import type { World } from "@manifesto-ai/world";
import { createMemoryRef } from "../schema/ref.js";
import { extractProof } from "../schema/proof.js";
import {
  ExistenceVerifier,
  createExistenceVerifier,
} from "../verifier/existence.js";
import {
  HashVerifier,
  createHashVerifier,
  computeHash,
} from "../verifier/hash.js";
import {
  MerkleVerifier,
  createMerkleVerifier,
} from "../verifier/merkle.js";

// Helper to create a mock World
function createMockWorld(overrides: Partial<World> = {}): World {
  return {
    worldId: "test-world-123",
    schemaHash: "schema-hash-abc",
    snapshotHash: "snapshot-hash-xyz",
    createdAt: 1704067200000,
    createdBy: { actorId: "test-system", kind: "system" },
    ...overrides,
  } as World;
}

describe("ExistenceVerifier", () => {
  const verifier = createExistenceVerifier();
  const ref = createMemoryRef("test-world-123");

  describe("prove", () => {
    it("should return valid=true for existing world", () => {
      const world = createMockWorld();
      const result = verifier.prove(ref, world);

      expect(result.valid).toBe(true);
      expect(result.proof).toBeDefined();
      expect(result.proof?.method).toBe("existence");
      expect(result.error).toBeUndefined();
    });

    it("should return valid=false for null world", () => {
      const result = verifier.prove(ref, null as unknown as World);

      expect(result.valid).toBe(false);
      expect(result.proof).toBeUndefined();
      expect(result.error).toBe("World not found");
    });

    it("should return valid=false for undefined world", () => {
      const result = verifier.prove(ref, undefined as unknown as World);

      expect(result.valid).toBe(false);
      expect(result.proof).toBeUndefined();
    });

    it("should be pure - same inputs produce same outputs", () => {
      const world = createMockWorld();
      const result1 = verifier.prove(ref, world);
      const result2 = verifier.prove(ref, world);

      expect(result1).toEqual(result2);
    });

    it("M-8: should not include timestamps in output", () => {
      const world = createMockWorld();
      const result = verifier.prove(ref, world);

      expect((result as unknown as Record<string, unknown>).verifiedAt).toBeUndefined();
      expect((result.proof as unknown as Record<string, unknown> | undefined)?.verifiedAt).toBeUndefined();
    });

    it("M-8: should not include actor refs in output", () => {
      const world = createMockWorld();
      const result = verifier.prove(ref, world);

      expect((result as unknown as Record<string, unknown>).verifiedBy).toBeUndefined();
      expect((result.proof as unknown as Record<string, unknown> | undefined)?.verifiedBy).toBeUndefined();
    });
  });

  describe("verifyProof", () => {
    it("should return true for existence method", () => {
      const proof = { method: "existence" as const };
      expect(verifier.verifyProof(proof)).toBe(true);
    });

    it("should return false for other methods", () => {
      const proof = { method: "hash" as const };
      expect(verifier.verifyProof(proof)).toBe(false);
    });
  });

  describe("M-12 integration", () => {
    it("proof extracted from evidence can be verified", () => {
      const world = createMockWorld();
      const proveResult = verifier.prove(ref, world);

      // Simulate Selector creating evidence
      const evidence = {
        method: proveResult.proof!.method,
        proof: proveResult.proof!.proof,
        verifiedAt: Date.now(),
        verifiedBy: { actorId: "user-1", kind: "human" as const },
      };

      // Authority extracts proof (M-12)
      const extractedProof = extractProof(evidence);

      // Authority verifies
      expect(verifier.verifyProof(extractedProof)).toBe(true);
    });
  });
});

describe("HashVerifier", () => {
  const verifier = createHashVerifier();
  const ref = createMemoryRef("test-world-123");

  describe("computeHash", () => {
    it("should produce consistent hashes", () => {
      const data = { a: 1, b: 2 };
      const hash1 = computeHash(data);
      const hash2 = computeHash(data);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different data", () => {
      const hash1 = computeHash({ a: 1 });
      const hash2 = computeHash({ a: 2 });

      expect(hash1).not.toBe(hash2);
    });

    it("should produce hash string starting with 'hash:'", () => {
      const hash = computeHash({ test: "data" });
      expect(hash.startsWith("hash:")).toBe(true);
    });
  });

  describe("prove", () => {
    it("should return valid proof for existing world", () => {
      const world = createMockWorld();
      const result = verifier.prove(ref, world);

      expect(result.valid).toBe(true);
      expect(result.proof).toBeDefined();
      expect(result.proof?.method).toBe("hash");
      expect(result.proof?.proof).toHaveProperty("computedHash");
    });

    it("should return valid=false for null world", () => {
      const result = verifier.prove(ref, null as unknown as World);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("World not found");
    });

    it("should be pure - same inputs produce same outputs", () => {
      const world = createMockWorld();
      const result1 = verifier.prove(ref, world);
      const result2 = verifier.prove(ref, world);

      expect(result1).toEqual(result2);
    });

    it("M-8: should not include timestamps in output", () => {
      const world = createMockWorld();
      const result = verifier.prove(ref, world);

      expect((result as unknown as Record<string, unknown>).verifiedAt).toBeUndefined();
    });

    it("M-8: should not include actor refs in output", () => {
      const world = createMockWorld();
      const result = verifier.prove(ref, world);

      expect((result as unknown as Record<string, unknown>).verifiedBy).toBeUndefined();
    });
  });

  describe("verifyProof", () => {
    it("should return true for valid hash proof", () => {
      const proof = {
        method: "hash" as const,
        proof: { computedHash: "hash:abc123" },
      };
      expect(verifier.verifyProof(proof)).toBe(true);
    });

    it("should return false for non-hash method", () => {
      const proof = { method: "existence" as const };
      expect(verifier.verifyProof(proof)).toBe(false);
    });

    it("should return false for missing proof data", () => {
      const proof = { method: "hash" as const };
      expect(verifier.verifyProof(proof)).toBe(false);
    });

    it("should return false for missing computedHash", () => {
      const proof = { method: "hash" as const, proof: {} };
      expect(verifier.verifyProof(proof)).toBe(false);
    });
  });

  describe("M-12 integration", () => {
    it("proof extracted from evidence can be verified", () => {
      const world = createMockWorld();
      const proveResult = verifier.prove(ref, world);

      const evidence = {
        method: proveResult.proof!.method,
        proof: proveResult.proof!.proof,
        verifiedAt: Date.now(),
        verifiedBy: { actorId: "user-1", kind: "human" as const },
      };

      const extractedProof = extractProof(evidence);
      expect(verifier.verifyProof(extractedProof)).toBe(true);
    });
  });
});

describe("MerkleVerifier", () => {
  const verifier = createMerkleVerifier();
  const ref = createMemoryRef("test-world-123");

  describe("prove", () => {
    it("should return valid proof for existing world", () => {
      const world = createMockWorld();
      const result = verifier.prove(ref, world);

      expect(result.valid).toBe(true);
      expect(result.proof).toBeDefined();
      expect(result.proof?.method).toBe("merkle");
      expect(result.proof?.proof).toHaveProperty("computedRoot");
    });

    it("should return valid=false for null world", () => {
      const result = verifier.prove(ref, null as unknown as World);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("World not found");
    });

    it("should be pure - same inputs produce same outputs", () => {
      const world = createMockWorld();
      const result1 = verifier.prove(ref, world);
      const result2 = verifier.prove(ref, world);

      expect(result1).toEqual(result2);
    });

    it("M-8: should not include timestamps in output", () => {
      const world = createMockWorld();
      const result = verifier.prove(ref, world);

      expect((result as unknown as Record<string, unknown>).verifiedAt).toBeUndefined();
    });

    it("M-8: should not include actor refs in output", () => {
      const world = createMockWorld();
      const result = verifier.prove(ref, world);

      expect((result as unknown as Record<string, unknown>).verifiedBy).toBeUndefined();
    });
  });

  describe("verifyProof", () => {
    it("should return true for valid merkle proof", () => {
      const proof = {
        method: "merkle" as const,
        proof: { computedRoot: "root:abc123" },
      };
      expect(verifier.verifyProof(proof)).toBe(true);
    });

    it("should return false for non-merkle method", () => {
      const proof = { method: "existence" as const };
      expect(verifier.verifyProof(proof)).toBe(false);
    });

    it("should return false for missing computedRoot", () => {
      const proof = { method: "merkle" as const, proof: {} };
      expect(verifier.verifyProof(proof)).toBe(false);
    });

    it("should verify matching roots", () => {
      const proof = {
        method: "merkle" as const,
        proof: {
          computedRoot: "root:abc123",
          expectedRoot: "root:abc123",
        },
      };
      expect(verifier.verifyProof(proof)).toBe(true);
    });

    it("should fail for mismatched roots", () => {
      const proof = {
        method: "merkle" as const,
        proof: {
          computedRoot: "root:abc123",
          expectedRoot: "root:different",
        },
      };
      expect(verifier.verifyProof(proof)).toBe(false);
    });
  });

  describe("M-12 integration", () => {
    it("proof extracted from evidence can be verified", () => {
      const world = createMockWorld();
      const proveResult = verifier.prove(ref, world);

      const evidence = {
        method: proveResult.proof!.method,
        proof: proveResult.proof!.proof,
        verifiedAt: Date.now(),
        verifiedBy: { actorId: "user-1", kind: "human" as const },
      };

      const extractedProof = extractProof(evidence);
      expect(verifier.verifyProof(extractedProof)).toBe(true);
    });
  });
});

describe("Factory Functions", () => {
  it("createExistenceVerifier should create an ExistenceVerifier", () => {
    const verifier = createExistenceVerifier();
    expect(verifier).toBeInstanceOf(ExistenceVerifier);
  });

  it("createHashVerifier should create a HashVerifier", () => {
    const verifier = createHashVerifier();
    expect(verifier).toBeInstanceOf(HashVerifier);
  });

  it("createMerkleVerifier should create a MerkleVerifier", () => {
    const verifier = createMerkleVerifier();
    expect(verifier).toBeInstanceOf(MerkleVerifier);
  });
});
