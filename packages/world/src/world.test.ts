/**
 * ManifestoWorld Integration Tests
 *
 * Tests for the World Protocol Orchestrator.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ManifestoWorld, createManifestoWorld } from "./world.js";
import type { HostInterface } from "./world.js";
import type {
  ActorRef,
  AuthorityPolicy,
  World,
  Proposal,
  IntentInstance,
} from "./schema/index.js";
import { createWorldId } from "./schema/world.js";
import type { HITLNotificationCallback } from "./authority/index.js";
import type { Snapshot } from "@manifesto-ai/core";

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestSnapshot(data: Record<string, unknown> = {}): Snapshot {
  return {
    data,
    meta: {
      schemaHash: "test-schema-hash",
      version: 1,
      timestamp: Date.now(),
    },
    system: {
      status: "idle" as const,
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    input: {},
    computed: {},
  };
}

function createTestIntent(type: string = "test-action", input: unknown = {}): IntentInstance {
  const intentId = `intent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    body: {
      type,
      input,
    },
    intentId,
    intentKey: `test-key-${intentId}`,
    meta: {
      origin: {
        projectionId: "test:projection",
        source: { kind: "ui" as const, eventId: `event-${Date.now()}` },
        actor: { actorId: "test-actor", kind: "human" as const },
      },
    },
  };
}

function createTestActor(id: string, kind: "human" | "agent" | "system" = "agent"): ActorRef {
  return {
    actorId: id,
    kind,
    name: `Test ${kind} ${id}`,
  };
}

function createMockHost(resultSnapshot?: Snapshot): HostInterface {
  let counter = 0;
  return {
    dispatch: vi.fn().mockImplementation(() => {
      counter++;
      return Promise.resolve({
        status: "complete" as const,
        snapshot: resultSnapshot ?? createTestSnapshot({ modified: true, counter }),
      });
    }),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("ManifestoWorld", () => {
  let world: ManifestoWorld;
  const schemaHash = "test-schema-hash";

  beforeEach(() => {
    world = createManifestoWorld({ schemaHash });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe("createManifestoWorld", () => {
    it("creates a new ManifestoWorld instance", () => {
      expect(world).toBeInstanceOf(ManifestoWorld);
    });

    it("creates with custom host", () => {
      const host = createMockHost();
      const worldWithHost = createManifestoWorld({ schemaHash, host });
      expect(worldWithHost).toBeInstanceOf(ManifestoWorld);
    });
  });

  // ==========================================================================
  // Actor Management
  // ==========================================================================

  describe("Actor Management", () => {
    it("registers an actor with auto-approve policy", () => {
      const actor = createTestActor("human-1", "human");
      const policy: AuthorityPolicy = { mode: "auto_approve" };

      world.registerActor(actor, policy);

      const binding = world.getActorBinding("human-1");
      expect(binding).toBeDefined();
      expect(binding?.actor.actorId).toBe("human-1");
      expect(binding?.authority.kind).toBe("auto");
    });

    it("registers an actor with HITL policy", () => {
      const owner = createTestActor("owner", "human");
      const agent = createTestActor("agent-1", "agent");
      const policy: AuthorityPolicy = {
        mode: "hitl",
        delegate: owner,
      };

      world.registerActor(agent, policy);

      const binding = world.getActorBinding("agent-1");
      expect(binding).toBeDefined();
      expect(binding?.authority.kind).toBe("human");
    });

    it("registers an actor with policy rules", () => {
      const actor = createTestActor("system-1", "system");
      const policy: AuthorityPolicy = {
        mode: "policy_rules",
        rules: [],
        defaultDecision: "approve",
      };

      world.registerActor(actor, policy);

      const binding = world.getActorBinding("system-1");
      expect(binding?.authority.kind).toBe("policy");
    });

    it("updates actor binding", () => {
      const actor = createTestActor("agent-1", "agent");
      world.registerActor(actor, { mode: "auto_approve" });

      const owner = createTestActor("owner", "human");
      world.updateActorBinding("agent-1", {
        mode: "hitl",
        delegate: owner,
      });

      const binding = world.getActorBinding("agent-1");
      expect(binding?.authority.kind).toBe("human");
    });

    it("throws when updating non-existent actor", () => {
      expect(() =>
        world.updateActorBinding("non-existent", { mode: "auto_approve" })
      ).toThrow("not registered");
    });

    it("gets all registered actors", () => {
      world.registerActor(createTestActor("actor-1"), { mode: "auto_approve" });
      world.registerActor(createTestActor("actor-2"), { mode: "auto_approve" });
      world.registerActor(createTestActor("actor-3"), { mode: "auto_approve" });

      const actors = world.getRegisteredActors();
      expect(actors).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Genesis
  // ==========================================================================

  describe("Genesis", () => {
    it("creates genesis world", async () => {
      const snapshot = createTestSnapshot({ initial: true });
      const genesis = await world.createGenesis(snapshot);

      expect(genesis.worldId).toBeDefined();
      expect(genesis.schemaHash).toBe(schemaHash);
      expect(genesis.createdBy).toBeNull();
    });

    it("stores genesis snapshot", async () => {
      const snapshot = createTestSnapshot({ initial: true });
      const genesis = await world.createGenesis(snapshot);

      const storedSnapshot = await world.getSnapshot(genesis.worldId);
      expect(storedSnapshot).toEqual(snapshot);
    });

    it("retrieves genesis world", async () => {
      const snapshot = createTestSnapshot({ initial: true });
      await world.createGenesis(snapshot);

      const genesis = await world.getGenesis();
      expect(genesis).toBeDefined();
      expect(genesis?.createdBy).toBeNull();
    });

    it("throws when creating genesis twice", async () => {
      await world.createGenesis(createTestSnapshot());

      await expect(world.createGenesis(createTestSnapshot())).rejects.toThrow(
        "Genesis world already exists"
      );
    });

    it("adds genesis to lineage", async () => {
      const snapshot = createTestSnapshot();
      const genesis = await world.createGenesis(snapshot);

      const lineage = world.getLineage();
      expect(lineage.hasGenesis()).toBe(true);
      expect(lineage.getGenesis()?.worldId).toBe(genesis.worldId);
    });
  });

  // ==========================================================================
  // Proposal Submission - Auto Approve
  // ==========================================================================

  describe("Proposal Submission - Auto Approve", () => {
    let genesis: World;

    beforeEach(async () => {
      genesis = await world.createGenesis(createTestSnapshot());
      world.registerActor(createTestActor("human-1", "human"), {
        mode: "auto_approve",
      });
    });

    it("submits and auto-approves proposal", async () => {
      const intent = createTestIntent("test-action");
      const result = await world.submitProposal(
        "human-1",
        intent,
        genesis.worldId
      );

      expect(result.proposal.status).toBe("approved");
      expect(result.decision).toBeDefined();
      expect(result.decision?.decision.kind).toBe("approved");
    });

    it("rejects submission from unregistered actor", async () => {
      const intent = createTestIntent();

      await expect(
        world.submitProposal("unknown", intent, genesis.worldId)
      ).rejects.toThrow("not registered");
    });

    it("rejects submission to non-existent base world", async () => {
      const intent = createTestIntent();
      const fakeWorld = createWorldId("fake-world");

      await expect(
        world.submitProposal("human-1", intent, fakeWorld)
      ).rejects.toThrow("not found");
    });

    it("stores proposal in store", async () => {
      const intent = createTestIntent();
      const result = await world.submitProposal(
        "human-1",
        intent,
        genesis.worldId
      );

      const stored = await world.getProposal(result.proposal.proposalId as string);
      expect(stored).toBeDefined();
      expect(stored?.proposalId).toBe(result.proposal.proposalId);
    });

    it("stores decision in store", async () => {
      const intent = createTestIntent();
      const result = await world.submitProposal(
        "human-1",
        intent,
        genesis.worldId
      );

      const decision = await world.getDecisionByProposal(
        result.proposal.proposalId as string
      );
      expect(decision).toBeDefined();
      expect(decision?.proposalId).toBe(result.proposal.proposalId);
    });
  });

  // ==========================================================================
  // Proposal Submission - With Host Execution
  // ==========================================================================

  describe("Proposal Submission - With Host Execution", () => {
    let genesis: World;
    let host: HostInterface;

    beforeEach(async () => {
      host = createMockHost();
      world = createManifestoWorld({ schemaHash, host });
      genesis = await world.createGenesis(createTestSnapshot());
      world.registerActor(createTestActor("human-1", "human"), {
        mode: "auto_approve",
      });
    });

    it("executes approved proposal via host", async () => {
      const intent = createTestIntent();
      const result = await world.submitProposal(
        "human-1",
        intent,
        genesis.worldId
      );

      // Host receives simple Intent format (type, input, intentId), not IntentInstance
      expect(host.dispatch).toHaveBeenCalledWith({
        type: intent.body.type,
        input: intent.body.input,
        intentId: intent.intentId,
      });
      expect(result.proposal.status).toBe("completed");
      expect(result.resultWorld).toBeDefined();
    });

    it("creates new world from execution", async () => {
      const intent = createTestIntent();
      const result = await world.submitProposal(
        "human-1",
        intent,
        genesis.worldId
      );

      expect(result.resultWorld).toBeDefined();
      expect(result.resultWorld?.createdBy).toBe(result.proposal.proposalId);
    });

    it("stores new world and snapshot", async () => {
      const resultSnapshot = createTestSnapshot({ executed: true });
      host = createMockHost(resultSnapshot);
      world = createManifestoWorld({ schemaHash, host });
      await world.createGenesis(createTestSnapshot());
      world.registerActor(createTestActor("human-1", "human"), {
        mode: "auto_approve",
      });

      const genesis = await world.getGenesis();
      const intent = createTestIntent();
      const result = await world.submitProposal(
        "human-1",
        intent,
        genesis!.worldId
      );

      const storedWorld = await world.getWorld(result.resultWorld!.worldId);
      expect(storedWorld).toBeDefined();

      const storedSnapshot = await world.getSnapshot(result.resultWorld!.worldId);
      expect(storedSnapshot?.data).toEqual({ executed: true });
    });

    it("adds edge to lineage", async () => {
      const intent = createTestIntent();
      const result = await world.submitProposal(
        "human-1",
        intent,
        genesis.worldId
      );

      const lineage = world.getLineage();
      const parentEdge = lineage.getParentEdge(result.resultWorld!.worldId);
      expect(parentEdge).toBeDefined();
      expect(parentEdge?.from).toBe(genesis.worldId);
      expect(parentEdge?.to).toBe(result.resultWorld!.worldId);
    });

    it("handles host execution error", async () => {
      const failingHost: HostInterface = {
        dispatch: vi.fn().mockResolvedValue({
          status: "error" as const,
          snapshot: createTestSnapshot({ error: true }),
        }),
      };

      world = createManifestoWorld({ schemaHash, host: failingHost });
      await world.createGenesis(createTestSnapshot());
      world.registerActor(createTestActor("human-1", "human"), {
        mode: "auto_approve",
      });

      const genesis = await world.getGenesis();
      const intent = createTestIntent();
      const result = await world.submitProposal(
        "human-1",
        intent,
        genesis!.worldId
      );

      expect(result.proposal.status).toBe("failed");
      expect(result.resultWorld).toBeDefined(); // World is created even on failure
    });
  });

  // ==========================================================================
  // Proposal Submission - Policy Rules
  // ==========================================================================

  describe("Proposal Submission - Policy Rules", () => {
    let genesis: World;

    beforeEach(async () => {
      genesis = await world.createGenesis(createTestSnapshot());
    });

    it("approves based on intent type rule", async () => {
      world.registerActor(createTestActor("agent-1", "agent"), {
        mode: "policy_rules",
        rules: [
          {
            condition: { kind: "intent_type", types: ["allowed-action"] },
            decision: "approve",
          },
        ],
        defaultDecision: "reject",
      });

      const intent = createTestIntent("allowed-action");
      const result = await world.submitProposal(
        "agent-1",
        intent,
        genesis.worldId
      );

      expect(result.proposal.status).toBe("approved");
    });

    it("rejects based on default decision", async () => {
      world.registerActor(createTestActor("agent-1", "agent"), {
        mode: "policy_rules",
        rules: [
          {
            condition: { kind: "intent_type", types: ["allowed-action"] },
            decision: "approve",
          },
        ],
        defaultDecision: "reject",
      });

      const intent = createTestIntent("disallowed-action");
      const result = await world.submitProposal(
        "agent-1",
        intent,
        genesis.worldId
      );

      expect(result.proposal.status).toBe("rejected");
      expect(result.decision?.decision.kind).toBe("rejected");
    });
  });

  // ==========================================================================
  // Proposal Submission - HITL
  // ==========================================================================

  describe("Proposal Submission - HITL", () => {
    let genesis: World;
    let onHITLRequired: HITLNotificationCallback;

    beforeEach(async () => {
      onHITLRequired = vi.fn();
      world = createManifestoWorld({ schemaHash, onHITLRequired });
      genesis = await world.createGenesis(createTestSnapshot());

      const owner = createTestActor("owner", "human");
      world.registerActor(createTestActor("agent-1", "agent"), {
        mode: "hitl",
        delegate: owner,
      });
    });

    it("returns pending status for HITL proposals", async () => {
      const intent = createTestIntent();
      const result = await world.submitProposal(
        "agent-1",
        intent,
        genesis.worldId
      );

      expect(result.proposal.status).toBe("pending");
      expect(result.decision).toBeUndefined();
    });

    it("notifies via onHITLRequired callback", async () => {
      const intent = createTestIntent();
      await world.submitProposal("agent-1", intent, genesis.worldId);

      expect(onHITLRequired).toHaveBeenCalled();
    });

    it("lists pending proposals", async () => {
      const intent = createTestIntent();
      await world.submitProposal("agent-1", intent, genesis.worldId);

      const pending = await world.getPendingProposals();
      expect(pending).toHaveLength(1);
    });
  });

  // ==========================================================================
  // HITL Decision Processing
  // ==========================================================================

  describe("HITL Decision Processing", () => {
    let genesis: World;
    let pendingProposal: Proposal;

    beforeEach(async () => {
      world = createManifestoWorld({ schemaHash, onHITLRequired: vi.fn() });
      genesis = await world.createGenesis(createTestSnapshot());

      const owner = createTestActor("owner", "human");
      world.registerActor(createTestActor("agent-1", "agent"), {
        mode: "hitl",
        delegate: owner,
      });

      const result = await world.submitProposal(
        "agent-1",
        createTestIntent(),
        genesis.worldId
      );
      pendingProposal = result.proposal;
    });

    it("approves pending proposal", async () => {
      const result = await world.processHITLDecision(
        pendingProposal.proposalId as string,
        "approved",
        "Looks good"
      );

      expect(result.proposal.status).toBe("approved");
      expect(result.decision?.decision.kind).toBe("approved");
      expect(result.decision?.reasoning).toBe("Looks good");
    });

    it("rejects pending proposal", async () => {
      const result = await world.processHITLDecision(
        pendingProposal.proposalId as string,
        "rejected",
        "Too risky"
      );

      expect(result.proposal.status).toBe("rejected");
      expect(result.decision?.decision.kind).toBe("rejected");
    });

    it("executes after approval when host configured", async () => {
      const host = createMockHost();
      world = createManifestoWorld({
        schemaHash,
        host,
        onHITLRequired: vi.fn(),
      });
      genesis = await world.createGenesis(createTestSnapshot());

      const owner = createTestActor("owner", "human");
      world.registerActor(createTestActor("agent-1", "agent"), {
        mode: "hitl",
        delegate: owner,
      });

      const submitResult = await world.submitProposal(
        "agent-1",
        createTestIntent(),
        genesis.worldId
      );

      const result = await world.processHITLDecision(
        submitResult.proposal.proposalId as string,
        "approved"
      );

      expect(result.proposal.status).toBe("completed");
      expect(result.resultWorld).toBeDefined();
    });

    it("throws for non-existent proposal", async () => {
      await expect(
        world.processHITLDecision("non-existent", "approved")
      ).rejects.toThrow("not found");
    });

    it("throws for non-pending proposal", async () => {
      // First approve it
      await world.processHITLDecision(
        pendingProposal.proposalId as string,
        "approved"
      );

      // Try to process again
      await expect(
        world.processHITLDecision(pendingProposal.proposalId as string, "rejected")
      ).rejects.toThrow("not pending");
    });
  });

  // ==========================================================================
  // Multiple Proposals and Branching
  // ==========================================================================

  describe("Multiple Proposals and Branching", () => {
    let genesis: World;
    let host: HostInterface;

    beforeEach(async () => {
      host = createMockHost();
      world = createManifestoWorld({ schemaHash, host });
      genesis = await world.createGenesis(createTestSnapshot());
      world.registerActor(createTestActor("human-1", "human"), {
        mode: "auto_approve",
      });
    });

    it("handles sequential proposals", async () => {
      const result1 = await world.submitProposal(
        "human-1",
        createTestIntent("action-1"),
        genesis.worldId
      );

      const result2 = await world.submitProposal(
        "human-1",
        createTestIntent("action-2"),
        result1.resultWorld!.worldId
      );

      expect(result2.proposal.status).toBe("completed");
      expect(result2.resultWorld).toBeDefined();

      // Verify lineage
      const lineage = world.getLineage();
      expect(lineage.getDepth(result2.resultWorld!.worldId)).toBe(2);
    });

    it("handles branching from same world", async () => {
      const result1 = await world.submitProposal(
        "human-1",
        createTestIntent("branch-1"),
        genesis.worldId
      );

      const result2 = await world.submitProposal(
        "human-1",
        createTestIntent("branch-2"),
        genesis.worldId
      );

      // Both should complete
      expect(result1.proposal.status).toBe("completed");
      expect(result2.proposal.status).toBe("completed");

      // Both should have genesis as parent
      const lineage = world.getLineage();
      const children = lineage.getChildrenEdges(genesis.worldId);
      expect(children).toHaveLength(2);
    });

    it("tracks complete lineage", async () => {
      // Create a chain: genesis -> w1 -> w2 -> w3
      const r1 = await world.submitProposal(
        "human-1",
        createTestIntent(),
        genesis.worldId
      );
      const r2 = await world.submitProposal(
        "human-1",
        createTestIntent(),
        r1.resultWorld!.worldId
      );
      const r3 = await world.submitProposal(
        "human-1",
        createTestIntent(),
        r2.resultWorld!.worldId
      );

      const lineage = world.getLineage();

      // Check ancestors (returns World[], not WorldId[])
      const ancestors = lineage.getAncestors(r3.resultWorld!.worldId);
      expect(ancestors).toHaveLength(3);
      expect(ancestors[0].worldId).toBe(r2.resultWorld!.worldId);
      expect(ancestors[1].worldId).toBe(r1.resultWorld!.worldId);
      expect(ancestors[2].worldId).toBe(genesis.worldId);
    });
  });

  // ==========================================================================
  // Queries
  // ==========================================================================

  describe("Queries", () => {
    let genesis: World;

    beforeEach(async () => {
      genesis = await world.createGenesis(createTestSnapshot());
      world.registerActor(createTestActor("human-1", "human"), {
        mode: "auto_approve",
      });
    });

    it("gets world by ID", async () => {
      const retrieved = await world.getWorld(genesis.worldId);
      expect(retrieved).toEqual(genesis);
    });

    it("returns null for non-existent world", async () => {
      const retrieved = await world.getWorld(createWorldId("non-existent"));
      expect(retrieved).toBeNull();
    });

    it("gets snapshot by world ID", async () => {
      const snapshot = await world.getSnapshot(genesis.worldId);
      expect(snapshot).toBeDefined();
    });

    it("gets proposal by ID", async () => {
      const result = await world.submitProposal(
        "human-1",
        createTestIntent(),
        genesis.worldId
      );

      const proposal = await world.getProposal(result.proposal.proposalId as string);
      expect(proposal).toBeDefined();
      expect(proposal?.proposalId).toBe(result.proposal.proposalId);
    });

    it("gets decision by proposal ID", async () => {
      const result = await world.submitProposal(
        "human-1",
        createTestIntent(),
        genesis.worldId
      );

      const decision = await world.getDecisionByProposal(
        result.proposal.proposalId as string
      );
      expect(decision).toBeDefined();
      expect(decision?.proposalId).toBe(result.proposal.proposalId);
    });

    it("provides access to store", () => {
      const store = world.getStore();
      expect(store).toBeDefined();
    });
  });

  // ==========================================================================
  // Complex Scenarios
  // ==========================================================================

  describe("Complex Scenarios", () => {
    it("multi-actor collaboration", async () => {
      const host = createMockHost();
      world = createManifestoWorld({ schemaHash, host });

      // Register multiple actors with different policies
      world.registerActor(createTestActor("admin", "human"), {
        mode: "auto_approve",
      });
      world.registerActor(createTestActor("developer", "human"), {
        mode: "auto_approve",
      });

      const genesis = await world.createGenesis(createTestSnapshot());

      // Admin makes initial change
      const adminResult = await world.submitProposal(
        "admin",
        createTestIntent("init"),
        genesis.worldId
      );

      // Developer builds on admin's work
      const devResult = await world.submitProposal(
        "developer",
        createTestIntent("feature"),
        adminResult.resultWorld!.worldId
      );

      expect(devResult.proposal.status).toBe("completed");

      // Verify lineage shows both contributions
      const lineage = world.getLineage();
      const path = lineage.findPath(genesis.worldId, devResult.resultWorld!.worldId);
      expect(path).not.toBeNull();
      expect(path!.edges).toHaveLength(2);
    });

    it("mixed policy types", async () => {
      world = createManifestoWorld({
        schemaHash,
        onHITLRequired: vi.fn(),
      });

      const owner = createTestActor("owner", "human");

      // Owner is auto-approved
      world.registerActor(owner, { mode: "auto_approve" });

      // Agent requires HITL
      world.registerActor(createTestActor("agent", "agent"), {
        mode: "hitl",
        delegate: owner,
      });

      // System uses policy rules
      world.registerActor(createTestActor("system", "system"), {
        mode: "policy_rules",
        rules: [
          {
            condition: { kind: "intent_type", types: ["system-task"] },
            decision: "approve",
          },
        ],
        defaultDecision: "reject",
      });

      const genesis = await world.createGenesis(createTestSnapshot());

      // Owner is auto-approved
      const ownerResult = await world.submitProposal(
        "owner",
        createTestIntent("owner-action"),
        genesis.worldId
      );
      expect(ownerResult.proposal.status).toBe("approved");

      // Agent goes to pending
      const agentResult = await world.submitProposal(
        "agent",
        createTestIntent("agent-action"),
        genesis.worldId
      );
      expect(agentResult.proposal.status).toBe("pending");

      // System approved by policy
      const systemResult = await world.submitProposal(
        "system",
        createTestIntent("system-task"),
        genesis.worldId
      );
      expect(systemResult.proposal.status).toBe("approved");

      // System rejected by policy
      const systemResult2 = await world.submitProposal(
        "system",
        createTestIntent("unknown-task"),
        genesis.worldId
      );
      expect(systemResult2.proposal.status).toBe("rejected");
    });

    it("full lifecycle with persistence check", async () => {
      const host = createMockHost();
      world = createManifestoWorld({ schemaHash, host });

      world.registerActor(createTestActor("user", "human"), {
        mode: "auto_approve",
      });

      const genesis = await world.createGenesis(createTestSnapshot({ v: 0 }));

      // Submit multiple proposals
      let currentWorld = genesis.worldId;
      for (let i = 1; i <= 3; i++) {
        const result = await world.submitProposal(
          "user",
          createTestIntent(`action-${i}`),
          currentWorld
        );
        currentWorld = result.resultWorld!.worldId;
      }

      // Verify store contents
      const store = world.getStore();
      const stats = await store.getStats();

      expect(stats.worlds).toBe(4); // genesis + 3 results
      expect(stats.edges).toBe(3);
      expect(stats.proposals).toBe(3);
      expect(stats.decisions).toBe(3);

      // Verify lineage integrity
      const lineage = world.getLineage();
      expect(lineage.getDepth(currentWorld)).toBe(3);
      expect(lineage.isDescendant(currentWorld, genesis.worldId)).toBe(true);
    });
  });
});
