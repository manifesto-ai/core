/**
 * Authority System Tests
 *
 * Tests for authority handlers and evaluator
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  AutoApproveHandler,
  createAutoApproveHandler,
} from "./auto.js";
import {
  PolicyRulesHandler,
  createPolicyRulesHandler,
  type CustomConditionEvaluator,
} from "./policy.js";
import {
  HITLHandler,
  createHITLHandler,
  type HITLNotificationCallback,
} from "./hitl.js";
import {
  TribunalHandler,
  createTribunalHandler,
  type TribunalNotificationCallback,
} from "./tribunal.js";
import {
  AuthorityEvaluator,
  createAuthorityEvaluator,
} from "./evaluator.js";
import type { Proposal } from "../schema/proposal.js";
import type { IntentInstance } from "../schema/intent.js";
import type {
  ActorAuthorityBinding,
  AutoApprovePolicy,
  HITLPolicy,
  PolicyRulesPolicy,
  TribunalPolicy,
} from "../schema/binding.js";
import type { ActorRef } from "../schema/actor.js";
import { createProposalId, createWorldId } from "../schema/world.js";
import { approvedResponse } from "../schema/authority.js";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestActor(overrides?: Partial<ActorRef>): ActorRef {
  return {
    actorId: "actor-1",
    kind: "agent",
    name: "Test Actor",
    ...overrides,
  };
}

function createTestIntent(overrides?: { type?: string; input?: unknown }): IntentInstance {
  return {
    body: {
      type: overrides?.type ?? "test:action",
      input: overrides?.input ?? { value: 42 },
    },
    intentId: "intent-1",
    intentKey: "test-key-intent-1",
    meta: {
      origin: {
        projectionId: "test:projection",
        source: { kind: "ui" as const, eventId: "event-1" },
        actor: { actorId: "test-actor", kind: "human" as const },
      },
    },
  };
}

function createTestProposal(overrides?: Partial<Proposal>): Proposal {
  return {
    proposalId: createProposalId("proposal-1"),
    actor: createTestActor(),
    intent: createTestIntent(),
    baseWorld: createWorldId("world-abc123"),
    status: "submitted",
    submittedAt: Date.now(),
    ...overrides,
  };
}

function createAutoApproveBinding(
  actor: ActorRef = createTestActor()
): ActorAuthorityBinding {
  const policy: AutoApprovePolicy = { mode: "auto_approve" };
  return {
    actor,
    authority: { authorityId: "auto-1", kind: "auto", name: "Auto Approve" },
    policy,
  };
}

function createHITLBinding(
  actor: ActorRef = createTestActor(),
  options?: { timeout?: number; onTimeout?: "approve" | "reject"; delegate?: ActorRef }
): ActorAuthorityBinding {
  const delegate = options?.delegate ?? { actorId: "human-1", kind: "human" as const, name: "Human Delegate" };
  const policy: HITLPolicy = {
    mode: "hitl",
    delegate,
    timeout: options?.timeout,
    onTimeout: options?.onTimeout,
  };
  return {
    actor,
    authority: { authorityId: "hitl-1", kind: "human", name: "Human Review" },
    policy,
  };
}

function createPolicyRulesBinding(
  actor: ActorRef = createTestActor(),
  rules: PolicyRulesPolicy["rules"] = [],
  defaultDecision: "approve" | "reject" | "escalate" = "reject"
): ActorAuthorityBinding {
  const policy: PolicyRulesPolicy = {
    mode: "policy_rules",
    rules,
    defaultDecision,
  };
  return {
    actor,
    authority: { authorityId: "policy-1", kind: "policy", name: "Policy Rules" },
    policy,
  };
}

function createTribunalBinding(
  actor: ActorRef = createTestActor(),
  members: ActorRef[] = [],
  quorum: TribunalPolicy["quorum"] = { kind: "majority" },
  options?: { timeout?: number; onTimeout?: "approve" | "reject" }
): ActorAuthorityBinding {
  const policy: TribunalPolicy = {
    mode: "tribunal",
    members,
    quorum,
    timeout: options?.timeout,
    onTimeout: options?.onTimeout,
  };
  return {
    actor,
    authority: { authorityId: "tribunal-1", kind: "tribunal", name: "Review Board" },
    policy,
  };
}

// ============================================================================
// AutoApproveHandler Tests
// ============================================================================

describe("AutoApproveHandler", () => {
  let handler: AutoApproveHandler;

  beforeEach(() => {
    handler = createAutoApproveHandler();
  });

  it("should create handler via factory", () => {
    expect(handler).toBeInstanceOf(AutoApproveHandler);
  });

  it("should always approve proposals", async () => {
    const proposal = createTestProposal();
    const binding = createAutoApproveBinding();

    const response = await handler.evaluate(proposal, binding);

    expect(response.kind).toBe("approved");
  });

  it("should approve different intent types", async () => {
    const proposal1 = createTestProposal({ intent: createTestIntent({ type: "read" }) });
    const proposal2 = createTestProposal({ intent: createTestIntent({ type: "write" }) });
    const proposal3 = createTestProposal({ intent: createTestIntent({ type: "delete" }) });
    const binding = createAutoApproveBinding();

    const [r1, r2, r3] = await Promise.all([
      handler.evaluate(proposal1, binding),
      handler.evaluate(proposal2, binding),
      handler.evaluate(proposal3, binding),
    ]);

    expect(r1.kind).toBe("approved");
    expect(r2.kind).toBe("approved");
    expect(r3.kind).toBe("approved");
  });

  it("should handle proposals from different actors", async () => {
    const actor1 = createTestActor({ actorId: "agent-1", kind: "agent" });
    const actor2 = createTestActor({ actorId: "human-1", kind: "human" });
    const actor3 = createTestActor({ actorId: "system-1", kind: "system" });

    const binding1 = createAutoApproveBinding(actor1);
    const binding2 = createAutoApproveBinding(actor2);
    const binding3 = createAutoApproveBinding(actor3);

    const proposal1 = createTestProposal({ actor: actor1 });
    const proposal2 = createTestProposal({ actor: actor2 });
    const proposal3 = createTestProposal({ actor: actor3 });

    const [r1, r2, r3] = await Promise.all([
      handler.evaluate(proposal1, binding1),
      handler.evaluate(proposal2, binding2),
      handler.evaluate(proposal3, binding3),
    ]);

    expect(r1.kind).toBe("approved");
    expect(r2.kind).toBe("approved");
    expect(r3.kind).toBe("approved");
  });
});

// ============================================================================
// PolicyRulesHandler Tests
// ============================================================================

describe("PolicyRulesHandler", () => {
  let handler: PolicyRulesHandler;

  beforeEach(() => {
    handler = createPolicyRulesHandler();
  });

  it("should create handler via factory", () => {
    expect(handler).toBeInstanceOf(PolicyRulesHandler);
  });

  describe("default decision", () => {
    it("should use default decision when no rules match", async () => {
      const proposal = createTestProposal();
      const binding = createPolicyRulesBinding(createTestActor(), [], "reject");

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("rejected");
    });

    it("should approve by default when configured", async () => {
      const proposal = createTestProposal();
      const binding = createPolicyRulesBinding(createTestActor(), [], "approve");

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("approved");
    });

    it("should handle escalate as default (rejects)", async () => {
      const proposal = createTestProposal();
      const binding = createPolicyRulesBinding(createTestActor(), [], "escalate");

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("rejected");
      // Escalate triggers rejection (not implemented as full escalation yet)
    });
  });

  describe("intent_type condition", () => {
    it("should match exact intent type", async () => {
      const proposal = createTestProposal({
        intent: createTestIntent({ type: "read" }),
      });
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "intent_type", types: ["read"] },
            decision: "approve",
            reason: "Read allowed",
          },
        ],
        "reject"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("approved");
    });

    it("should match one of multiple intent types", async () => {
      const proposal = createTestProposal({
        intent: createTestIntent({ type: "update" }),
      });
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "intent_type", types: ["create", "update", "delete"] },
            decision: "approve",
            reason: "CRUD allowed",
          },
        ],
        "reject"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("approved");
    });

    it("should not match when type not in list", async () => {
      const proposal = createTestProposal({
        intent: createTestIntent({ type: "admin:delete" }),
      });
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "intent_type", types: ["read", "write"] },
            decision: "approve",
          },
        ],
        "reject"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("rejected");
    });
  });

  describe("scope_pattern condition", () => {
    it("should match wildcard pattern", async () => {
      const proposal = createTestProposal({
        intent: createTestIntent({ type: "user:read" }),
      });
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "scope_pattern", pattern: "user:*" },
            decision: "approve",
          },
        ],
        "reject"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("approved");
    });

    it("should match prefix pattern", async () => {
      const proposal = createTestProposal({
        intent: createTestIntent({ type: "admin:settings:update" }),
      });
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "scope_pattern", pattern: "admin:*" },
            decision: "reject",
            reason: "Admin operations blocked",
          },
        ],
        "approve"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("rejected");
      if (response.kind === "rejected") {
        expect(response.reason).toBe("Admin operations blocked");
      }
    });

    it("should match exact pattern without wildcards", async () => {
      const proposal = createTestProposal({
        intent: createTestIntent({ type: "system:health" }),
      });
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "scope_pattern", pattern: "system:health" },
            decision: "approve",
          },
        ],
        "reject"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("approved");
    });

    it("should not match partial without wildcard", async () => {
      const proposal = createTestProposal({
        intent: createTestIntent({ type: "system:health:check" }),
      });
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "scope_pattern", pattern: "system:health" },
            decision: "approve",
          },
        ],
        "reject"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("rejected");
    });
  });

  describe("custom condition", () => {
    it("should call registered custom evaluator", async () => {
      const customEvaluator: CustomConditionEvaluator = vi.fn(() => true);
      handler.registerCustomEvaluator("always_true", customEvaluator);

      const proposal = createTestProposal();
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "custom", evaluator: "always_true" },
            decision: "approve",
          },
        ],
        "reject"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("approved");
      expect(customEvaluator).toHaveBeenCalledWith(proposal, binding);
    });

    it("should handle custom evaluator returning false", async () => {
      handler.registerCustomEvaluator("always_false", () => false);

      const proposal = createTestProposal();
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "custom", evaluator: "always_false" },
            decision: "approve",
          },
        ],
        "reject"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("rejected");
    });

    it("should return false for unknown custom evaluator", async () => {
      const proposal = createTestProposal();
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "custom", evaluator: "unknown_evaluator" },
            decision: "approve",
          },
        ],
        "reject"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("rejected");
    });

    it("should use custom evaluator with proposal input", async () => {
      handler.registerCustomEvaluator("check_amount", (proposal) => {
        const amount = (proposal.intent.body.input as { amount?: number })?.amount;
        return typeof amount === "number" && amount <= 1000;
      });

      const smallProposal = createTestProposal({
        intent: createTestIntent({ type: "payment", input: { amount: 500 } }),
      });
      const largeProposal = createTestProposal({
        intent: createTestIntent({ type: "payment", input: { amount: 5000 } }),
      });

      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "custom", evaluator: "check_amount" },
            decision: "approve",
            reason: "Amount within limit",
          },
        ],
        "reject"
      );

      const smallResponse = await handler.evaluate(smallProposal, binding);
      const largeResponse = await handler.evaluate(largeProposal, binding);

      expect(smallResponse.kind).toBe("approved");
      expect(largeResponse.kind).toBe("rejected");
    });
  });

  describe("rule evaluation order", () => {
    it("should stop at first matching rule", async () => {
      const proposal = createTestProposal({
        intent: createTestIntent({ type: "read" }),
      });
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "intent_type", types: ["read"] },
            decision: "approve",
            reason: "First rule",
          },
          {
            condition: { kind: "intent_type", types: ["read"] },
            decision: "reject",
            reason: "Second rule",
          },
        ],
        "reject"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("approved");
    });

    it("should try next rule if first doesn't match", async () => {
      const proposal = createTestProposal({
        intent: createTestIntent({ type: "write" }),
      });
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "intent_type", types: ["read"] },
            decision: "reject",
          },
          {
            condition: { kind: "intent_type", types: ["write"] },
            decision: "approve",
          },
        ],
        "reject"
      );

      const response = await handler.evaluate(proposal, binding);

      expect(response.kind).toBe("approved");
    });
  });

  it("should throw for non-policy_rules policy", async () => {
    const proposal = createTestProposal();
    const binding = createAutoApproveBinding();

    await expect(handler.evaluate(proposal, binding)).rejects.toThrow(
      "non-policy_rules policy"
    );
  });
});

// ============================================================================
// HITLHandler Tests
// ============================================================================

describe("HITLHandler", () => {
  let handler: HITLHandler;

  beforeEach(() => {
    handler = createHITLHandler();
  });

  it("should create handler via factory", () => {
    expect(handler).toBeInstanceOf(HITLHandler);
  });

  describe("basic flow", () => {
    it("should create pending state when evaluate is called", async () => {
      const proposal = createTestProposal();
      const binding = createHITLBinding();

      // Start evaluation (non-blocking)
      const promise = handler.evaluate(proposal, binding);

      // Should be pending
      expect(handler.isPending("proposal-1")).toBe(true);
      expect(handler.getPendingIds()).toContain("proposal-1");

      // Submit decision to resolve
      handler.submitDecision("proposal-1", "approved");
      const response = await promise;

      expect(response.kind).toBe("approved");
      expect(handler.isPending("proposal-1")).toBe(false);
    });

    it("should resolve with approved when decision is approved", async () => {
      const proposal = createTestProposal();
      const binding = createHITLBinding();

      const promise = handler.evaluate(proposal, binding);
      handler.submitDecision("proposal-1", "approved");

      const response = await promise;

      expect(response.kind).toBe("approved");
    });

    it("should resolve with rejected when decision is rejected", async () => {
      const proposal = createTestProposal();
      const binding = createHITLBinding();

      const promise = handler.evaluate(proposal, binding);
      handler.submitDecision("proposal-1", "rejected", "Not allowed");

      const response = await promise;

      expect(response.kind).toBe("rejected");
      if (response.kind === "rejected") {
        expect(response.reason).toBe("Not allowed");
      }
    });

    it("should use default reason when rejected without reasoning", async () => {
      const proposal = createTestProposal();
      const binding = createHITLBinding();

      const promise = handler.evaluate(proposal, binding);
      handler.submitDecision("proposal-1", "rejected");

      const response = await promise;

      expect(response.kind).toBe("rejected");
      if (response.kind === "rejected") {
        expect(response.reason).toBe("Human rejected");
      }
    });
  });

  describe("notification callback", () => {
    it("should call notification callback when pending", async () => {
      const callback: HITLNotificationCallback = vi.fn();
      handler.onPendingDecision(callback);

      const proposal = createTestProposal();
      const binding = createHITLBinding();

      const promise = handler.evaluate(proposal, binding);

      expect(callback).toHaveBeenCalledWith("proposal-1", proposal, binding);

      handler.submitDecision("proposal-1", "approved");
      await promise;
    });
  });

  describe("timeout handling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should reject on timeout by default", async () => {
      const proposal = createTestProposal();
      const binding = createHITLBinding(createTestActor(), { timeout: 1000 });

      const promise = handler.evaluate(proposal, binding);

      vi.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow("HITL decision timed out");
    });

    it("should approve on timeout when configured", async () => {
      const proposal = createTestProposal();
      const binding = createHITLBinding(createTestActor(), {
        timeout: 1000,
        onTimeout: "approve",
      });

      const promise = handler.evaluate(proposal, binding);

      vi.advanceTimersByTime(1001);

      const response = await promise;
      expect(response.kind).toBe("approved");
    });

    it("should clear timeout when decision is submitted", async () => {
      const proposal = createTestProposal();
      const binding = createHITLBinding(createTestActor(), { timeout: 5000 });

      const promise = handler.evaluate(proposal, binding);

      // Submit decision before timeout
      handler.submitDecision("proposal-1", "approved");

      // Advance time past timeout
      vi.advanceTimersByTime(6000);

      // Should still be approved (not rejected by timeout)
      const response = await promise;
      expect(response.kind).toBe("approved");
    });
  });

  describe("error handling", () => {
    it("should throw when submitting decision for unknown proposal", () => {
      expect(() => {
        handler.submitDecision("unknown-proposal", "approved");
      }).toThrow("No pending HITL decision");
    });

    it("should throw when proposal already has pending decision", async () => {
      const proposal = createTestProposal();
      const binding = createHITLBinding();

      // Start first evaluation
      handler.evaluate(proposal, binding);

      // Try to start second evaluation for same proposal
      await expect(handler.evaluate(proposal, binding)).rejects.toThrow(
        "already has a pending HITL decision"
      );

      // Clean up
      handler.submitDecision("proposal-1", "approved");
    });

    it("should throw for non-hitl policy", async () => {
      const proposal = createTestProposal();
      const binding = createAutoApproveBinding();

      await expect(handler.evaluate(proposal, binding)).rejects.toThrow(
        "non-hitl policy"
      );
    });
  });

  describe("cancellation", () => {
    it("should cancel pending decision", async () => {
      const proposal = createTestProposal();
      const binding = createHITLBinding();

      const promise = handler.evaluate(proposal, binding);

      const cancelled = handler.cancelPending("proposal-1", "Cancelled by user");

      expect(cancelled).toBe(true);
      expect(handler.isPending("proposal-1")).toBe(false);

      await expect(promise).rejects.toThrow("Cancelled by user");
    });

    it("should return false when cancelling non-existent proposal", () => {
      const cancelled = handler.cancelPending("unknown");
      expect(cancelled).toBe(false);
    });

    it("should clear all pending decisions", async () => {
      const binding = createHITLBinding();

      const p1 = handler.evaluate(createTestProposal({ proposalId: createProposalId("p1") }), binding);
      const p2 = handler.evaluate(createTestProposal({ proposalId: createProposalId("p2") }), binding);
      const p3 = handler.evaluate(createTestProposal({ proposalId: createProposalId("p3") }), binding);

      handler.clearAllPending();

      expect(handler.getPendingIds()).toHaveLength(0);

      await expect(p1).rejects.toThrow();
      await expect(p2).rejects.toThrow();
      await expect(p3).rejects.toThrow();
    });
  });
});

// ============================================================================
// TribunalHandler Tests
// ============================================================================

describe("TribunalHandler", () => {
  let handler: TribunalHandler;
  const member1: ActorRef = { actorId: "member-1", kind: "human", name: "Judge 1" };
  const member2: ActorRef = { actorId: "member-2", kind: "human", name: "Judge 2" };
  const member3: ActorRef = { actorId: "member-3", kind: "agent", name: "Judge 3" };

  beforeEach(() => {
    handler = createTribunalHandler();
  });

  it("should create handler via factory", () => {
    expect(handler).toBeInstanceOf(TribunalHandler);
  });

  describe("basic flow", () => {
    it("should create pending tribunal when evaluate is called", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(createTestActor(), [member1, member2, member3]);

      const promise = handler.evaluate(proposal, binding);

      expect(handler.isPending("proposal-1")).toBe(true);
      expect(handler.getPendingIds()).toContain("proposal-1");

      // Submit all votes to resolve
      handler.submitVote("proposal-1", member1, "approve");
      handler.submitVote("proposal-1", member2, "approve");

      const response = await promise;
      expect(response.kind).toBe("approved");
    });

    it("should notify when tribunal is needed", async () => {
      const callback: TribunalNotificationCallback = vi.fn();
      handler.onPendingTribunal(callback);

      const proposal = createTestProposal();
      const members = [member1, member2, member3];
      const binding = createTribunalBinding(createTestActor(), members);

      const promise = handler.evaluate(proposal, binding);

      expect(callback).toHaveBeenCalledWith("proposal-1", proposal, members);

      // Clean up
      handler.submitVote("proposal-1", member1, "approve");
      handler.submitVote("proposal-1", member2, "approve");
      await promise;
    });
  });

  describe("majority quorum", () => {
    it("should approve when majority votes approve", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3],
        { kind: "majority" }
      );

      const promise = handler.evaluate(proposal, binding);

      handler.submitVote("proposal-1", member1, "approve");
      handler.submitVote("proposal-1", member2, "approve");
      // member3 hasn't voted yet, but 2/3 majority reached

      const response = await promise;
      expect(response.kind).toBe("approved");
    });

    it("should reject when majority votes reject", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3],
        { kind: "majority" }
      );

      const promise = handler.evaluate(proposal, binding);

      handler.submitVote("proposal-1", member1, "reject");
      handler.submitVote("proposal-1", member2, "reject");

      const response = await promise;
      expect(response.kind).toBe("rejected");
    });

    it("should wait for more votes when no majority yet", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3],
        { kind: "majority" }
      );

      const promise = handler.evaluate(proposal, binding);

      handler.submitVote("proposal-1", member1, "approve");
      // Still pending, need majority (2/3)
      expect(handler.isPending("proposal-1")).toBe(true);

      handler.submitVote("proposal-1", member2, "approve");

      const response = await promise;
      expect(response.kind).toBe("approved");
    });

    it("should resolve on tie when all voted", async () => {
      const member4: ActorRef = { actorId: "member-4", kind: "human" };
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3, member4],
        { kind: "majority" }
      );

      const promise = handler.evaluate(proposal, binding);

      handler.submitVote("proposal-1", member1, "approve");
      handler.submitVote("proposal-1", member2, "approve");
      handler.submitVote("proposal-1", member3, "reject");
      handler.submitVote("proposal-1", member4, "reject");

      // 2-2 tie, should reject (approves need to exceed rejects for approval)
      const response = await promise;
      expect(response.kind).toBe("rejected");
    });
  });

  describe("unanimous quorum", () => {
    it("should approve when all vote approve", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3],
        { kind: "unanimous" }
      );

      const promise = handler.evaluate(proposal, binding);

      handler.submitVote("proposal-1", member1, "approve");
      handler.submitVote("proposal-1", member2, "approve");
      handler.submitVote("proposal-1", member3, "approve");

      const response = await promise;
      expect(response.kind).toBe("approved");
    });

    it("should reject immediately when any vote rejects", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3],
        { kind: "unanimous" }
      );

      const promise = handler.evaluate(proposal, binding);

      handler.submitVote("proposal-1", member1, "approve");
      handler.submitVote("proposal-1", member2, "reject"); // This should immediately reject

      const response = await promise;
      expect(response.kind).toBe("rejected");
    });
  });

  describe("threshold quorum", () => {
    it("should approve when threshold is reached", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3],
        { kind: "threshold", count: 2 }
      );

      const promise = handler.evaluate(proposal, binding);

      handler.submitVote("proposal-1", member1, "approve");
      handler.submitVote("proposal-1", member2, "approve");

      const response = await promise;
      expect(response.kind).toBe("approved");
    });

    it("should reject when threshold impossible", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3],
        { kind: "threshold", count: 3 } // Need all 3 to approve
      );

      const promise = handler.evaluate(proposal, binding);

      handler.submitVote("proposal-1", member1, "reject"); // Now impossible to reach threshold

      const response = await promise;
      expect(response.kind).toBe("rejected");
    });
  });

  describe("abstain votes", () => {
    it("should not count abstain toward approve or reject", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3],
        { kind: "majority" }
      );

      const promise = handler.evaluate(proposal, binding);

      handler.submitVote("proposal-1", member1, "approve");
      handler.submitVote("proposal-1", member2, "abstain");
      // Still pending, 1 approve, 0 reject, 1 abstain
      expect(handler.isPending("proposal-1")).toBe(true);

      handler.submitVote("proposal-1", member3, "approve");

      const response = await promise;
      expect(response.kind).toBe("approved");
    });
  });

  describe("vote retrieval", () => {
    it("should return votes for pending tribunal", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3],
        { kind: "unanimous" }
      );

      const promise = handler.evaluate(proposal, binding);

      handler.submitVote("proposal-1", member1, "approve", "Looks good");
      handler.submitVote("proposal-1", member2, "approve");

      const votes = handler.getVotes("proposal-1");
      expect(votes).toHaveLength(2);
      expect(votes[0]).toMatchObject({
        voter: member1,
        decision: "approve",
        reasoning: "Looks good",
      });

      // Complete the tribunal
      handler.submitVote("proposal-1", member3, "approve");
      await promise;
    });

    it("should return empty array for unknown proposal", () => {
      const votes = handler.getVotes("unknown");
      expect(votes).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("should throw when non-member tries to vote", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2],
        { kind: "majority" }
      );

      handler.evaluate(proposal, binding);

      expect(() => {
        handler.submitVote("proposal-1", member3, "approve"); // member3 not in tribunal
      }).toThrow("not a tribunal member");

      // Clean up
      handler.submitVote("proposal-1", member1, "approve");
      handler.submitVote("proposal-1", member2, "approve");
    });

    it("should throw when member votes twice", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2],
        { kind: "majority" }
      );

      handler.evaluate(proposal, binding);

      handler.submitVote("proposal-1", member1, "approve");

      expect(() => {
        handler.submitVote("proposal-1", member1, "reject");
      }).toThrow("has already voted");

      // Clean up
      handler.submitVote("proposal-1", member2, "approve");
    });

    it("should throw when voting on unknown proposal", () => {
      expect(() => {
        handler.submitVote("unknown", member1, "approve");
      }).toThrow("No pending tribunal");
    });

    it("should throw for non-tribunal policy", async () => {
      const proposal = createTestProposal();
      const binding = createAutoApproveBinding();

      await expect(handler.evaluate(proposal, binding)).rejects.toThrow(
        "non-tribunal policy"
      );
    });

    it("should throw when proposal already has pending tribunal", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(createTestActor(), [member1, member2]);

      handler.evaluate(proposal, binding);

      await expect(handler.evaluate(proposal, binding)).rejects.toThrow(
        "already has a pending tribunal"
      );

      // Clean up
      handler.submitVote("proposal-1", member1, "approve");
      handler.submitVote("proposal-1", member2, "approve");
    });
  });

  describe("timeout handling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should reject on timeout by default", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3],
        { kind: "majority" },
        { timeout: 5000 }
      );

      const promise = handler.evaluate(proposal, binding);

      vi.advanceTimersByTime(5001);

      await expect(promise).rejects.toThrow("HITL decision timed out");
    });

    it("should approve on timeout when configured", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2, member3],
        { kind: "majority" },
        { timeout: 5000, onTimeout: "approve" }
      );

      const promise = handler.evaluate(proposal, binding);

      vi.advanceTimersByTime(5001);

      const response = await promise;
      expect(response.kind).toBe("approved");
    });
  });

  describe("cancellation", () => {
    it("should cancel pending tribunal", async () => {
      const proposal = createTestProposal();
      const binding = createTribunalBinding(createTestActor(), [member1, member2]);

      const promise = handler.evaluate(proposal, binding);

      const cancelled = handler.cancelPending("proposal-1", "Review cancelled");

      expect(cancelled).toBe(true);
      expect(handler.isPending("proposal-1")).toBe(false);

      await expect(promise).rejects.toThrow("Review cancelled");
    });

    it("should return false when cancelling non-existent tribunal", () => {
      const cancelled = handler.cancelPending("unknown");
      expect(cancelled).toBe(false);
    });

    it("should clear all pending tribunals", async () => {
      const binding = createTribunalBinding(createTestActor(), [member1, member2]);

      const p1 = handler.evaluate(createTestProposal({ proposalId: createProposalId("p1") }), binding);
      const p2 = handler.evaluate(createTestProposal({ proposalId: createProposalId("p2") }), binding);

      handler.clearAllPending();

      expect(handler.getPendingIds()).toHaveLength(0);

      await expect(p1).rejects.toThrow("cleared all pending tribunals");
      await expect(p2).rejects.toThrow("cleared all pending tribunals");
    });
  });
});

// ============================================================================
// AuthorityEvaluator Tests
// ============================================================================

describe("AuthorityEvaluator", () => {
  let evaluator: AuthorityEvaluator;

  beforeEach(() => {
    evaluator = createAuthorityEvaluator();
  });

  it("should create evaluator via factory", () => {
    expect(evaluator).toBeInstanceOf(AuthorityEvaluator);
  });

  describe("routing", () => {
    it("should route auto_approve to AutoApproveHandler", async () => {
      const proposal = createTestProposal();
      const binding = createAutoApproveBinding();

      const response = await evaluator.evaluate(proposal, binding);

      expect(response.kind).toBe("approved");
    });

    it("should route policy_rules to PolicyRulesHandler", async () => {
      const proposal = createTestProposal({
        intent: createTestIntent({ type: "read" }),
      });
      const binding = createPolicyRulesBinding(
        createTestActor(),
        [
          {
            condition: { kind: "intent_type", types: ["read"] },
            decision: "approve",
          },
        ],
        "reject"
      );

      const response = await evaluator.evaluate(proposal, binding);

      expect(response.kind).toBe("approved");
    });

    it("should route hitl to HITLHandler", async () => {
      const proposal = createTestProposal();
      const binding = createHITLBinding();

      const promise = evaluator.evaluate(proposal, binding);

      // Check pending
      expect(evaluator.hasPendingHITL()).toBe(true);
      expect(evaluator.getPendingHITLIds()).toContain("proposal-1");

      // Submit decision
      evaluator.submitHITLDecision("proposal-1", "approved");

      const response = await promise;
      expect(response.kind).toBe("approved");
    });

    it("should route tribunal to TribunalHandler", async () => {
      const member1: ActorRef = { actorId: "m1", kind: "human" };
      const member2: ActorRef = { actorId: "m2", kind: "human" };

      const proposal = createTestProposal();
      const binding = createTribunalBinding(
        createTestActor(),
        [member1, member2],
        { kind: "majority" }
      );

      const promise = evaluator.evaluate(proposal, binding);

      // Check pending
      expect(evaluator.hasPendingTribunal()).toBe(true);
      expect(evaluator.getPendingTribunalIds()).toContain("proposal-1");

      // Submit votes
      evaluator.submitTribunalVote("proposal-1", member1, "approve");
      evaluator.submitTribunalVote("proposal-1", member2, "approve");

      const response = await promise;
      expect(response.kind).toBe("approved");
    });

    it("should throw for unknown policy mode", async () => {
      const proposal = createTestProposal();
      const binding = {
        actor: createTestActor(),
        authority: { authorityId: "unknown", kind: "auto" as const },
        policy: { mode: "unknown_mode" } as any,
      };

      await expect(evaluator.evaluate(proposal, binding)).rejects.toThrow(
        "Unknown policy mode"
      );
    });
  });

  describe("handler access", () => {
    it("should provide access to auto handler", () => {
      const handler = evaluator.getAutoHandler();
      expect(handler).toBeInstanceOf(AutoApproveHandler);
    });

    it("should provide access to policy handler", () => {
      const handler = evaluator.getPolicyHandler();
      expect(handler).toBeInstanceOf(PolicyRulesHandler);
    });

    it("should provide access to HITL handler", () => {
      const handler = evaluator.getHITLHandler();
      expect(handler).toBeInstanceOf(HITLHandler);
    });

    it("should provide access to tribunal handler", () => {
      const handler = evaluator.getTribunalHandler();
      expect(handler).toBeInstanceOf(TribunalHandler);
    });
  });

  describe("custom handler registration", () => {
    it("should allow registering custom handler", async () => {
      const customHandler = {
        evaluate: vi.fn(async () => approvedResponse()),
      };

      evaluator.registerHandler("custom_mode", customHandler);

      const proposal = createTestProposal();
      const binding = {
        actor: createTestActor(),
        authority: { authorityId: "custom", kind: "policy" as const },
        policy: { mode: "custom_mode" } as any,
      };

      const response = await evaluator.evaluate(proposal, binding);

      expect(response.kind).toBe("approved");
      expect(customHandler.evaluate).toHaveBeenCalledWith(proposal, binding);
    });
  });

  describe("pending state management", () => {
    it("should report no pending when empty", () => {
      expect(evaluator.hasPendingHITL()).toBe(false);
      expect(evaluator.hasPendingTribunal()).toBe(false);
      expect(evaluator.getPendingHITLIds()).toEqual([]);
      expect(evaluator.getPendingTribunalIds()).toEqual([]);
    });

    it("should clear all pending decisions", async () => {
      const member1: ActorRef = { actorId: "m1", kind: "human" };
      const member2: ActorRef = { actorId: "m2", kind: "human" };

      // Create pending HITL
      const hitlPromise = evaluator.evaluate(createTestProposal({ proposalId: createProposalId("hitl-1") }), createHITLBinding());

      // Create pending tribunal
      const tribunalPromise = evaluator.evaluate(
        createTestProposal({ proposalId: createProposalId("tribunal-1") }),
        createTribunalBinding(createTestActor(), [member1, member2])
      );

      expect(evaluator.hasPendingHITL()).toBe(true);
      expect(evaluator.hasPendingTribunal()).toBe(true);

      evaluator.clearAllPending();

      expect(evaluator.hasPendingHITL()).toBe(false);
      expect(evaluator.hasPendingTribunal()).toBe(false);

      // Await rejections to avoid unhandled rejection errors
      await expect(hitlPromise).rejects.toThrow();
      await expect(tribunalPromise).rejects.toThrow();
    });
  });

  describe("error wrapping", () => {
    it("should wrap non-WorldError in AUTHORITY_EVALUATION_ERROR", async () => {
      const faultyHandler = {
        evaluate: vi.fn(async () => {
          throw new Error("Handler crashed");
        }),
      };

      evaluator.registerHandler("faulty", faultyHandler);

      const proposal = createTestProposal();
      const binding = {
        actor: createTestActor(),
        authority: { authorityId: "faulty", kind: "policy" as const },
        policy: { mode: "faulty" } as any,
      };

      await expect(evaluator.evaluate(proposal, binding)).rejects.toThrow(
        "Authority evaluation failed"
      );
    });

    it("should pass through WorldError unchanged", async () => {
      const proposal = createTestProposal();
      const binding = createHITLBinding();

      evaluator.evaluate(proposal, binding);

      // Try to evaluate same proposal again (should throw WorldError)
      await expect(evaluator.evaluate(proposal, binding)).rejects.toThrow(
        "already has a pending HITL decision"
      );

      // Clean up
      evaluator.submitHITLDecision("proposal-1", "approved");
    });
  });
});
