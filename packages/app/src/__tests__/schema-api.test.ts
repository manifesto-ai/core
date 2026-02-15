/**
 * getDomainSchema() API Tests
 *
 * @see SPEC §6.2 getDomainSchema() Rules
 * @see FDR-CRIT-019 Plugin Schema Access Timing & Multi-Schema Compatibility
 * @since v0.4.10
 */

import { describe, it, expect, vi } from "vitest";
import { createApp, createTestApp, AppNotReadyError, AppDisposedError } from "../index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type { AppPlugin } from "../index.js";

// Mock DomainSchema for testing
const mockDomainSchema: DomainSchema = {
  id: "test:mock",
  version: "1.0.0",
  hash: "test-schema-hash-001",
  types: {},
  actions: {
    "todo.add": {
      flow: { kind: "seq", steps: [] },
    },
  },
  computed: { fields: {} },
  state: { fields: {} },
};

// Another mock schema with different hash
const mockDomainSchema2: DomainSchema = {
  id: "test:mock2",
  version: "1.0.0",
  hash: "test-schema-hash-002",
  types: {},
  actions: {
    "task.create": {
      flow: { kind: "seq", steps: [] },
    },
  },
  computed: { fields: {} },
  state: { fields: {} },
};

describe("getDomainSchema() API", () => {
  describe("SCHEMA-1: Current branch schema", () => {
    it("should return DomainSchema after ready()", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const schema = app.getDomainSchema();

      expect(schema).toBeDefined();
      expect(schema.hash).toBe("test-schema-hash-001");
      expect(schema.actions).toHaveProperty("todo.add");
    });

    it("should return schema matching current branch schemaHash", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const schema = app.getDomainSchema();
      const branch = app.currentBranch();

      expect(schema.hash).toBe(branch.schemaHash);
    });
  });

  describe("SCHEMA-2: Timing", () => {
    it("should throw AppNotReadyError before ready() is called", () => {
      const app = createTestApp(mockDomainSchema);

      expect(() => app.getDomainSchema()).toThrow(AppNotReadyError);
    });

    it("should NOT throw during plugin initialization (READY-1a)", async () => {
      let capturedSchema: DomainSchema | null = null;

      const testPlugin: AppPlugin = (app) => {
        // This should NOT throw - schema is resolved before plugins run
        capturedSchema = app.getDomainSchema();
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [testPlugin],
      });

      await app.ready();

      // Plugin should have successfully called getDomainSchema()
      expect(capturedSchema).not.toBeNull();
      expect(capturedSchema!.hash).toBe("test-schema-hash-001");
    });
  });

  describe("SCHEMA-3: No undefined", () => {
    it("should never return undefined once resolved", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const schema = app.getDomainSchema();

      expect(schema).not.toBeUndefined();
      expect(schema).not.toBeNull();
    });

    it("should always have required schema properties", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const schema = app.getDomainSchema();

      expect(schema.hash).toBeDefined();
      expect(schema.actions).toBeDefined();
      expect(schema.computed).toBeDefined();
      expect(schema.state).toBeDefined();
    });
  });

  describe("SCHEMA-4: Referential identity", () => {
    it("should return same instance for multiple calls", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const schema1 = app.getDomainSchema();
      const schema2 = app.getDomainSchema();
      const schema3 = app.getDomainSchema();

      // Referential equality check
      expect(schema1).toBe(schema2);
      expect(schema2).toBe(schema3);
    });

    it("should maintain referential identity across ready() boundary", async () => {
      let schemaFromPlugin: DomainSchema | null = null;

      const testPlugin: AppPlugin = (app) => {
        schemaFromPlugin = app.getDomainSchema();
      };

      const app = createTestApp(mockDomainSchema, {
        plugins: [testPlugin],
      });

      await app.ready();

      const schemaAfterReady = app.getDomainSchema();

      // Schema from plugin should be same instance as after ready()
      expect(schemaFromPlugin).toBe(schemaAfterReady);
    });
  });

  describe("SCHEMA-5: MEL compilation", () => {
    it("should return compiled schema when domain is MEL text", async () => {
      const melText = `
        domain TodoApp {
          state {
            count: number = 0
          }
          action increment() {
            when true {
              patch count = add(count, 1)
            }
          }
        }
      `;

      const app = createTestApp(melText);
      await app.ready();

      const schema = app.getDomainSchema();

      expect(schema).toBeDefined();
      expect(schema.hash).toBeDefined();
      expect(schema.actions).toHaveProperty("increment");
    });
  });

  describe("APP-NS-1: Platform Namespace Injection", () => {
    it("should inject $mel guards.intent field structure", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const schema = app.getDomainSchema();
      const melField = schema.state.fields.$mel;

      expect(melField).toBeDefined();
      expect(melField?.type).toBe("object");
      expect(melField?.fields?.guards?.type).toBe("object");
      expect(melField?.fields?.guards?.fields?.intent?.type).toBe("object");
    });
  });

  describe("Disposed state", () => {
    it("should throw AppDisposedError after dispose()", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();
      await app.dispose();

      expect(() => app.getDomainSchema()).toThrow(AppDisposedError);
    });
  });
});

