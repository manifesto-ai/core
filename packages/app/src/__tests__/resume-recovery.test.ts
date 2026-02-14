/**
 * Resume & Recovery Tests
 *
 * Tests for SPEC v2.0.5:
 * - RESUME: loadBranchState() consumption in AppBootstrap
 * - RESUME-SCHEMA: schemaHash mismatch detection
 * - BRANCH-RECOVER: head WorldId validation
 *
 * @see World SPEC v2.0.5 §5 Resume, §6.2 BRANCH-RECOVER
 */

import { describe, it, expect, vi } from "vitest";
import { createTestApp, createInMemoryWorldStore } from "../index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type { PersistedBranchState } from "../index.js";

const mockDomainSchema: DomainSchema = {
  id: "test:resume",
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

const mockDomainSchemaV2: DomainSchema = {
  id: "test:resume",
  version: "2.0.0",
  hash: "different-schema-hash",
  types: {},
  actions: {
    "test.action": {
      flow: { kind: "seq", steps: [] },
    },
  },
  computed: { fields: {} },
  state: { fields: {} },
};

describe("Resume from persisted state (SPEC v2.0.5)", () => {
  it("should resume branches from persisted state after restart", async () => {
    // Session 1: Create app, execute action, save state
    const worldStore = createInMemoryWorldStore();
    const app1 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app1.ready();

    const handle = app1.act("test.action", {});
    await handle.done();

    // Capture persisted state
    const savedState = await worldStore.loadBranchState();
    expect(savedState).not.toBeNull();
    expect(savedState!.branches.length).toBe(1);
    expect(savedState!.activeBranchId).toBe("main");

    const savedHead = savedState!.branches[0].head;

    // Session 2: Create new app with same worldStore — should resume
    const app2 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app2.ready();

    // The branch should exist and have the same persisted head's World in store
    const heads = await app2.getHeads!();
    expect(heads.length).toBeGreaterThanOrEqual(1);

    const mainHead = heads.find((h) => h.branchName === "main");
    expect(mainHead).toBeDefined();
  });

  it("should resume with multiple branches after fork", async () => {
    const worldStore = createInMemoryWorldStore();
    const app1 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app1.ready();

    // Execute action on main
    const handle1 = app1.act("test.action", {});
    await handle1.done();

    // Fork to experiment
    await app1.fork({ name: "experiment" });

    // Execute action on experiment
    const handle2 = app1.act("test.action", {});
    await handle2.done();

    const savedState = await worldStore.loadBranchState();
    expect(savedState!.branches.length).toBe(2);

    // Session 2: Resume
    const app2 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app2.ready();

    const heads = await app2.getHeads!();
    expect(heads.length).toBe(2);

    const branchNames = heads.map((h) => h.branchName);
    expect(branchNames).toContain("main");
    expect(branchNames).toContain("experiment");
  });

  it("should resume active branch from persisted state", async () => {
    const worldStore = createInMemoryWorldStore();
    const app1 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app1.ready();

    const handle = app1.act("test.action", {});
    await handle.done();

    // Fork and switch to experiment
    await app1.fork({ name: "experiment", switchTo: true });

    const handle2 = app1.act("test.action", {});
    await handle2.done();

    const savedState = await worldStore.loadBranchState();
    // Active branch should NOT be "main" — it was switched
    expect(savedState!.activeBranchId).not.toBe("main");

    // Session 2: Resume — active branch should be experiment
    const app2 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app2.ready();

    const currentBranch = app2.currentBranch();
    expect(currentBranch.name).toBe("experiment");
  });
});

describe("RESUME-SCHEMA: schemaHash mismatch detection", () => {
  it("should fall back to fresh start on schema mismatch", async () => {
    const worldStore = createInMemoryWorldStore();

    // Session 1: Schema v1
    const app1 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app1.ready();

    const handle = app1.act("test.action", {});
    await handle.done();

    const savedState = await worldStore.loadBranchState();
    expect(savedState).not.toBeNull();
    expect(savedState!.branches[0].schemaHash).toBe("test-schema-hash");

    // Session 2: Schema v2 (different hash) — should warn and fresh start
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const app2 = createTestApp(mockDomainSchemaV2, {
      world: { store: worldStore },
    });
    await app2.ready();

    // Should have logged a warning about schema mismatch
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Schema mismatch on resume")
    );

    // Should have a fresh main branch (not the persisted one)
    const heads = await app2.getHeads!();
    expect(heads.length).toBe(1);
    expect(heads[0].branchName).toBe("main");
    expect(heads[0].schemaHash).toBe("different-schema-hash");

    warnSpy.mockRestore();
  });
});

