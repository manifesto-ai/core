/**
 * Trace Tests
 *
 * Tests for trace utilities.
 */
import { describe, it, expect } from "vitest";
import type { ActorRef, Proposal } from "@manifesto-ai/world";
import {
  createMemoryTrace,
  createMemoryTraceFromResult,
  attachToProposal,
  getFromProposal,
  hasTrace,
  validateMemoryTrace,
  validateSelectedMemory,
  isMemoryTrace,
  extractProof,
} from "../trace/index.js";
import type { SelectionResult, SelectedMemory } from "../schema/selection.js";
import type { VerificationEvidence } from "../schema/proof.js";
import { MEMORY_TRACE_KEY } from "../schema/trace.js";

// Helper to create a mock ActorRef
function createMockActor(id: string): ActorRef {
  return {
    actorId: id,
    kind: "human",
  };
}

// Helper to create a mock Proposal
function createMockProposal(): Proposal {
  return {
    proposalId: "proposal-123" as any,
    actor: createMockActor("actor-1"),
    intent: {
      intentId: "intent-123",
      intentKey: "action:test",
      body: {
        action: "test",
        input: {},
      },
    },
    baseWorld: "world-123" as any,
    status: "submitted",
    submittedAt: Date.now(),
  };
}

describe("createMemoryTrace()", () => {
  it("should create a valid MemoryTrace", () => {
    const selector = createMockActor("selector-1");
    const query = "search query";
    const atWorldId = "world-123" as any;
    const selected: SelectedMemory[] = [];

    const trace = createMemoryTrace(selector, query, atWorldId, selected);

    expect(trace.selector).toEqual(selector);
    expect(trace.query).toBe(query);
    expect(trace.atWorldId).toBe(atWorldId);
    expect(trace.selected).toEqual([]);
    expect(trace.selectedAt).toBeGreaterThan(0);
  });

  it("should include selected memories", () => {
    const selector = createMockActor("selector-1");
    const selected: SelectedMemory[] = [
      {
        ref: { worldId: "world-456" as any },
        reason: "Matched",
        confidence: 0.9,
        verified: true,
      },
    ];

    const trace = createMemoryTrace(
      selector,
      "query",
      "world-123" as any,
      selected
    );

    expect(trace.selected).toHaveLength(1);
    expect(trace.selected[0].reason).toBe("Matched");
  });
});

describe("createMemoryTraceFromResult()", () => {
  it("should create trace from SelectionResult", () => {
    const selector = createMockActor("selector-1");
    const result: SelectionResult = {
      selected: [
        {
          ref: { worldId: "world-456" as any },
          reason: "Matched",
          confidence: 0.9,
          verified: true,
        },
      ],
      selectedAt: 1704067200000,
    };

    const trace = createMemoryTraceFromResult(
      selector,
      "query",
      "world-123" as any,
      result
    );

    expect(trace.selectedAt).toBe(1704067200000);
    expect(trace.selected).toHaveLength(1);
  });
});

describe("attachToProposal()", () => {
  it("should attach trace to proposal without existing trace", () => {
    const proposal = createMockProposal();
    const memoryTrace = createMemoryTrace(
      createMockActor("selector"),
      "query",
      "world-123" as any,
      []
    );

    const result = attachToProposal(proposal, memoryTrace);

    expect(result.trace).toBeDefined();
    expect(result.trace?.context?.[MEMORY_TRACE_KEY]).toEqual(memoryTrace);
  });

  it("should preserve existing trace fields", () => {
    const proposal: Proposal = {
      ...createMockProposal(),
      trace: {
        summary: "Existing summary",
        reasoning: "Existing reasoning",
      },
    };
    const memoryTrace = createMemoryTrace(
      createMockActor("selector"),
      "query",
      "world-123" as any,
      []
    );

    const result = attachToProposal(proposal, memoryTrace);

    expect(result.trace?.summary).toBe("Existing summary");
    expect(result.trace?.reasoning).toBe("Existing reasoning");
    expect(result.trace?.context?.[MEMORY_TRACE_KEY]).toEqual(memoryTrace);
  });

  it("should preserve existing context fields", () => {
    const proposal: Proposal = {
      ...createMockProposal(),
      trace: {
        summary: "Summary",
        context: { other: "data" },
      },
    };
    const memoryTrace = createMemoryTrace(
      createMockActor("selector"),
      "query",
      "world-123" as any,
      []
    );

    const result = attachToProposal(proposal, memoryTrace);

    expect(result.trace?.context?.other).toBe("data");
    expect(result.trace?.context?.[MEMORY_TRACE_KEY]).toEqual(memoryTrace);
  });
});

