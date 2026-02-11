/**
 * Memory Integration Tests
 *
 * @see SPEC §14 Memory Integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp, createTestApp } from "@manifesto-ai/app";
import {
  NoneVerifier,
  MemoryHub,
  EnabledMemoryFacade,
  DisabledMemoryFacade,
  createMemoryFacade,
} from "@manifesto-ai/runtime";
import { MemoryDisabledError, BranchNotFoundError } from "@manifesto-ai/shared";
import type { DomainSchema } from "@manifesto-ai/core";
import type {
  MemoryProvider,
  MemoryHubConfig,
  AppState,
} from "@manifesto-ai/shared";

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

// Mock memory provider
function createMockProvider(name: string): MemoryProvider {
  return {
    ingest: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockResolvedValue({
      selected: [
        {
          ref: { worldId: "world-123" },
          reason: "test match",
          confidence: 0.9,
          verified: false,
        },
      ],
      selectedAt: Date.now(),
    }),
    meta: {
      name,
      version: "1.0.0",
      capabilities: ["ingest", "select"] as const,
    },
  };
}

describe("Memory Integration", () => {
  describe("NoneVerifier", () => {
    describe("VER-2: NoneVerifier always produces verified = false", () => {
      it("prove() should return valid = false", () => {
        const result = NoneVerifier.prove(
          { worldId: "world-123" },
          {} as any // Mock world
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it("verifyProof() should return false", () => {
        const result = NoneVerifier.verifyProof({ method: "none" });

        expect(result).toBe(false);
      });
    });
  });

  describe("MemoryHub", () => {
    it("should throw if default provider not found", () => {
      expect(() => {
        new MemoryHub(
          {
            providers: { test: createMockProvider("test") },
            defaultProvider: "unknown",
          },
          "schema-hash"
        );
      }).toThrow("Default provider");
    });

    it("should list provider names", () => {
      const hub = new MemoryHub(
        {
          providers: {
            providerA: createMockProvider("A"),
            providerB: createMockProvider("B"),
          },
          defaultProvider: "providerA",
        },
        "schema-hash"
      );

      const names = hub.getProviderNames();

      expect(names).toContain("providerA");
      expect(names).toContain("providerB");
      expect(names).toHaveLength(2);
    });

    describe("MEM-2: Fan-out to providers", () => {
      it("should ingest to all providers by default", async () => {
        const providerA = createMockProvider("A");
        const providerB = createMockProvider("B");

        const hub = new MemoryHub(
          {
            providers: { providerA, providerB },
            defaultProvider: "providerA",
          },
          "schema-hash"
        );

        await hub.ingest({
          worldId: "world-123",
          schemaHash: "schema-hash",
          snapshot: {} as AppState<unknown>,
          createdAt: Date.now(),
          createdBy: { actorId: "test-user", kind: "human" as const },
        });

        expect(providerA.ingest).toHaveBeenCalled();
        expect(providerB.ingest).toHaveBeenCalled();
      });

      it("should respect routing config", async () => {
        const providerA = createMockProvider("A");
        const providerB = createMockProvider("B");

        const hub = new MemoryHub(
          {
            providers: { providerA, providerB },
            defaultProvider: "providerA",
            routing: {
              ingestTo: () => ["providerA"], // Only ingest to A
            },
          },
          "schema-hash"
        );

        await hub.ingest({
          worldId: "world-123",
          schemaHash: "schema-hash",
          snapshot: {} as AppState<unknown>,
          createdAt: Date.now(),
          createdBy: { actorId: "test-user", kind: "human" as const },
        });

        expect(providerA.ingest).toHaveBeenCalled();
        expect(providerB.ingest).not.toHaveBeenCalled();
      });
    });

    describe("MEM-3: Recall returns SelectionResult", () => {
      it("should return selection result from provider", async () => {
        const provider = createMockProvider("test");
        const hub = new MemoryHub(
          {
            providers: { test: provider },
            defaultProvider: "test",
          },
          "schema-hash"
        );

        const result = await hub.recall(
          ["test query"],
          "world-123",
          { actorId: "user-123", kind: "human" as const }
        );

        expect(result.attachments).toHaveLength(1);
        expect(result.selected).toHaveLength(1);
      });
    });
  });

  describe("DisabledMemoryFacade", () => {
    let facade: DisabledMemoryFacade;

    beforeEach(() => {
      facade = new DisabledMemoryFacade();
    });

    describe("MEM-DIS-1: enabled() returns false", () => {
      it("should return false", () => {
        expect(facade.enabled()).toBe(false);
      });
    });

    describe("MEM-DIS-2: recall() throws MemoryDisabledError", () => {
      it("should throw MemoryDisabledError", async () => {
        await expect(facade.recall("query")).rejects.toThrow(MemoryDisabledError);
      });
    });

    describe("MEM-DIS-3: backfill() throws MemoryDisabledError", () => {
      it("should throw MemoryDisabledError", async () => {
        await expect(facade.backfill({ worldId: "world-123" })).rejects.toThrow(
          MemoryDisabledError
        );
      });
    });

    describe("MEM-DIS-4: providers() returns empty array", () => {
      it("should return empty array", () => {
        expect(facade.providers()).toEqual([]);
      });
    });
  });

  describe("EnabledMemoryFacade", () => {
    it("enabled() should return true", () => {
      const hub = new MemoryHub(
        {
          providers: { test: createMockProvider("test") },
          defaultProvider: "test",
        },
        "schema-hash"
      );

      const facade = new EnabledMemoryFacade(hub, {
        getDefaultActorId: () => "anonymous",
        getCurrentBranchId: () => "main",
        getBranchHead: () => "world-123",
        branchExists: () => true,
      });

      expect(facade.enabled()).toBe(true);
    });

    it("providers() should return provider names", () => {
      const hub = new MemoryHub(
        {
          providers: {
            test1: createMockProvider("test1"),
            test2: createMockProvider("test2"),
          },
          defaultProvider: "test1",
        },
        "schema-hash"
      );

      const facade = new EnabledMemoryFacade(hub, {
        getDefaultActorId: () => "anonymous",
        getCurrentBranchId: () => "main",
        getBranchHead: () => "world-123",
        branchExists: () => true,
      });

      const providers = facade.providers();
      expect(providers).toContain("test1");
      expect(providers).toContain("test2");
    });

    describe("MEM-DIS-8: Empty array is no recall", () => {
      it("should return empty result for empty array", async () => {
        const hub = new MemoryHub(
          {
            providers: { test: createMockProvider("test") },
            defaultProvider: "test",
          },
          "schema-hash"
        );

        const facade = new EnabledMemoryFacade(hub, {
          getDefaultActorId: () => "anonymous",
          getCurrentBranchId: () => "main",
          getBranchHead: () => "world-123",
          branchExists: () => true,
        });

        const result = await facade.recall([]);

        expect(result.attachments).toEqual([]);
        expect(result.selected).toEqual([]);
        expect(result.views).toEqual([]);
      });
    });

    describe("MEM-REC-5: Invalid branchId throws BranchNotFoundError", () => {
      it("should throw BranchNotFoundError for non-existent branch", async () => {
        const hub = new MemoryHub(
          {
            providers: { test: createMockProvider("test") },
            defaultProvider: "test",
          },
          "schema-hash"
        );

        const facade = new EnabledMemoryFacade(hub, {
          getDefaultActorId: () => "anonymous",
          getCurrentBranchId: () => "main",
          getBranchHead: () => undefined,
          branchExists: (id) => id === "main", // Only main exists
        });

        await expect(
          facade.recall("query", { branchId: "non-existent" })
        ).rejects.toThrow(BranchNotFoundError);
      });
    });
  });

  describe("App Integration", () => {
    describe("Memory disabled (default)", () => {
      it("app.memory.enabled() should return false when no memory config", async () => {
        const app = createTestApp(mockDomainSchema);
        await app.ready();

        expect(app.memory.enabled()).toBe(false);
      });

      it("app.memory.enabled() should return false when memory: false", async () => {
        const app = createTestApp(mockDomainSchema, { memory: false });
        await app.ready();

        expect(app.memory.enabled()).toBe(false);
      });

      it("app.memory.recall() should throw when memory disabled", async () => {
        const app = createTestApp(mockDomainSchema, { memory: false });
        await app.ready();

        await expect(app.memory.recall("query")).rejects.toThrow(
          MemoryDisabledError
        );
      });

      it("app.memory.providers() should return empty when disabled", async () => {
        const app = createTestApp(mockDomainSchema, { memory: false });
        await app.ready();

        expect(app.memory.providers()).toEqual([]);
      });
    });

    describe("Memory enabled", () => {
      it("app.memory.enabled() should return true when configured", async () => {
        const app = createTestApp(mockDomainSchema, {
          memory: {
            providers: { test: createMockProvider("test") },
            defaultProvider: "test",
          },
        });
        await app.ready();

        expect(app.memory.enabled()).toBe(true);
      });

      it("app.memory.providers() should return provider names", async () => {
        const app = createTestApp(mockDomainSchema, {
          memory: {
            providers: {
              provider1: createMockProvider("p1"),
              provider2: createMockProvider("p2"),
            },
            defaultProvider: "provider1",
          },
        });
        await app.ready();

        const providers = app.memory.providers();
        expect(providers).toContain("provider1");
        expect(providers).toContain("provider2");
      });
    });

    describe("Session recall", () => {
      it("session.recall() should throw when memory disabled", async () => {
        const app = createTestApp(mockDomainSchema, { memory: false });
        await app.ready();

        const session = app.session("user-123");

        await expect(session.recall("query")).rejects.toThrow(
          MemoryDisabledError
        );
      });

      it("session.recall() should work when memory enabled", async () => {
        const app = createTestApp(mockDomainSchema, {
          memory: {
            providers: { test: createMockProvider("test") },
            defaultProvider: "test",
          },
        });
        await app.ready();

        const session = app.session("user-123");
        const result = await session.recall("query");

        expect(result.attachments).toBeDefined();
        expect(result.selected).toBeDefined();
      });
    });
  });

  describe("createMemoryFacade", () => {
    const mockContext = {
      getDefaultActorId: () => "anonymous",
      getCurrentBranchId: () => "main",
      getBranchHead: () => "world-123",
      branchExists: () => true,
    };

    it("should create DisabledMemoryFacade when config is false", () => {
      const facade = createMemoryFacade(false, "schema-hash", mockContext);

      expect(facade.enabled()).toBe(false);
    });

    it("should create DisabledMemoryFacade when config is undefined", () => {
      const facade = createMemoryFacade(undefined, "schema-hash", mockContext);

      expect(facade.enabled()).toBe(false);
    });

    it("should create EnabledMemoryFacade when config is provided", () => {
      const facade = createMemoryFacade(
        {
          providers: { test: createMockProvider("test") },
          defaultProvider: "test",
        },
        "schema-hash",
        mockContext
      );

      expect(facade.enabled()).toBe(true);
    });
  });
});
