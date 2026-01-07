/**
 * System Action Catalog Tests
 *
 * @see SPEC §17 System Action Catalog
 */

import { describe, it, expect, vi } from "vitest";
import { createApp } from "../index.js";
import {
  SystemActionRoutingError,
  SystemActionDisabledError,
} from "../errors/index.js";
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

describe("System Action Invocation Rules", () => {
  describe("SYS-INV-1: System Actions via app.act()", () => {
    it("should allow system.* actions via app.act()", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const handle = app.act("system.actor.register", {
        actorId: "user1",
        kind: "human",
      });

      expect(handle.runtime).toBe("system");

      const result = await handle.done();
      expect(result.status).toBe("completed");
    });

    it("should route system.* to System Runtime", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      for (const actionType of SYSTEM_ACTION_TYPES.slice(0, 3)) {
        const handle = app.act(actionType, { actorId: "test", kind: "human" });
        expect(handle.runtime).toBe("system");
      }
    });
  });

  describe("SYS-INV-2: branch.act() must reject system.* actions", () => {
    it("should throw SystemActionRoutingError for system.* via branch.act()", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();

      expect(() => {
        branch.act("system.actor.register", { actorId: "user1", kind: "human" });
      }).toThrow(SystemActionRoutingError);
    });

    it("should include 'branch' as source in error", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();

      try {
        branch.act("system.actor.register", { actorId: "user1", kind: "human" });
        expect.fail("Expected SystemActionRoutingError");
      } catch (error) {
        expect(error).toBeInstanceOf(SystemActionRoutingError);
        expect((error as SystemActionRoutingError).source).toBe("branch");
        expect((error as SystemActionRoutingError).actionType).toBe(
          "system.actor.register"
        );
      }
    });

    it("should allow domain actions via branch.act()", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();
      const handle = branch.act("todo.add", { title: "Test" });

      expect(handle.runtime).toBe("domain");
    });
  });

  describe("SYS-INV-3: session.act() must reject system.* actions", () => {
    it("should throw SystemActionRoutingError for system.* via session.act()", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session = app.session("user-123");

      expect(() => {
        session.act("system.actor.register", { actorId: "user1", kind: "human" });
      }).toThrow(SystemActionRoutingError);
    });

    it("should include 'session' as source in error", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session = app.session("user-123");

      try {
        session.act("system.workflow.enable", { workflowId: "flow1" });
        expect.fail("Expected SystemActionRoutingError");
      } catch (error) {
        expect(error).toBeInstanceOf(SystemActionRoutingError);
        expect((error as SystemActionRoutingError).source).toBe("session");
      }
    });

    it("should allow domain actions via session.act()", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session = app.session("user-123");
      const handle = session.act("todo.add", { title: "Test" });

      expect(handle.runtime).toBe("domain");
    });
  });
});

describe("System Action Disabled Rules", () => {
  describe("SYS-5: Global disable", () => {
    it("should reject all system.* when systemActions.enabled = false", async () => {
      const app = createApp(mockDomainSchema, {
        systemActions: {
          enabled: false,
        },
      });
      await app.ready();

      const handle = app.act("system.actor.register", {
        actorId: "user1",
        kind: "human",
      });

      const result = await handle.result();
      expect(result.status).toBe("preparation_failed");
      if (result.status === "preparation_failed") {
        expect(result.error.code).toBe("SYSTEM_ACTION_DISABLED");
      }
    });
  });

  describe("SYS-5a: Specific action disable", () => {
    it("should reject specific disabled actions", async () => {
      const app = createApp(mockDomainSchema, {
        systemActions: {
          disabled: ["system.actor.register", "system.service.unregister"],
        },
      });
      await app.ready();

      // Disabled action
      const handle1 = app.act("system.actor.register", {
        actorId: "user1",
        kind: "human",
      });
      const result1 = await handle1.result();
      expect(result1.status).toBe("preparation_failed");

      // Non-disabled action should work
      const handle2 = app.act("system.workflow.enable", {
        workflowId: "flow1",
      });
      const result2 = await handle2.result();
      expect(result2.status).toBe("completed");
    });

    it("should include action type in error message", async () => {
      const app = createApp(mockDomainSchema, {
        systemActions: {
          disabled: ["system.actor.disable"],
        },
      });
      await app.ready();

      const handle = app.act("system.actor.disable", { actorId: "user1" });
      const result = await handle.result();

      expect(result.status).toBe("preparation_failed");
      if (result.status === "preparation_failed") {
        expect(result.error.message).toContain("system.actor.disable");
      }
    });
  });
});

