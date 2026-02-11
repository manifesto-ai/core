/**
 * Branch Persistence Tests
 *
 * @see World SPEC v2.0.5 §4.3 BRANCH-PERSIST-1~5
 */

import { describe, it, expect } from "vitest";
import { createTestApp, createInMemoryWorldStore } from "@manifesto-ai/app";
import type { DomainSchema } from "@manifesto-ai/core";
import type { PersistedBranchState } from "@manifesto-ai/shared";

const mockDomainSchema: DomainSchema = {
  id: "test:branch-persist",
  version: "1.0.0",
  hash: "test-schema-hash",
  types: {},
  actions: {
    "test.action": {
      flow: { kind: "seq", steps: [] },
    },
  },
  computed: { fields: {} },
  state: { fields: {} },
};

describe("Branch Persistence (SPEC v2.0.5)", () => {
  describe("InMemoryWorldStore.saveBranchState/loadBranchState", () => {
    it("should save and load branch state", async () => {
      const store = createInMemoryWorldStore();

      const state: PersistedBranchState = {
        branches: [
          {
            id: "main",
            name: "main",
            head: "world_abc",
            schemaHash: "hash_abc",
            createdAt: 1700000000000,
            lineage: ["world_genesis", "world_abc"],
          },
        ],
        activeBranchId: "main",
      };

      await store.saveBranchState(state);
      const loaded = await store.loadBranchState();

      expect(loaded).toEqual(state);
    });

    it("should return null when no state saved", async () => {
      const store = createInMemoryWorldStore();

      const loaded = await store.loadBranchState();

      expect(loaded).toBeNull();
    });

    it("should overwrite previous state on save", async () => {
      const store = createInMemoryWorldStore();

      const state1: PersistedBranchState = {
        branches: [{ id: "main", name: "main", head: "w1", schemaHash: "h1", createdAt: 1, lineage: ["w1"] }],
        activeBranchId: "main",
      };

      const state2: PersistedBranchState = {
        branches: [{ id: "main", name: "main", head: "w2", schemaHash: "h1", createdAt: 2, lineage: ["w1", "w2"] }],
        activeBranchId: "main",
      };

      await store.saveBranchState(state1);
      await store.saveBranchState(state2);
      const loaded = await store.loadBranchState();

      expect(loaded).toEqual(state2);
    });
  });

  describe("BRANCH-PERSIST-4: Auto-save after action", () => {
    it("should persist branch state after successful action", async () => {
      const worldStore = createInMemoryWorldStore();
      const app = createTestApp(mockDomainSchema, {
        world: { store: worldStore },
      });
      await app.ready();

      // Before action, state might not be saved yet (genesis)
      const handle = app.act("test.action", {});
      await handle.done();

      const savedState = await worldStore.loadBranchState();

      expect(savedState).not.toBeNull();
      expect(savedState!.activeBranchId).toBe("main");
      expect(savedState!.branches.length).toBe(1);
      expect(savedState!.branches[0].id).toBe("main");
      expect(savedState!.branches[0].name).toBe("main");
    });

    it("should persist 2 branches after fork and action", async () => {
      const worldStore = createInMemoryWorldStore();
      const app = createTestApp(mockDomainSchema, {
        world: { store: worldStore },
      });
      await app.ready();

      // Execute action on main
      const handle1 = app.act("test.action", {});
      await handle1.done();

      // Fork to experiment
      await app.fork({ name: "experiment" });

      // Execute action on experiment
      const handle2 = app.act("test.action", {});
      await handle2.done();

      const savedState = await worldStore.loadBranchState();

      expect(savedState).not.toBeNull();
      expect(savedState!.branches.length).toBe(2);

      const branchIds = savedState!.branches.map((b) => b.id);
      expect(branchIds).toContain("main");
    });
  });
});
