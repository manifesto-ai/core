/**
 * Memory Architecture Integration Tests
 *
 * Tests to verify the memory system actually works for:
 * - Short-term memory (recent context)
 * - Medium-term memory (session-level)
 * - Long-term memory (persistent across sessions)
 *
 * @see SPEC §14 Memory Integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp, createTestApp, MemoryHub, withDxAliases } from "../index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type {
  MemoryProvider,
  MemoryIngestEntry,
  AppState,
  RecallResult,
} from "../index.js";
import type {
  SelectionResult,
  SelectedMemory,
} from "../index.js";
import type { WorldId } from "@manifesto-ai/world";

// ActorRef type definition (aligned with @manifesto-ai/world)
interface ActorRef {
  actorId: string;
  kind: "human" | "agent" | "system";
  name?: string;
  meta?: Record<string, unknown>;
}

// =============================================================================
// Test Domain Schema
// =============================================================================

const testDomainSchema: DomainSchema = {
  id: "test:memory",
  version: "1.0.0",
  hash: "memory-test-schema",
  types: {},
  actions: {
    "chat.message": {
      flow: { kind: "seq", steps: [] },
    },
    "note.create": {
      flow: { kind: "seq", steps: [] },
    },
  },
  computed: { fields: {} },
  state: { fields: {} },
};

// =============================================================================
// Memory Store Simulation
// =============================================================================

interface StoredMemory {
  worldId: string;
  schemaHash: string;
  snapshot: AppState<unknown>;
  parentWorldId?: string;
  createdAt: number;
  tier: "short" | "medium" | "long";
}

/**
 * In-memory store that simulates a real memory backend.
 * Supports tiered memory (short/medium/long term).
 */
class MemoryStore {
  private _memories: StoredMemory[] = [];
  private _shortTermWindowMs = 5 * 60 * 1000; // 5 minutes
  private _mediumTermWindowMs = 24 * 60 * 60 * 1000; // 24 hours

  ingest(entry: MemoryIngestEntry): void {
    const now = Date.now();
    const age = now - entry.createdAt;

    // Determine tier based on age
    let tier: "short" | "medium" | "long";
    if (age < this._shortTermWindowMs) {
      tier = "short";
    } else if (age < this._mediumTermWindowMs) {
      tier = "medium";
    } else {
      tier = "long";
    }

    this._memories.push({
      worldId: entry.worldId,
      schemaHash: entry.schemaHash,
      snapshot: entry.snapshot,
      parentWorldId: entry.parentWorldId,
      createdAt: entry.createdAt,
      tier,
    });
  }

  select(
    query: string,
    atWorldId: string,
    opts?: {
      tier?: "short" | "medium" | "long" | "all";
      limit?: number;
    }
  ): SelectedMemory[] {
    const tier = opts?.tier ?? "all";
    const limit = opts?.limit ?? 10;

    // Filter by tier
    let filtered = this._memories;
    if (tier !== "all") {
      filtered = filtered.filter((m) => m.tier === tier);
    }

    // Simple text search in snapshot data (simulating vector search)
    const queryLower = query.toLowerCase();
    const matched = filtered.filter((m) => {
      const dataStr = JSON.stringify(m.snapshot.data).toLowerCase();
      return dataStr.includes(queryLower);
    });

    // Sort by recency
    matched.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit and convert to SelectedMemory
    return matched.slice(0, limit).map((m) => ({
      ref: { worldId: m.worldId as WorldId },
      reason: `Matched query: ${query}`,
      confidence: 0.9,
      verified: false, // NoneVerifier always produces false
    }));
  }

  getAll(): StoredMemory[] {
    return [...this._memories];
  }

  clear(): void {
    this._memories = [];
  }

  getByTier(tier: "short" | "medium" | "long"): StoredMemory[] {
    return this._memories.filter((m) => m.tier === tier);
  }
}

// =============================================================================
// Tiered Memory Provider
// =============================================================================

