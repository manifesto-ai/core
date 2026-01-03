/**
 * Schema Tests
 *
 * Tests for Zod schema validation.
 */
import { describe, it, expect } from "vitest";
import {
  MemoryRef,
  VerificationMethod,
  VerificationProof,
  VerificationEvidence,
  SelectedMemory,
  MemoryTrace,
  SelectionRequest,
  SelectionConstraints,
  SelectionResult,
  MerkleProofData,
  ProveResult,
} from "../schema/index.js";

describe("Schema Validation", () => {
  describe("MemoryRef", () => {
    it("should accept valid MemoryRef", () => {
      const ref = { worldId: "world-123" };
      const result = MemoryRef.safeParse(ref);
      expect(result.success).toBe(true);
    });

    it("should reject MemoryRef without worldId", () => {
      const ref = {};
      const result = MemoryRef.safeParse(ref);
      expect(result.success).toBe(false);
    });
  });

  describe("VerificationMethod", () => {
    it("should accept known methods", () => {
      const methods = ["existence", "hash", "merkle", "signature", "none"];
      for (const method of methods) {
        const result = VerificationMethod.safeParse(method);
        expect(result.success).toBe(true);
      }
    });

    it("should accept custom methods", () => {
      const result = VerificationMethod.safeParse("custom-method");
      expect(result.success).toBe(true);
    });
  });

  describe("VerificationProof", () => {
    it("should accept valid VerificationProof", () => {
      const proof = { method: "existence" };
      const result = VerificationProof.safeParse(proof);
      expect(result.success).toBe(true);
    });

    it("should accept VerificationProof with proof data", () => {
      const proof = { method: "merkle", proof: { computedRoot: "root-123" } };
      const result = VerificationProof.safeParse(proof);
      expect(result.success).toBe(true);
    });
  });

  describe("VerificationEvidence", () => {
    it("should accept valid VerificationEvidence", () => {
      const evidence = {
        method: "existence",
        verifiedAt: Date.now(),
        verifiedBy: { actorId: "actor-1", kind: "human" },
      };
      const result = VerificationEvidence.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it("should reject VerificationEvidence with negative verifiedAt", () => {
      const evidence = {
        method: "existence",
        verifiedAt: -1,
        verifiedBy: { actorId: "actor-1", kind: "human" },
      };
      const result = VerificationEvidence.safeParse(evidence);
      expect(result.success).toBe(false);
    });
  });

  describe("SelectedMemory", () => {
    it("should accept valid SelectedMemory", () => {
      const memory = {
        ref: { worldId: "world-123" },
        reason: "Matched query",
        confidence: 0.8,
        verified: true,
      };
      const result = SelectedMemory.safeParse(memory);
      expect(result.success).toBe(true);
    });

    it("should reject SelectedMemory with empty reason (CR-07)", () => {
      const memory = {
        ref: { worldId: "world-123" },
        reason: "",
        confidence: 0.8,
        verified: true,
      };
      const result = SelectedMemory.safeParse(memory);
      expect(result.success).toBe(false);
    });

    it("should reject SelectedMemory with confidence > 1 (CR-08)", () => {
      const memory = {
        ref: { worldId: "world-123" },
        reason: "Valid reason",
        confidence: 1.5,
        verified: true,
      };
      const result = SelectedMemory.safeParse(memory);
      expect(result.success).toBe(false);
    });

    it("should reject SelectedMemory with confidence < 0 (CR-08)", () => {
      const memory = {
        ref: { worldId: "world-123" },
        reason: "Valid reason",
        confidence: -0.1,
        verified: true,
      };
      const result = SelectedMemory.safeParse(memory);
      expect(result.success).toBe(false);
    });

    it("should reject SelectedMemory with NaN confidence (CR-08)", () => {
      const memory = {
        ref: { worldId: "world-123" },
        reason: "Valid reason",
        confidence: NaN,
        verified: true,
      };
      const result = SelectedMemory.safeParse(memory);
      expect(result.success).toBe(false);
    });
  });

  describe("MemoryTrace", () => {
    it("should accept valid MemoryTrace", () => {
      const trace = {
        selector: { actorId: "actor-1", kind: "human" },
        query: "search query",
        selectedAt: Date.now(),
        atWorldId: "world-123",
        selected: [],
      };
      const result = MemoryTrace.safeParse(trace);
      expect(result.success).toBe(true);
    });

    it("should accept MemoryTrace with selected memories", () => {
      const trace = {
        selector: { actorId: "actor-1", kind: "human" },
        query: "search query",
        selectedAt: Date.now(),
        atWorldId: "world-123",
        selected: [
          {
            ref: { worldId: "world-456" },
            reason: "Matched",
            confidence: 0.9,
            verified: true,
          },
        ],
      };
      const result = MemoryTrace.safeParse(trace);
      expect(result.success).toBe(true);
    });

    it("should reject MemoryTrace with empty query", () => {
      const trace = {
        selector: { actorId: "actor-1", kind: "human" },
        query: "",
        selectedAt: Date.now(),
        atWorldId: "world-123",
        selected: [],
      };
      const result = MemoryTrace.safeParse(trace);
      expect(result.success).toBe(false);
    });
  });

  describe("SelectionRequest", () => {
    it("should accept valid SelectionRequest", () => {
      const request = {
        query: "search query",
        atWorldId: "world-123",
        selector: { actorId: "actor-1", kind: "human" },
      };
      const result = SelectionRequest.safeParse(request);
      expect(result.success).toBe(true);
    });

    it("should accept SelectionRequest with constraints", () => {
      const request = {
        query: "search query",
        atWorldId: "world-123",
        selector: { actorId: "actor-1", kind: "human" },
        constraints: {
          maxResults: 10,
          minConfidence: 0.5,
          requireVerified: true,
        },
      };
      const result = SelectionRequest.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe("MerkleProofData", () => {
    it("should accept valid MerkleProofData", () => {
      const data = { computedRoot: "root:abc123" };
      const result = MerkleProofData.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should accept MerkleProofData with expectedRoot", () => {
      const data = {
        computedRoot: "root:abc123",
        expectedRoot: "root:abc123",
      };
      const result = MerkleProofData.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should accept MerkleProofData with pathProof", () => {
      const data = {
        computedRoot: "root:abc123",
        pathProof: {
          leafHash: "leaf:xyz",
          siblings: [
            { hash: "node:123", position: "left" },
            { hash: "node:456", position: "right" },
          ],
        },
      };
      const result = MerkleProofData.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("ProveResult", () => {
    it("should accept valid ProveResult", () => {
      const result = ProveResult.safeParse({ valid: true });
      expect(result.success).toBe(true);
    });

    it("should accept ProveResult with proof", () => {
      const result = ProveResult.safeParse({
        valid: true,
        proof: { method: "existence" },
      });
      expect(result.success).toBe(true);
    });

    it("should accept ProveResult with error", () => {
      const result = ProveResult.safeParse({
        valid: false,
        error: "World not found",
      });
      expect(result.success).toBe(true);
    });
  });
});
