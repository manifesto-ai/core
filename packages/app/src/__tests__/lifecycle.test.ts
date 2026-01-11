/**
 * App Lifecycle Tests
 *
 * @see SPEC §5 App Creation and Lifecycle
 */

import { describe, it, expect, vi } from "vitest";
import { createApp } from "../index.js";
import {
  AppNotReadyError,
  AppDisposedError,
  MissingDefaultActorError,
  ReservedNamespaceError,
  ReservedEffectTypeError,
  PluginInitError,
} from "../errors/index.js";
import type { DomainSchema } from "@manifesto-ai/core";

// Mock DomainSchema for testing
const mockDomainSchema: DomainSchema = {
  id: "test:mock",
  version: "1.0.0",
  hash: "test-schema-hash",
  types: {},
  actions: {
    "todo.add": {
      flow: { kind: "seq", steps: [] },
    },
  },
  computed: { fields: {} },
  state: { fields: {} },
};

describe("App Lifecycle", () => {
  describe("createApp()", () => {
    it("should return an App instance synchronously", () => {
      const app = createApp(mockDomainSchema);
      expect(app).toBeDefined();
      expect(app.status).toBe("created");
    });

    it("should accept DomainSchema", () => {
      const app = createApp(mockDomainSchema);
      expect(app.status).toBe("created");
    });

    it("should accept options", () => {
      const app = createApp(mockDomainSchema, {
        initialData: { todos: [] },
        services: {},
      });
      expect(app.status).toBe("created");
    });
  });

  describe("ready()", () => {
    it("should transition status to ready", async () => {
      const app = createApp(mockDomainSchema);
      expect(app.status).toBe("created");

      await app.ready();
      expect(app.status).toBe("ready");
    });

    it("should be idempotent", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();
      await app.ready(); // Should not throw
      expect(app.status).toBe("ready");
    });

    it("should emit app:ready:before and app:ready hooks", async () => {
      const app = createApp(mockDomainSchema);
      const beforeHook = vi.fn();
      const readyHook = vi.fn();

      app.hooks.on("app:ready:before", beforeHook);
      app.hooks.on("app:ready", readyHook);

      await app.ready();

      expect(beforeHook).toHaveBeenCalledTimes(1);
      expect(readyHook).toHaveBeenCalledTimes(1);
    });

    it("should call hooks in order", async () => {
      const app = createApp(mockDomainSchema);
      const order: string[] = [];

      app.hooks.on("app:ready:before", () => {
        order.push("before");
      });
      app.hooks.on("app:ready", () => {
        order.push("ready");
      });

      await app.ready();

      expect(order).toEqual(["before", "ready"]);
    });
  });

  describe("dispose()", () => {
    it("should transition status to disposed", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app.dispose();
      expect(app.status).toBe("disposed");
    });

    it("should be idempotent", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app.dispose();
      await app.dispose(); // Should not throw
      expect(app.status).toBe("disposed");
    });

    it("should emit app:dispose:before and app:dispose hooks", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const beforeHook = vi.fn();
      const disposeHook = vi.fn();

      app.hooks.on("app:dispose:before", beforeHook);
      app.hooks.on("app:dispose", disposeHook);

      await app.dispose();

      expect(beforeHook).toHaveBeenCalledTimes(1);
      expect(disposeHook).toHaveBeenCalledTimes(1);
    });
  });

  describe("READY-1: API calls before ready()", () => {
    it("should throw AppNotReadyError for getState()", () => {
      const app = createApp(mockDomainSchema);
      expect(() => app.getState()).toThrow(AppNotReadyError);
    });

    it("should throw AppNotReadyError for currentBranch()", () => {
      const app = createApp(mockDomainSchema);
      expect(() => app.currentBranch()).toThrow(AppNotReadyError);
    });

    it("should throw AppNotReadyError for listBranches()", () => {
      const app = createApp(mockDomainSchema);
      expect(() => app.listBranches()).toThrow(AppNotReadyError);
    });

    it("should throw AppNotReadyError for act()", () => {
      const app = createApp(mockDomainSchema);
      expect(() => app.act("todo.add", {})).toThrow(AppNotReadyError);
    });

    it("should throw AppNotReadyError for subscribe()", () => {
      const app = createApp(mockDomainSchema);
      expect(() => app.subscribe(() => null, () => {})).toThrow(AppNotReadyError);
    });

    it("should throw AppNotReadyError for session()", () => {
      const app = createApp(mockDomainSchema);
      expect(() => app.session("user-1")).toThrow(AppNotReadyError);
    });

    it("should throw AppNotReadyError for fork()", async () => {
      const app = createApp(mockDomainSchema);
      await expect(app.fork()).rejects.toThrow(AppNotReadyError);
    });

    it("should throw AppNotReadyError for switchBranch()", async () => {
      const app = createApp(mockDomainSchema);
      await expect(app.switchBranch("main")).rejects.toThrow(AppNotReadyError);
    });

    it("should throw AppNotReadyError for getMigrationLinks()", () => {
      const app = createApp(mockDomainSchema);
      expect(() => app.getMigrationLinks()).toThrow(AppNotReadyError);
    });

    it("should throw AppNotReadyError for getActionHandle()", () => {
      const app = createApp(mockDomainSchema);
      expect(() => app.getActionHandle("proposal-123")).toThrow(AppNotReadyError);
    });
  });

  describe("DISPOSE-1: API calls after dispose()", () => {
    it("should throw AppDisposedError for getState()", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();
      await app.dispose();

      expect(() => app.getState()).toThrow(AppDisposedError);
    });

    it("should throw AppDisposedError for act()", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();
      await app.dispose();

      expect(() => app.act("todo.add", {})).toThrow(AppDisposedError);
    });

    it("should throw AppDisposedError for ready() after dispose()", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();
      await app.dispose();

      await expect(app.ready()).rejects.toThrow(AppDisposedError);
    });
  });

  describe("ACTOR-1: Actor policy validation", () => {
    it("should throw MissingDefaultActorError when mode=require and no defaultActor", async () => {
      const app = createApp(mockDomainSchema, {
        actorPolicy: {
          mode: "require",
        },
      });

      await expect(app.ready()).rejects.toThrow(MissingDefaultActorError);
    });

    it("should succeed when mode=require and defaultActor is provided", async () => {
      const app = createApp(mockDomainSchema, {
        actorPolicy: {
          mode: "require",
          defaultActor: {
            actorId: "user-1",
            kind: "human",
          },
        },
      });

      await app.ready();
      expect(app.status).toBe("ready");
    });

    it("should use anonymous actor when mode=anonymous and no defaultActor", async () => {
      const app = createApp(mockDomainSchema, {
        actorPolicy: {
          mode: "anonymous",
        },
      });

      await app.ready();
      expect(app.status).toBe("ready");
    });
  });

  describe("READY-4: Reserved namespace validation", () => {
    it("should throw ReservedNamespaceError for system.* action types", async () => {
      const schemaWithSystemAction: DomainSchema = {
        ...mockDomainSchema,
        actions: {
          "system.custom": {
            flow: { kind: "seq", steps: [] },
          },
        },
      };

      const app = createApp(schemaWithSystemAction);
      await expect(app.ready()).rejects.toThrow(ReservedNamespaceError);
    });
  });

  describe("READY-5: Reserved effect type validation", () => {
    it("should throw ReservedEffectTypeError for system.get in services", async () => {
      const app = createApp(mockDomainSchema, {
        services: {
          "system.get": () => undefined,
        },
      });

      await expect(app.ready()).rejects.toThrow(ReservedEffectTypeError);
    });

    it("should allow other effect types", async () => {
      const app = createApp(mockDomainSchema, {
        services: {
          "http.fetch": () => undefined,
        },
      });

      await app.ready();
      expect(app.status).toBe("ready");
    });
  });

  describe("Plugin initialization", () => {
    it("should call plugins in order", async () => {
      const order: number[] = [];
      const plugin1 = vi.fn(() => {
        order.push(1);
      });
      const plugin2 = vi.fn(() => {
        order.push(2);
      });

      const app = createApp(mockDomainSchema, {
        plugins: [plugin1, plugin2],
      });

      await app.ready();

      expect(plugin1).toHaveBeenCalled();
      expect(plugin2).toHaveBeenCalled();
      expect(order).toEqual([1, 2]);
    });

    it("should throw PluginInitError when plugin fails", async () => {
      const failingPlugin = () => {
        throw new Error("Plugin failed");
      };

      const app = createApp(mockDomainSchema, {
        plugins: [failingPlugin],
      });

      await expect(app.ready()).rejects.toThrow(PluginInitError);
    });

    it("should include plugin index in error", async () => {
      const failingPlugin = () => {
        throw new Error("Plugin failed");
      };

      const app = createApp(mockDomainSchema, {
        plugins: [() => {}, failingPlugin, () => {}],
      });

      try {
        await app.ready();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PluginInitError);
        expect((error as PluginInitError).pluginIndex).toBe(1);
      }
    });

    it("should support async plugins", async () => {
      const asyncPlugin = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const app = createApp(mockDomainSchema, {
        plugins: [asyncPlugin],
      });

      await app.ready();
      expect(asyncPlugin).toHaveBeenCalled();
    });
  });

  describe("Hooks", () => {
    it("should support once() for single-fire hooks", async () => {
      const app = createApp(mockDomainSchema);
      const handler = vi.fn();

      app.hooks.once("app:ready", handler);
      await app.ready();
      await app.dispose();
      await app.dispose(); // Won't trigger app:ready again

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should return unsubscribe function from on()", async () => {
      const app = createApp(mockDomainSchema);
      const handler = vi.fn();

      const unsub = app.hooks.on("app:dispose", handler);
      unsub();

      await app.ready();
      await app.dispose();

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
