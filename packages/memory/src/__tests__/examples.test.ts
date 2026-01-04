/**
 * Example Implementation Tests
 *
 * Tests for InMemoryStore, InMemoryKeywordIndex, and SimpleSelector.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { World, ActorRef, WorldId } from "@manifesto-ai/world";
import {
  InMemoryStore,
  createInMemoryStore,
} from "../examples/memory-store.js";
import {
  InMemoryKeywordIndex,
  SimpleSelector,
  createSimpleSelector,
  createKeywordIndex,
} from "../examples/simple-selector.js";
import { createExistenceVerifier } from "../verifier/existence.js";
import { createHashVerifier } from "../verifier/hash.js";
import type { SelectionRequest } from "../schema/selection.js";

// Test fixtures
const testActor: ActorRef = { actorId: "test-user", kind: "human" };

function createMockWorld(id: string, overrides: Partial<World> = {}): World {
  return {
    worldId: id as WorldId,
    schemaHash: `schema-${id}`,
    snapshotHash: `snapshot-${id}`,
    createdAt: Date.now(),
    createdBy: { actorId: "test-system", kind: "system" },
    ...overrides,
  } as World;
}

describe("InMemoryStore", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = createInMemoryStore();
  });

  describe("put/get", () => {
    it("should store and retrieve a World", async () => {
      const world = createMockWorld("world-1");
      store.put(world);

      const retrieved = await store.get("world-1" as WorldId);
      expect(retrieved).toEqual(world);
    });

    it("should return null for non-existent World", async () => {
      const retrieved = await store.get("nonexistent" as WorldId);
      expect(retrieved).toBeNull();
    });

    it("should overwrite existing World", async () => {
      const world1 = createMockWorld("world-1", { snapshotHash: "hash1" });
      const world2 = createMockWorld("world-1", { snapshotHash: "hash2" });

      store.put(world1);
      store.put(world2);

      const retrieved = await store.get("world-1" as WorldId);
      expect(retrieved?.snapshotHash).toBe("hash2");
    });
  });

  describe("exists", () => {
    it("should return true for existing World", async () => {
      store.put(createMockWorld("world-1"));
      expect(await store.exists("world-1" as WorldId)).toBe(true);
    });

    it("should return false for non-existent World", async () => {
      expect(await store.exists("nonexistent" as WorldId)).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete existing World", () => {
      store.put(createMockWorld("world-1"));
      const deleted = store.delete("world-1" as WorldId);

      expect(deleted).toBe(true);
      expect(store.size).toBe(0);
    });

    it("should return false for non-existent World", () => {
      const deleted = store.delete("nonexistent" as WorldId);
      expect(deleted).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all Worlds", () => {
      store.put(createMockWorld("world-1"));
      store.put(createMockWorld("world-2"));
      store.clear();

      expect(store.size).toBe(0);
    });
  });

  describe("size", () => {
    it("should return correct count", () => {
      expect(store.size).toBe(0);
      store.put(createMockWorld("world-1"));
      expect(store.size).toBe(1);
      store.put(createMockWorld("world-2"));
      expect(store.size).toBe(2);
    });
  });

  describe("keys/values", () => {
    it("should iterate over keys", () => {
      store.put(createMockWorld("world-1"));
      store.put(createMockWorld("world-2"));

      const keys = Array.from(store.keys());
      expect(keys).toContain("world-1");
      expect(keys).toContain("world-2");
    });

    it("should iterate over values", () => {
      const world1 = createMockWorld("world-1");
      const world2 = createMockWorld("world-2");
      store.put(world1);
      store.put(world2);

      const values = Array.from(store.values());
      expect(values).toHaveLength(2);
    });
  });
});

describe("InMemoryKeywordIndex", () => {
  let index: InMemoryKeywordIndex;

  beforeEach(() => {
    index = createKeywordIndex();
  });

  describe("add/findByKeywords", () => {
    it("should add and find entries by keywords", () => {
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["task", "completed", "urgent"],
      });

      const results = index.findByKeywords(["task"]);
      expect(results).toHaveLength(1);
      expect(results[0].worldId).toBe("world-1");
    });

    it("should find entries with partial keyword match", () => {
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["important task"],
      });

      const results = index.findByKeywords(["task"]);
      expect(results).toHaveLength(1);
    });

    it("should perform case-insensitive matching", () => {
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["UPPERCASE"],
      });

      const results = index.findByKeywords(["uppercase"]);
      expect(results).toHaveLength(1);
    });

    it("should return empty array for no matches", () => {
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["foo"],
      });

      const results = index.findByKeywords(["bar"]);
      expect(results).toHaveLength(0);
    });

    it("should return empty array for empty keywords", () => {
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["foo"],
      });

      const results = index.findByKeywords([]);
      expect(results).toHaveLength(0);
    });

    it("should find multiple matching entries", () => {
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["task", "project"],
      });
      index.add({
        worldId: "world-2" as WorldId,
        keywords: ["task", "urgent"],
      });

      const results = index.findByKeywords(["task"]);
      expect(results).toHaveLength(2);
    });
  });

  describe("remove", () => {
    it("should remove entry from index", () => {
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["task"],
      });

      index.remove("world-1" as WorldId);

      const results = index.findByKeywords(["task"]);
      expect(results).toHaveLength(0);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["task"],
      });
      index.add({
        worldId: "world-2" as WorldId,
        keywords: ["project"],
      });

      index.clear();

      expect(index.size).toBe(0);
    });
  });

  describe("size", () => {
    it("should return correct count", () => {
      expect(index.size).toBe(0);
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["task"],
      });
      expect(index.size).toBe(1);
    });
  });
});

describe("SimpleSelector", () => {
  let store: InMemoryStore;
  let index: InMemoryKeywordIndex;
  let selector: SimpleSelector;

  beforeEach(() => {
    store = createInMemoryStore();
    index = createKeywordIndex();
    selector = createSimpleSelector(
      store,
      createExistenceVerifier(),
      index
    );
  });

  describe("select", () => {
    it("should return empty result for no matches", async () => {
      const request: SelectionRequest = {
        query: "find nothing",
        atWorldId: "current-world" as WorldId,
        selector: testActor,
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(0);
      expect(typeof result.selectedAt).toBe("number");
    });

    it("should find matching memories", async () => {
      const world = createMockWorld("world-1");
      store.put(world);
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["task", "completed"],
      });

      const request: SelectionRequest = {
        query: "find completed tasks",
        atWorldId: "current-world" as WorldId,
        selector: testActor,
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].ref.worldId).toBe("world-1");
    });

    it("should calculate confidence based on keyword overlap", async () => {
      const world = createMockWorld("world-1");
      store.put(world);
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["task", "completed", "urgent"],
      });

      const request: SelectionRequest = {
        query: "find completed tasks",
        atWorldId: "current-world" as WorldId,
        selector: testActor,
      };

      const result = await selector.select(request);

      expect(result.selected[0].confidence).toBeGreaterThan(0);
      expect(result.selected[0].confidence).toBeLessThanOrEqual(1);
    });

    it("should include verification evidence", async () => {
      const world = createMockWorld("world-1");
      store.put(world);
      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["task"],
      });

      const request: SelectionRequest = {
        query: "task",
        atWorldId: "current-world" as WorldId,
        selector: testActor,
      };

      const result = await selector.select(request);

      expect(result.selected[0].evidence).toBeDefined();
      expect(result.selected[0].evidence?.method).toBe("existence");
      expect(result.selected[0].evidence?.verifiedBy).toEqual(testActor);
    });

    it("should sort by confidence descending", async () => {
      store.put(createMockWorld("world-1"));
      store.put(createMockWorld("world-2"));

      index.add({
        worldId: "world-1" as WorldId,
        keywords: ["task"],
      });
      index.add({
        worldId: "world-2" as WorldId,
        keywords: ["task", "completed", "important"],
      });

      const request: SelectionRequest = {
        query: "completed important task",
        atWorldId: "current-world" as WorldId,
        selector: testActor,
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(2);
      expect(result.selected[0].confidence).toBeGreaterThanOrEqual(
        result.selected[1].confidence
      );
    });

    describe("constraints", () => {
      beforeEach(() => {
        store.put(createMockWorld("world-1"));
        store.put(createMockWorld("world-2"));
        store.put(createMockWorld("world-3"));

        index.add({
          worldId: "world-1" as WorldId,
          keywords: ["task", "high"],
        });
        index.add({
          worldId: "world-2" as WorldId,
          keywords: ["task", "medium"],
        });
        index.add({
          worldId: "world-3" as WorldId,
          keywords: ["task", "low"],
        });
      });

      it("should apply maxResults constraint", async () => {
        const request: SelectionRequest = {
          query: "task",
          atWorldId: "current-world" as WorldId,
          selector: testActor,
          constraints: { maxResults: 2 },
        };

        const result = await selector.select(request);

        expect(result.selected).toHaveLength(2);
      });

      it("should apply minConfidence constraint", async () => {
        const request: SelectionRequest = {
          query: "task high priority",
          atWorldId: "current-world" as WorldId,
          selector: testActor,
          constraints: { minConfidence: 0.5 },
        };

        const result = await selector.select(request);

        for (const memory of result.selected) {
          expect(memory.confidence).toBeGreaterThanOrEqual(0.5);
        }
      });

      it("should apply requireVerified constraint", async () => {
        const request: SelectionRequest = {
          query: "task",
          atWorldId: "current-world" as WorldId,
          selector: testActor,
          constraints: { requireVerified: true },
        };

        const result = await selector.select(request);

        for (const memory of result.selected) {
          expect(memory.verified).toBe(true);
        }
      });

      it("should apply requireEvidence constraint", async () => {
        const request: SelectionRequest = {
          query: "task",
          atWorldId: "current-world" as WorldId,
          selector: testActor,
          constraints: { requireEvidence: true },
        };

        const result = await selector.select(request);

        for (const memory of result.selected) {
          expect(memory.evidence).toBeDefined();
          expect(memory.evidence?.method).not.toBe("none");
        }
      });
    });

    it("should skip worlds not found in store", async () => {
      // Add to index but not to store
      index.add({
        worldId: "missing-world" as WorldId,
        keywords: ["task"],
      });

      const request: SelectionRequest = {
        query: "task",
        atWorldId: "current-world" as WorldId,
        selector: testActor,
      };

      const result = await selector.select(request);

      expect(result.selected).toHaveLength(0);
    });
  });
});

describe("SimpleSelector with HashVerifier", () => {
  let store: InMemoryStore;
  let index: InMemoryKeywordIndex;
  let selector: SimpleSelector;

  beforeEach(() => {
    store = createInMemoryStore();
    index = createKeywordIndex();
    selector = createSimpleSelector(
      store,
      createHashVerifier(),
      index
    );
  });

  it("should include hash evidence", async () => {
    const world = createMockWorld("world-1");
    store.put(world);
    index.add({
      worldId: "world-1" as WorldId,
      keywords: ["task"],
    });

    const request: SelectionRequest = {
      query: "task",
      atWorldId: "current-world" as WorldId,
      selector: testActor,
    };

    const result = await selector.select(request);

    expect(result.selected[0].evidence?.method).toBe("hash");
    expect(result.selected[0].evidence?.proof).toHaveProperty("computedHash");
  });
});

describe("Factory functions", () => {
  it("createInMemoryStore should create an InMemoryStore", () => {
    const store = createInMemoryStore();
    expect(store).toBeInstanceOf(InMemoryStore);
  });

  it("createKeywordIndex should create an InMemoryKeywordIndex", () => {
    const index = createKeywordIndex();
    expect(index).toBeInstanceOf(InMemoryKeywordIndex);
  });

  it("createSimpleSelector should create a SimpleSelector", () => {
    const store = createInMemoryStore();
    const index = createKeywordIndex();
    const verifier = createExistenceVerifier();
    const selector = createSimpleSelector(store, verifier, index);

    expect(selector).toBeInstanceOf(SimpleSelector);
  });
});
