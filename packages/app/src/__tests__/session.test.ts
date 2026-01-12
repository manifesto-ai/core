/**
 * Session Management Tests
 *
 * @see SPEC §10 Session Management
 */

import { describe, it, expect, vi } from "vitest";
import { createApp } from "../index.js";
import {
  AppNotReadyError,
  AppDisposedError,
  MemoryDisabledError,
} from "../errors/index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type { Session } from "../types/index.js";

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
    "todo.remove": {
      flow: { kind: "seq", steps: [] },
    },
  },
  computed: { fields: {} },
  state: { fields: {} },
};

describe("Session Management", () => {
  describe("app.session()", () => {
    it("should create a session with actorId", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session = app.session("user-123");

      expect(session).toBeDefined();
      expect(session.actorId).toBe("user-123");
    });

    it("should use current branch by default", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session = app.session("user-123");

      expect(session.branchId).toBe("main");
    });

    it("should accept custom branchId", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const newBranch = await app.fork({ name: "feature", switchTo: false });
      const session = app.session("user-123", { branchId: newBranch.id });

      expect(session.branchId).toBe(newBranch.id);
    });

    it("should throw AppNotReadyError before ready()", () => {
      const app = createApp(mockDomainSchema);

      expect(() => app.session("user-123")).toThrow(AppNotReadyError);
    });

    it("should throw AppDisposedError after dispose()", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();
      await app.dispose();

      expect(() => app.session("user-123")).toThrow(AppDisposedError);
    });
  });

  describe("Session.act()", () => {
    it("should execute action with session context", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session = app.session("user-123");
      const handle = session.act("todo.add", { text: "Test" });

      expect(handle).toBeDefined();
      expect(handle.proposalId).toBeDefined();

      const result = await handle.done();
      expect(result.status).toBe("completed");
    });

    it("should use session actorId for actions", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session = app.session("specific-user");
      const handle = session.act("todo.add", {});

      // The actorId should be bound to the session
      expect(session.actorId).toBe("specific-user");
      await handle.done();
    });

    it("should use session branchId for actions", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const newBranch = await app.fork({ switchTo: false });
      const session = app.session("user", { branchId: newBranch.id });

      expect(session.branchId).toBe(newBranch.id);

      const handle = session.act("todo.add", {});
      await handle.done();
    });

    describe("SESS-ACT-1~4: Context Immutability", () => {
      it("SESS-ACT-1: actorId is immutably bound", async () => {
        const app = createApp(mockDomainSchema);
        await app.ready();

        const session = app.session("immutable-actor");

        // actorId should not change
        expect(session.actorId).toBe("immutable-actor");

        session.act("todo.add", {});
        expect(session.actorId).toBe("immutable-actor");
      });

      it("SESS-ACT-2: branchId is immutably bound", async () => {
        const app = createApp(mockDomainSchema);
        await app.ready();

        const session = app.session("user", { branchId: "main" });

        expect(session.branchId).toBe("main");

        // Even after fork, session branchId shouldn't change
        await app.fork();
        expect(session.branchId).toBe("main");
      });

      it("SESS-ACT-3: opts.actorId cannot override session actorId", async () => {
        const app = createApp(mockDomainSchema);
        await app.ready();

        const session = app.session("session-actor");

        // Try to override actorId in opts (should be ignored)
        const handle = session.act("todo.add", {}, { actorId: "other-actor" });

        // Session context should prevail
        expect(session.actorId).toBe("session-actor");
        await handle.done();
      });

      it("SESS-ACT-4: opts.branchId cannot override session branchId", async () => {
        const app = createApp(mockDomainSchema);
        await app.ready();

        const newBranch = await app.fork({ switchTo: false });
        const session = app.session("user", { branchId: "main" });

        // Try to override branchId in opts (should be ignored)
        const handle = session.act("todo.add", {}, { branchId: newBranch.id });

        // Session context should prevail
        expect(session.branchId).toBe("main");
        await handle.done();
      });
    });
  });

  describe("Session.getState()", () => {
    it("should return state for session branch", async () => {
      const app = createApp(mockDomainSchema, {
        initialData: { todos: [], count: 0 },
      });
      await app.ready();

      const session = app.session("user");
      const state = session.getState<{ todos: unknown[]; count: number }>();

      expect(state).toBeDefined();
      expect(state.data.todos).toEqual([]);
      expect(state.data.count).toBe(0);
    });

    it("should return typed state", async () => {
      interface AppData {
        items: string[];
      }

      const app = createApp(mockDomainSchema, {
        initialData: { items: ["a", "b", "c"] },
      });
      await app.ready();

      const session = app.session("user");
      const state = session.getState<AppData>();

      expect(state.data.items).toEqual(["a", "b", "c"]);
    });
  });

  describe("Session.recall()", () => {
    it("should throw MemoryDisabledError when memory is disabled", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session = app.session("user");

      await expect(session.recall("test query")).rejects.toThrow(
        MemoryDisabledError
      );
    });

    it("should throw MemoryDisabledError for array of requests", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session = app.session("user");

      await expect(
        session.recall([{ query: "query1" }, { query: "query2" }])
      ).rejects.toThrow(MemoryDisabledError);
    });
  });

  describe("Multiple Sessions", () => {
    it("should support multiple concurrent sessions", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session1 = app.session("user-1");
      const session2 = app.session("user-2");
      const session3 = app.session("user-3");

      expect(session1.actorId).toBe("user-1");
      expect(session2.actorId).toBe("user-2");
      expect(session3.actorId).toBe("user-3");

      // All can execute actions
      const results = await Promise.all([
        session1.act("todo.add", {}).done(),
        session2.act("todo.add", {}).done(),
        session3.act("todo.add", {}).done(),
      ]);

      expect(results.every((r) => r.status === "completed")).toBe(true);
    });

    it("should isolate sessions by actorId", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const adminSession = app.session("admin");
      const userSession = app.session("user");

      expect(adminSession.actorId).not.toBe(userSession.actorId);
    });

    it("should allow same actor with different branches", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const featureBranch = await app.fork({ name: "feature", switchTo: false });

      const mainSession = app.session("user", { branchId: "main" });
      const featureSession = app.session("user", { branchId: featureBranch.id });

      expect(mainSession.actorId).toBe(featureSession.actorId);
      expect(mainSession.branchId).not.toBe(featureSession.branchId);
    });
  });

  describe("Session Options", () => {
    it("should accept kind option", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const humanSession = app.session("user-1", { kind: "human" });
      const agentSession = app.session("agent-1", { kind: "agent" });
      const systemSession = app.session("system-1", { kind: "system" });

      expect(humanSession.actorId).toBe("user-1");
      expect(agentSession.actorId).toBe("agent-1");
      expect(systemSession.actorId).toBe("system-1");
    });

    it("should accept name option", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session = app.session("user", { name: "Admin Session" });

      expect(session.actorId).toBe("user");
    });

    it("should accept meta option", async () => {
      const app = createApp(mockDomainSchema);
      await app.ready();

      const session = app.session("user", {
        meta: { department: "engineering", role: "developer" },
      });

      expect(session.actorId).toBe("user");
    });
  });
});
