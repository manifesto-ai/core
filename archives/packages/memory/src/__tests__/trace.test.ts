/**
 * Trace Utility Tests
 *
 * Tests for trace creation, attachment, and validation utilities.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { Proposal, ActorRef, WorldId } from "@manifesto-ai/world";
import type { SelectedMemory, SelectionResult } from "../schema/selection.js";
import type { MemoryTrace } from "../schema/trace.js";
import {
  createMemoryTrace,
  createMemoryTraceFromResult,
} from "../trace/create.js";
import {
  attachToProposal,
  getFromProposal,
  hasTrace,
} from "../trace/attach.js";
import {
  validateMemoryTrace,
  validateSelectedMemory,
  validateVerificationEvidence,
  hasRequiredEvidence,
  allVerified,
  filterByConfidence,
  meetsConstraints,
} from "../trace/validate.js";

// Test fixtures
const testActor: ActorRef = { actorId: "test-user", kind: "human" };
const testWorldId: WorldId = "world-123" as WorldId;

const createSelectedMemory = (
  overrides: Partial<SelectedMemory> = {}
): SelectedMemory => ({
  ref: { worldId: "memory-world-1" },
  reason: "Test selection",
  confidence: 0.8,
  verified: true,
  ...overrides,
});

const createMinimalProposal = (): Proposal =>
  ({
    proposalId: "proposal-123",
    worldId: testWorldId,
    actor: testActor,
    intents: [],
    createdAt: Date.now(),
  }) as unknown as Proposal;

describe("createMemoryTrace", () => {
  it("should create a valid memory trace", () => {
    const selected = [createSelectedMemory()];
    const trace = createMemoryTrace(testActor, "test query", testWorldId, selected);

    expect(trace.selector).toEqual(testActor);
    expect(trace.query).toBe("test query");
    expect(trace.atWorldId).toBe(testWorldId);
    expect(trace.selected).toHaveLength(1);
    expect(typeof trace.selectedAt).toBe("number");
    expect(trace.selectedAt).toBeGreaterThan(0);
  });

  it("should handle empty selections", () => {
    const trace = createMemoryTrace(testActor, "empty query", testWorldId, []);

    expect(trace.selected).toHaveLength(0);
    expect(trace.query).toBe("empty query");
  });

  it("should copy the selected array", () => {
    const selected = [createSelectedMemory()];
    const trace = createMemoryTrace(testActor, "query", testWorldId, selected);

    // Modifying original array should not affect trace
    selected.push(createSelectedMemory({ confidence: 0.5 }));
    expect(trace.selected).toHaveLength(1);
  });

  it("should set selectedAt to current time", () => {
    const before = Date.now();
    const trace = createMemoryTrace(testActor, "query", testWorldId, []);
    const after = Date.now();

    expect(trace.selectedAt).toBeGreaterThanOrEqual(before);
    expect(trace.selectedAt).toBeLessThanOrEqual(after);
  });
});

describe("createMemoryTraceFromResult", () => {
  it("should use selectedAt from result", () => {
    const result: SelectionResult = {
      selected: [createSelectedMemory()],
      selectedAt: 1704067200000,
    };

    const trace = createMemoryTraceFromResult(
      testActor,
      "query",
      testWorldId,
      result
    );

    expect(trace.selectedAt).toBe(1704067200000);
  });

  it("should copy selected from result", () => {
    const result: SelectionResult = {
      selected: [
        createSelectedMemory({ confidence: 0.9 }),
        createSelectedMemory({ confidence: 0.7 }),
      ],
      selectedAt: Date.now(),
    };

    const trace = createMemoryTraceFromResult(
      testActor,
      "query",
      testWorldId,
      result
    );

    expect(trace.selected).toHaveLength(2);
    expect(trace.selected[0].confidence).toBe(0.9);
    expect(trace.selected[1].confidence).toBe(0.7);
  });
});

describe("attachToProposal", () => {
  it("should attach trace to proposal without existing trace", () => {
    const proposal = createMinimalProposal();
    const trace = createMemoryTrace(testActor, "query", testWorldId, []);

    const result = attachToProposal(proposal, trace);

    expect(result.trace).toBeDefined();
    expect(result.trace?.context?.memory).toEqual(trace);
  });

  it("should preserve existing trace fields", () => {
    const proposal = {
      ...createMinimalProposal(),
      trace: {
        summary: "Existing summary",
        reasoning: "Existing reasoning",
      },
    } as unknown as Proposal;
    const trace = createMemoryTrace(testActor, "query", testWorldId, []);

    const result = attachToProposal(proposal, trace);

    expect(result.trace?.summary).toBe("Existing summary");
    expect(result.trace?.reasoning).toBe("Existing reasoning");
    expect(result.trace?.context?.memory).toEqual(trace);
  });

  it("should preserve existing context fields", () => {
    const proposal = {
      ...createMinimalProposal(),
      trace: {
        summary: "Summary",
        context: {
          existingKey: "existingValue",
        },
      },
    } as unknown as Proposal;
    const trace = createMemoryTrace(testActor, "query", testWorldId, []);

    const result = attachToProposal(proposal, trace);

    expect((result.trace?.context as Record<string, unknown>)?.existingKey).toBe("existingValue");
    expect(result.trace?.context?.memory).toEqual(trace);
  });

  it("should not mutate original proposal", () => {
    const proposal = createMinimalProposal();
    const trace = createMemoryTrace(testActor, "query", testWorldId, []);

    attachToProposal(proposal, trace);

    expect(proposal.trace).toBeUndefined();
  });
});

describe("getFromProposal", () => {
  it("should return undefined for proposal without trace", () => {
    const proposal = createMinimalProposal();
    const result = getFromProposal(proposal);
    expect(result).toBeUndefined();
  });

  it("should return undefined for proposal without context", () => {
    const proposal = {
      ...createMinimalProposal(),
      trace: { summary: "No context" },
    } as unknown as Proposal;
    const result = getFromProposal(proposal);
    expect(result).toBeUndefined();
  });

  it("should return undefined for proposal without memory key", () => {
    const proposal = {
      ...createMinimalProposal(),
      trace: { summary: "Has context", context: { other: "value" } },
    } as unknown as Proposal;
    const result = getFromProposal(proposal);
    expect(result).toBeUndefined();
  });

  it("should return trace for proposal with memory trace", () => {
    const proposal = createMinimalProposal();
    const trace = createMemoryTrace(testActor, "query", testWorldId, [
      createSelectedMemory(),
    ]);
    const withTrace = attachToProposal(proposal, trace);

    const result = getFromProposal(withTrace);

    expect(result).toEqual(trace);
  });
});

describe("hasTrace", () => {
  it("should return false for proposal without trace", () => {
    const proposal = createMinimalProposal();
    expect(hasTrace(proposal)).toBe(false);
  });

  it("should return true for proposal with trace", () => {
    const proposal = createMinimalProposal();
    const trace = createMemoryTrace(testActor, "query", testWorldId, []);
    const withTrace = attachToProposal(proposal, trace);

    expect(hasTrace(withTrace)).toBe(true);
  });
});

describe("validateMemoryTrace", () => {
  it("should validate a valid trace", () => {
    const trace: MemoryTrace = {
      selector: testActor,
      query: "test query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [],
    };

    const result = validateMemoryTrace(trace);
    expect(result.valid).toBe(true);
  });

  it("should invalidate trace with empty query", () => {
    const trace = {
      selector: testActor,
      query: "",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [],
    };

    const result = validateMemoryTrace(trace);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("should invalidate trace with missing selector", () => {
    const trace = {
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [],
    };

    const result = validateMemoryTrace(trace);
    expect(result.valid).toBe(false);
  });
});

describe("validateSelectedMemory", () => {
  it("should validate a valid selected memory", () => {
    const memory = createSelectedMemory();
    const result = validateSelectedMemory(memory);
    expect(result.valid).toBe(true);
  });

  it("should invalidate memory with empty reason", () => {
    const memory = createSelectedMemory({ reason: "" });
    const result = validateSelectedMemory(memory);
    expect(result.valid).toBe(false);
  });

  it("should invalidate memory with out-of-range confidence", () => {
    const memory = createSelectedMemory({ confidence: 1.5 });
    const result = validateSelectedMemory(memory);
    expect(result.valid).toBe(false);
  });
});

describe("validateVerificationEvidence", () => {
  it("should validate valid evidence", () => {
    const evidence = {
      method: "hash",
      proof: { computedHash: "abc" },
      verifiedAt: Date.now(),
      verifiedBy: testActor,
    };

    const result = validateVerificationEvidence(evidence);
    expect(result.valid).toBe(true);
  });

  it("should invalidate evidence with missing verifiedBy", () => {
    const evidence = {
      method: "hash",
      verifiedAt: Date.now(),
    };

    const result = validateVerificationEvidence(evidence);
    expect(result.valid).toBe(false);
  });
});

describe("hasRequiredEvidence", () => {
  it("should return true when all memories have required evidence", () => {
    const trace: MemoryTrace = {
      selector: testActor,
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [
        createSelectedMemory({
          evidence: {
            method: "hash",
            verifiedAt: Date.now(),
            verifiedBy: testActor,
          },
        }),
        createSelectedMemory({
          evidence: {
            method: "merkle",
            verifiedAt: Date.now(),
            verifiedBy: testActor,
          },
        }),
      ],
    };

    expect(hasRequiredEvidence(trace)).toBe(true);
  });

  it("should return false when method is 'none'", () => {
    const trace: MemoryTrace = {
      selector: testActor,
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [
        createSelectedMemory({
          evidence: {
            method: "none",
            verifiedAt: Date.now(),
            verifiedBy: testActor,
          },
        }),
      ],
    };

    expect(hasRequiredEvidence(trace)).toBe(false);
  });

  it("should return false when evidence is missing", () => {
    const trace: MemoryTrace = {
      selector: testActor,
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [
        createSelectedMemory({ evidence: undefined }),
      ],
    };

    expect(hasRequiredEvidence(trace)).toBe(false);
  });

  it("should return true for empty selected array", () => {
    const trace: MemoryTrace = {
      selector: testActor,
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [],
    };

    expect(hasRequiredEvidence(trace)).toBe(true);
  });
});

describe("allVerified", () => {
  it("should return true when all memories are verified", () => {
    const trace: MemoryTrace = {
      selector: testActor,
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [
        createSelectedMemory({ verified: true }),
        createSelectedMemory({ verified: true }),
      ],
    };

    expect(allVerified(trace)).toBe(true);
  });

  it("should return false when any memory is not verified", () => {
    const trace: MemoryTrace = {
      selector: testActor,
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [
        createSelectedMemory({ verified: true }),
        createSelectedMemory({ verified: false }),
      ],
    };

    expect(allVerified(trace)).toBe(false);
  });

  it("should return true for empty selected array", () => {
    const trace: MemoryTrace = {
      selector: testActor,
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [],
    };

    expect(allVerified(trace)).toBe(true);
  });
});

describe("filterByConfidence", () => {
  it("should filter memories by minimum confidence", () => {
    const trace: MemoryTrace = {
      selector: testActor,
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [
        createSelectedMemory({ confidence: 0.9 }),
        createSelectedMemory({ confidence: 0.5 }),
        createSelectedMemory({ confidence: 0.3 }),
      ],
    };

    const filtered = filterByConfidence(trace, 0.5);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].confidence).toBe(0.9);
    expect(filtered[1].confidence).toBe(0.5);
  });

  it("should return all memories if minConfidence is 0", () => {
    const trace: MemoryTrace = {
      selector: testActor,
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [
        createSelectedMemory({ confidence: 0.1 }),
        createSelectedMemory({ confidence: 0.0 }),
      ],
    };

    const filtered = filterByConfidence(trace, 0);

    expect(filtered).toHaveLength(2);
  });

  it("should return empty array if no memories meet threshold", () => {
    const trace: MemoryTrace = {
      selector: testActor,
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [
        createSelectedMemory({ confidence: 0.3 }),
      ],
    };

    const filtered = filterByConfidence(trace, 0.5);

    expect(filtered).toHaveLength(0);
  });
});

describe("meetsConstraints", () => {
  let trace: MemoryTrace;

  beforeEach(() => {
    trace = {
      selector: testActor,
      query: "query",
      selectedAt: Date.now(),
      atWorldId: testWorldId,
      selected: [
        createSelectedMemory({
          confidence: 0.8,
          verified: true,
          evidence: {
            method: "hash",
            verifiedAt: Date.now(),
            verifiedBy: testActor,
          },
        }),
        createSelectedMemory({
          confidence: 0.6,
          verified: true,
          evidence: {
            method: "merkle",
            verifiedAt: Date.now(),
            verifiedBy: testActor,
          },
        }),
      ],
    };
  });

  it("should return true for empty constraints", () => {
    expect(meetsConstraints(trace, {})).toBe(true);
  });

  it("should check maxResults constraint", () => {
    expect(meetsConstraints(trace, { maxResults: 3 })).toBe(true);
    expect(meetsConstraints(trace, { maxResults: 2 })).toBe(true);
    expect(meetsConstraints(trace, { maxResults: 1 })).toBe(false);
  });

  it("should check minConfidence constraint", () => {
    expect(meetsConstraints(trace, { minConfidence: 0.5 })).toBe(true);
    expect(meetsConstraints(trace, { minConfidence: 0.7 })).toBe(false);
  });

  it("should check requireVerified constraint", () => {
    expect(meetsConstraints(trace, { requireVerified: true })).toBe(true);

    trace.selected[0] = createSelectedMemory({ verified: false });
    expect(meetsConstraints(trace, { requireVerified: true })).toBe(false);
  });

  it("should check requireEvidence constraint", () => {
    expect(meetsConstraints(trace, { requireEvidence: true })).toBe(true);

    trace.selected[0] = createSelectedMemory({ evidence: undefined });
    expect(meetsConstraints(trace, { requireEvidence: true })).toBe(false);
  });

  it("should check multiple constraints together", () => {
    expect(
      meetsConstraints(trace, {
        maxResults: 5,
        minConfidence: 0.5,
        requireVerified: true,
        requireEvidence: true,
      })
    ).toBe(true);
  });
});
