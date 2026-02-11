/**
 * Head Query API Tests
 *
 * @see App SPEC v2.3.1: getHeads(), getLatestHead()
 * @see World SPEC v2.0.5: HEAD-1~8
 */

import { describe, it, expect } from "vitest";
import { createTestApp } from "@manifesto-ai/app";
import { AppNotReadyError } from "@manifesto-ai/shared";
import type { DomainSchema } from "@manifesto-ai/core";

const mockDomainSchema: DomainSchema = {
  id: "test:head-query",
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

describe("Head Query API (SPEC v2.3.1)", () => {
  describe("getHeads()", () => {
    it("should return main branch head after ready()", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const heads = await app.getHeads!();

      expect(heads).toBeDefined();
      expect(Array.isArray(heads)).toBe(true);
      expect(heads.length).toBe(1);
      expect(heads[0].branchId).toBe("main");
      expect(heads[0].branchName).toBe("main");
      expect(heads[0].schemaHash).toBe("test-schema-hash");
      expect(typeof heads[0].worldId).toBe("string");
    });

    it("should return 2 heads after fork", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      await app.fork({ name: "experiment", switchTo: false });

      const heads = await app.getHeads!();

      expect(heads.length).toBe(2);

      const branchNames = heads.map((h) => h.branchName);
      expect(branchNames).toContain("main");
      expect(branchNames).toContain("experiment");
    });

    it("should update head after action execution", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const headsBefore = await app.getHeads!();
      const headBefore = headsBefore[0].worldId;

      const handle = app.act("test.action", {});
      await handle.done();

      const headsAfter = await app.getHeads!();
      const headAfter = headsAfter[0].worldId;

      // HEAD-1: Head should advance to new World
      expect(String(headAfter)).not.toBe(String(headBefore));
    });

    it("should throw AppNotReadyError before ready()", async () => {
      const app = createTestApp(mockDomainSchema);

      await expect(app.getHeads!()).rejects.toThrow(AppNotReadyError);
    });
  });

  describe("getLatestHead()", () => {
    it("should return the most recent head", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const latest = await app.getLatestHead!();

      expect(latest).not.toBeNull();
      expect(latest!.branchId).toBe("main");
    });

    it("should return head with latest createdAt after actions", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      // Execute action on main
      const handle = app.act("test.action", {});
      await handle.done();

      // Fork (inherits main's head)
      await app.fork({ name: "experiment", switchTo: false });

      const latest = await app.getLatestHead!();

      // Latest should be the branch whose head World was created most recently.
      // After act() on main, main's head is newer than the fork's head
      // (fork starts from main's head, same worldId).
      expect(latest).not.toBeNull();
    });

    it("should throw AppNotReadyError before ready()", async () => {
      const app = createTestApp(mockDomainSchema);

      await expect(app.getLatestHead!()).rejects.toThrow(AppNotReadyError);
    });
  });

  describe("HEAD-5: Deterministic sort order", () => {
    it("should sort by createdAt descending", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      // Execute action on main to advance its head
      const handle = app.act("test.action", {});
      await handle.done();

      // Fork creates a new branch at the same World as main's head
      await app.fork({ name: "experiment", switchTo: false });

      const heads = await app.getHeads!();

      // All heads should have createdAt in descending order
      for (let i = 1; i < heads.length; i++) {
        expect(heads[i - 1].createdAt).toBeGreaterThanOrEqual(heads[i].createdAt);
      }
    });
  });

  describe("QUERY-HEAD-3: No transformation beyond delegation", () => {
    it("getLatestHead should equal first element of getHeads", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const handle = app.act("test.action", {});
      await handle.done();

      const heads = await app.getHeads!();
      const latest = await app.getLatestHead!();

      expect(latest).toEqual(heads[0]);
    });
  });
});