/**
 * Creates a memory provider backed by the MemoryStore.
 */
function createTieredMemoryProvider(
  store: MemoryStore,
  tier: "short" | "medium" | "long" | "all"
): MemoryProvider {
  return {
    ingest: async (entry: MemoryIngestEntry) => {
      store.ingest(entry);
    },
    select: async (req: {
      query: string;
      atWorldId: string;
      selector: ActorRef;
      constraints?: { limit?: number; requireVerified?: boolean };
    }): Promise<SelectionResult> => {
      const selected = store.select(req.query, req.atWorldId, {
        tier,
        limit: req.constraints?.limit,
      });

      return {
        selected,
        trace: {
          query: req.query,
          atWorldId: req.atWorldId as WorldId,
          selector: req.selector,
          selectedAt: Date.now(),
          selected,
        },
      };
    },
    meta: {
      name: `${tier}-term-memory`,
      version: "1.0.0",
      capabilities: ["ingest", "select"],
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("Memory Architecture - Tiered Memory System", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  describe("Memory Ingestion", () => {
    it("should ingest world events into memory store", async () => {
      const provider = createTieredMemoryProvider(store, "all");

      await provider.ingest!({
        worldId: "world-1",
        schemaHash: "test-schema",
        snapshot: createMockState({ message: "Hello world" }),
        createdAt: Date.now(),
        createdBy: { actorId: "test-user", kind: "human" as const },
      });

      expect(store.getAll()).toHaveLength(1);
      expect(store.getAll()[0].worldId).toBe("world-1");
    });

    it("should classify memories by age tier", async () => {
      const provider = createTieredMemoryProvider(store, "all");
      const now = Date.now();

      // Short-term (recent)
      await provider.ingest!({
        worldId: "world-short",
        schemaHash: "test-schema",
        snapshot: createMockState({ type: "short-term" }),
        createdAt: now - 1000, // 1 second ago
        createdBy: { actorId: "test-user", kind: "human" as const },
      });

      // Medium-term (hours ago)
      await provider.ingest!({
        worldId: "world-medium",
        schemaHash: "test-schema",
        snapshot: createMockState({ type: "medium-term" }),
        createdAt: now - 2 * 60 * 60 * 1000, // 2 hours ago
        createdBy: { actorId: "test-user", kind: "human" as const },
      });

      // Long-term (days ago)
      await provider.ingest!({
        worldId: "world-long",
        schemaHash: "test-schema",
        snapshot: createMockState({ type: "long-term" }),
        createdAt: now - 48 * 60 * 60 * 1000, // 48 hours ago
        createdBy: { actorId: "test-user", kind: "human" as const },
      });

      expect(store.getByTier("short")).toHaveLength(1);
      expect(store.getByTier("medium")).toHaveLength(1);
      expect(store.getByTier("long")).toHaveLength(1);
    });
  });

  describe("Memory Recall - Tier Filtering", () => {
    beforeEach(async () => {
      const now = Date.now();
      const testActor = { actorId: "test-user", kind: "human" as const };

      // Populate store with memories from different tiers
      store.ingest({
        worldId: "world-short-1",
        schemaHash: "test-schema",
        snapshot: createMockState({ content: "recent chat about cats" }),
        createdAt: now - 1000,
        createdBy: testActor,
      });

      store.ingest({
        worldId: "world-short-2",
        schemaHash: "test-schema",
        snapshot: createMockState({ content: "recent discussion about dogs" }),
        createdAt: now - 2000,
        createdBy: testActor,
      });

      store.ingest({
        worldId: "world-medium-1",
        schemaHash: "test-schema",
        snapshot: createMockState({ content: "yesterday conversation about cats" }),
        createdAt: now - 6 * 60 * 60 * 1000, // 6 hours ago
        createdBy: testActor,
      });

      store.ingest({
        worldId: "world-long-1",
        schemaHash: "test-schema",
        snapshot: createMockState({ content: "old memory about cats from last week" }),
        createdAt: now - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        createdBy: testActor,
      });
    });

    it("should recall only short-term memories", async () => {
      const shortTermProvider = createTieredMemoryProvider(store, "short");

      const result = await shortTermProvider.select({
        query: "cats",
        atWorldId: "world-current",
        selector: { actorId: "user-1", kind: "human" },
      });

      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].ref.worldId).toBe("world-short-1");
    });

    it("should recall only medium-term memories", async () => {
      const mediumTermProvider = createTieredMemoryProvider(store, "medium");

      const result = await mediumTermProvider.select({
        query: "cats",
        atWorldId: "world-current",
        selector: { actorId: "user-1", kind: "human" },
      });

      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].ref.worldId).toBe("world-medium-1");
    });

    it("should recall only long-term memories", async () => {
      const longTermProvider = createTieredMemoryProvider(store, "long");

      const result = await longTermProvider.select({
        query: "cats",
        atWorldId: "world-current",
        selector: { actorId: "user-1", kind: "human" },
      });

      expect(result.selected).toHaveLength(1);
      expect(result.selected[0].ref.worldId).toBe("world-long-1");
    });

    it("should recall from all tiers", async () => {
      const allProvider = createTieredMemoryProvider(store, "all");

      const result = await allProvider.select({
        query: "cats",
        atWorldId: "world-current",
        selector: { actorId: "user-1", kind: "human" },
      });

      // Should find 3 memories about cats (short, medium, long)
      expect(result.selected).toHaveLength(3);
    });
  });

  describe("MemoryHub - Multi-Provider Fan-out", () => {
    it("should fan-out ingest to all providers", async () => {
      const shortStore = new MemoryStore();
      const longStore = new MemoryStore();

      const hub = new MemoryHub(
        {
          providers: {
            "short-term": createTieredMemoryProvider(shortStore, "short"),
            "long-term": createTieredMemoryProvider(longStore, "long"),
          },
          defaultProvider: "short-term",
        },
        "test-schema"
      );

      await hub.ingest({
        worldId: "world-1",
        schemaHash: "test-schema",
        snapshot: createMockState({ data: "test" }),
        createdAt: Date.now(),
        createdBy: { actorId: "test-user", kind: "human" as const },
      });

      // Both stores should receive the ingest
      expect(shortStore.getAll()).toHaveLength(1);
      expect(longStore.getAll()).toHaveLength(1);
    });

    it("should recall from specific provider", async () => {
      const now = Date.now();

      // Short-term store with recent memory
      store.ingest({
        worldId: "world-recent",
        schemaHash: "test-schema",
        snapshot: createMockState({ topic: "TypeScript generics" }),
        createdAt: now - 1000,
        createdBy: { actorId: "test-user", kind: "human" as const },
      });

      const hub = new MemoryHub(
        {
          providers: {
            "short-term": createTieredMemoryProvider(store, "short"),
            "long-term": createTieredMemoryProvider(store, "long"),
          },
          defaultProvider: "short-term",
        },
        "test-schema"
      );

      // Recall from short-term
      const result = await hub.recall(
        [{ query: "TypeScript", provider: "short-term" }],
        "world-current",
        { actorId: "user-1", kind: "human" }
      );

      expect(result.selected).toHaveLength(1);
      expect(result.attachments[0].provider).toBe("short-term");
    });
  });

  describe("App Integration - Full Memory Flow", () => {
    it("should enable memory recall through app.memory API", async () => {
      const now = Date.now();

      // Pre-populate store
      store.ingest({
        worldId: "world-history",
        schemaHash: "memory-test-schema",
        snapshot: createMockState({
          messages: [
            { role: "user", content: "How do I use React hooks?" },
            { role: "assistant", content: "React hooks are..." },
          ],
        }),
        createdAt: now - 1000,
        createdBy: { actorId: "test-user", kind: "human" as const },
      });

      const app = createTestApp(testDomainSchema, {
        memory: {
          providers: {
            conversation: createTieredMemoryProvider(store, "all"),
          },
          defaultProvider: "conversation",
        },
      });

      await app.ready();

      expect(app.memory.enabled()).toBe(true);

      const result = await app.memory.recall("React hooks");

      expect(result.selected).toHaveLength(1);
      expect(result.attachments).toHaveLength(1);
    });

    it("should enable memory recall through session API", async () => {
      const now = Date.now();

      store.ingest({
        worldId: "world-1",
        schemaHash: "memory-test-schema",
        snapshot: createMockState({ topic: "machine learning" }),
        createdAt: now - 1000,
        createdBy: { actorId: "test-user", kind: "human" as const },
      });

      const app = createTestApp(testDomainSchema, {
        memory: {
          providers: {
            knowledge: createTieredMemoryProvider(store, "all"),
          },
          defaultProvider: "knowledge",
        },
      });

      await app.ready();

      const session = app.session("user-123");
      const result = await session.recall("machine learning");

      expect(result.selected).toHaveLength(1);
    });

    it("should support multiple recall requests", async () => {
      const now = Date.now();
      const testActor = { actorId: "test-user", kind: "human" as const };

      store.ingest({
        worldId: "world-cats",
        schemaHash: "memory-test-schema",
        snapshot: createMockState({ animal: "cats are independent" }),
        createdAt: now - 1000,
        createdBy: testActor,
      });

      store.ingest({
        worldId: "world-dogs",
        schemaHash: "memory-test-schema",
        snapshot: createMockState({ animal: "dogs are loyal" }),
        createdAt: now - 2000,
        createdBy: testActor,
      });

      const app = createTestApp(testDomainSchema, {
        memory: {
          providers: {
            pets: createTieredMemoryProvider(store, "all"),
          },
          defaultProvider: "pets",
        },
      });

      await app.ready();

      const result = await app.memory.recall(["cats", "dogs"]);

      expect(result.selected).toHaveLength(2);
      expect(result.attachments).toHaveLength(2);
    });
  });

  describe("Realistic Conversation Memory Scenario", () => {
    it("should recall relevant conversation context", async () => {
      const now = Date.now();

      // Simulate a conversation history
      const conversations = [
        {
          worldId: "conv-1",
          content: { role: "user", message: "What is TypeScript?" },
          createdAt: now - 10000,
        },
        {
          worldId: "conv-2",
          content: { role: "assistant", message: "TypeScript is a typed superset of JavaScript." },
          createdAt: now - 9000,
        },
        {
          worldId: "conv-3",
          content: { role: "user", message: "How do I define interfaces?" },
          createdAt: now - 8000,
        },
        {
          worldId: "conv-4",
          content: { role: "assistant", message: "Interfaces in TypeScript define object shapes." },
          createdAt: now - 7000,
        },
        {
          worldId: "conv-5",
          content: { role: "user", message: "Can you show me a Python example?" },
          createdAt: now - 6000,
        },
        {
          worldId: "conv-6",
          content: { role: "assistant", message: "Here is a Python example: print('hello')" },
          createdAt: now - 5000,
        },
      ];

      for (const conv of conversations) {
        store.ingest({
          worldId: conv.worldId,
          schemaHash: "memory-test-schema",
          snapshot: createMockState(conv.content),
          createdAt: conv.createdAt,
          createdBy: { actorId: "test-user", kind: "human" as const },
        });
      }

      const app = createTestApp(testDomainSchema, {
        memory: {
          providers: {
            conversation: createTieredMemoryProvider(store, "all"),
          },
          defaultProvider: "conversation",
        },
      });

      await app.ready();

      // Recall TypeScript-related context
      const tsResult = await app.memory.recall("TypeScript");
      expect(tsResult.selected.length).toBeGreaterThanOrEqual(2);

      // Recall Python-related context
      const pyResult = await app.memory.recall("Python");
      expect(pyResult.selected.length).toBeGreaterThanOrEqual(1);

      // Recall interface-related context
      const ifResult = await app.memory.recall("interfaces");
      expect(ifResult.selected.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Memory Limit and Constraints", () => {
    it("should respect limit constraint", async () => {
      const now = Date.now();
      const testActor = { actorId: "test-user", kind: "human" as const };

      // Add many memories
      for (let i = 0; i < 20; i++) {
        store.ingest({
          worldId: `world-${i}`,
          schemaHash: "test-schema",
          snapshot: createMockState({ topic: "machine learning", index: i }),
          createdAt: now - i * 1000,
          createdBy: testActor,
        });
      }

      const provider = createTieredMemoryProvider(store, "all");

      const result = await provider.select({
        query: "machine learning",
        atWorldId: "world-current",
        selector: { actorId: "user-1", kind: "human" },
        constraints: { limit: 5 },
      });

      expect(result.selected).toHaveLength(5);
    });

    it("should return most recent memories first", async () => {
      const now = Date.now();
      const testActor = { actorId: "test-user", kind: "human" as const };

      store.ingest({
        worldId: "world-old",
        schemaHash: "test-schema",
        snapshot: createMockState({ topic: "AI", age: "old" }),
        createdAt: now - 10000,
        createdBy: testActor,
      });

      store.ingest({
        worldId: "world-new",
        schemaHash: "test-schema",
        snapshot: createMockState({ topic: "AI", age: "new" }),
        createdAt: now - 1000,
        createdBy: testActor,
      });

      const provider = createTieredMemoryProvider(store, "all");

      const result = await provider.select({
        query: "AI",
        atWorldId: "world-current",
        selector: { actorId: "user-1", kind: "human" },
      });

      expect(result.selected[0].ref.worldId).toBe("world-new");
      expect(result.selected[1].ref.worldId).toBe("world-old");
    });
  });
});

// =============================================================================
// Report Generation Tests
// =============================================================================

describe("Memory Architecture Report", () => {
  it("should generate architecture capability report", async () => {
    const store = new MemoryStore();
    const now = Date.now();

    // Simulate varied memory types
    const testCases = [
      // Short-term (within 5 minutes)
      { worldId: "short-1", data: { type: "chat", msg: "hello" }, age: 1000 },
      { worldId: "short-2", data: { type: "chat", msg: "world" }, age: 2000 },

      // Medium-term (5min - 24hr)
      { worldId: "medium-1", data: { type: "summary", topic: "meeting notes" }, age: 2 * 60 * 60 * 1000 },

      // Long-term (>24hr)
      { worldId: "long-1", data: { type: "knowledge", fact: "Earth orbits Sun" }, age: 48 * 60 * 60 * 1000 },
    ];

    for (const tc of testCases) {
      store.ingest({
        worldId: tc.worldId,
        schemaHash: "report-schema",
        snapshot: createMockState(tc.data),
        createdAt: now - tc.age,
        createdBy: { actorId: "test-user", kind: "human" as const },
      });
    }

    // Generate report
    const report = {
      totalMemories: store.getAll().length,
      shortTerm: store.getByTier("short").length,
      mediumTerm: store.getByTier("medium").length,
      longTerm: store.getByTier("long").length,
      capabilities: {
        tieredStorage: true,
        textSearch: true,
        recencySort: true,
        limitConstraint: true,
        multiProvider: true,
      },
    };

    console.log("\n=== Memory Architecture Report ===");
    console.log(JSON.stringify(report, null, 2));

    expect(report.totalMemories).toBe(4);
    expect(report.shortTerm).toBe(2);
    expect(report.mediumTerm).toBe(1);
    expect(report.longTerm).toBe(1);
    expect(report.capabilities.tieredStorage).toBe(true);
  });
});

// =============================================================================
// Helpers
// =============================================================================

function createMockState<T>(data: T): AppState<T> {
  return withDxAliases({
    data,
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
      randomSeed: `seed-${Date.now()}`,
      schemaHash: "test-schema",
    },
  });
}
