/**
 * System Runtime Tests
 *
 * @see SPEC §16 System Runtime Model
 */

import { describe, it, expect, vi } from "vitest";
import { createApp } from "../index.js";
import { SystemRuntime, createSystemFacade } from "../system/index.js";
import { SYSTEM_ACTION_TYPES } from "../constants.js";
import type { DomainSchema } from "@manifesto-ai/core";

// Mock DomainSchema
const mockDomainSchema: DomainSchema = {
  schemaHash: "test-schema-hash",
  actions: {
    "todo.add": {
      type: "todo.add",
      inputSchema: {},
      outputSchema: {},
      flow: { kind: "noop" },
    },
  },
  computed: {},
  state: {},
  effects: {},
  flows: {},
};

describe("System Runtime", () => {
  describe("SYSRT-1: Separate Runtime", () => {
    it("should create System Runtime with its own world lineage", () => {
      const runtime = new SystemRuntime();

      expect(runtime.head()).toBeDefined();
      expect(runtime.lineage()).toHaveLength(1);
    });

    it("should have separate schema from domain", () => {
      const runtime = new SystemRuntime();

      expect(runtime.schema.schemaHash).toBe("system-runtime-v0.4.9");
      expect(runtime.schema.schemaHash).not.toBe(mockDomainSchema.schemaHash);
    });
  });

  describe("SYSRT-2: System Schema", () => {
    it("should include all system action types", () => {
      const runtime = new SystemRuntime();

      for (const actionType of SYSTEM_ACTION_TYPES) {
        expect(runtime.schema.actions[actionType]).toBeDefined();
      }
    });
  });

  describe("SYSRT-3: Initial State", () => {
    it("should initialize with empty state", () => {
      const runtime = new SystemRuntime();
      const state = runtime.getState();

      expect(state.actors).toEqual({});
      expect(state.services).toEqual({});
      expect(state.workflows).toEqual({});
      expect(state.branchPointers).toEqual({});
      expect(state.auditLog).toEqual([]);
    });

    it("should apply initial actors config", () => {
      const runtime = new SystemRuntime({
        initialActors: [
          { actorId: "admin", kind: "human", name: "Admin User" },
        ],
      });

      const state = runtime.getState();
      expect(state.actors["admin"]).toBeDefined();
      expect(state.actors["admin"].kind).toBe("human");
      expect(state.actors["admin"].name).toBe("Admin User");
      expect(state.actors["admin"].enabled).toBe(true);
    });
  });

  describe("SYSRT-4: World Lineage", () => {
    it("should create new world on each action execution", async () => {
      const runtime = new SystemRuntime();
      const initialHead = runtime.head();

      await runtime.execute(
        "system.actor.register",
        { actorId: "user1", kind: "human" },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      expect(runtime.head()).not.toBe(initialHead);
      expect(runtime.lineage()).toHaveLength(2);
    });
  });

  describe("SYSRT-5: Lineage Query", () => {
    it("should support limit option", async () => {
      const runtime = new SystemRuntime();

      // Execute multiple actions
      for (let i = 0; i < 5; i++) {
        await runtime.execute(
          "system.actor.register",
          { actorId: `user${i}`, kind: "human" },
          { actorId: "admin", proposalId: `prop_${i}`, timestamp: Date.now() }
        );
      }

      const limited = runtime.lineage({ limit: 3 });
      expect(limited).toHaveLength(3);
    });
  });

  describe("SYSRT-6: System Action Detection", () => {
    it("should correctly identify system actions", () => {
      const runtime = new SystemRuntime();

      for (const actionType of SYSTEM_ACTION_TYPES) {
        expect(runtime.isSystemAction(actionType)).toBe(true);
      }

      expect(runtime.isSystemAction("todo.add")).toBe(false);
      expect(runtime.isSystemAction("custom.action")).toBe(false);
    });
  });

  describe("Actor Management Actions", () => {
    it("system.actor.register should add actor", async () => {
      const runtime = new SystemRuntime();

      const result = await runtime.execute(
        "system.actor.register",
        { actorId: "new-user", kind: "agent", name: "Bot" },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      expect(result.status).toBe("completed");
      expect(runtime.getState().actors["new-user"]).toBeDefined();
      expect(runtime.getState().actors["new-user"].kind).toBe("agent");
    });

    it("system.actor.disable should disable actor", async () => {
      const runtime = new SystemRuntime({
        initialActors: [{ actorId: "user1", kind: "human" }],
      });

      await runtime.execute(
        "system.actor.disable",
        { actorId: "user1" },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      expect(runtime.getState().actors["user1"].enabled).toBe(false);
    });

    it("system.actor.updateMeta should update actor metadata", async () => {
      const runtime = new SystemRuntime({
        initialActors: [{ actorId: "user1", kind: "human" }],
      });

      await runtime.execute(
        "system.actor.updateMeta",
        { actorId: "user1", meta: { role: "admin", level: 5 } },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      expect(runtime.getState().actors["user1"].meta).toEqual({
        role: "admin",
        level: 5,
      });
    });

    it("system.actor.bindAuthority should bind authorities", async () => {
      const runtime = new SystemRuntime({
        initialActors: [{ actorId: "user1", kind: "human" }],
      });

      await runtime.execute(
        "system.actor.bindAuthority",
        { actorId: "user1", authorityIds: ["auth1", "auth2"] },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      expect(runtime.getState().actors["user1"].authorityBindings).toEqual([
        "auth1",
        "auth2",
      ]);
    });
  });

  describe("Branch Management Actions", () => {
    it("system.branch.create should create branch pointer", async () => {
      const runtime = new SystemRuntime();

      await runtime.execute(
        "system.branch.create",
        { branchId: "feature-branch" },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      expect(runtime.getState().branchPointers["feature-branch"]).toBeDefined();
    });
  });

  describe("Service Management Actions", () => {
    it("system.service.register should register service", async () => {
      const runtime = new SystemRuntime();

      await runtime.execute(
        "system.service.register",
        { effectType: "http.fetch", handlerRef: "http-handler" },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      expect(runtime.getState().services["http.fetch"]).toBeDefined();
      expect(runtime.getState().services["http.fetch"].handlerRef).toBe(
        "http-handler"
      );
    });

    it("system.service.unregister should remove service", async () => {
      const runtime = new SystemRuntime();

      await runtime.execute(
        "system.service.register",
        { effectType: "http.fetch", handlerRef: "http-handler" },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      await runtime.execute(
        "system.service.unregister",
        { effectType: "http.fetch" },
        { actorId: "admin", proposalId: "prop_2", timestamp: Date.now() }
      );

      expect(runtime.getState().services["http.fetch"]).toBeUndefined();
    });
  });

  describe("Workflow Actions", () => {
    it("system.workflow.enable should enable workflow", async () => {
      const runtime = new SystemRuntime();

      await runtime.execute(
        "system.workflow.enable",
        { workflowId: "approval-flow" },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      expect(runtime.getState().workflows["approval-flow"]).toBeDefined();
      expect(runtime.getState().workflows["approval-flow"].enabled).toBe(true);
    });

    it("system.workflow.setPolicy should set workflow policy", async () => {
      const runtime = new SystemRuntime();

      await runtime.execute(
        "system.workflow.enable",
        { workflowId: "approval-flow" },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      await runtime.execute(
        "system.workflow.setPolicy",
        { workflowId: "approval-flow", policy: { maxRetries: 3 } },
        { actorId: "admin", proposalId: "prop_2", timestamp: Date.now() }
      );

      expect(runtime.getState().workflows["approval-flow"].policy).toEqual({
        maxRetries: 3,
      });
    });
  });

  describe("Audit Log", () => {
    it("should record audit entries for each action", async () => {
      const runtime = new SystemRuntime();

      await runtime.execute(
        "system.actor.register",
        { actorId: "user1", kind: "human" },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      const auditLog = runtime.getState().auditLog;
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].actionType).toBe("system.actor.register");
      expect(auditLog[0].actorId).toBe("admin");
      expect(auditLog[0].proposalId).toBe("prop_1");
    });
  });

  describe("Subscription", () => {
    it("should notify subscribers on state change", async () => {
      const runtime = new SystemRuntime();
      const listener = vi.fn();

      runtime.subscribe(listener);

      await runtime.execute(
        "system.actor.register",
        { actorId: "user1", kind: "human" },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          actors: expect.objectContaining({
            user1: expect.anything(),
          }),
        })
      );
    });

    it("should allow unsubscribe", async () => {
      const runtime = new SystemRuntime();
      const listener = vi.fn();

      const unsubscribe = runtime.subscribe(listener);
      unsubscribe();

      await runtime.execute(
        "system.actor.register",
        { actorId: "user1", kind: "human" },
        { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
      );

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe("System Facade", () => {
  it("should provide read-only access to System Runtime", () => {
    const runtime = new SystemRuntime({
      initialActors: [{ actorId: "user1", kind: "human" }],
    });

    const facade = createSystemFacade(runtime);

    expect(facade.getState()).toBe(runtime.getState());
    expect(facade.head()).toBe(runtime.head());
    expect(facade.lineage()).toEqual(runtime.lineage());
  });

  it("should support subscription via facade", async () => {
    const runtime = new SystemRuntime();
    const facade = createSystemFacade(runtime);
    const listener = vi.fn();

    facade.subscribe(listener);

    // Direct execution on runtime should trigger listener
    await runtime.execute(
      "system.actor.register",
      { actorId: "user1", kind: "human" },
      { actorId: "admin", proposalId: "prop_1", timestamp: Date.now() }
    );

    expect(listener).toHaveBeenCalled();
  });
});

describe("App Integration with System Runtime", () => {
  it("app.system should return SystemFacade", async () => {
    const app = createApp(mockDomainSchema);
    await app.ready();

    expect(app.system).toBeDefined();
    expect(app.system.getState).toBeDefined();
    expect(app.system.head).toBeDefined();
    expect(app.system.lineage).toBeDefined();
    expect(app.system.subscribe).toBeDefined();
  });

  it("app.system.getState() should return initial state", async () => {
    const app = createApp(mockDomainSchema);
    await app.ready();

    const state = app.system.getState();
    expect(state.actors).toBeDefined();
    expect(state.services).toBeDefined();
    expect(state.workflows).toBeDefined();
  });

  it("app.system.head() should return current world ID", async () => {
    const app = createApp(mockDomainSchema);
    await app.ready();

    const head = app.system.head();
    expect(head).toBeDefined();
    expect(head.startsWith("sysworld_")).toBe(true);
  });

  it("app.system.lineage() should return world history", async () => {
    const app = createApp(mockDomainSchema);
    await app.ready();

    const lineage = app.system.lineage();
    expect(lineage).toHaveLength(1);
  });

  it("app.act() should route system.* actions to System Runtime", async () => {
    const app = createApp(mockDomainSchema);
    await app.ready();

    const handle = app.act("system.actor.register", {
      actorId: "new-user",
      kind: "human",
    });

    expect(handle.runtime).toBe("system");

    const result = await handle.done();
    expect(result.status).toBe("completed");
    expect(result.runtime).toBe("system");

    // Verify actor was registered
    const state = app.system.getState();
    expect(state.actors["new-user"]).toBeDefined();
  });

  it("app.act() should route domain actions to Domain Runtime", async () => {
    const app = createApp(mockDomainSchema);
    await app.ready();

    const handle = app.act("todo.add", { title: "Test" });

    expect(handle.runtime).toBe("domain");

    const result = await handle.done();
    expect(result.runtime).toBe("domain");
  });

  it("System Runtime should be initialized with default actor", async () => {
    const app = createApp(mockDomainSchema, {
      actorPolicy: {
        defaultActor: {
          actorId: "admin",
          kind: "human",
          name: "Admin User",
        },
      },
    });
    await app.ready();

    const state = app.system.getState();
    expect(state.actors["admin"]).toBeDefined();
    expect(state.actors["admin"].name).toBe("Admin User");
  });

  it("should update System lineage after system action", async () => {
    const app = createApp(mockDomainSchema);
    await app.ready();

    const initialLineage = app.system.lineage();
    expect(initialLineage).toHaveLength(1);

    await app.act("system.actor.register", {
      actorId: "user1",
      kind: "human",
    }).done();

    const newLineage = app.system.lineage();
    expect(newLineage).toHaveLength(2);
  });

  it("system.subscribe should notify on system action completion", async () => {
    const app = createApp(mockDomainSchema);
    await app.ready();

    const listener = vi.fn();
    app.system.subscribe(listener);

    await app.act("system.actor.register", {
      actorId: "user1",
      kind: "human",
    }).done();

    expect(listener).toHaveBeenCalled();
  });
});
