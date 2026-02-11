/**
 * Hook System Tests
 *
 * @see SPEC §11 Hook System
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp } from "@manifesto-ai/app";
import { HookMutationError } from "@manifesto-ai/shared";
import { JobQueue, HookableImpl, createHookContext, createAppRef } from "@manifesto-ai/runtime";
import type { AppRefCallbacks } from "@manifesto-ai/runtime";
import type { DomainSchema } from "@manifesto-ai/core";
import type { AppState, Branch, HookContext } from "@manifesto-ai/shared";
import { toClientState } from "@manifesto-ai/shared";
import { createWorldId } from "@manifesto-ai/world";

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

function createTestState(): AppState<unknown> {
  return toClientState({
    data: {},
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    meta: {
      version: 0,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: mockDomainSchema.hash,
    },
  });
}

const branchStub: Branch = {
  id: "main",
  name: "main",
  schemaHash: mockDomainSchema.hash,
  head: () => "world-1",
  checkout: async () => {},
  act: () => {
    throw new Error("Branch.act not available in hooks test");
  },
  fork: async () => branchStub,
  getState: <T>() => createTestState() as AppState<T>,
  lineage: () => ["world-1"],
};

function createTestAppRef(
  queue: JobQueue,
  onEnqueue?: (proposalId: string, type: string) => void
) {
  const callbacks: AppRefCallbacks = {
    getStatus: () => "ready",
    getState: <T>() => createTestState() as AppState<T>,
    getDomainSchema: () => mockDomainSchema,
    getCurrentHead: () => createWorldId("world-1"),
    currentBranch: () => branchStub,
    generateProposalId: () => "prop-test",
  };

  return createAppRef(callbacks, queue, (proposalId, type) => {
    onEnqueue?.(proposalId, type);
  });
}

describe("Hook System", () => {
  describe("JobQueue", () => {
    describe("ENQ-1: Jobs execute after hook completion", () => {
      it("should queue jobs for later execution", async () => {
        const queue = new JobQueue();
        const executed: number[] = [];

        queue.enqueue(() => { executed.push(1); });
        queue.enqueue(() => { executed.push(2); });

        // Jobs should not execute synchronously
        expect(executed).toEqual([]);

        // Wait for microtask
        await new Promise((r) => setTimeout(r, 0));

        expect(executed).toEqual([1, 2]);
      });
    });

    describe("ENQ-2: Priority ordering", () => {
      it("should execute immediate jobs before normal", async () => {
        const queue = new JobQueue();
        const executed: string[] = [];

        queue.enqueue(() => { executed.push("normal-1"); }, { priority: "normal" });
        queue.enqueue(() => { executed.push("immediate"); }, { priority: "immediate" });
        queue.enqueue(() => { executed.push("normal-2"); }, { priority: "normal" });

        await queue.processAll();

        expect(executed).toEqual(["immediate", "normal-1", "normal-2"]);
      });

      it("should execute normal jobs before deferred", async () => {
        const queue = new JobQueue();
        const executed: string[] = [];

        queue.enqueue(() => { executed.push("defer"); }, { priority: "defer" });
        queue.enqueue(() => { executed.push("normal"); }, { priority: "normal" });

        await queue.processAll();

        expect(executed).toEqual(["normal", "defer"]);
      });

      it("should respect full priority order: immediate > normal > defer", async () => {
        const queue = new JobQueue();
        const executed: string[] = [];

        queue.enqueue(() => { executed.push("defer-1"); }, { priority: "defer" });
        queue.enqueue(() => { executed.push("normal-1"); }, { priority: "normal" });
        queue.enqueue(() => { executed.push("immediate-1"); }, { priority: "immediate" });
        queue.enqueue(() => { executed.push("defer-2"); }, { priority: "defer" });
        queue.enqueue(() => { executed.push("normal-2"); }, { priority: "normal" });
        queue.enqueue(() => { executed.push("immediate-2"); }, { priority: "immediate" });

        await queue.processAll();

        expect(executed).toEqual([
          "immediate-1",
          "immediate-2",
          "normal-1",
          "normal-2",
          "defer-1",
          "defer-2",
        ]);
      });
    });

    describe("ENQ-3: FIFO within same priority", () => {
      it("should maintain FIFO order for normal priority", async () => {
        const queue = new JobQueue();
        const executed: number[] = [];

        for (let i = 1; i <= 5; i++) {
          queue.enqueue(() => { executed.push(i); });
        }

        await queue.processAll();

        expect(executed).toEqual([1, 2, 3, 4, 5]);
      });

      it("should maintain FIFO order for immediate priority", async () => {
        const queue = new JobQueue();
        const executed: number[] = [];

        for (let i = 1; i <= 5; i++) {
          queue.enqueue(() => { executed.push(i); }, { priority: "immediate" });
        }

        await queue.processAll();

        expect(executed).toEqual([1, 2, 3, 4, 5]);
      });
    });

    describe("ENQ-5: Error handling", () => {
      it("should continue processing after job error", async () => {
        const queue = new JobQueue();
        const executed: number[] = [];
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        queue.enqueue(() => { executed.push(1); });
        queue.enqueue(() => {
          throw new Error("Job failed");
        });
        queue.enqueue(() => { executed.push(3); });

        await queue.processAll();

        expect(executed).toEqual([1, 3]);
        expect(consoleError).toHaveBeenCalled();

        consoleError.mockRestore();
      });
    });

    describe("ENQ-6: Jobs enqueued during processing", () => {
      it("should process jobs enqueued during execution", async () => {
        const queue = new JobQueue();
        const executed: string[] = [];

        queue.enqueue(() => {
          executed.push("first");
          queue.enqueue(() => { executed.push("nested"); });
        });

        await queue.processAll();

        expect(executed).toEqual(["first", "nested"]);
      });
    });

    describe("Queue utilities", () => {
      it("should report pending jobs count", () => {
        const queue = new JobQueue();

        queue.enqueue(() => {});
        queue.enqueue(() => {});
        queue.enqueue(() => {});

        expect(queue.pendingCount()).toBe(3);
      });

      it("should report hasPendingJobs correctly", () => {
        const queue = new JobQueue();

        expect(queue.hasPendingJobs()).toBe(false);

        queue.enqueue(() => {});

        expect(queue.hasPendingJobs()).toBe(true);
      });

      it("should clear all jobs", async () => {
        const queue = new JobQueue();
        const executed: number[] = [];

        queue.enqueue(() => { executed.push(1); });
        queue.enqueue(() => { executed.push(2); });

        queue.clear();

        await queue.processAll();

        expect(executed).toEqual([]);
      });
    });

    describe("Async jobs", () => {
      it("should wait for async jobs", async () => {
        const queue = new JobQueue();
        const executed: number[] = [];

        queue.enqueue(async () => {
          await new Promise((r) => setTimeout(r, 10));
          executed.push(1);
        });
        queue.enqueue(() => { executed.push(2); });

        await queue.processAll();

        expect(executed).toEqual([1, 2]);
      });
    });
  });

  describe("HookableImpl", () => {
    describe("on() and emit()", () => {
      it("should register and call handlers", async () => {
        const hookable = new HookableImpl<{ test: () => void }>();
        const handler = vi.fn();

        hookable.on("test", handler);
        await hookable.emit("test");

        expect(handler).toHaveBeenCalledTimes(1);
      });

      it("should call multiple handlers in order", async () => {
        const hookable = new HookableImpl<{ test: () => void }>();
        const order: number[] = [];

        hookable.on("test", () => order.push(1));
        hookable.on("test", () => order.push(2));
        hookable.on("test", () => order.push(3));

        await hookable.emit("test");

        expect(order).toEqual([1, 2, 3]);
      });

      it("should return unsubscribe function", async () => {
        const hookable = new HookableImpl<{ test: () => void }>();
        const handler = vi.fn();

        const unsub = hookable.on("test", handler);
        unsub();
        await hookable.emit("test");

        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe("once()", () => {
      it("should call handler only once", async () => {
        const hookable = new HookableImpl<{ test: () => void }>();
        const handler = vi.fn();

        hookable.once("test", handler);
        await hookable.emit("test");
        await hookable.emit("test");
        await hookable.emit("test");

        expect(handler).toHaveBeenCalledTimes(1);
      });

      it("should return unsubscribe function", async () => {
        const hookable = new HookableImpl<{ test: () => void }>();
        const handler = vi.fn();

        const unsub = hookable.once("test", handler);
        unsub();
        await hookable.emit("test");

        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe("HOOK-MUT-1~4: Mutation Guard", () => {
      it("HOOK-MUT-1: isInHook() returns true during hook execution", async () => {
        const hookable = new HookableImpl<{ test: (ctx: HookContext) => void }>();
        let wasInHook = false;
        const ctx = createHookContext(createTestAppRef(hookable.getJobQueue()), Date.now());

        hookable.on("test", () => {
          wasInHook = hookable.isInHook();
        });

        await hookable.emit("test", ctx);

        expect(wasInHook).toBe(true);
      });

      it("HOOK-MUT-2: isInHook() returns false outside hook execution", () => {
        const hookable = new HookableImpl<{ test: () => void }>();

        expect(hookable.isInHook()).toBe(false);
      });

      it("HOOK-MUT-3: getCurrentHook() returns hook name during execution", async () => {
        const hookable = new HookableImpl<{ "my:hook": () => void }>();
        let hookName: string | null = null;

        hookable.on("my:hook", () => {
          hookName = hookable.getCurrentHook();
        });

        await hookable.emit("my:hook");

        expect(hookName).toBe("my:hook");
      });

      it("HOOK-MUT-4: assertNotInHook() throws HookMutationError during hook", async () => {
        const hookable = new HookableImpl<{ test: () => void }>();
        let error: Error | null = null;

        hookable.on("test", () => {
          try {
            hookable.assertNotInHook("someApi");
          } catch (e) {
            error = e as Error;
          }
        });

        await hookable.emit("test");

        expect(error).toBeInstanceOf(HookMutationError);
      });

      it("assertNotInHook() does not throw outside hook", () => {
        const hookable = new HookableImpl<{ test: () => void }>();

        expect(() => hookable.assertNotInHook("someApi")).not.toThrow();
      });
    });

    describe("Nested hooks", () => {
      it("should track nested hook depth", async () => {
        const hookable = new HookableImpl<{
          outer: () => Promise<void>;
          inner: () => void;
        }>();

        let outerInHook = false;
        let innerInHook = false;
        let afterInnerInHook = false;

        hookable.on("outer", async () => {
          outerInHook = hookable.isInHook();
          await hookable.emit("inner");
          afterInnerInHook = hookable.isInHook();
        });

        hookable.on("inner", () => {
          innerInHook = hookable.isInHook();
        });

        await hookable.emit("outer");

        expect(outerInHook).toBe(true);
        expect(innerInHook).toBe(true);
        expect(afterInnerInHook).toBe(false);
      });
    });

    describe("Job queue integration", () => {
      it("should process enqueued jobs after hooks complete", async () => {
        const hookable = new HookableImpl<{ test: (ctx: HookContext) => void }>();
        const executed: string[] = [];
        const queue = hookable.getJobQueue();
        const appRef = createTestAppRef(queue, () => {
          executed.push("job");
        });
        const ctx = createHookContext(appRef, Date.now());

        hookable.on("test", (ctx) => {
          executed.push("handler");
          ctx.app.enqueueAction("todo.add", {});
        });

        await hookable.emit("test", ctx);
        await queue.processAll();

        expect(executed).toEqual(["handler", "job"]);
      });
    });
  });

  describe("HookContext", () => {
    it("should include AppRef and timestamp", () => {
      const queue = new JobQueue();
      const appRef = createTestAppRef(queue);
      const ctx = createHookContext(appRef, 123);

      expect(ctx.app).toBe(appRef);
      expect(ctx.timestamp).toBe(123);
    });

    it("should expose enqueueAction via AppRef", () => {
      const queue = new JobQueue();
      const appRef = createTestAppRef(queue);
      const ctx = createHookContext(appRef, Date.now());

      expect(typeof ctx.app.enqueueAction).toBe("function");
    });
  });

  describe("App Hook Integration", () => {
    it("should pass HookContext with AppRef and timestamp", async () => {
      const app = createTestApp(mockDomainSchema);
      let received = false;

      app.hooks.on("app:ready", (ctx) => {
        received = true;
        expect(ctx.app).toBeDefined();
        expect(typeof ctx.timestamp).toBe("number");
      });

      await app.ready();

      expect(received).toBe(true);
    });
  });
});
