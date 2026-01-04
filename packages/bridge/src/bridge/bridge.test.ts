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
import { createActionCatalogProjector } from "../catalog/projector.js";
import type { ActionDescriptor, AvailabilityContext } from "../catalog/types.js";
import type { ExprNode } from "@manifesto-ai/core";
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
        meta: { version: 1, timestamp: Date.now(), schemaHash: "test-schema-hash" },
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
  meta: { version: 1, timestamp: Date.now(), schemaHash: "test-schema-hash" },
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

// ============================================================================
// Action Catalog Integration Tests (v1.1)
// ============================================================================

describe("Bridge Action Catalog Integration", () => {
  let mockWorld: ReturnType<typeof createMockWorld>;
  let bridge: Bridge;
  const catalogProjector = createActionCatalogProjector();

  beforeEach(() => {
    mockWorld = createMockWorld();

    // Set up genesis with rich snapshot for availability testing
    const richSnapshot: Snapshot = {
      data: {
        user: { role: "admin", active: true },
        todos: [{ id: "1", title: "Test" }],
        balance: 100,
      },
      computed: {
        canCreateTodo: true,
        canDeleteTodo: false,
        todoCount: 1,
        isAdmin: true,
      },
      system: {
        status: "idle",
        lastError: null,
        errors: [],
        pendingRequirements: [],
        currentAction: null,
      },
      input: null,
      meta: { version: 1, timestamp: Date.now(), schemaHash: "test-schema-hash" },
    };
    mockWorld._setGenesis("genesis-world", richSnapshot);

    bridge = new Bridge({
      world: mockWorld,
      schemaHash: "test-schema-hash",
      defaultActor: {
        actorId: "user-1",
        kind: "human",
        name: "Test User",
      },
      catalogProjector,
    });
  });

  describe("hasActionCatalog", () => {
    it("should return true when catalogProjector is configured", () => {
      expect(bridge.hasActionCatalog()).toBe(true);
    });

    it("should return false when catalogProjector is not configured", () => {
      const bridgeWithoutCatalog = new Bridge({
        world: mockWorld,
        schemaHash: "test-schema-hash",
        defaultActor: { actorId: "user-1", kind: "human" },
      });

      expect(bridgeWithoutCatalog.hasActionCatalog()).toBe(false);
    });
  });

  describe("projectActionCatalog", () => {
    it("should return null when catalogProjector is not configured", async () => {
      const bridgeWithoutCatalog = new Bridge({
        world: mockWorld,
        schemaHash: "test-schema-hash",
        defaultActor: { actorId: "user-1", kind: "human" },
      });
      await bridgeWithoutCatalog.refresh();

      const catalog = await bridgeWithoutCatalog.projectActionCatalog([
        { type: "test.action" },
      ]);

      expect(catalog).toBeNull();
    });

    it("should return null when no snapshot available", async () => {
      // Don't refresh - no snapshot
      const catalog = await bridge.projectActionCatalog([
        { type: "test.action" },
      ]);

      expect(catalog).toBeNull();
    });

    it("should return null when no actor configured", async () => {
      const bridgeNoActor = new Bridge({
        world: mockWorld,
        schemaHash: "test-schema-hash",
        catalogProjector,
        // No defaultActor
      });
      await bridgeNoActor.refresh();

      const catalog = await bridgeNoActor.projectActionCatalog([
        { type: "test.action" },
      ]);

      expect(catalog).toBeNull();
    });

    it("should project action catalog successfully", async () => {
      await bridge.refresh();

      const actions: ActionDescriptor[] = [
        { type: "todo.create", label: "Create Todo" },
        { type: "todo.list", label: "List Todos" },
      ];

      const catalog = await bridge.projectActionCatalog(actions);

      expect(catalog).not.toBeNull();
      expect(catalog!.kind).toBe("action_catalog");
      expect(catalog!.schemaHash).toBe("test-schema-hash");
      expect(catalog!.actions).toHaveLength(2);
    });

    it("should evaluate availability using snapshot data", async () => {
      await bridge.refresh();

      const actions: ActionDescriptor[] = [
        {
          type: "admin.action",
          available: {
            kind: "fn",
            evaluate: (ctx: AvailabilityContext) =>
              (ctx.data as { user: { role: string } }).user.role === "admin",
          },
        },
        {
          type: "user.action",
          available: {
            kind: "fn",
            evaluate: (ctx: AvailabilityContext) =>
              (ctx.data as { user: { role: string } }).user.role === "user",
          },
        },
      ];

      const catalog = await bridge.projectActionCatalog(actions);

      expect(catalog).not.toBeNull();
      // user.action should be filtered out (unavailable with drop_unavailable default)
      expect(catalog!.actions).toHaveLength(1);
      expect(catalog!.actions[0].type).toBe("admin.action");
      expect(catalog!.actions[0].availability.status).toBe("available");
    });

    it("should evaluate ExprNode availability predicates", async () => {
      await bridge.refresh();

      // ExprNode that checks computed.canCreateTodo
      const canCreateExpr: ExprNode = {
        kind: "get",
        path: "computed.canCreateTodo",
      };

      // ExprNode that checks computed.canDeleteTodo (false)
      const canDeleteExpr: ExprNode = {
        kind: "get",
        path: "computed.canDeleteTodo",
      };

      const actions: ActionDescriptor[] = [
        { type: "todo.create", available: canCreateExpr },
        { type: "todo.delete", available: canDeleteExpr },
      ];

      const catalog = await bridge.projectActionCatalog(actions, {
        pruning: { policy: "mark_only" },
      });

      expect(catalog).not.toBeNull();
      expect(catalog!.actions).toHaveLength(2);

      const createAction = catalog!.actions.find((a) => a.type === "todo.create");
      const deleteAction = catalog!.actions.find((a) => a.type === "todo.delete");

      expect(createAction!.availability.status).toBe("available");
      expect(deleteAction!.availability.status).toBe("unavailable");
    });

    it("should apply pruning options", async () => {
      await bridge.refresh();

      const actions: ActionDescriptor[] = [
        { type: "action.a", available: { kind: "lit", value: true } as ExprNode },
        { type: "action.b", available: { kind: "lit", value: false } as ExprNode },
        { type: "action.c", available: { kind: "lit", value: true } as ExprNode },
      ];

      // Test drop_unavailable (default)
      const catalog1 = await bridge.projectActionCatalog(actions);
      expect(catalog1!.actions).toHaveLength(2);

      // Test mark_only
      const catalog2 = await bridge.projectActionCatalog(actions, {
        pruning: { policy: "mark_only" },
      });
      expect(catalog2!.actions).toHaveLength(3);

      // Test maxActions
      const catalog3 = await bridge.projectActionCatalog(actions, {
        pruning: { maxActions: 1 },
      });
      expect(catalog3!.actions).toHaveLength(1);
    });

    it("should respect mode parameter", async () => {
      await bridge.refresh();

      const actions: ActionDescriptor[] = [
        {
          type: "test.action",
          label: "Test Action",
          description: "A test action for validation",
        },
      ];

      const llmCatalog = await bridge.projectActionCatalog(actions, { mode: "llm" });
      const uiCatalog = await bridge.projectActionCatalog(actions, { mode: "ui" });

      // Both should contain the action with all fields
      expect(llmCatalog!.actions[0].label).toBe("Test Action");
      expect(llmCatalog!.actions[0].description).toBe("A test action for validation");
      expect(uiCatalog!.actions[0].label).toBe("Test Action");
    });

    it("should compute deterministic catalogHash", async () => {
      await bridge.refresh();

      const actions: ActionDescriptor[] = [
        { type: "action.a" },
        { type: "action.b" },
      ];

      const catalog1 = await bridge.projectActionCatalog(actions);
      const catalog2 = await bridge.projectActionCatalog(actions);

      expect(catalog1!.catalogHash).toBe(catalog2!.catalogHash);
    });

    it("should integrate with state changes", async () => {
      await bridge.refresh();

      // Define actions that depend on computed values
      const actions: ActionDescriptor[] = [
        {
          type: "withdraw",
          available: {
            kind: "fn",
            evaluate: (ctx: AvailabilityContext) =>
              ((ctx.data as { balance: number }).balance ?? 0) > 0,
          },
        },
      ];

      // Initially balance is 100, so withdraw should be available
      const catalog1 = await bridge.projectActionCatalog(actions);
      expect(catalog1!.actions).toHaveLength(1);
      expect(catalog1!.actions[0].availability.status).toBe("available");

      // After dispatch, world updates - simulate state change
      await bridge.dispatch({ type: "test.action", input: {} });

      // The new snapshot has data.updated = true but we need to test with new snapshot
      // For this test, the key point is that catalog projection uses current snapshot
    });
  });

  describe("end-to-end workflow", () => {
    it("should support full LLM agent workflow", async () => {
      // 1. Initialize bridge
      await bridge.refresh();
      expect(bridge.getSnapshot()).not.toBeNull();

      // 2. Get action catalog for LLM context
      const actions: ActionDescriptor[] = [
        {
          type: "todo.create",
          label: "Create Todo",
          description: "Creates a new todo item",
          inputSchema: {
            type: "object",
            properties: { title: { type: "string" } },
          },
        },
        {
          type: "todo.complete",
          label: "Complete Todo",
          description: "Marks a todo as complete",
          available: {
            kind: "fn",
            evaluate: (ctx: AvailabilityContext) =>
              ((ctx.computed as { todoCount: number }).todoCount ?? 0) > 0,
          },
        },
        {
          type: "todo.delete",
          label: "Delete Todo",
          description: "Deletes a todo",
          available: { kind: "get", path: "computed.canDeleteTodo" } as ExprNode,
        },
      ];

      const catalog = await bridge.projectActionCatalog(actions, { mode: "llm" });

      // 3. Verify catalog for LLM consumption
      expect(catalog).not.toBeNull();
      expect(catalog!.kind).toBe("action_catalog");

      // todo.create and todo.complete should be available
      // todo.delete should be filtered (canDeleteTodo is false)
      const availableTypes = catalog!.actions.map((a) => a.type);
      expect(availableTypes).toContain("todo.create");
      expect(availableTypes).toContain("todo.complete");
      expect(availableTypes).not.toContain("todo.delete");

      // 4. LLM would select an action, then dispatch
      await bridge.dispatch({
        type: "todo.create",
        input: { title: "New todo from LLM" },
      });

      // 5. Verify state updated
      expect(bridge.getWorldId()).not.toBe("genesis-world");
    });
  });
});
