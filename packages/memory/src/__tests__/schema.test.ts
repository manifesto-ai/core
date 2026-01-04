/**
 * Schema Tests
 *
 * Tests for all schema types in the memory package.
 */
import { describe, it, expect } from "vitest";
import {
  MemoryRef,
  createMemoryRef,
} from "../schema/ref.js";
import {
  VerificationMethod,
  VerificationProof,
  VerificationEvidence,
  ProveResult,
  extractProof,
} from "../schema/proof.js";
import {
  SelectedMemory,
  SelectionConstraints,
  SelectionRequest,
  SelectionResult,
} from "../schema/selection.js";
import { MemoryTrace } from "../schema/trace.js";
import {
  MerkleSibling,
  MerklePathProof,
  MerkleProofData,
  HashProofData,
} from "../schema/merkle.js";

describe("MemoryRef", () => {
  it("should validate a valid MemoryRef", () => {
    const ref = { worldId: "world-123" };
    const result = MemoryRef.safeParse(ref);
    expect(result.success).toBe(true);
  });

  it("should reject missing worldId", () => {
    const ref = {};
    const result = MemoryRef.safeParse(ref);
    expect(result.success).toBe(false);
  });

  it("should reject non-string worldId", () => {
    const ref = { worldId: 123 };
    const result = MemoryRef.safeParse(ref);
    expect(result.success).toBe(false);
  });

  it("createMemoryRef should create valid ref", () => {
    const ref = createMemoryRef("test-world");
    expect(ref.worldId).toBe("test-world");
    const result = MemoryRef.safeParse(ref);
    expect(result.success).toBe(true);
  });
});

describe("VerificationMethod", () => {
  it("should accept standard methods", () => {
    const methods = ["existence", "hash", "merkle", "signature", "none"];
    for (const method of methods) {
      const result = VerificationMethod.safeParse(method);
      expect(result.success).toBe(true);
    }
  });

  it("should accept custom string methods", () => {
    const result = VerificationMethod.safeParse("custom-method");
    expect(result.success).toBe(true);
  });

  it("should reject non-string methods", () => {
    const result = VerificationMethod.safeParse(123);
    expect(result.success).toBe(false);
  });
});

describe("VerificationProof", () => {
  it("should validate minimal proof", () => {
    const proof = { method: "existence" };
    const result = VerificationProof.safeParse(proof);
    expect(result.success).toBe(true);
  });

  it("should validate proof with data", () => {
    const proof = {
      method: "hash",
      proof: { computedHash: "abc123" },
    };
    const result = VerificationProof.safeParse(proof);
    expect(result.success).toBe(true);
  });

  it("should reject missing method", () => {
    const proof = { proof: {} };
    const result = VerificationProof.safeParse(proof);
    expect(result.success).toBe(false);
  });
});

