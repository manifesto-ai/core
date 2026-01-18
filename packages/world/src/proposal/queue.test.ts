import { describe, it, expect, beforeEach } from "vitest";
import { ProposalQueue, createProposalQueue } from "./queue.js";
import {
  isValidTransition,
  isTerminalStatus,
  getValidTransitions,
  requiresDecision,
  createsWorld,
} from "./state-machine.js";
import { createHumanActor, createAgentActor } from "../schema/actor.js";
import { createWorldId, createDecisionId, createProposalId } from "../schema/world.js";
import type { IntentInstance } from "../schema/intent.js";
import { createExecutionKey } from "../types/index.js";

describe("State Machine", () => {
  describe("isValidTransition", () => {
    it("should allow submitted → evaluating", () => {
      expect(isValidTransition("submitted", "evaluating")).toBe(true);
    });

    it("should NOT allow submitted → approved", () => {
      expect(isValidTransition("submitted", "approved")).toBe(false);
    });

    it("should allow submitted → rejected", () => {
      expect(isValidTransition("submitted", "rejected")).toBe(true);
    });

    it("should allow evaluating → approved", () => {
      expect(isValidTransition("evaluating", "approved")).toBe(true);
    });

    it("should allow evaluating → rejected", () => {
      expect(isValidTransition("evaluating", "rejected")).toBe(true);
    });

    it("should allow approved → executing", () => {
      expect(isValidTransition("approved", "executing")).toBe(true);
    });

    it("should allow executing → completed", () => {
      expect(isValidTransition("executing", "completed")).toBe(true);
    });

    it("should allow executing → failed", () => {
      expect(isValidTransition("executing", "failed")).toBe(true);
    });

    it("should NOT allow skipping states", () => {
      expect(isValidTransition("submitted", "executing")).toBe(false);
      expect(isValidTransition("submitted", "completed")).toBe(false);
      expect(isValidTransition("evaluating", "executing")).toBe(false);
    });

    it("should NOT allow reverse transitions", () => {
      expect(isValidTransition("approved", "evaluating")).toBe(false);
      expect(isValidTransition("approved", "submitted")).toBe(false);
      expect(isValidTransition("executing", "approved")).toBe(false);
    });

    it("should NOT allow transitions from terminal states", () => {
      expect(isValidTransition("completed", "submitted")).toBe(false);
      expect(isValidTransition("rejected", "evaluating")).toBe(false);
      expect(isValidTransition("failed", "executing")).toBe(false);
    });
  });

  describe("isTerminalStatus", () => {
    it("should identify terminal statuses", () => {
      expect(isTerminalStatus("completed")).toBe(true);
      expect(isTerminalStatus("rejected")).toBe(true);
      expect(isTerminalStatus("failed")).toBe(true);
    });

    it("should identify non-terminal statuses", () => {
      expect(isTerminalStatus("submitted")).toBe(false);
      expect(isTerminalStatus("evaluating")).toBe(false);
      expect(isTerminalStatus("approved")).toBe(false);
      expect(isTerminalStatus("executing")).toBe(false);
    });
  });

  describe("getValidTransitions", () => {
    it("should return valid transitions for each status", () => {
      expect(getValidTransitions("submitted")).toEqual(["evaluating", "rejected"]);
      expect(getValidTransitions("evaluating")).toEqual(["approved", "rejected"]);
      expect(getValidTransitions("approved")).toEqual(["executing"]);
      expect(getValidTransitions("executing")).toEqual(["completed", "failed"]);
      expect(getValidTransitions("completed")).toEqual([]);
      expect(getValidTransitions("rejected")).toEqual([]);
      expect(getValidTransitions("failed")).toEqual([]);
    });
  });

  describe("requiresDecision", () => {
    it("should require decision for approved/rejected", () => {
      expect(requiresDecision("approved")).toBe(true);
      expect(requiresDecision("rejected")).toBe(true);
    });

    it("should NOT require decision for other statuses", () => {
      expect(requiresDecision("submitted")).toBe(false);
      expect(requiresDecision("evaluating")).toBe(false);
      expect(requiresDecision("executing")).toBe(false);
      expect(requiresDecision("completed")).toBe(false);
      expect(requiresDecision("failed")).toBe(false);
    });
  });

  describe("createsWorld", () => {
    it("should create world for completed/failed", () => {
      expect(createsWorld("completed")).toBe(true);
      expect(createsWorld("failed")).toBe(true);
    });

    it("should NOT create world for other statuses", () => {
      expect(createsWorld("submitted")).toBe(false);
      expect(createsWorld("evaluating")).toBe(false);
      expect(createsWorld("approved")).toBe(false);
      expect(createsWorld("rejected")).toBe(false);
      expect(createsWorld("executing")).toBe(false);
    });
  });
});

