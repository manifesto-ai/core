/**
 * HITL Prompt Builder Tests
 *
 * Tests for v1.1 HITL prompt building functionality.
 */

import { describe, it, expect } from "vitest";
import type { Snapshot, Proposal } from "@manifesto-ai/world";
import type {
  RenderContext,
  HITLPromptOptions,
  PendingReason,
  HITLAction,
  DecisionRecord,
} from "../types.js";
import {
  PendingReasons,
  lowConfidence,
  ambiguousIntent,
  requiresConfirmation,
  scopeExceeded,
  resourceLimit,
} from "../hitl/pending-reason.js";
import {
  HITLActions,
  retry,
  modify,
  requestInfo,
  escalate,
  abort,
  getDefaultActions,
} from "../hitl/actions.js";
import {
  buildPrompt,
  promptToText,
  promptToJSON,
} from "../hitl/prompt.js";
import {
  createHITLContext,
  createPendingDecisionRecord,
  canAutoResolve,
  getSuggestedAction,
} from "../hitl/context-v1.js";

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockSnapshot(): Snapshot {
  return {
    schemaHash: "test-hash",
    data: {
      items: [{ id: "1", name: "Test Item" }],
      count: 1,
    },
    version: 1,
    createdAt: Date.now(),
  };
}

function createMockProposal(): Proposal {
  return {
    proposalId: "proposal-001",
    actor: {
      actorId: "test-actor",
      type: "ai",
      metadata: {},
    },
    intent: {
      body: {
        type: "item.add",
        input: { name: "New Item" },
      },
      meta: {
        confidence: 0.7,
      },
    },
    status: "pending",
    submittedAt: Date.now(),
  };
}

function createMockRenderContext(): RenderContext {
  return {
    step: 5,
    totalSteps: 10,
    runId: "test-run-001",
    level: 2,
    state: {
      status: "waiting_hitl",
    },
    elapsedMs: 30000,
    recentEvents: [],
    mode: "interactive",
  };
}

// =============================================================================
// PendingReasons Tests
// =============================================================================

describe("PendingReasons", () => {
  describe("lowConfidence", () => {
    it("creates LOW_CONFIDENCE reason", () => {
      const reason = lowConfidence(0.65, 0.8);

      expect(reason.code).toBe("LOW_CONFIDENCE");
      expect(reason.description).toContain("65%");
      expect(reason.description).toContain("80%");
      expect(reason.details.confidence?.actual).toBe(0.65);
      expect(reason.details.confidence?.required).toBe(0.8);
      expect(reason.suggestions).toBeDefined();
      expect(reason.suggestions!.length).toBeGreaterThan(0);
    });

    it("accepts custom suggestions", () => {
      const reason = lowConfidence(0.5, 0.8, ["Custom suggestion"]);

      expect(reason.suggestions).toEqual(["Custom suggestion"]);
    });
  });

  describe("ambiguousIntent", () => {
    it("creates AMBIGUOUS_INTENT reason", () => {
      const reason = ambiguousIntent(
        ["interpretation1", "interpretation2"],
        "Which one is correct?"
      );

      expect(reason.code).toBe("AMBIGUOUS_INTENT");
      expect(reason.description).toContain("Which one is correct?");
      expect(reason.details.ambiguity?.interpretations).toHaveLength(2);
      expect(reason.details.ambiguity?.question).toBe("Which one is correct?");
    });
  });

  describe("requiresConfirmation", () => {
    it("creates REQUIRES_CONFIRMATION reason", () => {
      const reason = requiresConfirmation("delete-policy", "high");

      expect(reason.code).toBe("REQUIRES_CONFIRMATION");
      expect(reason.description).toContain("delete-policy");
      expect(reason.description).toContain("high-risk");
      expect(reason.details.confirmation?.policy).toBe("delete-policy");
      expect(reason.details.confirmation?.risk).toBe("high");
    });
  });

  describe("scopeExceeded", () => {
    it("creates SCOPE_EXCEEDED reason", () => {
      const reason = scopeExceeded(
        ["read", "write", "delete"],
        ["read", "write"]
      );

      expect(reason.code).toBe("SCOPE_EXCEEDED");
      expect(reason.description).toContain("delete");
      expect(reason.details.scope?.requested).toEqual(["read", "write", "delete"]);
      expect(reason.details.scope?.allowed).toEqual(["read", "write"]);
    });
  });

  describe("resourceLimit", () => {
    it("creates RESOURCE_LIMIT reason", () => {
      const reason = resourceLimit("memory", 1024, 512);

      expect(reason.code).toBe("RESOURCE_LIMIT");
      expect(reason.description).toContain("memory");
      expect(reason.description).toContain("1024");
      expect(reason.description).toContain("512");
      expect(reason.details.resource?.type).toBe("memory");
      expect(reason.details.resource?.requested).toBe(1024);
      expect(reason.details.resource?.limit).toBe(512);
    });
  });

  describe("PendingReasons namespace", () => {
    it("exposes all factory functions", () => {
      expect(typeof PendingReasons.lowConfidence).toBe("function");
      expect(typeof PendingReasons.ambiguousIntent).toBe("function");
      expect(typeof PendingReasons.requiresConfirmation).toBe("function");
      expect(typeof PendingReasons.scopeExceeded).toBe("function");
      expect(typeof PendingReasons.resourceLimit).toBe("function");
      expect(typeof PendingReasons.create).toBe("function");
    });
  });
});

