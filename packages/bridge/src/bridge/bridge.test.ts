/**
 * Bridge Integration Tests
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Bridge, createBridge } from "./bridge.js";
import type { BridgeConfig } from "./bridge.js";
import type { Projection, ProjectionRequest } from "../schema/projection.js";
import { intentResult, noneResult } from "../schema/projection.js";
import { createProjectionRegistry } from "../projection/registry.js";
import { createProjectionRecorder } from "../projection/recorder.js";
import { createIntentIssuer } from "../issuer/intent-issuer.js";
import type { Snapshot } from "@manifesto-ai/core";
import type { ManifestoWorld, ActorRef, WorldId } from "@manifesto-ai/world";

// Mock ManifestoWorld
const createMockWorld = () => {
  const snapshots = new Map<string, Snapshot>();
  let genesisWorldId: string | null = null;

  const mockWorld = {
    schemaHash: "test-schema-hash",

    async getGenesis() {
      if (!genesisWorldId) return null;
      return { worldId: genesisWorldId, schemaHash: "test-schema-hash" };
    },

    async getSnapshot(worldId: WorldId) {
      return snapshots.get(worldId as string) ?? null;
    },

    async submitProposal(actorId: string, intent: any, baseWorld: WorldId) {
      // Simulate successful proposal
      const newWorldId = `world-${Date.now()}`;
      const newSnapshot: Snapshot = {
        data: { updated: true },
        computed: {},
        system: {
          status: "idle",
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        input: null,
        meta: { version: 1, timestamp: Date.now(), randomSeed: "seed", schemaHash: "test-schema-hash" },
      };
      snapshots.set(newWorldId, newSnapshot);

      return {
        proposal: { proposalId: "prop-1", status: "completed" },
        resultWorld: { worldId: newWorldId, schemaHash: "test-schema-hash" },
      };
    },

    // Helper to set up initial state
    _setGenesis(worldId: string, snapshot: Snapshot) {
      genesisWorldId = worldId;
      snapshots.set(worldId, snapshot);
    },
  } as unknown as ManifestoWorld & { _setGenesis: (id: string, s: Snapshot) => void };

  return mockWorld;
};

const createMockSnapshot = (): Snapshot => ({
  data: {
    todos: [{ id: "1", title: "Test Todo" }],
    count: 1,
  },
  computed: {
    totalTodos: 1,
    isEmpty: false,
  },
  system: {
    status: "idle",
    lastError: null,
    errors: [],
    pendingRequirements: [],
    currentAction: null,
  },
  input: null,
  meta: { version: 1, timestamp: Date.now(), randomSeed: "seed", schemaHash: "test-schema-hash" },
});

const createDefaultActor = (): ActorRef => ({
  actorId: "user-1",
  kind: "human",
  name: "Test User",
});

describe("Bridge", () => {
  let mockWorld: ReturnType<typeof createMockWorld>;
  let bridge: Bridge;

  beforeEach(() => {
    mockWorld = createMockWorld();
    mockWorld._setGenesis("genesis-world", createMockSnapshot());

    bridge = new Bridge({
      world: mockWorld,
      schemaHash: "test-schema-hash",
      defaultActor: createDefaultActor(),
    });
  });

  describe("constructor", () => {
    it("should throw if no world provided", () => {
      expect(() => {
        new Bridge({
          world: undefined as any,
          schemaHash: "test",
        });
      }).toThrow("No world configured");
    });

    it("should use provided registry", () => {
      const registry = createProjectionRegistry();
      const bridge = new Bridge({
        world: mockWorld,
        schemaHash: "test",
        registry,
      });

      expect(bridge.getRegistry()).toBe(registry);
    });

    it("should use provided recorder", () => {
      const recorder = createProjectionRecorder();
      const bridge = new Bridge({
        world: mockWorld,
        schemaHash: "test",
        recorder,
      });

      expect(bridge.getRecorder()).toBe(recorder);
    });

    it("should use default projection ID", () => {
      const bridge = new Bridge({
        world: mockWorld,
        schemaHash: "test",
        defaultProjectionId: "custom:projection",
      });

      expect(bridge).toBeDefined();
    });
  });

  describe("subscribe", () => {
    it("should add subscriber", () => {
      const callback = vi.fn();

      bridge.subscribe(callback);

      // Callback should not be called immediately (no snapshot yet)
      expect(callback).not.toHaveBeenCalled();
    });

    it("should call subscriber immediately if snapshot exists", async () => {
      const callback = vi.fn();

      // Refresh to load snapshot
      await bridge.refresh();

      bridge.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Object),
          computed: expect.any(Object),
        })
      );
    });

    it("should return unsubscribe function", async () => {
      const callback = vi.fn();

      await bridge.refresh();
      const unsubscribe = bridge.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      // After unsubscribe, callback should not be called on refresh
      await bridge.refresh();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should throw if bridge is disposed", () => {
      bridge.dispose();

      expect(() => {
        bridge.subscribe(() => {});
      }).toThrow("disposed");
    });
  });

  describe("get", () => {
    it("should return undefined if no snapshot", () => {
      const value = bridge.get("data.todos");

      expect(value).toBeUndefined();
    });

    it("should get value by path after refresh", async () => {
      await bridge.refresh();

      const todos = bridge.get("todos");

      expect(todos).toBeDefined();
      expect(Array.isArray(todos)).toBe(true);
    });

    it("should get computed values", async () => {
      await bridge.refresh();

      const totalTodos = bridge.get("computed.totalTodos");

      expect(totalTodos).toBe(1);
    });
  });

  describe("getSnapshot", () => {
    it("should return null if no snapshot", () => {
      expect(bridge.getSnapshot()).toBeNull();
    });

    it("should return snapshot after refresh", async () => {
      await bridge.refresh();

      const snapshot = bridge.getSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot?.data).toBeDefined();
      expect(snapshot?.computed).toBeDefined();
    });
  });

  describe("getWorldId", () => {
    it("should return null initially", () => {
      expect(bridge.getWorldId()).toBeNull();
    });

    it("should return world ID after refresh", async () => {
      await bridge.refresh();

      expect(bridge.getWorldId()).toBe("genesis-world");
    });
  });

  describe("dispatch", () => {
    it("should throw if no actor configured", async () => {
      const bridge = new Bridge({
        world: mockWorld,
        schemaHash: "test",
        // No defaultActor
      });

      await expect(
        bridge.dispatch({ type: "test.action", input: {} })
      ).rejects.toThrow("No actor configured");
    });

    it("should dispatch intent body", async () => {
      await bridge.dispatch({
        type: "todo.create",
        input: { title: "New Todo" },
      });

      // Should have updated world ID
      expect(bridge.getWorldId()).not.toBe("genesis-world");
    });

    it("should use provided actor over default", async () => {
      const customActor: ActorRef = {
        actorId: "custom-user",
        kind: "agent",
      };

      await bridge.dispatch(
        { type: "test.action", input: {} },
        undefined,
        customActor
      );

      // Should complete without error
      expect(bridge.getWorldId()).toBeDefined();
    });

    it("should throw if disposed", async () => {
      bridge.dispose();

      await expect(
        bridge.dispatch({ type: "test", input: {} })
      ).rejects.toThrow("disposed");
    });
  });

  describe("dispatchEvent", () => {
    beforeEach(async () => {
      await bridge.refresh();
    });

    it("should throw if no actor configured", async () => {
      const bridge = new Bridge({
        world: mockWorld,
        schemaHash: "test",
      });
      await bridge.refresh();

      await expect(
        bridge.dispatchEvent({ kind: "ui", eventId: "e1", payload: {} })
      ).rejects.toThrow("No actor configured");
    });

    it("should route through projections", async () => {
      const projection: Projection = {
        projectionId: "test-projection",
        project: (req) => {
          if ((req.source.payload as any)?.action === "submit") {
            return intentResult({
              type: "form.submit",
              input: (req.source.payload as any)?.data,
            });
          }
          return noneResult();
        },
      };

      bridge.registerProjection(projection);

      const result = await bridge.dispatchEvent({
        kind: "ui",
        eventId: "form-submit",
        payload: { action: "submit", data: { name: "Test" } },
      });

      expect(result.kind).toBe("intent");
    });

    it("should evaluate each projection only once", async () => {
      const project = vi.fn(() => noneResult("no match"));
      const projection: Projection = {
        projectionId: "single-eval",
        project,
      };

      bridge.registerProjection(projection);

      await bridge.dispatchEvent({
        kind: "ui",
        eventId: "event-1",
        payload: {},
      });

      expect(project).toHaveBeenCalledTimes(1);
    });

    it("should return none if no projection matches", async () => {
      const result = await bridge.dispatchEvent({
        kind: "ui",
        eventId: "unknown-event",
        payload: {},
      });

      expect(result.kind).toBe("none");
    });

    it("should throw if disposed", async () => {
      bridge.dispose();

      await expect(
        bridge.dispatchEvent({ kind: "ui", eventId: "e1", payload: {} })
      ).rejects.toThrow("disposed");
    });
  });

  describe("set", () => {
    it("should dispatch field.set intent", async () => {
      const submitSpy = vi.spyOn(mockWorld, "submitProposal");

      await bridge.set("data.name", "Alice");

      expect(submitSpy).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          body: {
            type: "field.set",
            input: { path: "data.name", value: "Alice" },
          },
        }),
        expect.any(String)
      );
    });
  });

  describe("registerProjection", () => {
    it("should register projection to registry", () => {
      const projection: Projection = {
        projectionId: "test-proj",
        project: () => noneResult(),
      };

      bridge.registerProjection(projection);

      expect(bridge.getRegistry().get("test-proj")).toBe(projection);
    });
  });

  describe("unregisterProjection", () => {
    it("should remove projection from registry", () => {
      const projection: Projection = {
        projectionId: "test-proj",
        project: () => noneResult(),
      };

      bridge.registerProjection(projection);
      const removed = bridge.unregisterProjection("test-proj");

      expect(removed).toBe(true);
      expect(bridge.getRegistry().get("test-proj")).toBeUndefined();
    });

    it("should return false for non-existent projection", () => {
      const removed = bridge.unregisterProjection("unknown");

      expect(removed).toBe(false);
    });
  });

  describe("dispose", () => {
    it("should mark bridge as disposed", () => {
      expect(bridge.isDisposed()).toBe(false);

      bridge.dispose();

      expect(bridge.isDisposed()).toBe(true);
    });

    it("should clear subscribers", async () => {
      const callback = vi.fn();
      await bridge.refresh();
      bridge.subscribe(callback);

      bridge.dispose();

      // Subscribers should be cleared
      expect(bridge.isDisposed()).toBe(true);
    });

    it("should clear snapshot and world ID", async () => {
      await bridge.refresh();
      expect(bridge.getSnapshot()).not.toBeNull();
      expect(bridge.getWorldId()).not.toBeNull();

      bridge.dispose();

      expect(bridge.getSnapshot()).toBeNull();
      expect(bridge.getWorldId()).toBeNull();
    });
  });

  describe("refresh", () => {
    it("should load snapshot from genesis", async () => {
      expect(bridge.getSnapshot()).toBeNull();

      await bridge.refresh();

      expect(bridge.getSnapshot()).not.toBeNull();
    });

    it("should notify subscribers on refresh", async () => {
      const callback = vi.fn();
      bridge.subscribe(callback);

      await bridge.refresh();

      expect(callback).toHaveBeenCalled();
    });

    it("should do nothing if disposed", async () => {
      bridge.dispose();

      await bridge.refresh();

      expect(bridge.getSnapshot()).toBeNull();
    });
  });
});

describe("createBridge factory", () => {
  it("should create a Bridge instance", () => {
    const mockWorld = createMockWorld();
    const bridge = createBridge({
      world: mockWorld,
      schemaHash: "test",
    });

    expect(bridge).toBeInstanceOf(Bridge);
  });

  it("should pass config to Bridge", () => {
    const mockWorld = createMockWorld();
    const registry = createProjectionRegistry();

    const bridge = createBridge({
      world: mockWorld,
      schemaHash: "custom-schema",
      registry,
      defaultActor: { actorId: "default", kind: "system" },
    });

    expect(bridge.getRegistry()).toBe(registry);
  });
});
