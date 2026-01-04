/**
 * Level Authority Tests
 *
 * Tests for level-specific authority handlers.
 */

import { describe, it, expect } from "vitest";
import { createLevelAuthority } from "../authority/index.js";
import { createDeterministicAuthority } from "../authority/deterministic.js";
import { createConsistencyAuthority } from "../authority/consistency.js";
import { createSemanticAuditAuthority } from "../authority/semantic-audit.js";
import { createConfirmationAuthority } from "../authority/confirmation.js";
import type { ActorAuthorityBinding } from "@manifesto-ai/world";
import { createTestProposal, createTestIntent } from "./helpers/mock-world.js";

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestBinding(): ActorAuthorityBinding {
  return {
    actorId: "test-actor",
    authorityId: "test-authority",
    mode: "evaluate" as const,
    boundAt: Date.now(),
    policy: { mode: "evaluate" as const },
  };
}

// ============================================================================
// Level Authority Factory Tests
// ============================================================================

describe("createLevelAuthority", () => {
  it("creates Level 0 deterministic authority", () => {
    const authority = createLevelAuthority(0);

    expect(authority.level).toBe(0);
    expect(authority.verificationMethod).toBe("deterministic");
    expect(authority.guarantee).toBe("certain");
  });

  it("creates Level 1 consistency authority", () => {
    const authority = createLevelAuthority(1);

    expect(authority.level).toBe(1);
    expect(authority.verificationMethod).toBe("posterior_consistency");
    expect(authority.guarantee).toBe("consistent");
  });

  it("creates Level 2 semantic audit authority", () => {
    const authority = createLevelAuthority(2);

    expect(authority.level).toBe(2);
    expect(authority.verificationMethod).toBe("semantic_audit");
    expect(authority.guarantee).toBe("plausible");
  });

  it("creates Level 3 confirmation authority", () => {
    const authority = createLevelAuthority(3);

    expect(authority.level).toBe(3);
    expect(authority.verificationMethod).toBe("user_confirmation");
    expect(authority.guarantee).toBe("confirmed");
  });

  it("throws for invalid level", () => {
    expect(() => createLevelAuthority(4 as any)).toThrow("Invalid necessity level");
  });
});

// ============================================================================
// Level 0: Deterministic Authority Tests
// ============================================================================

describe("DeterministicAuthority", () => {
  const authority = createDeterministicAuthority();
  const binding = createTestBinding();

  it("has correct metadata", () => {
    expect(authority.level).toBe(0);
    expect(authority.verificationMethod).toBe("deterministic");
    expect(authority.guarantee).toBe("certain");
  });

  it("approves proposals without LLM role", async () => {
    const intent = createTestIntent("add-item", { item: "test" });
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("approved");
  });

  it("rejects proposals with LLM involvement", async () => {
    const intent = createTestIntent("add-item", {
      item: "test",
    });
    // Mark intent as LLM-generated via meta
    (intent.meta as Record<string, unknown>).llmUsed = true;
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("rejected");
    if (response.kind === "rejected") {
      expect(response.reason).toContain("LLM usage");
    }
  });
});

// ============================================================================
// Level 1: Consistency Authority Tests
// ============================================================================

describe("ConsistencyAuthority", () => {
  const binding = createTestBinding();

  it("has correct metadata", () => {
    const authority = createConsistencyAuthority();
    expect(authority.level).toBe(1);
    expect(authority.verificationMethod).toBe("posterior_consistency");
    expect(authority.guarantee).toBe("consistent");
  });

  it("approves proposals with high confidence", async () => {
    const authority = createConsistencyAuthority({ confidenceThreshold: 0.7 });
    const intent = createTestIntent("infer-state", {
      belief: { confidence: 0.9 }
    });
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("approved");
  });

  it("rejects proposals with low confidence", async () => {
    const authority = createConsistencyAuthority({ confidenceThreshold: 0.7 });
    const intent = createTestIntent("infer-state", {
      belief: { confidence: 0.5 }
    });
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("rejected");
    if (response.kind === "rejected") {
      expect(response.reason).toContain("Confidence");
    }
  });

  it("defaults to high confidence if not specified", async () => {
    const authority = createConsistencyAuthority();
    const intent = createTestIntent("infer-state", {});
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("approved");
  });

  it("rejects proposals with contradicting observations", async () => {
    const authority = createConsistencyAuthority();
    const intent = createTestIntent("infer-state", {
      belief: {
        confidence: 0.9,
        hypotheses: [
          {
            id: "h1",
            refutingConditions: [
              { observation: "obs1", reason: "contradicts" }
            ]
          }
        ],
        observations: [
          { id: "obs1", content: "something" }
        ]
      }
    });
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("rejected");
    if (response.kind === "rejected") {
      expect(response.reason).toContain("contradicts");
    }
  });
});

