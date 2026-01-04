/**
 * Merkle Tree Utility Tests
 *
 * Tests for Merkle tree functions in the memory package.
 */
import { describe, it, expect } from "vitest";
import {
  hashData,
  hashLeaf,
  computeParentHash,
  computeMerkleRoot,
  generateMerklePathProof,
  verifyMerklePathProof,
} from "../verifier/merkle.js";

describe("hashData", () => {
  it("should produce consistent hashes", () => {
    const hash1 = hashData("test string");
    const hash2 = hashData("test string");
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different inputs", () => {
    const hash1 = hashData("hello");
    const hash2 = hashData("world");
    expect(hash1).not.toBe(hash2);
  });

  it("should handle empty string", () => {
    const hash = hashData("");
    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
  });

  it("should produce 8-character padded hex", () => {
    const hash = hashData("test");
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("should handle special characters", () => {
    const hash = hashData("hello\nworld\t!");
    expect(hash).toBeDefined();
  });

  it("should handle unicode", () => {
    const hash = hashData("안녕하세요");
    expect(hash).toBeDefined();
  });
});

describe("hashLeaf", () => {
  it("should produce consistent leaf hashes", () => {
    const hash1 = hashLeaf("key", "value");
    const hash2 = hashLeaf("key", "value");
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different keys", () => {
    const hash1 = hashLeaf("key1", "value");
    const hash2 = hashLeaf("key2", "value");
    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hashes for different values", () => {
    const hash1 = hashLeaf("key", "value1");
    const hash2 = hashLeaf("key", "value2");
    expect(hash1).not.toBe(hash2);
  });

  it("should prefix hash with 'leaf:'", () => {
    const hash = hashLeaf("key", "value");
    expect(hash.startsWith("leaf:")).toBe(true);
  });

  it("should handle complex values", () => {
    const hash = hashLeaf("key", { nested: { deep: true } });
    expect(hash).toBeDefined();
    expect(hash.startsWith("leaf:")).toBe(true);
  });

  it("should handle null and undefined values", () => {
    const hashNull = hashLeaf("key", null);
    const hashUndef = hashLeaf("key", undefined);
    expect(hashNull).toBeDefined();
    expect(hashUndef).toBeDefined();
    expect(hashNull).not.toBe(hashUndef);
  });
});

describe("computeParentHash", () => {
  it("should produce consistent parent hashes", () => {
    const hash1 = computeParentHash("left", "right");
    const hash2 = computeParentHash("left", "right");
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different orders", () => {
    const hash1 = computeParentHash("left", "right");
    const hash2 = computeParentHash("right", "left");
    expect(hash1).not.toBe(hash2);
  });

  it("should prefix hash with 'node:'", () => {
    const hash = computeParentHash("left", "right");
    expect(hash.startsWith("node:")).toBe(true);
  });

  it("should handle identical children", () => {
    const hash = computeParentHash("same", "same");
    expect(hash).toBeDefined();
    expect(hash.startsWith("node:")).toBe(true);
  });
});

describe("computeMerkleRoot", () => {
  it("should return 'root:empty' for empty object", () => {
    const root = computeMerkleRoot({});
    expect(root).toBe("root:empty");
  });

  it("should compute root for single entry", () => {
    const root = computeMerkleRoot({ key: "value" });
    expect(root).toBeDefined();
    expect(root.startsWith("root:")).toBe(true);
  });

  it("should compute root for multiple entries", () => {
    const root = computeMerkleRoot({
      key1: "value1",
      key2: "value2",
      key3: "value3",
    });
    expect(root).toBeDefined();
    expect(root.startsWith("root:")).toBe(true);
  });

  it("should produce consistent roots", () => {
    const data = { a: 1, b: 2, c: 3 };
    const root1 = computeMerkleRoot(data);
    const root2 = computeMerkleRoot(data);
    expect(root1).toBe(root2);
  });

  it("should produce same root regardless of property order", () => {
    const root1 = computeMerkleRoot({ a: 1, b: 2 });
    const root2 = computeMerkleRoot({ b: 2, a: 1 });
    expect(root1).toBe(root2);
  });

  it("should produce different roots for different data", () => {
    const root1 = computeMerkleRoot({ a: 1 });
    const root2 = computeMerkleRoot({ a: 2 });
    expect(root1).not.toBe(root2);
  });

  it("should handle odd number of entries", () => {
    const root = computeMerkleRoot({
      a: 1,
      b: 2,
      c: 3,
    });
    expect(root).toBeDefined();
    expect(root.startsWith("root:")).toBe(true);
  });

  it("should handle even number of entries", () => {
    const root = computeMerkleRoot({
      a: 1,
      b: 2,
      c: 3,
      d: 4,
    });
    expect(root).toBeDefined();
    expect(root.startsWith("root:")).toBe(true);
  });

  it("should handle nested values", () => {
    const root = computeMerkleRoot({
      nested: { deep: { value: true } },
    });
    expect(root).toBeDefined();
  });
});

describe("generateMerklePathProof", () => {
  it("should return undefined for non-existent key", () => {
    const data = { a: 1, b: 2 };
    const proof = generateMerklePathProof(data, "nonexistent");
    expect(proof).toBeUndefined();
  });

  it("should return undefined for empty object", () => {
    const proof = generateMerklePathProof({}, "any");
    expect(proof).toBeUndefined();
  });

  it("should generate proof for existing key", () => {
    const data = { a: 1, b: 2, c: 3 };
    const proof = generateMerklePathProof(data, "a");

    expect(proof).toBeDefined();
    expect(proof?.leafHash).toBeDefined();
    expect(proof?.siblings).toBeDefined();
    expect(Array.isArray(proof?.siblings)).toBe(true);
  });

  it("should generate valid leaf hash", () => {
    const data = { mykey: "myvalue" };
    const proof = generateMerklePathProof(data, "mykey");

    expect(proof?.leafHash).toBe(hashLeaf("mykey", "myvalue"));
  });

  it("should generate proof for single entry", () => {
    const data = { only: "one" };
    const proof = generateMerklePathProof(data, "only");

    expect(proof).toBeDefined();
    expect(proof?.leafHash).toBeDefined();
    expect(proof?.siblings).toHaveLength(0);
  });

  it("should generate proof for middle key", () => {
    const data = { a: 1, b: 2, c: 3, d: 4 };
    const proof = generateMerklePathProof(data, "b");

    expect(proof).toBeDefined();
    expect(proof?.siblings.length).toBeGreaterThan(0);
  });

  it("should have correct sibling positions", () => {
    const data = { a: 1, b: 2 };
    const proof = generateMerklePathProof(data, "a");

    expect(proof).toBeDefined();
    if (proof && proof.siblings.length > 0) {
      for (const sibling of proof.siblings) {
        expect(["left", "right"]).toContain(sibling.position);
      }
    }
  });
});

describe("verifyMerklePathProof", () => {
  it("should verify valid proof", () => {
    const data = { a: 1, b: 2, c: 3 };
    const root = computeMerkleRoot(data);
    const proof = generateMerklePathProof(data, "a");

    expect(proof).toBeDefined();
    const isValid = verifyMerklePathProof(
      proof!.leafHash,
      proof!.siblings,
      root
    );
    expect(isValid).toBe(true);
  });

  it("should verify proof for all keys", () => {
    const data = { key1: "value1", key2: "value2", key3: "value3" };
    const root = computeMerkleRoot(data);

    for (const key of Object.keys(data)) {
      const proof = generateMerklePathProof(data, key);
      expect(proof).toBeDefined();
      const isValid = verifyMerklePathProof(
        proof!.leafHash,
        proof!.siblings,
        root
      );
      expect(isValid).toBe(true);
    }
  });

  it("should fail for tampered leaf hash", () => {
    const data = { a: 1, b: 2 };
    const root = computeMerkleRoot(data);
    const proof = generateMerklePathProof(data, "a");

    expect(proof).toBeDefined();
    const isValid = verifyMerklePathProof(
      "tampered-leaf-hash",
      proof!.siblings,
      root
    );
    expect(isValid).toBe(false);
  });

  it("should fail for wrong root", () => {
    const data = { a: 1, b: 2 };
    const proof = generateMerklePathProof(data, "a");

    expect(proof).toBeDefined();
    const isValid = verifyMerklePathProof(
      proof!.leafHash,
      proof!.siblings,
      "wrong-root"
    );
    expect(isValid).toBe(false);
  });

  it("should fail for tampered siblings", () => {
    const data = { a: 1, b: 2, c: 3, d: 4 };
    const root = computeMerkleRoot(data);
    const proof = generateMerklePathProof(data, "a");

    expect(proof).toBeDefined();
    if (proof && proof.siblings.length > 0) {
      const tamperedSiblings = [
        { ...proof.siblings[0], hash: "tampered-hash" },
        ...proof.siblings.slice(1),
      ];
      const isValid = verifyMerklePathProof(
        proof.leafHash,
        tamperedSiblings,
        root
      );
      expect(isValid).toBe(false);
    }
  });

  it("should verify proof for single entry data", () => {
    const data = { only: "value" };
    const root = computeMerkleRoot(data);
    const proof = generateMerklePathProof(data, "only");

    expect(proof).toBeDefined();
    const isValid = verifyMerklePathProof(
      proof!.leafHash,
      proof!.siblings,
      root
    );
    expect(isValid).toBe(true);
  });

  it("should handle empty siblings array", () => {
    const leafHash = hashLeaf("key", "value");
    // For single entry, the leaf becomes the root
    const isValid = verifyMerklePathProof(
      leafHash,
      [],
      `root:${leafHash}`
    );
    // This tests the edge case behavior
    expect(typeof isValid).toBe("boolean");
  });
});

describe("End-to-end Merkle verification", () => {
  it("should round-trip: compute root, generate proof, verify proof", () => {
    const data = {
      userId: "user-123",
      action: "create",
      timestamp: 1704067200000,
      metadata: { foo: "bar" },
    };

    const root = computeMerkleRoot(data);

    for (const key of Object.keys(data)) {
      const proof = generateMerklePathProof(data, key);
      expect(proof).toBeDefined();

      const isValid = verifyMerklePathProof(
        proof!.leafHash,
        proof!.siblings,
        root
      );
      expect(isValid).toBe(true);
    }
  });

  it("should detect data modification", () => {
    const originalData = { a: 1, b: 2, c: 3 };
    const root = computeMerkleRoot(originalData);
    const proof = generateMerklePathProof(originalData, "a");

    // Modify the data
    const modifiedData = { ...originalData, a: 999 };
    const modifiedRoot = computeMerkleRoot(modifiedData);

    // Original proof should not verify against modified root
    expect(proof).toBeDefined();
    const isValid = verifyMerklePathProof(
      proof!.leafHash,
      proof!.siblings,
      modifiedRoot
    );
    expect(isValid).toBe(false);

    // Different roots confirm data change
    expect(root).not.toBe(modifiedRoot);
  });
});
