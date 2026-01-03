import { describe, it, expect, beforeEach } from "vitest";
import { MemorySnapshotStore, createMemoryStore } from "./memory.js";
import type { Snapshot } from "@manifesto-ai/core";

// Helper to create a test snapshot
function createTestSnapshot(version: number, data: unknown = {}): Snapshot {
  return {
    data,
    system: {
      status: "idle",
      pendingRequirements: [],
      lastError: null,
      errors: [],
      currentAction: null,
    },
    meta: {
      version,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "test-hash",
    },
    computed: {},
    input: undefined,
  };
}

describe("MemorySnapshotStore", () => {
  let store: MemorySnapshotStore;

  beforeEach(() => {
    store = new MemorySnapshotStore();
  });

  describe("get", () => {
    it("should return null for empty store", async () => {
      const result = await store.get();
      expect(result).toBeNull();
    });

    it("should return latest snapshot", async () => {
      await store.save(createTestSnapshot(1, { value: 1 }));
      await store.save(createTestSnapshot(2, { value: 2 }));

      const result = await store.get();
      expect(result?.data).toEqual({ value: 2 });
      expect(result?.meta.version).toBe(2);
    });
  });

  describe("save", () => {
    it("should save a snapshot", async () => {
      const snapshot = createTestSnapshot(1, { key: "value" });
      await store.save(snapshot);

      const result = await store.get();
      expect(result?.data).toEqual({ key: "value" });
    });

    it("should deep clone saved snapshot", async () => {
      const snapshot = createTestSnapshot(1, { nested: { value: "original" } });
      await store.save(snapshot);

      // Modify original
      (snapshot.data as any).nested.value = "modified";

      const result = await store.get();
      expect((result?.data as any).nested.value).toBe("original");
    });

    it("should throw for non-increasing version", async () => {
      await store.save(createTestSnapshot(5));

      await expect(store.save(createTestSnapshot(3))).rejects.toThrow(
        /Cannot save snapshot with version 3/
      );

      await expect(store.save(createTestSnapshot(5))).rejects.toThrow(
        /Cannot save snapshot with version 5/
      );
    });

    it("should require strictly increasing versions", async () => {
      await store.save(createTestSnapshot(1));
      await store.save(createTestSnapshot(2));
      await store.save(createTestSnapshot(3));

      const latest = await store.get();
      expect(latest?.meta.version).toBe(3);
    });

    it("should allow gaps in versions", async () => {
      await store.save(createTestSnapshot(1));
      await store.save(createTestSnapshot(10));
      await store.save(createTestSnapshot(100));

      expect(await store.getLatestVersion()).toBe(100);
    });
  });

  describe("getVersion", () => {
    it("should return null for non-existent version", async () => {
      const result = await store.getVersion(999);
      expect(result).toBeNull();
    });

    it("should return snapshot at specific version", async () => {
      await store.save(createTestSnapshot(1, { v: 1 }));
      await store.save(createTestSnapshot(2, { v: 2 }));
      await store.save(createTestSnapshot(3, { v: 3 }));

      const v1 = await store.getVersion(1);
      const v2 = await store.getVersion(2);
      const v3 = await store.getVersion(3);

      expect(v1?.data).toEqual({ v: 1 });
      expect(v2?.data).toEqual({ v: 2 });
      expect(v3?.data).toEqual({ v: 3 });
    });

    it("should return null for version in gap", async () => {
      await store.save(createTestSnapshot(1));
      await store.save(createTestSnapshot(10));

      const v5 = await store.getVersion(5);
      expect(v5).toBeNull();
    });
  });

  describe("getLatestVersion", () => {
    it("should return -1 for empty store", async () => {
      const version = await store.getLatestVersion();
      expect(version).toBe(-1);
    });

    it("should return latest version number", async () => {
      await store.save(createTestSnapshot(5));
      expect(await store.getLatestVersion()).toBe(5);

      await store.save(createTestSnapshot(10));
      expect(await store.getLatestVersion()).toBe(10);
    });
  });

  describe("clear", () => {
    it("should remove all snapshots", async () => {
      await store.save(createTestSnapshot(1));
      await store.save(createTestSnapshot(2));
      await store.save(createTestSnapshot(3));

      await store.clear();

      expect(await store.get()).toBeNull();
      expect(await store.getLatestVersion()).toBe(-1);
      expect(await store.count()).toBe(0);
    });

    it("should allow new snapshots after clear", async () => {
      await store.save(createTestSnapshot(100));
      await store.clear();

      // Can now start from version 1 again
      await store.save(createTestSnapshot(1));
      expect(await store.getLatestVersion()).toBe(1);
    });
  });

  describe("getVersionRange", () => {
    beforeEach(async () => {
      await store.save(createTestSnapshot(1, { v: 1 }));
      await store.save(createTestSnapshot(2, { v: 2 }));
      await store.save(createTestSnapshot(3, { v: 3 }));
      await store.save(createTestSnapshot(5, { v: 5 })); // Gap at 4
      await store.save(createTestSnapshot(6, { v: 6 }));
    });

    it("should return snapshots in range", async () => {
      const range = await store.getVersionRange(2, 5);

      expect(range).toHaveLength(3); // 2, 3, 5 (4 is missing)
      expect(range[0]?.data).toEqual({ v: 2 });
      expect(range[1]?.data).toEqual({ v: 3 });
      expect(range[2]?.data).toEqual({ v: 5 });
    });

    it("should return empty array for range with no snapshots", async () => {
      const range = await store.getVersionRange(100, 200);
      expect(range).toEqual([]);
    });

    it("should return single snapshot for single-version range", async () => {
      const range = await store.getVersionRange(3, 3);
      expect(range).toHaveLength(1);
      expect(range[0]?.data).toEqual({ v: 3 });
    });

    it("should return all snapshots for full range", async () => {
      const range = await store.getVersionRange(1, 6);
      expect(range).toHaveLength(5); // All snapshots
    });

    it("should skip missing versions in range", async () => {
      const range = await store.getVersionRange(3, 6);
      expect(range).toHaveLength(3); // 3, 5, 6 (4 is missing)

      const versions = range.map((s) => s.meta.version);
      expect(versions).toEqual([3, 5, 6]);
    });
  });

  describe("count", () => {
    it("should return 0 for empty store", async () => {
      expect(await store.count()).toBe(0);
    });

    it("should return correct count", async () => {
      await store.save(createTestSnapshot(1));
      expect(await store.count()).toBe(1);

      await store.save(createTestSnapshot(2));
      expect(await store.count()).toBe(2);

      await store.save(createTestSnapshot(3));
      expect(await store.count()).toBe(3);
    });
  });

  describe("immutability", () => {
    it("should not expose internal storage", async () => {
      await store.save(createTestSnapshot(1, { value: "original" }));

      const result1 = await store.get();
      if (result1) {
        (result1.data as any).value = "modified";
      }

      const result2 = await store.get();
      expect((result2?.data as any).value).toBe("original");
    });
  });
});

describe("createMemoryStore", () => {
  it("should create a new MemorySnapshotStore instance", () => {
    const store = createMemoryStore();
    expect(store).toBeInstanceOf(MemorySnapshotStore);
  });

  it("should create independent instances", async () => {
    const store1 = createMemoryStore();
    const store2 = createMemoryStore();

    await store1.save(createTestSnapshot(1, { from: "store1" }));

    expect(await store1.get()).not.toBeNull();
    expect(await store2.get()).toBeNull();
  });
});
