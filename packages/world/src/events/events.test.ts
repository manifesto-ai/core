/**
 * World Protocol Event System Integration Tests
 *
 * Tests event emission in ManifestoWorld per WORLD_EVENT_SPEC.md.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DomainSchema } from "@manifesto-ai/core";
import { createSnapshot, hashSchemaSync } from "@manifesto-ai/core";
import { createHost, type HostLoopOptions } from "@manifesto-ai/host";
import {
  ManifestoWorld,
  createManifestoWorld,
} from "../index.js";
import { createIntentInstance } from "../schema/intent.js";
import type {
  World,
  WorldEvent,
  WorldEventType,
  ProposalSubmittedEvent,
  ProposalEvaluatingEvent,
  ProposalDecidedEvent,
  ExecutionStartedEvent,
  ExecutionComputingEvent,
  ExecutionPatchesEvent,
  ExecutionEffectEvent,
  ExecutionEffectResultEvent,
  ExecutionCompletedEvent,
  SnapshotChangedEvent,
  WorldCreatedEvent,
  WorldForkedEvent,
  IntentInstance,
} from "../index.js";

// =============================================================================
// Test Helpers
// =============================================================================

const TEST_FLOW = {
  kind: "seq" as const,
  steps: [
    { kind: "patch" as const, op: "set" as const, path: "started", value: { kind: "lit" as const, value: true } },
    {
      kind: "if" as const,
      cond: { kind: "isNull" as const, arg: { kind: "get" as const, path: "result" } },
      then: {
        kind: "effect" as const,
        type: "test.effect",
        params: { value: { kind: "get" as const, path: "input.value" } },
      },
      else: { kind: "patch" as const, op: "set" as const, path: "done", value: { kind: "lit" as const, value: true } },
    },
  ],
};

const TEST_SCHEMA_BASE: Omit<DomainSchema, "hash"> = {
  id: "manifesto:test-world-events",
  version: "1.0.0",
  types: {},
  state: {
    fields: {
      started: { type: "boolean", required: false, default: false },
      result: { type: "string", required: false, default: null },
      done: { type: "boolean", required: false, default: false },
    },
  },
  computed: {
    fields: {
      "computed.started": {
        expr: { kind: "get", path: "started" },
        deps: ["started"],
      },
    },
  },
  actions: {
    "test-action": { flow: TEST_FLOW },
    "action-1": { flow: TEST_FLOW },
    "action-2": { flow: TEST_FLOW },
  },
};

const TEST_SCHEMA_HASH = hashSchemaSync(TEST_SCHEMA_BASE);
const HOST_CONTEXT = { now: 0, randomSeed: "seed" };

const TEST_SCHEMA: DomainSchema = {
  ...TEST_SCHEMA_BASE,
  hash: TEST_SCHEMA_HASH,
};

function createTestSnapshot(data: Record<string, unknown> = {}) {
  return createSnapshot(data, TEST_SCHEMA_HASH, HOST_CONTEXT);
}

function createTestActor(id: string, kind: "human" | "agent" | "system" = "human") {
  return { actorId: id, kind };
}

async function createTestIntent(
  type: string = "test-action",
  input: Record<string, unknown> = {},
  actor: { actorId: string; kind: "human" | "agent" | "system" } = { actorId: "human-1", kind: "human" }
): Promise<IntentInstance> {
  return createIntentInstance({
    body: {
      type,
      input,
    },
    schemaHash: TEST_SCHEMA_HASH,
    projectionId: "test:projection",
    source: { kind: "ui", eventId: `event-${Date.now()}` },
    actor,
  });
}

function createMockHost(resultSnapshot = createTestSnapshot({ executed: true })) {
  return {
    dispatch: vi.fn().mockResolvedValue({
      status: "complete" as const,
      snapshot: resultSnapshot,
    }),
  };
}

function createTestHost() {
  const host = createHost(TEST_SCHEMA, { initialData: {} });
  host.registerEffect("test.effect", async (_type, params) => {
    const value = (params as { value?: string }).value ?? "ok";
    return [{ op: "set", path: "result", value }];
  });

  return {
    dispatch: (
      intent: { type: string; input?: unknown; intentId: string },
      loopOptions?: Partial<HostLoopOptions>
    ) => host.dispatch(intent, loopOptions),
  };
}

// =============================================================================
// Event Integration Tests
// =============================================================================

describe("World Protocol Event System", () => {
  let world: ManifestoWorld;
  let genesis: World;
  let events: WorldEvent[];
  let host: ReturnType<typeof createTestHost>;

  beforeEach(async () => {
    events = [];
    host = createTestHost();
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
      const intent = await createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const submittedEvents = events.filter((e) => e.type === "proposal:submitted");
      expect(submittedEvents).toHaveLength(1);

      const event = submittedEvents[0] as ProposalSubmittedEvent;
      expect(event.proposal).toBeDefined();
      expect(event.actor.actorId).toBe("human-1");
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it("emits proposal:evaluating when authority begins evaluation", async () => {
      const intent = await createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const evaluatingEvents = events.filter((e) => e.type === "proposal:evaluating");
      expect(evaluatingEvents).toHaveLength(1);

      const event = evaluatingEvents[0] as ProposalEvaluatingEvent;
      expect(event.proposalId).toBeDefined();
      expect(event.authorityId).toBeDefined();
    });

    it("emits proposal:decided with approved decision", async () => {
      const intent = await createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const decidedEvents = events.filter((e) => e.type === "proposal:decided");
      expect(decidedEvents).toHaveLength(1);

      const event = decidedEvents[0] as ProposalDecidedEvent;
      expect(event.decision).toBe("approved");
      expect(event.decisionRecord).toBeDefined();
    });

    it("emits proposal:decided with rejected decision", async () => {
      // Register actor with policy that rejects
      const rejector = createTestActor("rejector", "human");
      world.registerActor(rejector, {
        mode: "policy_rules",
        rules: [],
        defaultDecision: "reject",
      });

      const intent = await createTestIntent("test-action", {}, rejector);
      await world.submitProposal("rejector", intent, genesis.worldId);

      const decidedEvents = events.filter((e) => e.type === "proposal:decided");
      expect(decidedEvents).toHaveLength(1);

      const event = decidedEvents[0] as ProposalDecidedEvent;
      expect(event.decision).toBe("rejected");
    });

    it("emits proposal:decided with pending for HITL", async () => {
      const hitlActor = createTestActor("hitl-actor", "human");
      world.registerActor(hitlActor, {
        mode: "hitl",
        delegate: { actorId: "human-reviewer", kind: "human" as const },
      });

      const intent = await createTestIntent("test-action", {}, hitlActor);
      await world.submitProposal("hitl-actor", intent, genesis.worldId);

      const decidedEvents = events.filter((e) => e.type === "proposal:decided");
      expect(decidedEvents).toHaveLength(1);

      const event = decidedEvents[0] as ProposalDecidedEvent;
      expect(event.decision).toBe("pending");
    });
  });

  describe("Execution Lifecycle Events", () => {
    it("emits execution:started when execution begins", async () => {
      const intent = await createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const startedEvents = events.filter((e) => e.type === "execution:started");
      expect(startedEvents).toHaveLength(1);

      const event = startedEvents[0] as ExecutionStartedEvent;
      expect(event.type).toBe("execution:started");
      expect(event.timestamp).toBeGreaterThan(0);
      expect(event.baseSnapshot).toBeDefined();
    });

    it("emits execution:computing and execution:patches during compute", async () => {
      const intent = await createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const computingEvents = events.filter((e) => e.type === "execution:computing");
      expect(computingEvents.length).toBeGreaterThan(0);

      const patchesEvents = events.filter((e) => e.type === "execution:patches");
      expect(patchesEvents.length).toBeGreaterThan(0);

      const computeEvent = computingEvents[0] as ExecutionComputingEvent;
      expect(computeEvent.iteration).toBe(0);

      const patchesEvent = patchesEvents[0] as ExecutionPatchesEvent;
      expect(patchesEvent.source).toBe("compute");
      expect(Array.isArray(patchesEvent.patches)).toBe(true);
    });

    it("emits execution:effect and execution:effect_result for effects", async () => {
      const intent = await createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const effectEvents = events.filter((e) => e.type === "execution:effect");
      expect(effectEvents).toHaveLength(1);

      const effectEvent = effectEvents[0] as ExecutionEffectEvent;
      expect(effectEvent.effectType).toBe("test.effect");

      const resultEvents = events.filter((e) => e.type === "execution:effect_result");
      expect(resultEvents).toHaveLength(1);

      const resultEvent = resultEvents[0] as ExecutionEffectResultEvent;
      expect(resultEvent.effectType).toBe("test.effect");
      expect(resultEvent.success).toBe(true);
    });

    it("emits snapshot:changed for state transitions", async () => {
      const intent = await createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const snapshotEvents = events.filter((e) => e.type === "snapshot:changed");
      expect(snapshotEvents.length).toBeGreaterThan(0);

      const event = snapshotEvents[0] as SnapshotChangedEvent;
      expect(event.before.snapshotHash).toBeDefined();
      expect(event.after.snapshotHash).toBeDefined();
      expect(event.after.snapshot).toBeDefined();
    });

    it("emits execution:completed on successful execution", async () => {
      const intent = await createTestIntent();
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

      const intent = await createTestIntent();
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
      const intent = await createTestIntent();
      const result = await world.submitProposal("human-1", intent, genesis.worldId);

      const createdEvents = events.filter((e) => e.type === "world:created");
      expect(createdEvents).toHaveLength(1);

      const event = createdEvents[0] as WorldCreatedEvent;
      expect(event.world.worldId).toBe(result.resultWorld?.worldId);
      expect(event.proposalId).toBe(result.proposal.proposalId);
      expect(event.parentWorldId).toBe(genesis.worldId);
    });

    it("does not emit world:created for rejected proposals", async () => {
      const rejector = createTestActor("rejector", "human");
      world.registerActor(rejector, {
        mode: "policy_rules",
        rules: [],
        defaultDecision: "reject",
      });

      const intent = await createTestIntent("test-action", {}, rejector);
      await world.submitProposal("rejector", intent, genesis.worldId);

      const createdEvents = events.filter((e) => e.type === "world:created");
      expect(createdEvents).toHaveLength(0);
    });

    it("emits world:forked when a parent gains a second child", async () => {
      const forkEvents: WorldEvent[] = [];
      const forkHost = {
        dispatch: vi.fn()
          .mockResolvedValueOnce({ status: "complete" as const, snapshot: createTestSnapshot({ result: "a" }) })
          .mockResolvedValueOnce({ status: "complete" as const, snapshot: createTestSnapshot({ result: "b" }) }),
      };
      const forkWorld = createManifestoWorld({
        schemaHash: TEST_SCHEMA_HASH,
        host: forkHost,
      });
      forkWorld.subscribe((e) => forkEvents.push(e));

      const forkGenesis = await forkWorld.createGenesis(createTestSnapshot());
      forkWorld.registerActor(createTestActor("human-1", "human"), {
        mode: "auto_approve",
      });

      await forkWorld.submitProposal(
        "human-1",
        await createTestIntent("test-action", { value: "a" }),
        forkGenesis.worldId
      );
      await forkWorld.submitProposal(
        "human-1",
        await createTestIntent("test-action", { value: "b" }),
        forkGenesis.worldId
      );

      const forkedEvents = forkEvents.filter((e) => e.type === "world:forked");
      expect(forkedEvents).toHaveLength(1);

      const event = forkedEvents[0] as WorldForkedEvent;
      expect(event.parentWorldId).toBe(forkGenesis.worldId);
      expect(event.childWorldId).toBeDefined();
      expect(event.proposalId).toBeDefined();
    });
  });

  describe("Event Ordering (EVT-R2)", () => {
    it("emits events in causal order for full proposal lifecycle", async () => {
      const intent = await createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const indexOf = (type: WorldEventType) => events.findIndex((e) => e.type === type);

      expect(indexOf("proposal:submitted")).toBeLessThan(indexOf("proposal:decided"));
      expect(indexOf("proposal:decided")).toBeLessThan(indexOf("execution:started"));
      expect(indexOf("execution:started")).toBeLessThan(indexOf("execution:computing"));
      expect(indexOf("execution:computing")).toBeLessThan(indexOf("execution:patches"));
      expect(indexOf("execution:patches")).toBeLessThan(indexOf("snapshot:changed"));
      expect(indexOf("snapshot:changed")).toBeLessThan(indexOf("execution:completed"));
      expect(indexOf("execution:completed")).toBeLessThan(indexOf("world:created"));
    });

    it("proposal:submitted comes before proposal:decided", async () => {
      const intent = await createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const submittedIndex = events.findIndex((e) => e.type === "proposal:submitted");
      const decidedIndex = events.findIndex((e) => e.type === "proposal:decided");

      expect(submittedIndex).toBeLessThan(decidedIndex);
    });

    it("execution:started comes before execution:completed", async () => {
      const intent = await createTestIntent();
      await world.submitProposal("human-1", intent, genesis.worldId);

      const startedIndex = events.findIndex((e) => e.type === "execution:started");
      const completedIndex = events.findIndex((e) => e.type === "execution:completed");

      expect(startedIndex).toBeLessThan(completedIndex);
    });

    it("execution:completed comes before world:created", async () => {
      const intent = await createTestIntent();
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

      const intent = await createTestIntent();
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

      const intent1 = await createTestIntent("action-1");
      await world.submitProposal("human-1", intent1, genesis.worldId);
      const countAfterFirst = laterEvents.length;

      unsubscribe();

      const intent2 = await createTestIntent("action-2");
      const result = await world.submitProposal("human-1", intent2, (await world.getWorld(laterEvents.find(e => e.type === "world:created")?.world?.worldId ?? genesis.worldId))?.worldId ?? genesis.worldId);

      // Should not have received any new events
      expect(laterEvents.length).toBe(countAfterFirst);
    });
  });

  describe("HITL Decision Events", () => {
    it("emits proposal:decided after processHITLDecision approval", async () => {
      const hitlEvents: WorldEvent[] = [];
      const hitlActor = createTestActor("hitl-actor", "human");
      world.registerActor(hitlActor, {
        mode: "hitl",
        delegate: { actorId: "human-reviewer", kind: "human" as const },
      });

      world.subscribe((e) => hitlEvents.push(e));

      const intent = await createTestIntent("test-action", {}, hitlActor);
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
      const hitlActor = createTestActor("hitl-actor", "human");
      noHostWorld.registerActor(hitlActor, {
        mode: "hitl",
        delegate: { actorId: "human-reviewer", kind: "human" as const },
      });

      noHostWorld.subscribe((e) => hitlEvents.push(e));

      const intent = await createTestIntent("test-action", {}, hitlActor);
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
      const intent1 = await createTestIntent("action-1");
      const result1 = await world.submitProposal("human-1", intent1, genesis.worldId);

      expect(result1.resultWorld).toBeDefined();

      const eventsAfterFirst = events.length;

      const intent2 = await createTestIntent("action-2");
      await world.submitProposal("human-1", intent2, result1.resultWorld!.worldId);

      // Should have events for second proposal too
      const eventsForSecond = events.slice(eventsAfterFirst);

      // At minimum, should have proposal:submitted for the second proposal
      const submittedEvents = eventsForSecond.filter((e) => e.type === "proposal:submitted");
      expect(submittedEvents.length).toBeGreaterThanOrEqual(1);
    });
  });
});