describe("VerificationEvidence", () => {
  it("should validate complete evidence", () => {
    const evidence = {
      method: "hash",
      proof: { computedHash: "abc" },
      verifiedAt: Date.now(),
      verifiedBy: { actorId: "user-1", kind: "human" },
    };
    const result = VerificationEvidence.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it("should reject non-positive verifiedAt", () => {
    const evidence = {
      method: "hash",
      verifiedAt: 0,
      verifiedBy: { actorId: "user-1", kind: "human" },
    };
    const result = VerificationEvidence.safeParse(evidence);
    expect(result.success).toBe(false);
  });

  it("should reject negative verifiedAt", () => {
    const evidence = {
      method: "hash",
      verifiedAt: -1,
      verifiedBy: { actorId: "user-1", kind: "human" },
    };
    const result = VerificationEvidence.safeParse(evidence);
    expect(result.success).toBe(false);
  });

  it("should reject missing verifiedBy", () => {
    const evidence = {
      method: "hash",
      verifiedAt: Date.now(),
    };
    const result = VerificationEvidence.safeParse(evidence);
    expect(result.success).toBe(false);
  });
});

describe("extractProof (M-12)", () => {
  it("should extract proof from evidence", () => {
    const evidence = {
      method: "merkle" as const,
      proof: { computedRoot: "root-123" },
      verifiedAt: 1234567890,
      verifiedBy: { kind: "human" as const, id: "user-1" },
    };

    const proof = extractProof(evidence);

    expect(proof.method).toBe("merkle");
    expect(proof.proof).toEqual({ computedRoot: "root-123" });
    expect((proof as unknown as Record<string, unknown>).verifiedAt).toBeUndefined();
    expect((proof as unknown as Record<string, unknown>).verifiedBy).toBeUndefined();
  });

  it("should handle evidence without proof data", () => {
    const evidence = {
      method: "existence" as const,
      verifiedAt: 1234567890,
      verifiedBy: { kind: "human" as const, id: "user-1" },
    };

    const proof = extractProof(evidence);

    expect(proof.method).toBe("existence");
    expect(proof.proof).toBeUndefined();
  });
});

describe("ProveResult", () => {
  it("should validate successful result", () => {
    const result = {
      valid: true,
      proof: { method: "hash", proof: { computedHash: "abc" } },
    };
    const parsed = ProveResult.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("should validate failed result with error", () => {
    const result = {
      valid: false,
      error: "World not found",
    };
    const parsed = ProveResult.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});

describe("SelectedMemory", () => {
  const validActor = { actorId: "user-1", kind: "human" as const };

  it("should validate complete selected memory", () => {
    const memory = {
      ref: { worldId: "world-1" },
      reason: "Matched query",
      confidence: 0.8,
      verified: true,
      evidence: {
        method: "hash",
        verifiedAt: Date.now(),
        verifiedBy: validActor,
      },
    };
    const result = SelectedMemory.safeParse(memory);
    expect(result.success).toBe(true);
  });

  it("should validate memory without evidence", () => {
    const memory = {
      ref: { worldId: "world-1" },
      reason: "Matched query",
      confidence: 0.5,
      verified: false,
    };
    const result = SelectedMemory.safeParse(memory);
    expect(result.success).toBe(true);
  });

  it("should reject empty reason", () => {
    const memory = {
      ref: { worldId: "world-1" },
      reason: "",
      confidence: 0.5,
      verified: false,
    };
    const result = SelectedMemory.safeParse(memory);
    expect(result.success).toBe(false);
  });

  it("should reject confidence below 0", () => {
    const memory = {
      ref: { worldId: "world-1" },
      reason: "Reason",
      confidence: -0.1,
      verified: false,
    };
    const result = SelectedMemory.safeParse(memory);
    expect(result.success).toBe(false);
  });

  it("should reject confidence above 1", () => {
    const memory = {
      ref: { worldId: "world-1" },
      reason: "Reason",
      confidence: 1.1,
      verified: false,
    };
    const result = SelectedMemory.safeParse(memory);
    expect(result.success).toBe(false);
  });

  it("should reject NaN confidence", () => {
    const memory = {
      ref: { worldId: "world-1" },
      reason: "Reason",
      confidence: NaN,
      verified: false,
    };
    const result = SelectedMemory.safeParse(memory);
    expect(result.success).toBe(false);
  });

  it("should reject Infinity confidence", () => {
    const memory = {
      ref: { worldId: "world-1" },
      reason: "Reason",
      confidence: Infinity,
      verified: false,
    };
    const result = SelectedMemory.safeParse(memory);
    expect(result.success).toBe(false);
  });

  it("should accept boundary confidence values", () => {
    const mem0 = {
      ref: { worldId: "world-1" },
      reason: "Reason",
      confidence: 0,
      verified: false,
    };
    const mem1 = {
      ref: { worldId: "world-1" },
      reason: "Reason",
      confidence: 1,
      verified: false,
    };

    expect(SelectedMemory.safeParse(mem0).success).toBe(true);
    expect(SelectedMemory.safeParse(mem1).success).toBe(true);
  });
});

describe("SelectionConstraints", () => {
  it("should validate empty constraints", () => {
    const constraints = {};
    const result = SelectionConstraints.safeParse(constraints);
    expect(result.success).toBe(true);
  });

  it("should validate full constraints", () => {
    const constraints = {
      maxResults: 10,
      minConfidence: 0.5,
      requireVerified: true,
      requireEvidence: true,
      timeRange: { after: 1000, before: 2000 },
    };
    const result = SelectionConstraints.safeParse(constraints);
    expect(result.success).toBe(true);
  });

  it("should reject negative maxResults", () => {
    const constraints = { maxResults: -1 };
    const result = SelectionConstraints.safeParse(constraints);
    expect(result.success).toBe(false);
  });

  it("should reject zero maxResults", () => {
    const constraints = { maxResults: 0 };
    const result = SelectionConstraints.safeParse(constraints);
    expect(result.success).toBe(false);
  });
});

describe("SelectionRequest", () => {
  const validActor = { actorId: "user-1", kind: "human" as const };

  it("should validate complete request", () => {
    const request = {
      query: "find tasks",
      atWorldId: "world-123",
      selector: validActor,
      constraints: { maxResults: 5 },
    };
    const result = SelectionRequest.safeParse(request);
    expect(result.success).toBe(true);
  });

  it("should reject empty query", () => {
    const request = {
      query: "",
      atWorldId: "world-123",
      selector: validActor,
    };
    const result = SelectionRequest.safeParse(request);
    expect(result.success).toBe(false);
  });
});

describe("SelectionResult", () => {
  it("should validate empty result", () => {
    const result = {
      selected: [],
      selectedAt: Date.now(),
    };
    const parsed = SelectionResult.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("should validate result with memories", () => {
    const result = {
      selected: [
        {
          ref: { worldId: "world-1" },
          reason: "Match",
          confidence: 0.8,
          verified: true,
        },
      ],
      selectedAt: Date.now(),
    };
    const parsed = SelectionResult.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});

describe("MemoryTrace", () => {
  const validActor = { actorId: "user-1", kind: "human" as const };

  it("should validate complete trace", () => {
    const trace = {
      selector: validActor,
      query: "find completed tasks",
      selectedAt: Date.now(),
      atWorldId: "world-123",
      selected: [
        {
          ref: { worldId: "world-1" },
          reason: "Task completed",
          confidence: 0.9,
          verified: true,
        },
      ],
    };
    const result = MemoryTrace.safeParse(trace);
    expect(result.success).toBe(true);
  });

  it("should validate trace with empty selected", () => {
    const trace = {
      selector: validActor,
      query: "find nothing",
      selectedAt: Date.now(),
      atWorldId: "world-123",
      selected: [],
    };
    const result = MemoryTrace.safeParse(trace);
    expect(result.success).toBe(true);
  });

  it("should reject empty query", () => {
    const trace = {
      selector: validActor,
      query: "",
      selectedAt: Date.now(),
      atWorldId: "world-123",
      selected: [],
    };
    const result = MemoryTrace.safeParse(trace);
    expect(result.success).toBe(false);
  });
});

describe("MerkleSibling", () => {
  it("should validate left sibling", () => {
    const sibling = { hash: "abc123", position: "left" };
    const result = MerkleSibling.safeParse(sibling);
    expect(result.success).toBe(true);
  });

  it("should validate right sibling", () => {
    const sibling = { hash: "def456", position: "right" };
    const result = MerkleSibling.safeParse(sibling);
    expect(result.success).toBe(true);
  });

  it("should reject invalid position", () => {
    const sibling = { hash: "abc", position: "center" };
    const result = MerkleSibling.safeParse(sibling);
    expect(result.success).toBe(false);
  });
});

describe("MerklePathProof", () => {
  it("should validate empty siblings", () => {
    const proof = { leafHash: "leaf-hash", siblings: [] };
    const result = MerklePathProof.safeParse(proof);
    expect(result.success).toBe(true);
  });

  it("should validate proof with siblings", () => {
    const proof = {
      leafHash: "leaf-hash",
      siblings: [
        { hash: "sibling-1", position: "right" },
        { hash: "sibling-2", position: "left" },
      ],
    };
    const result = MerklePathProof.safeParse(proof);
    expect(result.success).toBe(true);
  });
});

describe("MerkleProofData", () => {
  it("should validate minimal proof data", () => {
    const data = { computedRoot: "root-hash" };
    const result = MerkleProofData.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("should validate full proof data", () => {
    const data = {
      computedRoot: "root-hash",
      expectedRoot: "expected-root",
      pathProof: {
        leafHash: "leaf",
        siblings: [{ hash: "sib", position: "left" }],
      },
    };
    const result = MerkleProofData.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("HashProofData", () => {
  it("should validate minimal hash proof", () => {
    const data = { computedHash: "hash-123" };
    const result = HashProofData.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("should validate full hash proof", () => {
    const data = {
      computedHash: "hash-123",
      expectedHash: "hash-123",
    };
    const result = HashProofData.safeParse(data);
    expect(result.success).toBe(true);
  });
});
