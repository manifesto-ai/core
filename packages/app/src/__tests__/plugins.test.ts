/**
 * Plugin System Tests
 *
 * @see SPEC §15 Plugin System
 */

import { describe, it, expect, vi } from "vitest";
import { createApp, createTestApp, PluginInitError } from "../index.js";
import type { App, AppPlugin } from "../index.js";
import type { DomainSchema } from "@manifesto-ai/core";

// Mock DomainSchema
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

describe("Plugin System", () => {
  describe("PLUG-1: Plugin execution during ready()", () => {
    it("should call plugins during ready() in order", async () => {
      const callOrder: number[] = [];

      const plugin1: AppPlugin = () => {
        callOrder.push(1);
      };

      const plugin2: AppPlugin = () => {
        callOrder.push(2);
      };

      const plugin3: AppPlugin = () => {
        callOrder.push(3);
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [plugin1, plugin2, plugin3],
      });

      await app.ready();

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it("should pass app instance to plugins", async () => {
      let receivedApp: App | null = null;

      const plugin: AppPlugin = (app) => {
        receivedApp = app;
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [plugin],
      });

      await app.ready();

      expect(receivedApp).toBe(app);
    });
  });

  describe("PLUG-2: Async plugin support", () => {
    it("should support async plugins", async () => {
      const callOrder: number[] = [];

      const syncPlugin: AppPlugin = () => {
        callOrder.push(1);
      };

      const asyncPlugin: AppPlugin = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push(2);
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [syncPlugin, asyncPlugin],
      });

      await app.ready();

      expect(callOrder).toEqual([1, 2]);
    });

    it("should wait for async plugins before completing ready()", async () => {
      let pluginCompleted = false;

      const asyncPlugin: AppPlugin = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        pluginCompleted = true;
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [asyncPlugin],
      });

      await app.ready();

      expect(pluginCompleted).toBe(true);
    });
  });

  describe("PLUG-3: Plugin error handling", () => {
    it("should throw PluginInitError on sync plugin failure", async () => {
      const failingPlugin: AppPlugin = () => {
        throw new Error("Plugin initialization failed");
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [failingPlugin],
      });

      await expect(app.ready()).rejects.toThrow(PluginInitError);
    });

    it("should throw PluginInitError on async plugin failure", async () => {
      const asyncFailingPlugin: AppPlugin = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error("Async plugin initialization failed");
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [asyncFailingPlugin],
      });

      await expect(app.ready()).rejects.toThrow(PluginInitError);
    });

    it("should include plugin index in PluginInitError", async () => {
      const successPlugin: AppPlugin = () => {};
      const failingPlugin: AppPlugin = () => {
        throw new Error("Second plugin failed");
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [successPlugin, failingPlugin],
      });

      try {
        await app.ready();
        expect.fail("Expected PluginInitError");
      } catch (error) {
        expect(error).toBeInstanceOf(PluginInitError);
        expect((error as PluginInitError).pluginIndex).toBe(1);
        expect((error as PluginInitError).message).toContain("index 1");
      }
    });

    it("should include original error message in PluginInitError", async () => {
      const failingPlugin: AppPlugin = () => {
        throw new Error("Custom error message");
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [failingPlugin],
      });

      try {
        await app.ready();
        expect.fail("Expected PluginInitError");
      } catch (error) {
        expect(error).toBeInstanceOf(PluginInitError);
        expect((error as PluginInitError).message).toContain(
          "Custom error message"
        );
      }
    });

    it("should preserve error cause", async () => {
      const originalError = new Error("Original cause");
      const failingPlugin: AppPlugin = () => {
        throw originalError;
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [failingPlugin],
      });

      try {
        await app.ready();
        expect.fail("Expected PluginInitError");
      } catch (error) {
        expect(error).toBeInstanceOf(PluginInitError);
        expect((error as PluginInitError).cause).toBe(originalError);
      }
    });
  });

  describe("PLUG-4: Plugin execution order", () => {
    it("should stop on first plugin failure", async () => {
      const callOrder: number[] = [];

      const plugin1: AppPlugin = () => {
        callOrder.push(1);
      };

      const failingPlugin: AppPlugin = () => {
        callOrder.push(2);
        throw new Error("Failed");
      };

      const plugin3: AppPlugin = () => {
        callOrder.push(3);
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [plugin1, failingPlugin, plugin3],
      });

      await expect(app.ready()).rejects.toThrow(PluginInitError);

      // Plugin 3 should NOT be called
      expect(callOrder).toEqual([1, 2]);
    });
  });

  describe("PLUG-5: No plugins scenario", () => {
    it("should work without plugins", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      expect(app.status).toBe("ready");
    });

    it("should work with empty plugins array", async () => {
      const app = createTestApp(mockDomainSchema, {
        plugins: [],
      });
      await app.ready();

      expect(app.status).toBe("ready");
    });
  });

  describe("PLUG-6: Plugin hooks integration", () => {
    it("should allow plugins to register hook listeners", async () => {
      const hookCalls: string[] = [];

      const hookPlugin: AppPlugin = (app) => {
        app.hooks.on("app:ready", () => {
          hookCalls.push("app:ready from plugin");
        });
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [hookPlugin],
      });

      await app.ready();

      expect(hookCalls).toContain("app:ready from plugin");
    });

    it("should allow plugins to use once() for one-time listeners", async () => {
      let callCount = 0;

      const plugin: AppPlugin = (app) => {
        app.hooks.once("app:ready", () => {
          callCount++;
        });
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [plugin],
      });

      await app.ready();

      // Calling ready() again should not trigger once() listener
      await app.ready();

      expect(callCount).toBe(1);
    });
  });

  describe("PLUG-7: Plugin state access", () => {
    it("should NOT allow state access in plugins during ready()", async () => {
      let errorThrown = false;

      const stateAccessPlugin: AppPlugin = (app) => {
        try {
          // This should throw because app is not ready yet
          app.getState();
        } catch {
          errorThrown = true;
        }
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [stateAccessPlugin],
      });

      await app.ready();

      // Plugin tried to access state before ready, should have thrown
      expect(errorThrown).toBe(true);
    });

    it("should allow state access after ready() via hooks", async () => {
      let stateAccessed = false;

      const plugin: AppPlugin = (app) => {
        app.hooks.on("app:ready", () => {
          // State access IS allowed in app:ready hook (after ready completes)
          const state = app.getState();
          stateAccessed = state !== undefined;
        });
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [plugin],
      });

      await app.ready();

      expect(stateAccessed).toBe(true);
    });
  });

  describe("Plugin practical use cases", () => {
    it("should support logging plugin pattern", async () => {
      const logs: string[] = [];

      const loggingPlugin: AppPlugin = (app) => {
        app.hooks.on("app:ready", () => {
          logs.push("[LOG] App ready");
        });

        app.hooks.on("app:dispose:before", () => {
          logs.push("[LOG] App disposing");
        });

        app.hooks.on("app:dispose", () => {
          logs.push("[LOG] App disposed");
        });
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [loggingPlugin],
      });

      await app.ready();
      await app.dispose();

      expect(logs).toEqual([
        "[LOG] App ready",
        "[LOG] App disposing",
        "[LOG] App disposed",
      ]);
    });

    it("should support metrics plugin pattern", async () => {
      const metrics = {
        actionsStarted: 0,
        actionsCompleted: 0,
      };

      const metricsPlugin: AppPlugin = (app) => {
        app.hooks.on("action:preparing", () => {
          metrics.actionsStarted++;
        });

        app.hooks.on("action:completed", () => {
          metrics.actionsCompleted++;
        });
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [metricsPlugin],
      });

      await app.ready();

      // Execute an action
      const handle = app.act("todo.add", { title: "Test" });
      await handle.done();

      expect(metrics.actionsStarted).toBe(1);
      expect(metrics.actionsCompleted).toBe(1);
    });

    it("should support configuration plugin pattern", async () => {
      interface PluginConfig {
        prefix: string;
      }

      function createConfigPlugin(config: PluginConfig): AppPlugin {
        return (app) => {
          // Store config for later use (via closure)
          app.hooks.on("app:ready", () => {
            // Plugin can use config here
            expect(config.prefix).toBe("test-");
          });
        };
      }

      const app = createTestApp(mockDomainSchema, {
        plugins: [createConfigPlugin({ prefix: "test-" })],
      });

      await app.ready();
    });
  });
});