describe("System Action Audit Logging", () => {
  describe("API-AUD-1: Audit log entries", () => {
    it("should record audit entry for each system action", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.actor.register", { actorId: "user1", kind: "human" })
        .done();

      const state = app.system.getState();
      expect(state.auditLog).toHaveLength(1);
      expect(state.auditLog[0].actionType).toBe("system.actor.register");
    });

    it("should include actor, timestamp, and summary in audit entry", async () => {
      const app = createApp(mockDomainSchema, {
        actorPolicy: {
          defaultActor: { actorId: "admin", kind: "human" },
        },
      });
      await app.ready();

      const beforeTime = Date.now();
      await app
        .act("system.actor.register", { actorId: "user1", kind: "agent" })
        .done();
      const afterTime = Date.now();

      const state = app.system.getState();
      const entry = state.auditLog[0];

      expect(entry.actorId).toBe("admin");
      expect(entry.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(entry.timestamp).toBeLessThanOrEqual(afterTime);
      expect(entry.summary).toContain("user1");
    });
  });

  describe("API-AUD-2: Audit trail persistence", () => {
    it("should accumulate audit entries across multiple actions", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.actor.register", { actorId: "user1", kind: "human" })
        .done();
      await app
        .act("system.actor.register", { actorId: "user2", kind: "agent" })
        .done();
      await app
        .act("system.workflow.enable", { workflowId: "flow1" })
        .done();

      const state = app.system.getState();
      expect(state.auditLog).toHaveLength(3);
    });
  });
});

describe("System Action Catalog", () => {
  describe("Actor Management", () => {
    it("system.actor.register should register new actor", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.actor.register", {
          actorId: "new-user",
          kind: "human",
          name: "New User",
          meta: { role: "viewer" },
        })
        .done();

      const state = app.system.getState();
      expect(state.actors["new-user"]).toBeDefined();
      expect(state.actors["new-user"].kind).toBe("human");
      expect(state.actors["new-user"].name).toBe("New User");
      expect(state.actors["new-user"].meta).toEqual({ role: "viewer" });
    });

    it("system.actor.disable should disable actor", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.actor.register", { actorId: "user1", kind: "human" })
        .done();
      await app.act("system.actor.disable", { actorId: "user1" }).done();

      const state = app.system.getState();
      expect(state.actors["user1"].enabled).toBe(false);
    });

    it("system.actor.updateMeta should update metadata", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.actor.register", { actorId: "user1", kind: "human" })
        .done();
      await app
        .act("system.actor.updateMeta", {
          actorId: "user1",
          meta: { level: 10, badge: "gold" },
        })
        .done();

      const state = app.system.getState();
      expect(state.actors["user1"].meta).toEqual({ level: 10, badge: "gold" });
    });

    it("system.actor.bindAuthority should bind authorities", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.actor.register", { actorId: "user1", kind: "human" })
        .done();
      await app
        .act("system.actor.bindAuthority", {
          actorId: "user1",
          authorityIds: ["admin-authority", "moderator-authority"],
        })
        .done();

      const state = app.system.getState();
      expect(state.actors["user1"].authorityBindings).toEqual([
        "admin-authority",
        "moderator-authority",
      ]);
    });
  });

  describe("Branch Management", () => {
    it("system.branch.create should create branch pointer", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.branch.create", {
          branchId: "feature-branch",
          name: "Feature Branch",
        })
        .done();

      const state = app.system.getState();
      expect(state.branchPointers["feature-branch"]).toBeDefined();
      expect(state.branchPointers["feature-branch"].branchId).toBe(
        "feature-branch"
      );
    });
  });

  describe("Service Management", () => {
    it("system.service.register should register service", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.service.register", {
          effectType: "http.fetch",
          handlerRef: "http-fetch-handler",
        })
        .done();

      const state = app.system.getState();
      expect(state.services["http.fetch"]).toBeDefined();
      expect(state.services["http.fetch"].handlerRef).toBe("http-fetch-handler");
    });

    it("system.service.unregister should remove service", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.service.register", {
          effectType: "http.fetch",
          handlerRef: "handler1",
        })
        .done();
      await app
        .act("system.service.unregister", { effectType: "http.fetch" })
        .done();

      const state = app.system.getState();
      expect(state.services["http.fetch"]).toBeUndefined();
    });

    it("system.service.replace should replace existing service", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.service.register", {
          effectType: "http.fetch",
          handlerRef: "handler1",
        })
        .done();
      await app
        .act("system.service.replace", {
          effectType: "http.fetch",
          handlerRef: "handler2",
        })
        .done();

      const state = app.system.getState();
      expect(state.services["http.fetch"].handlerRef).toBe("handler2");
    });
  });

  describe("Memory Management", () => {
    it("system.memory.configure should update memory config", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.memory.configure", {
          providers: ["provider1", "provider2"],
          defaultProvider: "provider1",
        })
        .done();

      const state = app.system.getState();
      expect(state.memoryConfig.providers).toEqual(["provider1", "provider2"]);
      expect(state.memoryConfig.defaultProvider).toBe("provider1");
    });
  });

  describe("Workflow Management", () => {
    it("system.workflow.enable should enable workflow", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.workflow.enable", { workflowId: "approval-flow" })
        .done();

      const state = app.system.getState();
      expect(state.workflows["approval-flow"]).toBeDefined();
      expect(state.workflows["approval-flow"].enabled).toBe(true);
    });

    it("system.workflow.disable should disable workflow", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.workflow.enable", { workflowId: "approval-flow" })
        .done();
      await app
        .act("system.workflow.disable", { workflowId: "approval-flow" })
        .done();

      const state = app.system.getState();
      expect(state.workflows["approval-flow"].enabled).toBe(false);
    });

    it("system.workflow.setPolicy should set workflow policy", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app
        .act("system.workflow.setPolicy", {
          workflowId: "approval-flow",
          policy: { maxRetries: 3, timeout: 5000 },
        })
        .done();

      const state = app.system.getState();
      expect(state.workflows["approval-flow"].policy).toEqual({
        maxRetries: 3,
        timeout: 5000,
      });
    });
  });
});

