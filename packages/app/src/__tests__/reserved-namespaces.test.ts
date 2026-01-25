/**
 * Reserved Namespaces Tests
 *
 * @see SPEC §18 Reserved Namespaces
 */

import { describe, it, expect } from "vitest";
import { createApp } from "../index.js";
import {
  ReservedNamespaceError,
  ReservedEffectTypeError,
} from "../errors/index.js";
import { ServiceRegistry } from "../runtime/services/index.js";
import { executeSystemGet } from "../runtime/services/system-get.js";
import { RESERVED_EFFECT_TYPE, RESERVED_NAMESPACE_PREFIX } from "../constants.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type { AppState } from "../core/types/index.js";

// Valid mock DomainSchema
const validDomainSchema: DomainSchema = {
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

describe("Reserved Namespaces", () => {
  describe("NS-ACT-1~4: Action Type Reservation", () => {
    it("NS-ACT-1: system.* prefix is reserved for System Actions", () => {
      expect(RESERVED_NAMESPACE_PREFIX).toBe("system.");
    });

    it("NS-ACT-2: Domain actions MUST NOT use system.* prefix", async () => {
      const invalidSchema: DomainSchema = {
        ...validDomainSchema,
        actions: {
          "system.custom": {
            flow: { kind: "seq", steps: [] },
          },
        },
      };

      const app = createApp(invalidSchema);

      await expect(app.ready()).rejects.toThrow(ReservedNamespaceError);
    });

    it("NS-ACT-3: ReservedNamespaceError should include action type", async () => {
      const invalidSchema: DomainSchema = {
        ...validDomainSchema,
        actions: {
          "system.myAction": {
            flow: { kind: "seq", steps: [] },
          },
        },
      };

      const app = createApp(invalidSchema);

      try {
        await app.ready();
        expect.fail("Expected ReservedNamespaceError");
      } catch (error) {
        expect(error).toBeInstanceOf(ReservedNamespaceError);
        expect((error as ReservedNamespaceError).namespace).toBe(
          "system.myAction"
        );
        expect((error as ReservedNamespaceError).kind).toBe("action");
      }
    });

    it("NS-ACT-4: Valid domain actions should be allowed", async () => {
      const validSchema: DomainSchema = {
        ...validDomainSchema,
        actions: {
          "user.create": {
            flow: { kind: "seq", steps: [] },
          },
          "order.submit": {
            flow: { kind: "seq", steps: [] },
          },
        },
      };

      const app = createApp(validSchema);
      await app.ready();

      expect(app.status).toBe("ready");
    });
  });

  describe("NS-EFF-1~4: Effect Type Reservation", () => {
    it("NS-EFF-1: system.get is the reserved effect type", () => {
      expect(RESERVED_EFFECT_TYPE).toBe("system.get");
    });

    it("NS-EFF-2: Domain effects MUST NOT use system.get (only system.get is reserved)", async () => {
      // Note: Currently only system.get is reserved, not all system.* prefixes
      // Testing that system.get specifically is rejected
      const app = createApp(validDomainSchema, {
        services: {
          "system.get": async () => [],
        },
      });

      await expect(app.ready()).rejects.toThrow(ReservedEffectTypeError);
    });

    it("NS-EFF-3: system.get IS allowed (handled internally)", async () => {
      // system.get is handled internally, so valid schema should work
      const app = createApp(validDomainSchema);
      await app.ready();

      expect(app.status).toBe("ready");
    });

    it("NS-EFF-4: ReservedEffectTypeError should include effect type", async () => {
      const app = createApp(validDomainSchema, {
        services: {
          "system.get": async () => [],
        },
      });

      try {
        await app.ready();
        expect.fail("Expected ReservedEffectTypeError");
      } catch (error) {
        expect(error).toBeInstanceOf(ReservedEffectTypeError);
        expect((error as ReservedEffectTypeError).effectType).toBe("system.get");
      }
    });
  });

  describe("SYSGET-1~6: system.get Built-in Handler", () => {
    it("SYSGET-1: system.get is a reserved effect type constant", () => {
      expect(RESERVED_EFFECT_TYPE).toBe("system.get");
    });

    it("SYSGET-2: User services MUST NOT override system.get", () => {
      expect(() => {
        new ServiceRegistry({
          "system.get": async () => [],
        });
      }).not.toThrow(); // Creation is allowed

      const registry = new ServiceRegistry({
        "system.get": async () => [],
      });

      // But validation throws
      expect(() => {
        registry.validate([]);
      }).toThrow(ReservedEffectTypeError);
    });

    it("SYSGET-3: ReservedEffectTypeError on system.get override attempt", () => {
      const registry = new ServiceRegistry({
        "system.get": async () => [],
      });

      try {
        registry.validate([]);
        expect.fail("Expected ReservedEffectTypeError");
      } catch (error) {
        expect(error).toBeInstanceOf(ReservedEffectTypeError);
        expect((error as ReservedEffectTypeError).effectType).toBe("system.get");
      }
    });

    it("SYSGET-4: system.get validation is always satisfied (skipped)", () => {
      const registry = new ServiceRegistry({}, { validationMode: "strict" });

      // Should not throw even though system.get is not registered
      // because it's handled internally
      expect(() => {
        registry.validate(["system.get"]);
      }).not.toThrow();
    });

    it("SYSGET-5: system.get returns value at path", () => {
      const snapshot: AppState<{ count: number; user: { name: string } }> = {
        data: { count: 42, user: { name: "John" } },
        computed: { doubled: 84 },
        system: {
          status: "idle",
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        meta: {
          version: 1,
          timestamp: Date.now(),
          randomSeed: "seed",
          schemaHash: "hash",
        },
      };

      // Get from data
      const dataResult = executeSystemGet({ path: "data.count" }, snapshot);
      expect(dataResult.result.value).toBe(42);
      expect(dataResult.result.found).toBe(true);

      // Get nested data
      const nestedResult = executeSystemGet(
        { path: "data.user.name" },
        snapshot
      );
      expect(nestedResult.result.value).toBe("John");

      // Get from computed
      const computedResult = executeSystemGet(
        { path: "computed.doubled" },
        snapshot
      );
      expect(computedResult.result.value).toBe(84);

      // Get from system
      const systemResult = executeSystemGet(
        { path: "system.status" },
        snapshot
      );
      expect(systemResult.result.value).toBe("idle");

      // Get from meta
      const metaResult = executeSystemGet({ path: "meta.version" }, snapshot);
      expect(metaResult.result.value).toBe(1);
    });

    it("SYSGET-5: system.get returns found=false for missing path", () => {
      const snapshot: AppState<unknown> = {
        data: {},
        computed: {},
        system: {
          status: "idle",
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        meta: {
          version: 1,
          timestamp: Date.now(),
          randomSeed: "seed",
          schemaHash: "hash",
        },
      };

      const result = executeSystemGet(
        { path: "data.nonexistent.deep.path" },
        snapshot
      );
      expect(result.result.found).toBe(false);
      expect(result.result.value).toBeUndefined();
    });

    it("SYSGET-5: system.get with target creates patch", () => {
      const snapshot: AppState<{ count: number }> = {
        data: { count: 42 },
        computed: {},
        system: {
          status: "idle",
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        meta: {
          version: 1,
          timestamp: Date.now(),
          randomSeed: "seed",
          schemaHash: "hash",
        },
      };

      const result = executeSystemGet(
        { path: "data.count", target: "data.cachedCount" },
        snapshot
      );

      expect(result.patches).toHaveLength(1);
      expect(result.patches[0].op).toBe("set");
      expect(result.patches[0].path).toBe("/data/cachedCount");
      expect((result.patches[0] as { value: unknown }).value).toBe(42);
    });

    it("SYSGET-6: system.get implicit data root", () => {
      const snapshot: AppState<{ items: string[] }> = {
        data: { items: ["a", "b", "c"] },
        computed: {},
        system: {
          status: "idle",
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        meta: {
          version: 1,
          timestamp: Date.now(),
          randomSeed: "seed",
          schemaHash: "hash",
        },
      };

      // Path without explicit root should resolve to data
      const result = executeSystemGet({ path: "items" }, snapshot);
      expect(result.result.value).toEqual(["a", "b", "c"]);
      expect(result.result.found).toBe(true);
    });
  });

  describe("Service Registry Merge Validation", () => {
    it("should reject system.get in merged services", () => {
      const registry = new ServiceRegistry({
        "http.fetch": async () => [],
      });

      expect(() => {
        registry.merge({
          "system.get": async () => [],
        });
      }).toThrow(ReservedEffectTypeError);
    });

    it("should allow valid services in merge", () => {
      const registry = new ServiceRegistry({
        "http.fetch": async () => [],
      });

      const merged = registry.merge({
        "db.query": async () => [],
      });

      expect(merged.has("http.fetch")).toBe(true);
      expect(merged.has("db.query")).toBe(true);
    });
  });

  describe("App Integration", () => {
    it("should validate namespaces at ready() time", async () => {
      const invalidSchema: DomainSchema = {
        ...validDomainSchema,
        actions: {
          "system.hack": {
            flow: { kind: "seq", steps: [] },
          },
        },
      };

      const app = createApp(invalidSchema);

      // App is created but not ready
      expect(app.status).toBe("created");

      // Validation happens at ready()
      await expect(app.ready()).rejects.toThrow(ReservedNamespaceError);
    });

    it("should validate services at ready() time", async () => {
      const app = createApp(validDomainSchema, {
        services: {
          "system.get": async () => [],
        },
      });

      await expect(app.ready()).rejects.toThrow(ReservedEffectTypeError);
    });

    it("should allow valid configuration", async () => {
      const app = createApp(validDomainSchema, {
        services: {
          "http.fetch": async () => [],
          "db.query": async () => [],
        },
      });

      await app.ready();
      expect(app.status).toBe("ready");
    });
  });
});