describe("BRANCH-RECOVER: head WorldId validation", () => {
  it("should exclude branches with invalid head WorldIds", async () => {
    const worldStore = createInMemoryWorldStore();

    // Session 1: Normal operation
    const app1 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app1.ready();

    const handle = app1.act("test.action", {});
    await handle.done();

    // Manually corrupt the persisted state — inject a branch with invalid head
    const savedState = await worldStore.loadBranchState();
    expect(savedState).not.toBeNull();

    const corruptedState: PersistedBranchState = {
      branches: [
        ...savedState!.branches,
        {
          id: "corrupt-branch",
          name: "corrupt",
          head: "world_nonexistent_12345",
          schemaHash: "test-schema-hash",
          createdAt: Date.now(),
          lineage: ["world_nonexistent_12345"],
        },
      ],
      activeBranchId: savedState!.activeBranchId,
    };

    await worldStore.saveBranchState!(corruptedState);

    // Session 2: Resume — should exclude corrupt branch
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const app2 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app2.ready();

    // Should have warned about invalid head
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("not found in WorldStore")
    );

    // Should only have valid branches
    const heads = await app2.getHeads!();
    const branchNames = heads.map((h) => h.branchName);
    expect(branchNames).not.toContain("corrupt");
    expect(branchNames).toContain("main");

    warnSpy.mockRestore();
  });

  it("should fresh start when all persisted branches have invalid heads", async () => {
    const worldStore = createInMemoryWorldStore();

    // Session 1: Set up a valid app to get worldStore initialized
    const app1 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app1.ready();

    // Manually set all-invalid persisted state
    const corruptedState: PersistedBranchState = {
      branches: [
        {
          id: "bad-main",
          name: "main",
          head: "world_dead_001",
          schemaHash: "test-schema-hash",
          createdAt: Date.now(),
          lineage: ["world_dead_001"],
        },
      ],
      activeBranchId: "bad-main",
    };

    await worldStore.saveBranchState!(corruptedState);

    // Session 2: Resume — should fall back to fresh start
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const app2 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app2.ready();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("All persisted branch heads are invalid")
    );

    // Should have a fresh main branch
    const heads = await app2.getHeads!();
    expect(heads.length).toBe(1);
    expect(heads[0].branchName).toBe("main");

    warnSpy.mockRestore();
  });
});

describe("BranchManager.fromPersistedState()", () => {
  it("should restore branches with correct lineage", async () => {
    const worldStore = createInMemoryWorldStore();
    const app1 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app1.ready();

    // Execute multiple actions to build lineage
    const h1 = app1.act("test.action", {});
    await h1.done();
    const h2 = app1.act("test.action", {});
    await h2.done();

    const savedState = await worldStore.loadBranchState();
    expect(savedState).not.toBeNull();
    expect(savedState!.branches[0].lineage.length).toBeGreaterThanOrEqual(2);

    // Session 2: Resume
    const app2 = createTestApp(mockDomainSchema, {
      world: { store: worldStore },
    });
    await app2.ready();

    // Branch should still have lineage
    const branch = app2.currentBranch();
    const lineage = branch.lineage();
    expect(lineage.length).toBeGreaterThanOrEqual(1);
  });
});