describe("READY-1a/READY-6: Plugin schema access", () => {
  it("should allow getDomainSchema() in plugin during ready()", async () => {
    const schemaAccess: { success: boolean; hash?: string } = { success: false };

    const testPlugin: AppPlugin = (app) => {
      try {
        const schema = app.getDomainSchema();
        schemaAccess.success = true;
        schemaAccess.hash = schema.hash;
      } catch {
        schemaAccess.success = false;
      }
    };

    const app = createTestApp(mockDomainSchema, {
      plugins: [testPlugin],
    });

    await app.ready();

    expect(schemaAccess.success).toBe(true);
    expect(schemaAccess.hash).toBe(mockDomainSchema.hash);
  });

  it("should have schema available before state initialization", async () => {
    // This test verifies READY-6: schema resolved before plugins
    const pluginExecutionOrder: string[] = [];
    let schemaHashDuringPlugin: string | undefined;

    const testPlugin: AppPlugin = (app) => {
      pluginExecutionOrder.push("plugin");
      const schema = app.getDomainSchema();
      schemaHashDuringPlugin = schema.hash;
    };

    const app = createTestApp(mockDomainSchema, {
      plugins: [testPlugin],
    });

    await app.ready();

    expect(pluginExecutionOrder).toContain("plugin");
    expect(schemaHashDuringPlugin).toBe(mockDomainSchema.hash);
  });

  it("should provide same schema instance to multiple plugins", async () => {
    const schemas: DomainSchema[] = [];

    const plugin1: AppPlugin = (app) => {
      schemas.push(app.getDomainSchema());
    };

    const plugin2: AppPlugin = (app) => {
      schemas.push(app.getDomainSchema());
    };

    const app = createTestApp(mockDomainSchema, {
      plugins: [plugin1, plugin2],
    });

    await app.ready();

    expect(schemas.length).toBe(2);
    expect(schemas[0]).toBe(schemas[1]); // Same instance
  });
});

describe("domain:resolved hook", () => {
  it("should emit domain:resolved after NS-ACT-2 validation passes", async () => {
    const hookPayload: { schemaHash: string; schema: DomainSchema } | null = {
      schemaHash: "",
      schema: null as unknown as DomainSchema,
    };

    const app = createTestApp(mockDomainSchema);

    app.hooks.on("domain:resolved", (payload) => {
      hookPayload.schemaHash = payload.schemaHash;
      hookPayload.schema = payload.schema;
    });

    await app.ready();

    expect(hookPayload.schemaHash).toBe(mockDomainSchema.hash);
    expect(hookPayload.schema).toBe(app.getDomainSchema());
  });

  it("should NOT emit domain:resolved if NS-ACT-2 fails", async () => {
    const hookCalled = vi.fn();

    // Schema with reserved namespace action (should fail validation)
    const invalidSchema: DomainSchema = {
      id: "test:invalid",
      version: "1.0.0",
      hash: "invalid-schema",
      types: {},
      actions: {
        "system.reserved": {
          flow: { kind: "seq", steps: [] },
        },
      },
      computed: { fields: {} },
      state: { fields: {} },
    };

    const app = createTestApp(invalidSchema);
    app.hooks.on("domain:resolved", hookCalled);

    await expect(app.ready()).rejects.toThrow();
    expect(hookCalled).not.toHaveBeenCalled();
  });

  it("should emit before plugins initialize", async () => {
    const order: string[] = [];

    const testPlugin: AppPlugin = () => {
      order.push("plugin");
    };

    const app = createTestApp(mockDomainSchema, {
      plugins: [testPlugin],
    });

    app.hooks.on("domain:resolved", () => {
      order.push("domain:resolved");
    });

    await app.ready();

    const resolvedIndex = order.indexOf("domain:resolved");
    const pluginIndex = order.indexOf("plugin");

    expect(resolvedIndex).toBeLessThan(pluginIndex);
  });
});

describe("domain:schema:added hook", () => {
  it("should NOT emit during initial ready()", async () => {
    const hookCalled = vi.fn();

    const app = createTestApp(mockDomainSchema);
    app.hooks.on("domain:schema:added", hookCalled);

    await app.ready();

    // domain:schema:added should NOT emit during initial ready
    // Only domain:resolved should emit
    expect(hookCalled).not.toHaveBeenCalled();
  });

  // Note: Tests for schema-changing fork would require fork({ domain }) support
  // which is a future feature. These tests are placeholder for when that's implemented.
  it.skip("should emit when schema-changing fork adds new schema", async () => {
    // TODO: Implement when fork({ domain }) is supported
  });

  it.skip("should NOT emit for already-cached schemas", async () => {
    // TODO: Implement when fork({ domain }) is supported
  });
});
