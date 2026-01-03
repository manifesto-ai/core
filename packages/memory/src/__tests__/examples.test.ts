/**
 * Examples Tests
 *
 * Tests for example implementations.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { World, ActorRef } from "@manifesto-ai/world";
import {
  InMemoryStore,
  createInMemoryStore,
  SimpleSelector,
  createSimpleSelector,
} from "../examples/index.js";
import { ExistenceVerifier, createExistenceVerifier } from "../verifier/index.js";
import type { SelectionRequest } from "../schema/selection.js";

// Helper to create a mock World
function createMockWorld(worldId: string, createdAt?: number): World {
  return {
    worldId: worldId as any,
    schemaHash: "schema:abc123",
    snapshotHash: "snapshot:def456",
    createdAt: createdAt ?? Date.now(),
    createdBy: null,
  };
}

// Helper to create a mock ActorRef
function createMockActor(id: string): ActorRef {
  return {
    actorId: id,
    kind: "agent",
  };
}

describe("InMemoryStore", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = createInMemoryStore();
  });

  describe("put()", () => {
    it("should store a World", () => {
      const world = createMockWorld("world-123");
      store.put(world);

      expect(store.size).toBe(1);
    });

    it("should overwrite existing World", () => {
      const world1 = createMockWorld("world-123");
      const world2 = createMockWorld("world-123");
      world2.schemaHash = "different";

      store.put(world1);
      store.put(world2);

      expect(store.size).toBe(1);
    });
  });

  describe("get()", () => {
    it("should return stored World", async () => {
      const world = createMockWorld("world-123");
      store.put(world);

      const result = await store.get("world-123" as any);

      expect(result).toEqual(world);
    });

    it("should return null for non-existent World", async () => {
      const result = await store.get("non-existent" as any);

      expect(result).toBeNull();
    });
  });

  describe("exists()", () => {
    it("should return true for stored World", async () => {
      const world = createMockWorld("world-123");
      store.put(world);

      const result = await store.exists("world-123" as any);

      expect(result).toBe(true);
    });

    it("should return false for non-existent World", async () => {
      const result = await store.exists("non-existent" as any);

      expect(result).toBe(false);
    });
  });

  describe("delete()", () => {
    it("should remove stored World", () => {
      const world = createMockWorld("world-123");
      store.put(world);

      const result = store.delete("world-123" as any);

      expect(result).toBe(true);
      expect(store.size).toBe(0);
    });

    it("should return false for non-existent World", () => {
      const result = store.delete("non-existent" as any);

      expect(result).toBe(false);
    });
  });

  describe("clear()", () => {
    it("should remove all Worlds", () => {
      store.put(createMockWorld("world-1"));
      store.put(createMockWorld("world-2"));
      store.put(createMockWorld("world-3"));

      store.clear();

      expect(store.size).toBe(0);
    });
  });

  describe("keys()", () => {
    it("should return all World IDs", () => {
      store.put(createMockWorld("world-1"));
      store.put(createMockWorld("world-2"));

      const keys = Array.from(store.keys());

      expect(keys).toHaveLength(2);
      expect(keys).toContain("world-1");
      expect(keys).toContain("world-2");
    });
  });

  describe("values()", () => {
    it("should return all Worlds", () => {
      store.put(createMockWorld("world-1"));
      store.put(createMockWorld("world-2"));

      const values = Array.from(store.values());

      expect(values).toHaveLength(2);
    });
  });
});

describe("SimpleSelector", () => {
  let store: InMemoryStore;
  let verifier: ExistenceVerifier;
  let selector: SimpleSelector;

  beforeEach(() => {
    store = createInMemoryStore();
    verifier = createExistenceVerifier();
    selector = createSimpleSelector(store, verifier);
  });

  describe("addToIndex()", () => {
    it("should add World to index", () => {
      selector.addToIndex("world-123", ["keyword1", "keyword2"], Date.now());

      // No direct way to check index, but we can verify via select
    });
  });

  describe("select()", () => {
    it("should return empty result for no matches", async () => {
      const request: SelectionRequest = {
        query: "nonexistent query",
        atWorldId: "current-world" as any,
        selector: createMockActor("selector"),
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(0);
      expect(result.selectedAt).toBeGreaterThan(0);
    });

    it("should find matching Worlds by keyword", async () => {
      const world = createMockWorld("world-123");
      store.put(world);
      selector.addToIndex("world-123", ["important", "data"], Date.now());

      const request: SelectionRequest = {
        query: "important",
        atWorldId: "current-world" as any,
        selector: createMockActor("selector"),
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].ref.worldId).toBe("world-123");
    });

    it("should calculate confidence based on keyword match", async () => {
      const world = createMockWorld("world-123");
      store.put(world);
      selector.addToIndex("world-123", ["keyword1", "keyword2"], Date.now());

      const request: SelectionRequest = {
        query: "keyword1 other",
        atWorldId: "current-world" as any,
        selector: createMockActor("selector"),
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].confidence).toBe(0.5); // 1 out of 2 keywords
    });

    it("should respect maxResults constraint", async () => {
      for (let i = 0; i < 5; i++) {
        const world = createMockWorld(`world-${i}`);
        store.put(world);
        selector.addToIndex(`world-${i}`, ["common"], Date.now());
      }

      const request: SelectionRequest = {
        query: "common",
        atWorldId: "current-world" as any,
        selector: createMockActor("selector"),
        constraints: { maxResults: 2 },
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(2);
    });

    it("should respect minConfidence constraint", async () => {
      const world1 = createMockWorld("world-1");
      const world2 = createMockWorld("world-2");
      store.put(world1);
      store.put(world2);
      selector.addToIndex("world-1", ["high", "match"], Date.now());
      selector.addToIndex("world-2", ["low"], Date.now());

      const request: SelectionRequest = {
        query: "high match",
        atWorldId: "current-world" as any,
        selector: createMockActor("selector"),
        constraints: { minConfidence: 0.8 },
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].ref.worldId).toBe("world-1");
    });

    it("should respect requireVerified constraint", async () => {
      // World that exists in store (verified)
      const world1 = createMockWorld("world-1");
      store.put(world1);
      selector.addToIndex("world-1", ["verified"], Date.now());

      // World not in store (not verified)
      selector.addToIndex("world-2", ["unverified"], Date.now());

      const request: SelectionRequest = {
        query: "verified unverified",
        atWorldId: "current-world" as any,
        selector: createMockActor("selector"),
        constraints: { requireVerified: true },
      };

      const result = await selector.select(request);

      expect(result.selected.every((m) => m.verified)).toBe(true);
    });

    it("should include verification evidence", async () => {
      const world = createMockWorld("world-123");
      store.put(world);
      selector.addToIndex("world-123", ["keyword"], Date.now());

      const selectorActor = createMockActor("selector");
      const request: SelectionRequest = {
        query: "keyword",
        atWorldId: "current-world" as any,
        selector: selectorActor,
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].evidence).toBeDefined();
      expect(result.selected[0].evidence?.method).toBe("existence");
      expect(result.selected[0].evidence?.verifiedBy).toEqual(selectorActor);
    });

    it("should respect timeRange constraint", async () => {
      const now = Date.now();
      const world1 = createMockWorld("world-old", now - 10000);
      const world2 = createMockWorld("world-new", now);
      store.put(world1);
      store.put(world2);
      selector.addToIndex("world-old", ["common"], now - 10000);
      selector.addToIndex("world-new", ["common"], now);

      const request: SelectionRequest = {
        query: "common",
        atWorldId: "current-world" as any,
        selector: createMockActor("selector"),
        constraints: {
          timeRange: { after: now - 5000 },
        },
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].ref.worldId).toBe("world-new");
    });
  });

  describe("removeFromIndex()", () => {
    it("should remove World from index", async () => {
      const world = createMockWorld("world-123");
      store.put(world);
      selector.addToIndex("world-123", ["keyword"], Date.now());

      selector.removeFromIndex("world-123");

      const request: SelectionRequest = {
        query: "keyword",
        atWorldId: "current-world" as any,
        selector: createMockActor("selector"),
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(0);
    });
  });

  describe("clearIndex()", () => {
    it("should clear all entries from index", async () => {
      selector.addToIndex("world-1", ["keyword"], Date.now());
      selector.addToIndex("world-2", ["keyword"], Date.now());

      selector.clearIndex();

      const request: SelectionRequest = {
        query: "keyword",
        atWorldId: "current-world" as any,
        selector: createMockActor("selector"),
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(0);
    });
  });
});
