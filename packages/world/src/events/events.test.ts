/**
 * World Protocol Event System Integration Tests
 *
 * Tests event emission in ManifestoWorld per WORLD_EVENT_SPEC.md.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSnapshot } from "@manifesto-ai/core";
import {
  ManifestoWorld,
  createManifestoWorld,
} from "../index.js";
import type {
  World,
  WorldEvent,
  WorldEventType,
  ProposalSubmittedEvent,
  ProposalEvaluatingEvent,
  ProposalDecidedEvent,
  ExecutionStartedEvent,
  ExecutionCompletedEvent,
  WorldCreatedEvent,
  IntentInstance,
} from "../index.js";

// =============================================================================
// Test Helpers
// =============================================================================

const TEST_SCHEMA_HASH = "test-schema-hash-events";

function createTestSnapshot(data: Record<string, unknown> = {}) {
  return createSnapshot(data, TEST_SCHEMA_HASH);
}

function createTestActor(id: string, kind: "human" | "agent" | "system" = "human") {
  return { actorId: id, kind };
}

function createTestIntent(type: string = "test-action", input: Record<string, unknown> = {}): IntentInstance {
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

function createMockHost(resultSnapshot = createTestSnapshot({ executed: true })) {
  return {
    dispatch: vi.fn().mockResolvedValue({
      status: "complete" as const,
      snapshot: resultSnapshot,
    }),
  };
}

// =============================================================================
// Event Integration Tests
// =============================================================================

describe("World Protocol Event System", () => {
  let world: ManifestoWorld;
  let genesis: World;
  let events: WorldEvent[];
  let host: ReturnType<typeof createMockHost>;

  beforeEach(async () => {
    events = [];
    host = createMockHost();
    world = createManifestoWorld({
      schemaHash: TEST_SCHEMA_HASH,
      host,
    });

    // Subscribe to all events
    world.subscribe((event) => {
      events.push(event);
    });

    genesis = await world.createGenesis(createTestSnapshot());
    world.registerActor(createTestActor("human-1", "human"), {
      mode: "auto_approve",
    });

    // Clear genesis events
    events = [];
  });

  describe("Genesis Events", () => {
    it("emits world:created for genesis", async () => {
      const genesisEvents: WorldEvent[] = [];
      const newWorld = createManifestoWorld({ schemaHash: "new-schema" });
      newWorld.subscribe((e) => genesisEvents.push(e));

      const gen = await newWorld.createGenesis(createTestSnapshot());

      expect(genesisEvents).toHaveLength(1);
      expect(genesisEvents[0].type).toBe("world:created");

      const event = genesisEvents[0] as WorldCreatedEvent;
      expect(event.world.worldId).toBe(gen.worldId);
      expect(event.proposalId).toBeNull();
      expect(event.parentWorldId).toBeNull();
    });
  });

  describe("Proposal Lifecycle Events", () => {
    it("emits proposal:submitted when proposal is submitted", async () => {
      const intent = createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const submittedEvents = events.filter((e) => e.type === "proposal:submitted");
      expect(submittedEvents).toHaveLength(1);

      const event = submittedEvents[0] as ProposalSubmittedEvent;
      expect(event.proposal).toBeDefined();
      expect(event.actor.actorId).toBe("human-1");
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it("emits proposal:evaluating when authority begins evaluation", async () => {
      const intent = createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const evaluatingEvents = events.filter((e) => e.type === "proposal:evaluating");
      expect(evaluatingEvents).toHaveLength(1);

      const event = evaluatingEvents[0] as ProposalEvaluatingEvent;
      expect(event.proposalId).toBeDefined();
      expect(event.authorityId).toBeDefined();
    });

    it("emits proposal:decided with approved decision", async () => {
      const intent = createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const decidedEvents = events.filter((e) => e.type === "proposal:decided");
      expect(decidedEvents).toHaveLength(1);

      const event = decidedEvents[0] as ProposalDecidedEvent;
      expect(event.decision).toBe("approved");
      expect(event.decisionRecord).toBeDefined();
    });

    it("emits proposal:decided with rejected decision", async () => {
      // Register actor with policy that rejects
      world.registerActor(createTestActor("rejector", "human"), {
        mode: "policy_rules",
        rules: [],
        defaultDecision: "reject",
      });

      const intent = createTestIntent();
      await world.submitProposal("rejector", intent, genesis.worldId);

      const decidedEvents = events.filter((e) => e.type === "proposal:decided");
      expect(decidedEvents).toHaveLength(1);

      const event = decidedEvents[0] as ProposalDecidedEvent;
      expect(event.decision).toBe("rejected");
    });

    it("emits proposal:decided with pending for HITL", async () => {
      world.registerActor(createTestActor("hitl-actor", "human"), {
        mode: "hitl",
        delegate: { actorId: "human-reviewer", kind: "human" as const },
      });

      const intent = createTestIntent();
      await world.submitProposal("hitl-actor", intent, genesis.worldId);

      const decidedEvents = events.filter((e) => e.type === "proposal:decided");
      expect(decidedEvents).toHaveLength(1);

      const event = decidedEvents[0] as ProposalDecidedEvent;
      expect(event.decision).toBe("pending");
    });
  });

  describe("Execution Lifecycle Events", () => {
    it("emits execution:started when execution begins", async () => {
      const intent = createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const startedEvents = events.filter((e) => e.type === "execution:started");
      expect(startedEvents).toHaveLength(1);

      const event = startedEvents[0] as ExecutionStartedEvent;
      expect(event.type).toBe("execution:started");
      expect(event.timestamp).toBeGreaterThan(0);
      expect(event.baseSnapshot).toBeDefined();
    });

    it("emits execution:completed on successful execution", async () => {
      const intent = createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const completedEvents = events.filter((e) => e.type === "execution:completed");
      expect(completedEvents).toHaveLength(1);

      const event = completedEvents[0] as ExecutionCompletedEvent;
      expect(event.type).toBe("execution:completed");
      expect(event.finalSnapshot).toBeDefined();
      expect(typeof event.totalPatches).toBe("number");
      expect(typeof event.totalEffects).toBe("number");
    });

    it("emits execution:failed on host error", async () => {
      const failingHost = {
        dispatch: vi.fn().mockRejectedValue(new Error("Host failed")),
      };
      const failWorld = createManifestoWorld({
        schemaHash: TEST_SCHEMA_HASH,
        host: failingHost,
      });

      const failEvents: WorldEvent[] = [];
      failWorld.subscribe((e) => failEvents.push(e));

      await failWorld.createGenesis(createTestSnapshot());
      failWorld.registerActor(createTestActor("human-1"), { mode: "auto_approve" });

      const intent = createTestIntent();
      await failWorld.submitProposal("human-1", intent, (await failWorld.getGenesis())!.worldId);

      const failedEvents = failEvents.filter((e) => e.type === "execution:failed");
      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0]).toMatchObject({
        type: "execution:failed",
        error: expect.objectContaining({
          code: "HOST_EXECUTION_ERROR",
        }),
      });
    });
  });

  describe("World Lifecycle Events", () => {
    it("emits world:created after successful execution", async () => {
      const intent = createTestIntent();
      const result = await world.submitProposal("human-1", intent, genesis.worldId);

      const createdEvents = events.filter((e) => e.type === "world:created");
      expect(createdEvents).toHaveLength(1);

      const event = createdEvents[0] as WorldCreatedEvent;
      expect(event.world.worldId).toBe(result.resultWorld?.worldId);
      expect(event.proposalId).toBe(result.proposal.proposalId);
      expect(event.parentWorldId).toBe(genesis.worldId);
    });

    it("does not emit world:created for rejected proposals", async () => {
      world.registerActor(createTestActor("rejector", "human"), {
        mode: "policy_rules",
        rules: [],
        defaultDecision: "reject",
      });

      const intent = createTestIntent();
      await world.submitProposal("rejector", intent, genesis.worldId);

      const createdEvents = events.filter((e) => e.type === "world:created");
      expect(createdEvents).toHaveLength(0);
    });
  });

  describe("Event Ordering (EVT-R2)", () => {
    it("emits events in causal order for full proposal lifecycle", async () => {
      const intent = createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const eventTypes = events.map((e) => e.type);

      // Expected order per spec
      const expectedOrder = [
        "proposal:submitted",
        "proposal:evaluating",
        "proposal:decided",
        "execution:started",
        // execution:computing, execution:patches, etc. may or may not appear depending on host
        "execution:completed",
        "world:created",
      ];

      // Filter to only the events we expect in order
      const relevantEvents = eventTypes.filter((t) => expectedOrder.includes(t));

      // Check order
      let lastIndex = -1;
      for (const eventType of relevantEvents) {
        const index = expectedOrder.indexOf(eventType);
        expect(index).toBeGreaterThan(lastIndex);
        lastIndex = index;
      }
    });

    it("proposal:submitted comes before proposal:decided", async () => {
      const intent = createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const submittedIndex = events.findIndex((e) => e.type === "proposal:submitted");
      const decidedIndex = events.findIndex((e) => e.type === "proposal:decided");

      expect(submittedIndex).toBeLessThan(decidedIndex);
    });

    it("execution:started comes before execution:completed", async () => {
      const intent = createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const startedIndex = events.findIndex((e) => e.type === "execution:started");
      const completedIndex = events.findIndex((e) => e.type === "execution:completed");

      expect(startedIndex).toBeLessThan(completedIndex);
    });

    it("execution:completed comes before world:created", async () => {
      const intent = createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const completedIndex = events.findIndex((e) => e.type === "execution:completed");
      const createdIndex = events.findIndex((e) => e.type === "world:created");

      expect(completedIndex).toBeLessThan(createdIndex);
    });
  });

  describe("Filtered Subscription", () => {
    it("receives only specified event types", async () => {
      const filteredEvents: WorldEvent[] = [];
      world.subscribe(["proposal:submitted", "world:created"], (e) => {
        filteredEvents.push(e);
      });

      const intent = createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      expect(filteredEvents.every((e) =>
        e.type === "proposal:submitted" || e.type === "world:created"
      )).toBe(true);
      expect(filteredEvents).toHaveLength(2);
    });
  });

  describe("Unsubscribe", () => {
    it("stops receiving events after unsubscribe", async () => {
      const laterEvents: WorldEvent[] = [];
      const unsubscribe = world.subscribe((e) => laterEvents.push(e));

      const intent1 = createTestIntent("action-1");
      await world.submitProposal("human-1", intent1, genesis.worldId);
      const countAfterFirst = laterEvents.length;

      unsubscribe();

      const intent2 = createTestIntent("action-2");
      const result = await world.submitProposal("human-1", intent2, (await world.getWorld(laterEvents.find(e => e.type === "world:created")?.world?.worldId ?? genesis.worldId))?.worldId ?? genesis.worldId);

      // Should not have received any new events
      expect(laterEvents.length).toBe(countAfterFirst);
    });
  });

  describe("HITL Decision Events", () => {
    it("emits proposal:decided after processHITLDecision approval", async () => {
      const hitlEvents: WorldEvent[] = [];
      world.registerActor(createTestActor("hitl-actor", "human"), {
        mode: "hitl",
        delegate: { actorId: "human-reviewer", kind: "human" as const },
      });

      world.subscribe((e) => hitlEvents.push(e));

      const intent = createTestIntent();
      const pendingResult = await world.submitProposal("hitl-actor", intent, genesis.worldId);

      // Clear events from initial submission
      hitlEvents.length = 0;

      // Process HITL decision
      await world.processHITLDecision(pendingResult.proposal.proposalId, "approved");

      const decidedEvents = hitlEvents.filter((e) => e.type === "proposal:decided");
      expect(decidedEvents).toHaveLength(1);

      const event = decidedEvents[0] as ProposalDecidedEvent;
      expect(event.decision).toBe("approved");
      expect(event.decisionRecord).toBeDefined();
    });

    it("emits proposal:decided after processHITLDecision rejection", async () => {
      const hitlEvents: WorldEvent[] = [];
      // Create a new world without host to avoid execution
      const noHostWorld = createManifestoWorld({ schemaHash: TEST_SCHEMA_HASH });
      const noHostGenesis = await noHostWorld.createGenesis(createTestSnapshot());
      noHostWorld.registerActor(createTestActor("hitl-actor", "human"), {
        mode: "hitl",
        delegate: { actorId: "human-reviewer", kind: "human" as const },
      });

      noHostWorld.subscribe((e) => hitlEvents.push(e));

      const intent = createTestIntent();
      const pendingResult = await noHostWorld.submitProposal("hitl-actor", intent, noHostGenesis.worldId);

      // Clear events
      hitlEvents.length = 0;

      // Reject
      await noHostWorld.processHITLDecision(
        pendingResult.proposal.proposalId,
        "rejected",
        "Not allowed"
      );

      const decidedEvents = hitlEvents.filter((e) => e.type === "proposal:decided");
      expect(decidedEvents).toHaveLength(1);

      const event = decidedEvents[0] as ProposalDecidedEvent;
      expect(event.decision).toBe("rejected");
    });
  });

  describe("Multiple Proposals", () => {
    it("emits correct events for sequential proposals", async () => {
      const intent1 = createTestIntent("action-1");
      const result1 = await world.submitProposal("human-1", intent1, genesis.worldId);

      expect(result1.resultWorld).toBeDefined();

      const eventsAfterFirst = events.length;

      const intent2 = createTestIntent("action-2");
      await world.submitProposal("human-1", intent2, result1.resultWorld!.worldId);

      // Should have events for second proposal too
      const eventsForSecond = events.slice(eventsAfterFirst);

      // At minimum, should have proposal:submitted for the second proposal
      const submittedEvents = eventsForSecond.filter((e) => e.type === "proposal:submitted");
      expect(submittedEvents.length).toBeGreaterThanOrEqual(1);
    });
  });
});