// ============================================================================
// Level 2: Semantic Audit Authority Tests
// ============================================================================

describe("SemanticAuditAuthority", () => {
  const authority = createSemanticAuditAuthority();
  const binding = createTestBinding();

  it("has correct metadata", () => {
    expect(authority.level).toBe(2);
    expect(authority.verificationMethod).toBe("semantic_audit");
    expect(authority.guarantee).toBe("plausible");
  });

  it("approves proposals without interpretation data", async () => {
    const intent = createTestIntent("interpret-rule", {});
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("approved");
  });

  it("approves proposals with high confidence interpretation", async () => {
    const intent = createTestIntent("interpret-rule", {
      interpretedRule: {
        confidence: "high",
        validation: { validated: true }
      }
    });
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("approved");
  });

  it("rejects proposals with low confidence interpretation", async () => {
    const authority = createSemanticAuditAuthority();
    const intent = createTestIntent("interpret-rule", {
      interpretedRule: {
        confidence: "low",
        validation: { validated: true }
      }
    });
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("rejected");
    if (response.kind === "rejected") {
      expect(response.reason).toContain("confidence");
    }
  });

  it("rejects proposals with critical assumptions", async () => {
    const intent = createTestIntent("interpret-rule", {
      interpretedRule: {
        confidence: "high",
        assumptions: [
          { impact: "critical" }
        ]
      }
    });
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("rejected");
    if (response.kind === "rejected") {
      expect(response.reason).toContain("critical assumption");
    }
  });
});

// ============================================================================
// Level 3: Confirmation Authority Tests
// ============================================================================

describe("ConfirmationAuthority", () => {
  const authority = createConfirmationAuthority();
  const binding = createTestBinding();

  it("has correct metadata", () => {
    expect(authority.level).toBe(3);
    expect(authority.verificationMethod).toBe("user_confirmation");
    expect(authority.guarantee).toBe("confirmed");
  });

  it("rejects proposals without grounding (no HITL)", async () => {
    const intent = createTestIntent("parse-intent", {});
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("rejected");
    if (response.kind === "rejected") {
      expect(response.reason).toContain("Level 3");
    }
  });

  it("approves proposals with confirmed grounding", async () => {
    const intent = createTestIntent("parse-intent", {
      grounding: {
        confirmation: {
          required: true,
          status: "confirmed"
        }
      }
    });
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("approved");
  });

  it("rejects proposals with rejected grounding", async () => {
    const intent = createTestIntent("parse-intent", {
      grounding: {
        confirmation: {
          required: true,
          status: "rejected"
        }
      }
    });
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("rejected");
    if (response.kind === "rejected") {
      expect(response.reason).toContain("rejected");
    }
  });

  it("rejects proposals with unresolved ambiguities", async () => {
    const intent = createTestIntent("parse-intent", {
      grounding: {
        ambiguities: [
          { resolutionMethod: "unresolved" }
        ]
      }
    });
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("rejected");
    if (response.kind === "rejected") {
      expect(response.reason).toContain("ambiguity");
    }
  });

  it("rejects proposals with low confidence resolutions", async () => {
    const intent = createTestIntent("parse-intent", {
      grounding: {
        referenceResolutions: [
          { confidence: 0.5 }
        ]
      }
    });
    const proposal = createTestProposal("actor-1", intent);

    const response = await authority.evaluate(proposal, binding);

    expect(response.kind).toBe("rejected");
    if (response.kind === "rejected") {
      expect(response.reason).toContain("Low confidence");
    }
  });
});
