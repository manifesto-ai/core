/**
 * Branch Management Tests
 *
 * @see SPEC §9 Branch Management
 */

import { describe, it, expect, vi } from "vitest";
import { createApp } from "../index.js";
import {
  AppNotReadyError,
  BranchNotFoundError,
  WorldNotInLineageError,
  ForkMigrationError,
} from "../errors/index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type { Branch } from "../types/index.js";

// Mock DomainSchema
const mockDomainSchema: DomainSchema = {
  schemaHash: "test-schema-hash",
  actions: {
    "todo.add": {
      type: "todo.add",
      inputSchema: {},
      outputSchema: {},
      flow: { kind: "noop" },
    },
  },
  computed: {},
  state: {},
  effects: {},
  flows: {},
};

describe("Branch Management", () => {
  describe("currentBranch()", () => {
    it("should return main branch after ready()", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();

      expect(branch).toBeDefined();
      expect(branch.id).toBe("main");
      expect(branch.name).toBe("main");
      expect(branch.schemaHash).toBe("test-schema-hash");
    });

    it("should throw AppNotReadyError before ready()", () => {
      const app = createApp(mockDomainSchema);

      expect(() => app.currentBranch()).toThrow(AppNotReadyError);
    });

    it("should have a valid head() worldId", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();
      const headId = branch.head();

      expect(headId).toBeDefined();
      expect(typeof headId).toBe("string");
      expect(headId).toMatch(/^world_/);
    });
  });

  describe("listBranches()", () => {
    it("should return array with main branch initially", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branches = app.listBranches();

      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBe(1);
      expect(branches[0].id).toBe("main");
    });

    it("should throw AppNotReadyError before ready()", () => {
      const app = createApp(mockDomainSchema);

      expect(() => app.listBranches()).toThrow(AppNotReadyError);
    });
  });

  describe("fork()", () => {
    it("should create a new branch", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const newBranch = await app.fork();

      expect(newBranch).toBeDefined();
      expect(newBranch.id).toMatch(/^branch_/);
      expect(newBranch.schemaHash).toBe("test-schema-hash");
    });

    it("should add new branch to listBranches()", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await app.fork();
      const branches = app.listBranches();

      expect(branches.length).toBe(2);
    });

    it("should switch to new branch by default", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const newBranch = await app.fork();
      const currentBranch = app.currentBranch();

      expect(currentBranch.id).toBe(newBranch.id);
    });

    it("should not switch when switchTo is false", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const mainBranch = app.currentBranch();
      await app.fork({ switchTo: false });
      const currentBranch = app.currentBranch();

      expect(currentBranch.id).toBe(mainBranch.id);
    });

    it("should accept custom name", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const newBranch = await app.fork({ name: "feature-branch" });

      expect(newBranch.name).toBe("feature-branch");
    });

    it("should throw AppNotReadyError before ready()", async () => {
      const app = createApp(mockDomainSchema);

      await expect(app.fork()).rejects.toThrow(AppNotReadyError);
    });
  });

  describe("switchBranch()", () => {
    it("should switch to an existing branch", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      // Create a new branch but don't switch
      const newBranch = await app.fork({ switchTo: false });

      // Should still be on main
      expect(app.currentBranch().id).toBe("main");

      // Switch to new branch
      const switched = await app.switchBranch(newBranch.id);

      expect(switched.id).toBe(newBranch.id);
      expect(app.currentBranch().id).toBe(newBranch.id);
    });

    it("should throw BranchNotFoundError for unknown branch", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      await expect(app.switchBranch("unknown-branch")).rejects.toThrow(
        BranchNotFoundError
      );
    });

    it("should throw AppNotReadyError before ready()", async () => {
      const app = createApp(mockDomainSchema);

      await expect(app.switchBranch("main")).rejects.toThrow(AppNotReadyError);
    });
  });

  describe("Branch.head()", () => {
    it("should return current head worldId", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();
      const head = branch.head();

      expect(head).toBeDefined();
      expect(typeof head).toBe("string");
    });
  });

  describe("Branch.checkout()", () => {
    it("should checkout to a world in lineage", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();
      const initialHead = branch.head();

      // Checkout to the same world (genesis)
      await branch.checkout(initialHead);

      expect(branch.head()).toBe(initialHead);
    });

    it("should throw WorldNotInLineageError for unknown worldId", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();

      await expect(branch.checkout("unknown-world")).rejects.toThrow(
        WorldNotInLineageError
      );
    });
  });

  describe("Branch.lineage()", () => {
    it("should return array of worldIds", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();
      const lineage = branch.lineage();

      expect(Array.isArray(lineage)).toBe(true);
      expect(lineage.length).toBeGreaterThanOrEqual(1);
      expect(lineage[0]).toMatch(/^world_/);
    });

    it("should include head in lineage", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();
      const head = branch.head();
      const lineage = branch.lineage();

      expect(lineage).toContain(head);
    });

    it("should respect limit option", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();
      const lineage = branch.lineage({ limit: 1 });

      expect(lineage.length).toBeLessThanOrEqual(1);
    });
  });

  describe("Branch.act()", () => {
    it("should execute action on the branch", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch = app.currentBranch();
      const handle = branch.act("todo.add", { text: "Test" });

      expect(handle).toBeDefined();
      expect(handle.proposalId).toBeDefined();

      const result = await handle.done();
      expect(result.status).toBe("completed");
    });
  });

  describe("Branch.getState()", () => {
    it("should return state for the branch", async () => {
      const app = createApp(mockDomainSchema, {
        initialData: { todos: [] },
      });
      await app.ready();

      const branch = app.currentBranch();
      const state = branch.getState<{ todos: unknown[] }>();

      expect(state).toBeDefined();
      expect(state.data.todos).toEqual([]);
    });
  });

  describe("Branch.fork()", () => {
    it("should fork from current branch", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const mainBranch = app.currentBranch();
      const forkedBranch = await mainBranch.fork();

      expect(forkedBranch).toBeDefined();
      expect(forkedBranch.id).not.toBe(mainBranch.id);
    });
  });

  describe("Multiple branches workflow", () => {
    it("should handle multiple forks", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const branch1 = await app.fork({ name: "feature-1", switchTo: false });
      const branch2 = await app.fork({ name: "feature-2", switchTo: false });
      const branch3 = await app.fork({ name: "feature-3", switchTo: false });

      const branches = app.listBranches();

      expect(branches.length).toBe(4); // main + 3 features
      expect(branches.map((b) => b.name)).toContain("main");
      expect(branches.map((b) => b.name)).toContain("feature-1");
      expect(branches.map((b) => b.name)).toContain("feature-2");
      expect(branches.map((b) => b.name)).toContain("feature-3");
    });

    it("should maintain separate branch contexts", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const mainBranch = app.currentBranch();
      const mainHead = mainBranch.head();

      const featureBranch = await app.fork({ name: "feature" });
      const featureHead = featureBranch.head();

      // Switch back to main
      await app.switchBranch("main");

      // Main should still have original head
      expect(app.currentBranch().head()).toBe(mainHead);

      // Switch to feature
      await app.switchBranch(featureBranch.id);
      expect(app.currentBranch().head()).toBe(featureHead);
    });
  });
});