describe("getFromProposal()", () => {
  it("should return undefined for proposal without trace", () => {
    const proposal = createMockProposal();

    const result = getFromProposal(proposal);

    expect(result).toBeUndefined();
  });

  it("should return undefined for proposal without memory trace", () => {
    const proposal: Proposal = {
      ...createMockProposal(),
      trace: {
        summary: "Summary",
      },
    };

    const result = getFromProposal(proposal);

    expect(result).toBeUndefined();
  });

  it("should return memory trace from proposal", () => {
    const memoryTrace = createMemoryTrace(
      createMockActor("selector"),
      "query",
      "world-123" as any,
      []
    );
    const proposal = attachToProposal(createMockProposal(), memoryTrace);

    const result = getFromProposal(proposal);

    expect(result).toEqual(memoryTrace);
  });
});

describe("hasTrace()", () => {
  it("should return false for proposal without memory trace", () => {
    const proposal = createMockProposal();

    expect(hasTrace(proposal)).toBe(false);
  });

  it("should return true for proposal with memory trace", () => {
    const memoryTrace = createMemoryTrace(
      createMockActor("selector"),
      "query",
      "world-123" as any,
      []
    );
    const proposal = attachToProposal(createMockProposal(), memoryTrace);

    expect(hasTrace(proposal)).toBe(true);
  });
});

describe("validateMemoryTrace()", () => {
  it("should validate correct trace", () => {
    const trace = {
      selector: { actorId: "actor-1", kind: "human" },
      query: "search query",
      selectedAt: Date.now(),
      atWorldId: "world-123",
      selected: [],
    };

    const result = validateMemoryTrace(trace);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject empty query", () => {
    const trace = {
      selector: { actorId: "actor-1", kind: "human" },
      query: "",
      selectedAt: Date.now(),
      atWorldId: "world-123",
      selected: [],
    };

    const result = validateMemoryTrace(trace);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("query"))).toBe(true);
  });

  it("should validate selected memories", () => {
    const trace = {
      selector: { actorId: "actor-1", kind: "human" },
      query: "query",
      selectedAt: Date.now(),
      atWorldId: "world-123",
      selected: [
        {
          ref: { worldId: "world-456" },
          reason: "", // Invalid: empty reason
          confidence: 0.9,
          verified: true,
        },
      ],
    };

    const result = validateMemoryTrace(trace);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("reason"))).toBe(true);
  });
});

describe("validateSelectedMemory()", () => {
  it("should validate correct memory", () => {
    const memory = {
      ref: { worldId: "world-123" },
      reason: "Matched query",
      confidence: 0.8,
      verified: true,
    };

    const result = validateSelectedMemory(memory);

    expect(result.valid).toBe(true);
  });

  it("should reject invalid confidence", () => {
    const memory = {
      ref: { worldId: "world-123" },
      reason: "Matched",
      confidence: 1.5, // Invalid
      verified: true,
    };

    const result = validateSelectedMemory(memory);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("confidence"))).toBe(true);
  });
});

describe("isMemoryTrace()", () => {
  it("should return true for valid trace", () => {
    const trace = {
      selector: { actorId: "actor-1", kind: "human" },
      query: "query",
      selectedAt: Date.now(),
      atWorldId: "world-123",
      selected: [],
    };

    expect(isMemoryTrace(trace)).toBe(true);
  });

  it("should return false for invalid trace", () => {
    const trace = { invalid: "data" };

    expect(isMemoryTrace(trace)).toBe(false);
  });
});

describe("extractProof()", () => {
  it("should extract proof from evidence (M-12)", () => {
    const evidence: VerificationEvidence = {
      method: "merkle",
      proof: { computedRoot: "root:abc" },
      verifiedAt: Date.now(),
      verifiedBy: createMockActor("verifier"),
    };

    const proof = extractProof(evidence);

    expect(proof.method).toBe("merkle");
    expect(proof.proof).toEqual({ computedRoot: "root:abc" });
    expect((proof as any).verifiedAt).toBeUndefined();
    expect((proof as any).verifiedBy).toBeUndefined();
  });
});
