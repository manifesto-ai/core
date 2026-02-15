/**
 * Subscription System Tests
 *
 * @see SPEC §12 Subscription API
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp, withDxAliases } from "../index.js";
import { SubscriptionStore } from "@manifesto-ai/runtime";
import type { DomainSchema } from "@manifesto-ai/core";
import type { AppState } from "../index.js";

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

describe("Subscription System", () => {
  describe("SubscriptionStore", () => {
    let store: SubscriptionStore;

    beforeEach(() => {
      store = new SubscriptionStore();
    });

    describe("Basic subscription", () => {
      it("should register a subscriber", () => {
        const listener = vi.fn();

        store.subscribe((state) => state.data, listener);

        expect(store.subscriberCount()).toBe(1);
      });

      it("should unsubscribe when unsub function is called", () => {
        const listener = vi.fn();

        const unsub = store.subscribe((state) => state.data, listener);
        expect(store.subscriberCount()).toBe(1);

        unsub();
        expect(store.subscriberCount()).toBe(0);
      });

      it("should call listener when value changes", () => {
        const listener = vi.fn();
        const initialState = createMockState({ count: 0 });
        const newState = createMockState({ count: 1 });

        store.setState(initialState);
        store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener
        );

        store.notify(newState);

        expect(listener).toHaveBeenCalledWith(1);
      });

      it("should NOT call listener when value is same", () => {
        const listener = vi.fn();
        const state1 = createMockState({ count: 1 });
        const state2 = createMockState({ count: 1 }); // Same value, different state object

        store.setState(state1);
        store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener
        );
        listener.mockClear(); // Clear the initialization call

        store.notify(state2);

        expect(listener).not.toHaveBeenCalled();
      });
    });

    describe("fireImmediately option", () => {
      it("should NOT call listener immediately by default", () => {
        const listener = vi.fn();
        const state = createMockState({ count: 5 });

        store.setState(state);
        store.subscribe((state) => (state.data as { count: number }).count, listener);

        expect(listener).not.toHaveBeenCalled();
      });

      it("should call listener immediately when fireImmediately is true", () => {
        const listener = vi.fn();
        const state = createMockState({ count: 5 });

        store.setState(state);
        store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener,
          { fireImmediately: true }
        );

        expect(listener).toHaveBeenCalledWith(5);
      });

      it("should NOT call listener immediately if state is null", () => {
        const listener = vi.fn();

        store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener,
          { fireImmediately: true }
        );

        expect(listener).not.toHaveBeenCalled();
      });
    });

    describe("equalityFn option", () => {
      it("should use Object.is by default", () => {
        const listener = vi.fn();
        const obj1 = { foo: "bar" };
        const obj2 = { foo: "bar" }; // Different object, same content

        store.setState(createMockState(obj1));
        store.subscribe((state) => state.data, listener);
        listener.mockClear();

        store.notify(createMockState(obj2));

        // Should be called because Object.is treats them as different
        expect(listener).toHaveBeenCalled();
      });

      it("should use custom equalityFn when provided", () => {
        const listener = vi.fn();
        const obj1 = { foo: "bar" };
        const obj2 = { foo: "bar" }; // Different object, same content

        // Custom equality that compares by JSON
        const deepEqual = (a: unknown, b: unknown) =>
          JSON.stringify(a) === JSON.stringify(b);

        store.setState(createMockState(obj1));
        store.subscribe((state) => state.data, listener, {
          equalityFn: deepEqual,
        });
        listener.mockClear();

        store.notify(createMockState(obj2));

        // Should NOT be called because custom equality treats them as same
        expect(listener).not.toHaveBeenCalled();
      });
    });

    describe("batchMode: immediate", () => {
      it("should call listener on every state change", () => {
        const listener = vi.fn();

        store.setState(createMockState({ count: 0 }));
        store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener,
          { batchMode: "immediate" }
        );

        store.notify(createMockState({ count: 1 }));
        store.notify(createMockState({ count: 2 }));
        store.notify(createMockState({ count: 3 }));

        expect(listener).toHaveBeenCalledTimes(3);
        expect(listener).toHaveBeenNthCalledWith(1, 1);
        expect(listener).toHaveBeenNthCalledWith(2, 2);
        expect(listener).toHaveBeenNthCalledWith(3, 3);
      });
    });

    describe("batchMode: transaction", () => {
      it("should defer notifications during transaction", () => {
        const listener = vi.fn();

        store.setState(createMockState({ count: 0 }));
        store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener,
          { batchMode: "transaction" }
        );

        store.startTransaction();
        store.notify(createMockState({ count: 1 }));
        store.notify(createMockState({ count: 2 }));
        store.notify(createMockState({ count: 3 }));

        // Should not be called during transaction
        expect(listener).not.toHaveBeenCalled();

        store.endTransaction();

        // Should be called once with final value after transaction
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(3);
      });

      it("should call listener immediately when not in transaction", () => {
        const listener = vi.fn();

        store.setState(createMockState({ count: 0 }));
        store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener,
          { batchMode: "transaction" }
        );

        // Not in transaction
        store.notify(createMockState({ count: 1 }));

        expect(listener).toHaveBeenCalledWith(1);
      });
    });

    describe("batchMode: debounce", () => {
      it("should debounce notifications", async () => {
        const listener = vi.fn();

        store.setState(createMockState({ count: 0 }));
        store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener,
          { batchMode: { debounce: 50 } }
        );

        store.notify(createMockState({ count: 1 }));
        store.notify(createMockState({ count: 2 }));
        store.notify(createMockState({ count: 3 }));

        // Should not be called immediately
        expect(listener).not.toHaveBeenCalled();

        // Wait for debounce
        await new Promise((r) => setTimeout(r, 60));

        // Should be called once with final value
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(3);
      });

      it("should clear debounce timer on unsubscribe", async () => {
        const listener = vi.fn();

        store.setState(createMockState({ count: 0 }));
        const unsub = store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener,
          { batchMode: { debounce: 50 } }
        );

        store.notify(createMockState({ count: 1 }));

        unsub();

        // Wait for debounce
        await new Promise((r) => setTimeout(r, 60));

        // Should NOT be called because unsubscribed
        expect(listener).not.toHaveBeenCalled();
      });
    });

    describe("Multiple subscribers", () => {
      it("should notify all subscribers", () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();

        store.setState(createMockState({ count: 0 }));
        store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener1
        );
        store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener2
        );

        store.notify(createMockState({ count: 1 }));

        expect(listener1).toHaveBeenCalledWith(1);
        expect(listener2).toHaveBeenCalledWith(1);
      });

      it("should support different selectors", () => {
        const countListener = vi.fn();
        const nameListener = vi.fn();

        store.setState(createMockState({ count: 0, name: "Alice" }));
        store.subscribe(
          (state) => (state.data as { count: number }).count,
          countListener
        );
        store.subscribe(
          (state) => (state.data as { name: string }).name,
          nameListener
        );

        // Update only count
        store.notify(createMockState({ count: 1, name: "Alice" }));

        expect(countListener).toHaveBeenCalledWith(1);
        expect(nameListener).not.toHaveBeenCalled(); // Same name, no call
      });
    });

    describe("clear()", () => {
      it("should remove all subscribers", () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();

        store.subscribe(() => null, listener1);
        store.subscribe(() => null, listener2);

        expect(store.subscriberCount()).toBe(2);

        store.clear();

        expect(store.subscriberCount()).toBe(0);
      });

      it("should clear pending debounce timers", async () => {
        const listener = vi.fn();

        store.setState(createMockState({ count: 0 }));
        store.subscribe(
          (state) => (state.data as { count: number }).count,
          listener,
          { batchMode: { debounce: 50 } }
        );

        store.notify(createMockState({ count: 1 }));

        store.clear();

        await new Promise((r) => setTimeout(r, 60));

        expect(listener).not.toHaveBeenCalled();
      });
    });

    describe("isInTransaction()", () => {
      it("should return false when not in transaction", () => {
        expect(store.isInTransaction()).toBe(false);
      });

      it("should return true when in transaction", () => {
        store.startTransaction();
        expect(store.isInTransaction()).toBe(true);
      });

      it("should return false after endTransaction()", () => {
        store.startTransaction();
        store.endTransaction();
        expect(store.isInTransaction()).toBe(false);
      });
    });
  });

  describe("App Integration", () => {
    it("should throw AppNotReadyError before ready()", () => {
      const app = createTestApp(mockDomainSchema);

      expect(() => {
        app.subscribe((state) => state.data, () => {});
      }).toThrow("subscribe");
    });

    it("should subscribe after ready()", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const listener = vi.fn();
      const unsub = app.subscribe((state) => state.data, listener);

      expect(typeof unsub).toBe("function");
    });

    it("should call listener with fireImmediately", async () => {
      const app = createTestApp(mockDomainSchema, {
        initialData: { count: 5 },
      });
      await app.ready();

      const listener = vi.fn();
      app.subscribe(
        (state) => (state.data as { count: number }).count,
        listener,
        { fireImmediately: true }
      );

      expect(listener).toHaveBeenCalledWith(5);
    });

    it("should unsubscribe correctly", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const listener = vi.fn();
      const unsub = app.subscribe(
        (state) => state.data,
        listener,
        { fireImmediately: true }
      );

      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      // Further state changes should not trigger listener
      // (This would require state change to test fully)
    });
  });
});

// Helper function to create mock AppState
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
      randomSeed: "test-seed",
      schemaHash: "test-schema-hash",
    },
  });
}
