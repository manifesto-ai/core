/**
 * Memory World Store Tests
 *
 * Tests for the in-memory implementation of WorldStore.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryWorldStore, createMemoryWorldStore } from "./memory.js";
import type { World, WorldEdge, Proposal, DecisionRecord, ActorAuthorityBinding } from "../schema/index.js";
import {
  createWorldId,
  createProposalId,
  createDecisionId,
  createEdgeId,
} from "../schema/world.js";
import type { Snapshot } from "@manifesto-ai/core";

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestWorld(id: string, createdBy: string | null = null): World {
  return {
    worldId: createWorldId(id),
    schemaHash: "schema-hash-123",
    snapshotHash: `snapshot-${id}`,
    createdAt: Date.now(),
    createdBy: createdBy ? createProposalId(createdBy) : null,
  };
}

function createTestSnapshot(): Snapshot {
  return {
    data: { count: 0 },
    meta: {
      schemaHash: "schema-hash-123",
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

function createTestEdge(
  id: string,
  from: string,
  to: string,
  proposalId: string,
  decisionId: string
): WorldEdge {
  return {
    edgeId: createEdgeId(id),
    from: createWorldId(from),
    to: createWorldId(to),
    proposalId: createProposalId(proposalId),
    decisionId: createDecisionId(decisionId),
    createdAt: Date.now(),
  };
}

function createTestProposal(id: string, actorId: string, baseWorld: string, status: Proposal["status"] = "submitted"): Proposal {
  const actor = { actorId, kind: "agent" as const, name: `Agent ${actorId}` };
  return {
    proposalId: createProposalId(id),
    actor,
    intent: {
      body: { type: "test-action", input: {} },
      intentId: `intent-${id}`,
      intentKey: `key-${id}`,
      meta: {
        origin: {
          projectionId: "test:projection",
          source: { kind: "ui" as const, eventId: `event-${id}` },
          actor,
        },
      },
    },
    baseWorld: createWorldId(baseWorld),
    status,
    submittedAt: Date.now(),
  };
}

function createTestDecision(id: string, proposalId: string): DecisionRecord {
  return {
    decisionId: createDecisionId(id),
    proposalId: createProposalId(proposalId),
    authority: { authorityId: "auth-1", kind: "auto" },
    decision: { kind: "approved" },
    decidedAt: Date.now(),
  };
}

function createTestBinding(actorId: string): ActorAuthorityBinding {
  return {
    actor: { actorId, kind: "agent", name: `Agent ${actorId}` },
    authority: { authorityId: `auth-${actorId}`, kind: "auto" },
    policy: { mode: "auto_approve" },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("MemoryWorldStore", () => {
  let store: MemoryWorldStore;

  beforeEach(() => {
    store = createMemoryWorldStore();
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe("createMemoryWorldStore", () => {
    it("creates an empty store", async () => {
      const stats = await store.getStats();
      expect(stats.worlds).toBe(0);
      expect(stats.edges).toBe(0);
      expect(stats.proposals).toBe(0);
      expect(stats.decisions).toBe(0);
      expect(stats.bindings).toBe(0);
      expect(stats.snapshots).toBe(0);
    });
  });

  // ==========================================================================
  // World Operations
  // ==========================================================================

  describe("World Operations", () => {
    it("saves and retrieves a world", async () => {
      const world = createTestWorld("world-1");
      const result = await store.saveWorld(world);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(world);

      const retrieved = await store.getWorld(createWorldId("world-1"));
      expect(retrieved).toEqual(world);
    });

    it("rejects duplicate world saves", async () => {
      const world = createTestWorld("world-1");
      await store.saveWorld(world);

      const result = await store.saveWorld(world);
      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("returns null for non-existent world", async () => {
      const world = await store.getWorld(createWorldId("non-existent"));
      expect(world).toBeNull();
    });

    it("checks if world exists", async () => {
      const world = createTestWorld("world-1");
      await store.saveWorld(world);

      expect(await store.hasWorld(createWorldId("world-1"))).toBe(true);
      expect(await store.hasWorld(createWorldId("world-2"))).toBe(false);
    });

    it("lists worlds", async () => {
      await store.saveWorld(createTestWorld("world-1"));
      await store.saveWorld(createTestWorld("world-2"));
      await store.saveWorld(createTestWorld("world-3"));

      const worlds = await store.listWorlds();
      expect(worlds).toHaveLength(3);
    });

    it("lists worlds with query filters", async () => {
      const world1 = { ...createTestWorld("world-1"), schemaHash: "schema-a" };
      const world2 = { ...createTestWorld("world-2"), schemaHash: "schema-b" };
      const world3 = { ...createTestWorld("world-3"), schemaHash: "schema-a" };

      await store.saveWorld(world1);
      await store.saveWorld(world2);
      await store.saveWorld(world3);

      const filtered = await store.listWorlds({ schemaHash: "schema-a" });
      expect(filtered).toHaveLength(2);
    });

    it("lists worlds with pagination", async () => {
      for (let i = 0; i < 10; i++) {
        await store.saveWorld(createTestWorld(`world-${i}`));
      }

      const page1 = await store.listWorlds({ limit: 3 });
      expect(page1).toHaveLength(3);

      const page2 = await store.listWorlds({ limit: 3, offset: 3 });
      expect(page2).toHaveLength(3);
    });

    it("lists worlds with time range filter", async () => {
      const now = Date.now();
      const world1 = { ...createTestWorld("world-1"), createdAt: now - 1000 };
      const world2 = { ...createTestWorld("world-2"), createdAt: now };
      const world3 = { ...createTestWorld("world-3"), createdAt: now + 1000 };

      await store.saveWorld(world1);
      await store.saveWorld(world2);
      await store.saveWorld(world3);

      const filtered = await store.listWorlds({ createdAfter: now - 500, createdBefore: now + 500 });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].worldId).toBe(world2.worldId);
    });
  });

  // ==========================================================================
  // Genesis Operations
  // ==========================================================================

  describe("Genesis Operations", () => {
    it("sets and gets genesis world", async () => {
      const world = createTestWorld("genesis");
      await store.saveWorld(world);

      const result = await store.setGenesis(createWorldId("genesis"));
      expect(result.success).toBe(true);

      const genesis = await store.getGenesis();
      expect(genesis).toEqual(world);
    });

    it("rejects setting genesis twice", async () => {
      const world1 = createTestWorld("genesis-1");
      const world2 = createTestWorld("genesis-2");
      await store.saveWorld(world1);
      await store.saveWorld(world2);

      await store.setGenesis(createWorldId("genesis-1"));
      const result = await store.setGenesis(createWorldId("genesis-2"));

      expect(result.success).toBe(false);
      expect(result.error).toContain("Genesis already set");
    });

    it("rejects setting non-existent world as genesis", async () => {
      const result = await store.setGenesis(createWorldId("non-existent"));
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("returns null when no genesis set", async () => {
      const genesis = await store.getGenesis();
      expect(genesis).toBeNull();
    });
  });

  // ==========================================================================
  // Snapshot Operations
  // ==========================================================================

  describe("Snapshot Operations", () => {
    it("saves and retrieves a snapshot", async () => {
      const world = createTestWorld("world-1");
      const snapshot = createTestSnapshot();

      await store.saveWorld(world);
      const result = await store.saveSnapshot(createWorldId("world-1"), snapshot);
      expect(result.success).toBe(true);

      const retrieved = await store.getSnapshot(createWorldId("world-1"));
      expect(retrieved).toEqual(snapshot);
    });

    it("rejects snapshot for non-existent world", async () => {
      const snapshot = createTestSnapshot();
      const result = await store.saveSnapshot(createWorldId("non-existent"), snapshot);
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("returns null for world without snapshot", async () => {
      const world = createTestWorld("world-1");
      await store.saveWorld(world);

      const snapshot = await store.getSnapshot(createWorldId("world-1"));
      expect(snapshot).toBeNull();
    });
  });

  // ==========================================================================
  // Edge Operations
  // ==========================================================================

  describe("Edge Operations", () => {
    beforeEach(async () => {
      // Set up worlds for edge tests
      await store.saveWorld(createTestWorld("world-1"));
      await store.saveWorld(createTestWorld("world-2"));
      await store.saveWorld(createTestWorld("world-3"));
    });

    it("saves and retrieves an edge", async () => {
      const edge = createTestEdge("edge-1", "world-1", "world-2", "prop-1", "dec-1");
      const result = await store.saveEdge(edge);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(edge);

      const retrieved = await store.getEdge(createEdgeId("edge-1"));
      expect(retrieved).toEqual(edge);
    });

    it("rejects duplicate edge saves", async () => {
      const edge = createTestEdge("edge-1", "world-1", "world-2", "prop-1", "dec-1");
      await store.saveEdge(edge);

      const result = await store.saveEdge(edge);
      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("rejects edge with non-existent source world", async () => {
      const edge = createTestEdge("edge-1", "non-existent", "world-2", "prop-1", "dec-1");
      const result = await store.saveEdge(edge);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Source world");
    });

    it("rejects edge with non-existent target world", async () => {
      const edge = createTestEdge("edge-1", "world-1", "non-existent", "prop-1", "dec-1");
      const result = await store.saveEdge(edge);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Target world");
    });

    it("gets parent edge for a world", async () => {
      const edge = createTestEdge("edge-1", "world-1", "world-2", "prop-1", "dec-1");
      await store.saveEdge(edge);

      const parent = await store.getParentEdge(createWorldId("world-2"));
      expect(parent).toEqual(edge);
    });

    it("returns null for world without parent edge", async () => {
      const parent = await store.getParentEdge(createWorldId("world-1"));
      expect(parent).toBeNull();
    });

    it("gets child edges for a world", async () => {
      const edge1 = createTestEdge("edge-1", "world-1", "world-2", "prop-1", "dec-1");
      const edge2 = createTestEdge("edge-2", "world-1", "world-3", "prop-2", "dec-2");
      await store.saveEdge(edge1);
      await store.saveEdge(edge2);

      const children = await store.getChildEdges(createWorldId("world-1"));
      expect(children).toHaveLength(2);
    });

    it("returns empty array for world without children", async () => {
      const children = await store.getChildEdges(createWorldId("world-3"));
      expect(children).toEqual([]);
    });

    it("lists edges with query filters", async () => {
      const edge1 = createTestEdge("edge-1", "world-1", "world-2", "prop-1", "dec-1");
      const edge2 = createTestEdge("edge-2", "world-1", "world-3", "prop-2", "dec-2");
      await store.saveEdge(edge1);
      await store.saveEdge(edge2);

      const filtered = await store.listEdges({ from: createWorldId("world-1") });
      expect(filtered).toHaveLength(2);

      const byProposal = await store.listEdges({ proposalId: createProposalId("prop-1") });
      expect(byProposal).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Proposal Operations
  // ==========================================================================

  describe("Proposal Operations", () => {
    beforeEach(async () => {
      await store.saveWorld(createTestWorld("base-world"));
    });

    it("saves and retrieves a proposal", async () => {
      const proposal = createTestProposal("prop-1", "agent-1", "base-world");
      const result = await store.saveProposal(proposal);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(proposal);

      const retrieved = await store.getProposal(createProposalId("prop-1"));
      expect(retrieved).toEqual(proposal);
    });

    it("rejects duplicate proposal saves", async () => {
      const proposal = createTestProposal("prop-1", "agent-1", "base-world");
      await store.saveProposal(proposal);

      const result = await store.saveProposal(proposal);
      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("updates proposal status", async () => {
      const proposal = createTestProposal("prop-1", "agent-1", "base-world");
      await store.saveProposal(proposal);

      const result = await store.updateProposal(createProposalId("prop-1"), {
        status: "pending",
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe("pending");

      const retrieved = await store.getProposal(createProposalId("prop-1"));
      expect(retrieved?.status).toBe("pending");
    });

    it("updates proposal with decision info", async () => {
      const proposal = createTestProposal("prop-1", "agent-1", "base-world");
      await store.saveProposal(proposal);

      const decisionId = createDecisionId("dec-1");
      const result = await store.updateProposal(createProposalId("prop-1"), {
        status: "approved",
        decisionId,
        decidedAt: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(result.data?.decisionId).toBe(decisionId);
    });

    it("rejects update for non-existent proposal", async () => {
      const result = await store.updateProposal(createProposalId("non-existent"), {
        status: "pending",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("checks if proposal exists", async () => {
      const proposal = createTestProposal("prop-1", "agent-1", "base-world");
      await store.saveProposal(proposal);

      expect(await store.hasProposal(createProposalId("prop-1"))).toBe(true);
      expect(await store.hasProposal(createProposalId("prop-2"))).toBe(false);
    });

    it("lists proposals with status filter", async () => {
      await store.saveProposal(createTestProposal("prop-1", "agent-1", "base-world", "submitted"));
      await store.saveProposal(createTestProposal("prop-2", "agent-1", "base-world", "pending"));
      await store.saveProposal(createTestProposal("prop-3", "agent-1", "base-world", "pending"));

      const pending = await store.listProposals({ status: "pending" });
      expect(pending).toHaveLength(2);
    });

    it("lists proposals with multiple status filter", async () => {
      await store.saveProposal(createTestProposal("prop-1", "agent-1", "base-world", "submitted"));
      await store.saveProposal(createTestProposal("prop-2", "agent-1", "base-world", "pending"));
      await store.saveProposal(createTestProposal("prop-3", "agent-1", "base-world", "approved"));

      const filtered = await store.listProposals({ status: ["submitted", "pending"] });
      expect(filtered).toHaveLength(2);
    });

    it("lists proposals by actor", async () => {
      await store.saveProposal(createTestProposal("prop-1", "agent-1", "base-world"));
      await store.saveProposal(createTestProposal("prop-2", "agent-2", "base-world"));
      await store.saveProposal(createTestProposal("prop-3", "agent-1", "base-world"));

      const byAgent1 = await store.listProposals({ actorId: "agent-1" });
      expect(byAgent1).toHaveLength(2);
    });

    it("lists proposals with pagination", async () => {
      for (let i = 0; i < 10; i++) {
        await store.saveProposal(createTestProposal(`prop-${i}`, "agent-1", "base-world"));
      }

      const page1 = await store.listProposals({ limit: 3 });
      expect(page1).toHaveLength(3);

      const page2 = await store.listProposals({ limit: 3, offset: 3 });
      expect(page2).toHaveLength(3);
    });

    it("gets pending proposals shortcut", async () => {
      await store.saveProposal(createTestProposal("prop-1", "agent-1", "base-world", "submitted"));
      await store.saveProposal(createTestProposal("prop-2", "agent-1", "base-world", "pending"));
      await store.saveProposal(createTestProposal("prop-3", "agent-1", "base-world", "pending"));

      const pending = await store.getPendingProposals();
      expect(pending).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Decision Operations
  // ==========================================================================

  describe("Decision Operations", () => {
    it("saves and retrieves a decision", async () => {
      const decision = createTestDecision("dec-1", "prop-1");
      const result = await store.saveDecision(decision);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(decision);

      const retrieved = await store.getDecision(createDecisionId("dec-1"));
      expect(retrieved).toEqual(decision);
    });

    it("rejects duplicate decision saves", async () => {
      const decision = createTestDecision("dec-1", "prop-1");
      await store.saveDecision(decision);

      const result = await store.saveDecision(decision);
      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });

    it("rejects multiple decisions for same proposal", async () => {
      const decision1 = createTestDecision("dec-1", "prop-1");
      const decision2 = createTestDecision("dec-2", "prop-1");

      await store.saveDecision(decision1);
      const result = await store.saveDecision(decision2);

      expect(result.success).toBe(false);
      expect(result.error).toContain("already has a decision");
    });

    it("gets decision by proposal", async () => {
      const decision = createTestDecision("dec-1", "prop-1");
      await store.saveDecision(decision);

      const retrieved = await store.getDecisionByProposal(createProposalId("prop-1"));
      expect(retrieved).toEqual(decision);
    });

    it("returns null for proposal without decision", async () => {
      const decision = await store.getDecisionByProposal(createProposalId("prop-1"));
      expect(decision).toBeNull();
    });

    it("checks if decision exists", async () => {
      const decision = createTestDecision("dec-1", "prop-1");
      await store.saveDecision(decision);

      expect(await store.hasDecision(createDecisionId("dec-1"))).toBe(true);
      expect(await store.hasDecision(createDecisionId("dec-2"))).toBe(false);
    });
  });

  // ==========================================================================
  // Binding Operations
  // ==========================================================================

  describe("Binding Operations", () => {
    it("saves and retrieves a binding", async () => {
      const binding = createTestBinding("agent-1");
      const result = await store.saveBinding(binding);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(binding);

      const retrieved = await store.getBinding("agent-1");
      expect(retrieved).toEqual(binding);
    });

    it("overwrites existing binding", async () => {
      const binding1 = createTestBinding("agent-1");
      const binding2 = {
        ...binding1,
        policy: { mode: "hitl" as const, delegate: { actorId: "human-1", kind: "human" as const } },
      };

      await store.saveBinding(binding1);
      await store.saveBinding(binding2);

      const retrieved = await store.getBinding("agent-1");
      expect(retrieved?.policy.mode).toBe("hitl");
    });

    it("returns null for non-existent binding", async () => {
      const binding = await store.getBinding("non-existent");
      expect(binding).toBeNull();
    });

    it("removes a binding", async () => {
      const binding = createTestBinding("agent-1");
      await store.saveBinding(binding);

      const result = await store.removeBinding("agent-1");
      expect(result.success).toBe(true);

      const retrieved = await store.getBinding("agent-1");
      expect(retrieved).toBeNull();
    });

    it("rejects removing non-existent binding", async () => {
      const result = await store.removeBinding("non-existent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("lists all bindings", async () => {
      await store.saveBinding(createTestBinding("agent-1"));
      await store.saveBinding(createTestBinding("agent-2"));
      await store.saveBinding(createTestBinding("agent-3"));

      const bindings = await store.listBindings();
      expect(bindings).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Utility Operations
  // ==========================================================================

  describe("Utility Operations", () => {
    it("clears all data", async () => {
      await store.saveWorld(createTestWorld("world-1"));
      await store.saveProposal(createTestProposal("prop-1", "agent-1", "world-1"));
      await store.saveDecision(createTestDecision("dec-1", "prop-1"));
      await store.saveBinding(createTestBinding("agent-1"));

      await store.clear();

      const stats = await store.getStats();
      expect(stats.worlds).toBe(0);
      expect(stats.proposals).toBe(0);
      expect(stats.decisions).toBe(0);
      expect(stats.bindings).toBe(0);
    });

    it("returns accurate stats", async () => {
      await store.saveWorld(createTestWorld("world-1"));
      await store.saveWorld(createTestWorld("world-2"));
      await store.saveSnapshot(createWorldId("world-1"), createTestSnapshot());
      await store.saveEdge(createTestEdge("edge-1", "world-1", "world-2", "prop-1", "dec-1"));
      await store.saveProposal(createTestProposal("prop-1", "agent-1", "world-1"));
      await store.saveDecision(createTestDecision("dec-1", "prop-1"));
      await store.saveBinding(createTestBinding("agent-1"));

      const stats = await store.getStats();
      expect(stats.worlds).toBe(2);
      expect(stats.edges).toBe(1);
      expect(stats.proposals).toBe(1);
      expect(stats.decisions).toBe(1);
      expect(stats.bindings).toBe(1);
      expect(stats.snapshots).toBe(1);
    });
  });

  // ==========================================================================
  // Observable Events
  // ==========================================================================

  describe("Observable Events", () => {
    it("emits world:saved event", async () => {
      const listener = vi.fn();
      store.subscribe("world:saved", listener);

      const world = createTestWorld("world-1");
      await store.saveWorld(world);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0].type).toBe("world:saved");
      expect(listener.mock.calls[0][0].data).toEqual(world);
    });

    it("emits proposal:updated event", async () => {
      const world = createTestWorld("world-1");
      await store.saveWorld(world);
      await store.saveProposal(createTestProposal("prop-1", "agent-1", "world-1"));

      const listener = vi.fn();
      store.subscribe("proposal:updated", listener);

      await store.updateProposal(createProposalId("prop-1"), { status: "pending" });

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0].data.status).toBe("pending");
    });

    it("emits genesis:set event", async () => {
      const listener = vi.fn();
      store.subscribe("genesis:set", listener);

      const world = createTestWorld("genesis");
      await store.saveWorld(world);
      await store.setGenesis(createWorldId("genesis"));

      expect(listener).toHaveBeenCalledOnce();
    });

    it("subscribes to all events", async () => {
      const listener = vi.fn();
      store.subscribeAll(listener);

      await store.saveWorld(createTestWorld("world-1"));
      await store.saveBinding(createTestBinding("agent-1"));

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("unsubscribes from events", async () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe("world:saved", listener);

      await store.saveWorld(createTestWorld("world-1"));
      expect(listener).toHaveBeenCalledOnce();

      unsubscribe();

      await store.saveWorld(createTestWorld("world-2"));
      expect(listener).toHaveBeenCalledOnce(); // Still 1
    });

    it("handles listener errors gracefully", async () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error("Listener error");
      });
      const normalListener = vi.fn();

      store.subscribe("world:saved", errorListener);
      store.subscribe("world:saved", normalListener);

      await store.saveWorld(createTestWorld("world-1"));

      // Both listeners called despite error
      expect(errorListener).toHaveBeenCalledOnce();
      expect(normalListener).toHaveBeenCalledOnce();
    });
  });

  // ==========================================================================
  // Serialization
  // ==========================================================================

  describe("Serialization", () => {
    it("exports to JSON", async () => {
      const world = createTestWorld("world-1");
      await store.saveWorld(world);
      await store.setGenesis(createWorldId("world-1"));
      await store.saveSnapshot(createWorldId("world-1"), createTestSnapshot());
      await store.saveBinding(createTestBinding("agent-1"));

      const json = store.toJSON();

      expect(json.worlds).toHaveLength(1);
      expect(json.snapshots).toHaveLength(1);
      expect(json.bindings).toHaveLength(1);
      expect(json.genesisId).toBe("world-1");
    });

    it("imports from JSON", async () => {
      const world = createTestWorld("world-1");
      const snapshot = createTestSnapshot();
      const binding = createTestBinding("agent-1");

      await store.saveWorld(world);
      await store.saveSnapshot(createWorldId("world-1"), snapshot);
      await store.setGenesis(createWorldId("world-1"));
      await store.saveBinding(binding);

      const json = store.toJSON();
      const restored = MemoryWorldStore.fromJSON(json);

      const stats = await restored.getStats();
      expect(stats.worlds).toBe(1);
      expect(stats.snapshots).toBe(1);
      expect(stats.bindings).toBe(1);

      const genesis = await restored.getGenesis();
      expect(genesis).toEqual(world);
    });

    it("restores edge indexes correctly", async () => {
      await store.saveWorld(createTestWorld("world-1"));
      await store.saveWorld(createTestWorld("world-2"));
      await store.saveWorld(createTestWorld("world-3"));
      await store.saveEdge(createTestEdge("edge-1", "world-1", "world-2", "prop-1", "dec-1"));
      await store.saveEdge(createTestEdge("edge-2", "world-1", "world-3", "prop-2", "dec-2"));

      const json = store.toJSON();
      const restored = MemoryWorldStore.fromJSON(json);

      const children = await restored.getChildEdges(createWorldId("world-1"));
      expect(children).toHaveLength(2);

      const parent = await restored.getParentEdge(createWorldId("world-2"));
      expect(parent?.edgeId).toBe("edge-1");
    });

    it("restores decision by proposal index", async () => {
      const decision = createTestDecision("dec-1", "prop-1");
      await store.saveDecision(decision);

      const json = store.toJSON();
      const restored = MemoryWorldStore.fromJSON(json);

      const byProposal = await restored.getDecisionByProposal(createProposalId("prop-1"));
      expect(byProposal).toEqual(decision);
    });
  });

  // ==========================================================================
  // Complex Scenarios
  // ==========================================================================

  describe("Complex Scenarios", () => {
    it("handles full proposal lifecycle", async () => {
      // Setup
      const genesis = createTestWorld("genesis");
      await store.saveWorld(genesis);
      await store.setGenesis(createWorldId("genesis"));
      await store.saveBinding(createTestBinding("agent-1"));

      // Submit proposal
      const proposal = createTestProposal("prop-1", "agent-1", "genesis");
      await store.saveProposal(proposal);

      // Transition to pending
      await store.updateProposal(createProposalId("prop-1"), { status: "pending" });

      // Make decision
      const decision = createTestDecision("dec-1", "prop-1");
      await store.saveDecision(decision);
      await store.updateProposal(createProposalId("prop-1"), {
        status: "approved",
        decisionId: decision.decisionId,
        decidedAt: Date.now(),
      });

      // Execute and complete
      await store.updateProposal(createProposalId("prop-1"), { status: "executing" });

      const resultWorld = createTestWorld("world-2", "prop-1");
      await store.saveWorld(resultWorld);

      const edge = createTestEdge("edge-1", "genesis", "world-2", "prop-1", "dec-1");
      await store.saveEdge(edge);

      await store.updateProposal(createProposalId("prop-1"), {
        status: "completed",
        resultWorld: resultWorld.worldId,
        completedAt: Date.now(),
      });

      // Verify final state
      const finalProposal = await store.getProposal(createProposalId("prop-1"));
      expect(finalProposal?.status).toBe("completed");
      expect(finalProposal?.resultWorld).toBe(resultWorld.worldId);

      const stats = await store.getStats();
      expect(stats.worlds).toBe(2);
      expect(stats.edges).toBe(1);
      expect(stats.proposals).toBe(1);
      expect(stats.decisions).toBe(1);
    });

    it("handles branching lineage", async () => {
      // Create genesis
      await store.saveWorld(createTestWorld("genesis"));
      await store.setGenesis(createWorldId("genesis"));

      // Create three branches from genesis
      for (let i = 1; i <= 3; i++) {
        await store.saveWorld(createTestWorld(`branch-${i}`, `prop-${i}`));
        await store.saveEdge(createTestEdge(`edge-${i}`, "genesis", `branch-${i}`, `prop-${i}`, `dec-${i}`));
      }

      const children = await store.getChildEdges(createWorldId("genesis"));
      expect(children).toHaveLength(3);

      const stats = await store.getStats();
      expect(stats.worlds).toBe(4);
      expect(stats.edges).toBe(3);
    });

    it("concurrent proposal tracking", async () => {
      await store.saveWorld(createTestWorld("base"));

      // Submit multiple proposals concurrently
      const proposals = [];
      for (let i = 0; i < 5; i++) {
        proposals.push(store.saveProposal(createTestProposal(`prop-${i}`, `agent-${i}`, "base")));
      }
      await Promise.all(proposals);

      const all = await store.listProposals();
      expect(all).toHaveLength(5);

      // Update some to pending
      await store.updateProposal(createProposalId("prop-1"), { status: "pending" });
      await store.updateProposal(createProposalId("prop-2"), { status: "pending" });

      const pending = await store.getPendingProposals();
      expect(pending).toHaveLength(2);
    });
  });
});