// =============================================================================
// HITLActions Tests
// =============================================================================

describe("HITLActions", () => {
  describe("retry", () => {
    it("creates retry action", () => {
      const action = retry("Try again", "With more context");

      expect(action.type).toBe("retry");
      expect(action.description).toBe("Try again");
      expect(action.hint).toBe("With more context");
    });

    it("uses default description", () => {
      const action = retry();

      expect(action.type).toBe("retry");
      expect(action.description).toBeDefined();
    });
  });

  describe("modify", () => {
    it("creates modify action", () => {
      const action = modify(["input", "params"], "Modify parameters");

      expect(action.type).toBe("modify");
      expect(action.description).toBe("Modify parameters");
      expect(action.allowedModifications).toEqual(["input", "params"]);
    });
  });

  describe("requestInfo", () => {
    it("creates request_info action", () => {
      const action = requestInfo(["What is X?", "Why Y?"]);

      expect(action.type).toBe("request_info");
      expect(action.suggestedQuestions).toHaveLength(2);
    });
  });

  describe("escalate", () => {
    it("creates escalate action", () => {
      const action = escalate("admin");

      expect(action.type).toBe("escalate");
      expect(action.to).toBe("admin");
    });
  });

  describe("abort", () => {
    it("creates abort action", () => {
      const action = abort("Cancel operation");

      expect(action.type).toBe("abort");
      expect(action.description).toBe("Cancel operation");
    });
  });

  describe("getDefaultActions", () => {
    it("returns actions for LOW_CONFIDENCE", () => {
      const actions = getDefaultActions("LOW_CONFIDENCE");

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((a) => a.type === "retry")).toBe(true);
    });

    it("returns actions for AMBIGUOUS_INTENT", () => {
      const actions = getDefaultActions("AMBIGUOUS_INTENT");

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((a) => a.type === "request_info")).toBe(true);
    });

    it("returns actions for REQUIRES_CONFIRMATION", () => {
      const actions = getDefaultActions("REQUIRES_CONFIRMATION");

      expect(actions.length).toBeGreaterThan(0);
    });

    it("returns actions for SCOPE_EXCEEDED", () => {
      const actions = getDefaultActions("SCOPE_EXCEEDED");

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((a) => a.type === "modify")).toBe(true);
    });

    it("returns actions for RESOURCE_LIMIT", () => {
      const actions = getDefaultActions("RESOURCE_LIMIT");

      expect(actions.length).toBeGreaterThan(0);
    });
  });

  describe("HITLActions namespace", () => {
    it("exposes all factory functions", () => {
      expect(typeof HITLActions.retry).toBe("function");
      expect(typeof HITLActions.modify).toBe("function");
      expect(typeof HITLActions.requestInfo).toBe("function");
      expect(typeof HITLActions.escalate).toBe("function");
      expect(typeof HITLActions.abort).toBe("function");
      expect(typeof HITLActions.getDefaultActions).toBe("function");
    });

    it("exposes default action sets", () => {
      expect(typeof HITLActions.defaults.lowConfidence).toBe("function");
      expect(typeof HITLActions.defaults.ambiguousIntent).toBe("function");
      expect(typeof HITLActions.defaults.confirmation).toBe("function");
      expect(typeof HITLActions.defaults.scopeExceeded).toBe("function");
      expect(typeof HITLActions.defaults.resourceLimit).toBe("function");
    });
  });
});

// =============================================================================
// Prompt Builder Tests
// =============================================================================