describe("ProposalQueue", () => {
  let queue: ProposalQueue;

  const alice = createHumanActor("alice", "Alice");
  const bob = createHumanActor("bob", "Bob");
  const agent = createAgentActor("agent-1", "AI Agent");

  const world1 = createWorldId("world-1");
  const world2 = createWorldId("world-2");

  const intent1: IntentInstance = {
    body: {
      type: "addTodo",
      input: { title: "Test" },
    },
    intentId: "intent-1",
    intentKey: "key-1",
    meta: {
      origin: {
        projectionId: "test:projection",
        source: { kind: "ui", eventId: "event-1" },
        actor: alice,
      },
    },
  };

  const intent2: IntentInstance = {
    body: {
      type: "removeTodo",
      input: { id: "todo-1" },
    },
    intentId: "intent-2",
    intentKey: "key-2",
    meta: {
      origin: {
        projectionId: "test:projection",
        source: { kind: "ui", eventId: "event-2" },
        actor: agent,
      },
    },
  };

  let proposalSeq = 0;
  beforeEach(() => {
    queue = createProposalQueue();
    proposalSeq = 0;
  });
  const submit = (
    actor: typeof alice,
    intent: IntentInstance,
    baseWorld: ReturnType<typeof createWorldId>,
    trace?: { summary: string },
    epoch?: number
  ) => {
    const proposalId = createProposalId(`prop-${++proposalSeq}`);
    const executionKey = createExecutionKey(proposalId, 1);
    return queue.submit(
      proposalId,
      executionKey,
      actor,
      intent,
      baseWorld,
      trace,
      epoch
    );
  };

  describe("submit", () => {
    it("should create a proposal with submitted status", () => {
      const proposal = submit(alice, intent1, world1);

      expect(proposal.status).toBe("submitted");
      expect(proposal.actor).toEqual(alice);
      expect(proposal.intent).toEqual(intent1);
      expect(proposal.baseWorld).toBe(world1);
      expect(proposal.proposalId).toBeDefined();
      expect(proposal.submittedAt).toBeDefined();
    });

    it("should generate unique proposal IDs", () => {
      const p1 = submit(alice, intent1, world1);
      const p2 = submit(alice, intent1, world1);

      expect(p1.proposalId).not.toBe(p2.proposalId);
    });

    it("should include optional trace", () => {
      const trace = { summary: "Adding a new todo item" };
      const proposal = submit(alice, intent1, world1, trace);

      expect(proposal.trace).toEqual(trace);
    });
  });

  describe("transition", () => {
    it("should transition submitted → evaluating", () => {
      const proposal = submit(alice, intent1, world1);
      const updated = queue.transition(proposal.proposalId, "evaluating");

      expect(updated.status).toBe("evaluating");
    });

    it("should transition evaluating → approved with decisionId", () => {
      const proposal = submit(alice, intent1, world1);
      queue.transition(proposal.proposalId, "evaluating");
      const decisionId = createDecisionId("dec-1");
      const updated = queue.transition(proposal.proposalId, "approved", {
        decisionId,
        decidedAt: Date.now(),
      });

      expect(updated.status).toBe("approved");
      expect(updated.decisionId).toBe(decisionId);
    });

    it("should transition approved → executing", () => {
      const proposal = submit(alice, intent1, world1);
      const decisionId = createDecisionId("dec-1");
      queue.transition(proposal.proposalId, "evaluating");
      queue.transition(proposal.proposalId, "approved", { decisionId });
      const updated = queue.transition(proposal.proposalId, "executing");

      expect(updated.status).toBe("executing");
    });

    it("should transition executing → completed with resultWorld", () => {
      const proposal = submit(alice, intent1, world1);
      const decisionId = createDecisionId("dec-1");
      queue.transition(proposal.proposalId, "evaluating");
      queue.transition(proposal.proposalId, "approved", { decisionId });
      queue.transition(proposal.proposalId, "executing");
      const updated = queue.transition(proposal.proposalId, "completed", {
        resultWorld: world2,
        completedAt: Date.now(),
      });

      expect(updated.status).toBe("completed");
      expect(updated.resultWorld).toBe(world2);
    });

    it("should throw for invalid transition", () => {
      const proposal = submit(alice, intent1, world1);

      expect(() =>
        queue.transition(proposal.proposalId, "executing")
      ).toThrow(/Invalid state transition/);
    });

    it("should throw for unknown proposal", () => {
      expect(() => queue.transition("unknown", "evaluating")).toThrow(
        /not found/
      );
    });

    it("should throw when approved without decisionId", () => {
      const proposal = submit(alice, intent1, world1);
      queue.transition(proposal.proposalId, "evaluating");

      expect(() =>
        queue.transition(proposal.proposalId, "approved")
      ).toThrow(/requires a decisionId/);
    });

    it("should preserve readonly fields", () => {
      const proposal = submit(alice, intent1, world1);
      const decisionId = createDecisionId("dec-1");
      queue.transition(proposal.proposalId, "evaluating");
      queue.transition(proposal.proposalId, "approved", { decisionId });

      const updated = queue.get(proposal.proposalId);
      expect(updated?.actor).toEqual(alice);
      expect(updated?.intent).toEqual(intent1);
      expect(updated?.baseWorld).toBe(world1);
      expect(updated?.submittedAt).toBe(proposal.submittedAt);
    });
  });

  describe("get", () => {
    it("should return proposal by ID", () => {
      const proposal = submit(alice, intent1, world1);
      const result = queue.get(proposal.proposalId);

      expect(result).toEqual(proposal);
    });

    it("should return undefined for unknown ID", () => {
      const result = queue.get("unknown");
      expect(result).toBeUndefined();
    });
  });

  describe("getOrThrow", () => {
    it("should return proposal by ID", () => {
      const proposal = submit(alice, intent1, world1);
      const result = queue.getOrThrow(proposal.proposalId);

      expect(result).toEqual(proposal);
    });

    it("should throw for unknown ID", () => {
      expect(() => queue.getOrThrow("unknown")).toThrow(/not found/);
    });
  });

  describe("getByStatus", () => {
    it("should return proposals by status", () => {
      const p1 = submit(alice, intent1, world1);
      const p2 = submit(bob, intent2, world1);
      queue.transition(p2.proposalId, "evaluating");

      const submitted = queue.getByStatus("submitted");
      const evaluating = queue.getByStatus("evaluating");

      expect(submitted).toHaveLength(1);
      expect(evaluating).toHaveLength(1);
      expect(submitted[0].proposalId).toBe(p1.proposalId);
      expect(evaluating[0].proposalId).toBe(p2.proposalId);
    });
  });

  describe("getByBaseWorld", () => {
    it("should return proposals by base world", () => {
      submit(alice, intent1, world1);
      submit(bob, intent2, world1);
      submit(agent, intent1, world2);

      const fromWorld1 = queue.getByBaseWorld(world1);
      const fromWorld2 = queue.getByBaseWorld(world2);

      expect(fromWorld1).toHaveLength(2);
      expect(fromWorld2).toHaveLength(1);
    });
  });

  describe("getByActor", () => {
    it("should return proposals by actor", () => {
      submit(alice, intent1, world1);
      submit(alice, intent2, world1);
      submit(bob, intent1, world1);

      const aliceProposals = queue.getByActor("alice");
      const bobProposals = queue.getByActor("bob");

      expect(aliceProposals).toHaveLength(2);
      expect(bobProposals).toHaveLength(1);
    });
  });

  describe("getEvaluating", () => {
    it("should return evaluating proposals", () => {
      const p1 = submit(alice, intent1, world1);
      submit(bob, intent2, world1);
      queue.transition(p1.proposalId, "evaluating");

      const evaluating = queue.getEvaluating();
      expect(evaluating).toHaveLength(1);
      expect(evaluating[0].proposalId).toBe(p1.proposalId);
    });
  });

  describe("getTerminal", () => {
    it("should return terminal proposals", () => {
      const p1 = submit(alice, intent1, world1);
      const p2 = submit(bob, intent2, world1);
      const decisionId = createDecisionId("dec-1");

      queue.transition(p1.proposalId, "rejected", { decisionId });

      const terminal = queue.getTerminal();
      expect(terminal).toHaveLength(1);
      expect(terminal[0].proposalId).toBe(p1.proposalId);
    });
  });

  describe("getActive", () => {
    it("should return non-terminal proposals", () => {
      const p1 = submit(alice, intent1, world1);
      const p2 = submit(bob, intent2, world1);
      const decisionId = createDecisionId("dec-1");

      queue.transition(p1.proposalId, "rejected", { decisionId });

      const active = queue.getActive();
      expect(active).toHaveLength(1);
      expect(active[0].proposalId).toBe(p2.proposalId);
    });
  });

  describe("query", () => {
    it("should filter by status", () => {
      const p1 = submit(alice, intent1, world1);
      submit(bob, intent2, world1);
      queue.transition(p1.proposalId, "evaluating");

      const result = queue.query({ status: "evaluating" });
      expect(result).toHaveLength(1);
    });

    it("should filter by multiple statuses", () => {
      const p1 = submit(alice, intent1, world1);
      const p2 = submit(bob, intent2, world1);
      queue.transition(p1.proposalId, "evaluating");

      const result = queue.query({ status: ["submitted", "evaluating"] });
      expect(result).toHaveLength(2);
    });

    it("should filter by actor", () => {
      submit(alice, intent1, world1);
      submit(bob, intent2, world1);

      const result = queue.query({ actorId: "alice" });
      expect(result).toHaveLength(1);
    });

    it("should filter by baseWorld", () => {
      submit(alice, intent1, world1);
      submit(bob, intent2, world2);

      const result = queue.query({ baseWorld: world1 });
      expect(result).toHaveLength(1);
    });

    it("should combine filters", () => {
      submit(alice, intent1, world1);
      submit(alice, intent2, world2);
      submit(bob, intent1, world1);

      const result = queue.query({ actorId: "alice", baseWorld: world1 });
      expect(result).toHaveLength(1);
    });
  });

  describe("list", () => {
    it("should return all proposals", () => {
      submit(alice, intent1, world1);
      submit(bob, intent2, world1);
      submit(agent, intent1, world2);

      const all = queue.list();
      expect(all).toHaveLength(3);
    });
  });

  describe("size", () => {
    it("should return the number of proposals", () => {
      expect(queue.size).toBe(0);

      submit(alice, intent1, world1);
      expect(queue.size).toBe(1);

      submit(bob, intent2, world1);
      expect(queue.size).toBe(2);
    });
  });

  describe("clear", () => {
    it("should remove all proposals", () => {
      submit(alice, intent1, world1);
      submit(bob, intent2, world1);

      queue.clear();

      expect(queue.size).toBe(0);
    });
  });

  describe("remove", () => {
    it("should remove a specific proposal", () => {
      const proposal = submit(alice, intent1, world1);
      const result = queue.remove(proposal.proposalId);

      expect(result).toBe(true);
      expect(queue.has(proposal.proposalId)).toBe(false);
    });

    it("should return false for unknown proposal", () => {
      const result = queue.remove("unknown");
      expect(result).toBe(false);
    });
  });
});

describe("createProposalQueue", () => {
  it("should create a new empty queue", () => {
    const queue = createProposalQueue();
    expect(queue).toBeInstanceOf(ProposalQueue);
    expect(queue.size).toBe(0);
  });
});