describe("System Action Error Handling", () => {
  it("should handle non-existent actor gracefully", async () => {
    const app = createApp(mockDomainSchema);
    await app.ready();

    const handle = app.act("system.actor.disable", { actorId: "non-existent" });
    const result = await handle.result();

    expect(result.status).toBe("failed");
  });

  it("should handle non-existent workflow gracefully", async () => {
    const app = createApp(mockDomainSchema);
    await app.ready();

    const handle = app.act("system.workflow.disable", {
      workflowId: "non-existent",
    });
    const result = await handle.result();

    expect(result.status).toBe("failed");
  });
});

/**
 * Memory Maintenance Tests
 *
 * @see SPEC §17.5 MEM-MAINT-1~10
 * @since v0.4.8
 */
describe("Memory Maintenance (v0.4.8+)", () => {
  describe("system.memory.maintain action existence", () => {
    it("should be in SYSTEM_ACTION_TYPES", () => {
      expect(SYSTEM_ACTION_TYPES).toContain("system.memory.maintain");
    });
  });

  describe("MEM-MAINT-10: Actor context from Proposal", () => {
    it("should fail when memory is disabled", async () => {
      // Create app with memory disabled (default)
      const app = createApp(mockDomainSchema);
      await app.ready();

      const handle = app.act("system.memory.maintain", {
        ops: [
          {
            kind: "forget",
            ref: { worldId: "world-123" },
          },
        ],
      });

      const result = await handle.result();
      expect(result.status).toBe("failed");
    });

    it("should include maintain in audit log", async () => {
      // Create mock memory provider with maintain capability
      const mockProvider = {
        select: vi.fn().mockResolvedValue({ selected: [], selectedAt: Date.now() }),
        maintain: vi.fn().mockResolvedValue({
          success: true,
          op: { kind: "forget", ref: { worldId: "world-123" } },
          tombstoneId: "tomb-123",
        }),
        meta: {
          capabilities: ["select", "maintain"],
        },
      };

      const app = createApp(mockDomainSchema, {
        memory: {
          providers: { default: mockProvider },
          defaultProvider: "default",
        },
      });
      await app.ready();

      const handle = app.act("system.memory.maintain", {
        ops: [
          {
            kind: "forget",
            ref: { worldId: "world-123" },
            scope: "actor",
            reason: "Test forget",
          },
        ],
      });

      const result = await handle.result();
      expect(result.status).toBe("completed");

      // Check audit log
      const state = app.system.getState();
      const maintainEntry = state.auditLog.find(
        (e) => e.actionType === "system.memory.maintain"
      );
      expect(maintainEntry).toBeDefined();
    });

    it("should pass actor from Proposal context, not from input", async () => {
      // Create mock memory provider with maintain capability
      let capturedContext: unknown = null;
      const mockProvider = {
        select: vi.fn().mockResolvedValue({ selected: [], selectedAt: Date.now() }),
        maintain: vi.fn().mockImplementation((_op, ctx) => {
          capturedContext = ctx;
          return Promise.resolve({
            success: true,
            op: { kind: "forget", ref: { worldId: "world-123" } },
            tombstoneId: "tomb-456",
          });
        }),
        meta: {
          capabilities: ["select", "maintain"],
        },
      };

      const app = createApp(mockDomainSchema, {
        actorPolicy: {
          defaultActor: { actorId: "authenticated-user", kind: "human" },
        },
        memory: {
          providers: { default: mockProvider },
          defaultProvider: "default",
        },
      });
      await app.ready();

      // Execute maintain action
      const handle = app.act("system.memory.maintain", {
        ops: [
          {
            kind: "forget",
            ref: { worldId: "world-123" },
          },
        ],
      });

      await handle.done();

      // Verify the actor in context came from authenticated default actor
      expect(capturedContext).toBeDefined();
      expect((capturedContext as { actor: { actorId: string } }).actor.actorId).toBe(
        "authenticated-user"
      );
    });
  });

  describe("MEM-MAINT-5: Forget is idempotent", () => {
    it("should succeed even without maintain-capable providers", async () => {
      // Create mock provider WITHOUT maintain capability
      const mockProvider = {
        select: vi.fn().mockResolvedValue({ selected: [], selectedAt: Date.now() }),
        // No maintain method
        meta: {
          capabilities: ["select"],
        },
      };

      const app = createApp(mockDomainSchema, {
        memory: {
          providers: { default: mockProvider },
          defaultProvider: "default",
        },
      });
      await app.ready();

      const handle = app.act("system.memory.maintain", {
        ops: [
          {
            kind: "forget",
            ref: { worldId: "world-123" },
          },
        ],
      });

      const result = await handle.result();
      // Should complete (idempotent - no-op is valid)
      expect(result.status).toBe("completed");
    });
  });

  describe("MEM-MAINT-8/9: Scope handling", () => {
    it("should default scope to 'actor'", async () => {
      let capturedContext: unknown = null;
      const mockProvider = {
        select: vi.fn().mockResolvedValue({ selected: [], selectedAt: Date.now() }),
        maintain: vi.fn().mockImplementation((_op, ctx) => {
          capturedContext = ctx;
          return Promise.resolve({
            success: true,
            op: { kind: "forget", ref: { worldId: "world-123" } },
          });
        }),
        meta: {
          capabilities: ["select", "maintain"],
        },
      };

      const app = createApp(mockDomainSchema, {
        memory: {
          providers: { default: mockProvider },
          defaultProvider: "default",
        },
      });
      await app.ready();

      // Execute without explicit scope
      const handle = app.act("system.memory.maintain", {
        ops: [
          {
            kind: "forget",
            ref: { worldId: "world-123" },
            // No scope specified
          },
        ],
      });

      await handle.done();

      expect((capturedContext as { scope: string }).scope).toBe("actor");
    });

    it("should respect explicit 'global' scope", async () => {
      let capturedContext: unknown = null;
      const mockProvider = {
        select: vi.fn().mockResolvedValue({ selected: [], selectedAt: Date.now() }),
        maintain: vi.fn().mockImplementation((_op, ctx) => {
          capturedContext = ctx;
          return Promise.resolve({
            success: true,
            op: { kind: "forget", ref: { worldId: "world-123" }, scope: "global" },
          });
        }),
        meta: {
          capabilities: ["select", "maintain"],
        },
      };

      const app = createApp(mockDomainSchema, {
        memory: {
          providers: { default: mockProvider },
          defaultProvider: "default",
        },
      });
      await app.ready();

      // Execute with explicit global scope
      const handle = app.act("system.memory.maintain", {
        ops: [
          {
            kind: "forget",
            ref: { worldId: "world-123" },
            scope: "global",
          },
        ],
      });

      await handle.done();

      expect((capturedContext as { scope: string }).scope).toBe("global");
    });
  });
});