describe("buildPrompt", () => {
  it("builds a complete prompt", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.7, 0.9);
    const availableActions = getDefaultActions("LOW_CONFIDENCE");

    const prompt = buildPrompt({
      snapshot,
      proposal,
      pendingReason,
      availableActions,
      renderContext,
    });

    expect(prompt.situation).toContain("Level 2");
    expect(prompt.situation).toContain("test-run-001");
    expect(prompt.situation).toContain("test-actor");

    expect(prompt.currentState).toBeDefined();

    expect(prompt.yourProposal.intentType).toBe("item.add");
    expect(prompt.yourProposal.content).toEqual({ name: "New Item" });

    expect(prompt.whyPending.reason).toBe("LOW_CONFIDENCE");
    expect(prompt.whyPending.description).toBeDefined();

    expect(prompt.options.length).toBeGreaterThan(0);
    // Should always include approve and reject
    expect(prompt.options.some((o) => o.id === "approve")).toBe(true);
    expect(prompt.options.some((o) => o.id === "reject")).toBe(true);
  });

  it("includes response schema when requested", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.7, 0.9);
    const availableActions: HITLAction[] = [];

    const prompt = buildPrompt({
      snapshot,
      proposal,
      pendingReason,
      availableActions,
      renderContext,
      promptOptions: {
        responseFormat: "json",
        includeSchema: true,
      },
    });

    expect(prompt.responseFormat).toBeDefined();
    expect(prompt.responseFormat?.type).toBe("json");
    expect(prompt.responseFormat?.schema).toBeDefined();
  });

  it("excludes available actions when includeActions is false", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.7, 0.9);
    const availableActions = getDefaultActions("LOW_CONFIDENCE");

    const prompt = buildPrompt({
      snapshot,
      proposal,
      pendingReason,
      availableActions,
      renderContext,
      promptOptions: {
        includeActions: false,
      },
    });

    // Should only have approve and reject
    expect(prompt.options.length).toBe(2);
    expect(prompt.options.every((o) => o.id === "approve" || o.id === "reject")).toBe(true);
  });
});

describe("promptToText", () => {
  it("converts prompt to readable text", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.7, 0.9);
    const availableActions: HITLAction[] = [];

    const prompt = buildPrompt({
      snapshot,
      proposal,
      pendingReason,
      availableActions,
      renderContext,
    });

    const text = promptToText(prompt);

    expect(text).toContain("HITL Decision Required");
    expect(text).toContain("Situation");
    expect(text).toContain("Current State");
    expect(text).toContain("Your Proposal");
    expect(text).toContain("Why Pending");
    expect(text).toContain("Available Options");
  });

  it("includes response format section when present", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.7, 0.9);
    const availableActions: HITLAction[] = [];

    const prompt = buildPrompt({
      snapshot,
      proposal,
      pendingReason,
      availableActions,
      renderContext,
      promptOptions: {
        responseFormat: "json",
        includeSchema: true,
      },
    });

    const text = promptToText(prompt);

    expect(text).toContain("Response Format");
  });
});

describe("promptToJSON", () => {
  it("converts prompt to JSON string", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.7, 0.9);
    const availableActions: HITLAction[] = [];

    const prompt = buildPrompt({
      snapshot,
      proposal,
      pendingReason,
      availableActions,
      renderContext,
    });

    const json = promptToJSON(prompt);
    const parsed = JSON.parse(json);

    expect(parsed.situation).toBeDefined();
    expect(parsed.yourProposal).toBeDefined();
  });

  it("supports pretty printing", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.7, 0.9);
    const availableActions: HITLAction[] = [];

    const prompt = buildPrompt({
      snapshot,
      proposal,
      pendingReason,
      availableActions,
      renderContext,
    });

    const json = promptToJSON(prompt, true);

    expect(json).toContain("\n");
    expect(json).toContain("  ");
  });
});

// =============================================================================
// HITLContext Tests
// =============================================================================

describe("createHITLContext", () => {
  it("creates a valid context", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.7, 0.9);
    const decisionRecord = createPendingDecisionRecord("test-authority");

    const context = createHITLContext({
      snapshot,
      proposal,
      pendingReason,
      renderContext,
      decisionRecord,
    });

    expect(context.snapshot).toBe(snapshot);
    expect(context.proposal).toBe(proposal);
    expect(context.pendingReason).toBe(pendingReason);
    expect(context.renderContext).toBe(renderContext);
    expect(context.decisionRecord).toBe(decisionRecord);
    expect(context.availableActions.length).toBeGreaterThan(0);
    expect(typeof context.toPrompt).toBe("function");
  });

  it("uses custom available actions when provided", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.7, 0.9);
    const decisionRecord = createPendingDecisionRecord("test-authority");
    const customActions: HITLAction[] = [abort("Custom abort")];

    const context = createHITLContext({
      snapshot,
      proposal,
      pendingReason,
      renderContext,
      decisionRecord,
      availableActions: customActions,
    });

    expect(context.availableActions).toBe(customActions);
    expect(context.availableActions).toHaveLength(1);
    expect(context.availableActions[0].type).toBe("abort");
  });

  it("generates prompt via toPrompt()", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.7, 0.9);
    const decisionRecord = createPendingDecisionRecord("test-authority");

    const context = createHITLContext({
      snapshot,
      proposal,
      pendingReason,
      renderContext,
      decisionRecord,
    });

    const prompt = context.toPrompt();

    expect(prompt.situation).toBeDefined();
    expect(prompt.yourProposal.intentType).toBe("item.add");
    expect(prompt.whyPending.reason).toBe("LOW_CONFIDENCE");
  });

  it("passes options to toPrompt()", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.7, 0.9);
    const decisionRecord = createPendingDecisionRecord("test-authority");

    const context = createHITLContext({
      snapshot,
      proposal,
      pendingReason,
      renderContext,
      decisionRecord,
    });

    const prompt = context.toPrompt({
      responseFormat: "json",
      includeSchema: true,
    });

    expect(prompt.responseFormat).toBeDefined();
  });
});

describe("createPendingDecisionRecord", () => {
  it("creates a pending decision record", () => {
    const record = createPendingDecisionRecord("auth-001");

    expect(record.authorityId).toBe("auth-001");
    expect(record.decision).toBe("pending");
    expect(record.timestamp).toBeGreaterThan(0);
  });

  it("accepts optional fields", () => {
    const record = createPendingDecisionRecord("auth-001", {
      confidence: 0.7,
      note: "Test note",
      verificationMethod: "semantic_audit",
    });

    expect(record.confidence).toBe(0.7);
    expect(record.note).toBe("Test note");
    expect(record.verificationMethod).toBe("semantic_audit");
  });
});

describe("canAutoResolve", () => {
  it("returns true for low confidence within threshold gap", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.85, 0.9); // 5% gap, within 10%
    const decisionRecord = createPendingDecisionRecord("test");

    const context = createHITLContext({
      snapshot,
      proposal,
      pendingReason,
      renderContext,
      decisionRecord,
    });

    expect(canAutoResolve(context)).toBe(true);
  });

  it("returns false for low confidence with large gap", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.5, 0.9); // 40% gap
    const decisionRecord = createPendingDecisionRecord("test");

    const context = createHITLContext({
      snapshot,
      proposal,
      pendingReason,
      renderContext,
      decisionRecord,
    });

    expect(canAutoResolve(context)).toBe(false);
  });

  it("returns true for low-risk confirmation", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = requiresConfirmation("policy", "low");
    const decisionRecord = createPendingDecisionRecord("test");

    const context = createHITLContext({
      snapshot,
      proposal,
      pendingReason,
      renderContext,
      decisionRecord,
    });

    expect(canAutoResolve(context)).toBe(true);
  });

  it("returns false for high-risk confirmation", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = requiresConfirmation("policy", "high");
    const decisionRecord = createPendingDecisionRecord("test");

    const context = createHITLContext({
      snapshot,
      proposal,
      pendingReason,
      renderContext,
      decisionRecord,
    });

    expect(canAutoResolve(context)).toBe(false);
  });
});

describe("getSuggestedAction", () => {
  it("returns retry for auto-resolvable low confidence", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = lowConfidence(0.85, 0.9);
    const decisionRecord = createPendingDecisionRecord("test");

    const context = createHITLContext({
      snapshot,
      proposal,
      pendingReason,
      renderContext,
      decisionRecord,
    });

    expect(getSuggestedAction(context)).toBe("retry");
  });

  it("returns retry for low-risk confirmation", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = requiresConfirmation("policy", "low");
    const decisionRecord = createPendingDecisionRecord("test");

    const context = createHITLContext({
      snapshot,
      proposal,
      pendingReason,
      renderContext,
      decisionRecord,
    });

    expect(getSuggestedAction(context)).toBe("retry");
  });

  it("returns null for non-auto-resolvable", () => {
    const snapshot = createMockSnapshot();
    const proposal = createMockProposal();
    const renderContext = createMockRenderContext();
    const pendingReason = scopeExceeded(["admin"], ["user"]);
    const decisionRecord = createPendingDecisionRecord("test");

    const context = createHITLContext({
      snapshot,
      proposal,
      pendingReason,
      renderContext,
      decisionRecord,
    });

    expect(getSuggestedAction(context)).toBe(null);
  });
});
