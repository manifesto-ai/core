/**
 * WorldEventBus Unit Tests
 *
 * Tests for the World Protocol Event System per WORLD_EVENT_SPEC.md and FDR.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorldEventBus, createWorldEventBus } from "./bus.js";
import type { WorldEvent, WorldEventHandler } from "./types.js";

// =============================================================================
// Test Helpers
// =============================================================================

function createMockEvent(
  type: WorldEvent["type"],
  overrides: Partial<WorldEvent> = {}
): WorldEvent {
  const base = {
    timestamp: Date.now(),
  };

  switch (type) {
    case "proposal:submitted":
      return {
        ...base,
        type: "proposal:submitted",
        proposal: {} as any,
        actor: { actorId: "test-actor", role: "human" },
        ...overrides,
      } as WorldEvent;

    case "proposal:evaluating":
      return {
        ...base,
        type: "proposal:evaluating",
        proposalId: "test-proposal",
        authorityId: "test-authority",
        ...overrides,
      } as WorldEvent;

    case "proposal:decided":
      return {
        ...base,
        type: "proposal:decided",
        proposalId: "test-proposal",
        authorityId: "test-authority",
        decision: "approved",
        ...overrides,
      } as WorldEvent;

    case "execution:started":
      return {
        ...base,
        type: "execution:started",
        proposalId: "test-proposal",
        intentId: "test-intent",
        baseSnapshot: {} as any,
        ...overrides,
      } as WorldEvent;

    case "execution:computing":
      return {
        ...base,
        type: "execution:computing",
        intentId: "test-intent",
        iteration: 0,
        ...overrides,
      } as WorldEvent;

    case "execution:completed":
      return {
        ...base,
        type: "execution:completed",
        proposalId: "test-proposal",
        intentId: "test-intent",
        finalSnapshot: {} as any,
        totalPatches: 0,
        totalEffects: 0,
        ...overrides,
      } as WorldEvent;

    case "world:created":
      return {
        ...base,
        type: "world:created",
        world: {} as any,
        proposalId: null,
        parentWorldId: null,
        ...overrides,
      } as WorldEvent;

    default:
      throw new Error(`Unsupported event type: ${type}`);
  }
}

// =============================================================================
// WorldEventBus Tests
// =============================================================================

describe("WorldEventBus", () => {
  let eventBus: WorldEventBus;

  beforeEach(() => {
    eventBus = createWorldEventBus();
  });

  describe("factory function", () => {
    it("creates a new WorldEventBus instance", () => {
      const bus = createWorldEventBus();
      expect(bus).toBeInstanceOf(WorldEventBus);
    });
  });

  describe("subscribe (all events)", () => {
    it("receives all emitted events", () => {
      const handler = vi.fn();
      eventBus.subscribe(handler);

      const event1 = createMockEvent("proposal:submitted");
      const event2 = createMockEvent("execution:started");

      eventBus.emit(event1);
      eventBus.emit(event2);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, event1);
      expect(handler).toHaveBeenNthCalledWith(2, event2);
    });

    it("returns unsubscribe function", () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe(handler);

      expect(typeof unsubscribe).toBe("function");
    });

    it("stops receiving events after unsubscribe (EVT-R6)", () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe(handler);

      const event1 = createMockEvent("proposal:submitted");
      eventBus.emit(event1);
      expect(handler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Should not receive this event
      const event2 = createMockEvent("execution:started");
      eventBus.emit(event2);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("unsubscribe takes effect immediately (EVT-R6)", () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe(handler);

      unsubscribe();

      // No events should be received after immediate unsubscribe
      eventBus.emit(createMockEvent("proposal:submitted"));
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("subscribe (filtered events)", () => {
    it("receives only specified event types", () => {
      const handler = vi.fn();
      eventBus.subscribe(["proposal:submitted", "proposal:decided"], handler);

      eventBus.emit(createMockEvent("proposal:submitted"));
      eventBus.emit(createMockEvent("proposal:evaluating")); // Should be filtered
      eventBus.emit(createMockEvent("proposal:decided"));
      eventBus.emit(createMockEvent("execution:started")); // Should be filtered

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("returns unsubscribe function for filtered subscription", () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe(["proposal:submitted"], handler);

      expect(typeof unsubscribe).toBe("function");

      eventBus.emit(createMockEvent("proposal:submitted"));
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      eventBus.emit(createMockEvent("proposal:submitted"));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("handles empty filter array (receives nothing)", () => {
      const handler = vi.fn();
      eventBus.subscribe([], handler);

      eventBus.emit(createMockEvent("proposal:submitted"));
      eventBus.emit(createMockEvent("execution:started"));

      expect(handler).not.toHaveBeenCalled();
    });

    it("handles single event type filter", () => {
      const handler = vi.fn();
      eventBus.subscribe(["world:created"], handler);

      eventBus.emit(createMockEvent("proposal:submitted"));
      eventBus.emit(createMockEvent("world:created"));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "world:created" })
      );
    });
  });

  describe("multiple subscribers (EVT-R3)", () => {
    it("supports multiple simultaneous subscribers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);
      eventBus.subscribe(handler3);

      const event = createMockEvent("proposal:submitted");
      eventBus.emit(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
      expect(handler3).toHaveBeenCalledWith(event);
    });

    it("mixed filtered and unfiltered subscribers", () => {
      const allHandler = vi.fn();
      const filteredHandler = vi.fn();

      eventBus.subscribe(allHandler);
      eventBus.subscribe(["proposal:submitted"], filteredHandler);

      eventBus.emit(createMockEvent("proposal:submitted"));
      eventBus.emit(createMockEvent("execution:started"));

      expect(allHandler).toHaveBeenCalledTimes(2);
      expect(filteredHandler).toHaveBeenCalledTimes(1);
    });

    it("unsubscribing one does not affect others", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsub1 = eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);

      eventBus.emit(createMockEvent("proposal:submitted"));
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      unsub1();

      eventBus.emit(createMockEvent("proposal:submitted"));
      expect(handler1).toHaveBeenCalledTimes(1); // Still 1
      expect(handler2).toHaveBeenCalledTimes(2); // Now 2
    });
  });

  describe("synchronous delivery (EVT-R7)", () => {
    it("delivers events synchronously before emit returns", () => {
      const events: string[] = [];

      eventBus.subscribe((event) => {
        events.push(event.type);
      });

      events.push("before-emit");
      eventBus.emit(createMockEvent("proposal:submitted"));
      events.push("after-emit");

      // Event should be delivered between before and after
      expect(events).toEqual([
        "before-emit",
        "proposal:submitted",
        "after-emit",
      ]);
    });

    it("all handlers receive event before emit returns", () => {
      const order: number[] = [];

      eventBus.subscribe(() => order.push(1));
      eventBus.subscribe(() => order.push(2));
      eventBus.subscribe(() => order.push(3));

      eventBus.emit(createMockEvent("proposal:submitted"));
      order.push(4);

      expect(order).toEqual([1, 2, 3, 4]);
    });
  });

  describe("exception isolation (EVT-R5, FDR-E009)", () => {
    it("handler exceptions do not affect other handlers", () => {
      const handler1 = vi.fn();
      const throwingHandler = vi.fn(() => {
        throw new Error("Handler error");
      });
      const handler3 = vi.fn();

      eventBus.subscribe(handler1);
      eventBus.subscribe(throwingHandler);
      eventBus.subscribe(handler3);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const event = createMockEvent("proposal:submitted");
      eventBus.emit(event);

      // All handlers should be called despite the exception
      expect(handler1).toHaveBeenCalledWith(event);
      expect(throwingHandler).toHaveBeenCalledWith(event);
      expect(handler3).toHaveBeenCalledWith(event);

      consoleSpy.mockRestore();
    });

    it("handler exceptions are logged", () => {
      const throwingHandler = vi.fn(() => {
        throw new Error("Test error");
      });

      eventBus.subscribe(throwingHandler);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      eventBus.emit(createMockEvent("proposal:submitted"));

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain("[WorldEventBus]");

      consoleSpy.mockRestore();
    });

    it("emit does not throw even if handler throws", () => {
      eventBus.subscribe(() => {
        throw new Error("Handler error");
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Should not throw
      expect(() => {
        eventBus.emit(createMockEvent("proposal:submitted"));
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it("multiple throwing handlers are all isolated", () => {
      const callOrder: number[] = [];

      eventBus.subscribe(() => {
        callOrder.push(1);
        throw new Error("Error 1");
      });
      eventBus.subscribe(() => {
        callOrder.push(2);
        throw new Error("Error 2");
      });
      eventBus.subscribe(() => {
        callOrder.push(3);
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      eventBus.emit(createMockEvent("proposal:submitted"));

      expect(callOrder).toEqual([1, 2, 3]);
      expect(consoleSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe("subscriberCount", () => {
    it("returns current subscriber count", () => {
      expect(eventBus.subscriberCount).toBe(0);

      const unsub1 = eventBus.subscribe(vi.fn());
      expect(eventBus.subscriberCount).toBe(1);

      const unsub2 = eventBus.subscribe(vi.fn());
      expect(eventBus.subscriberCount).toBe(2);

      unsub1();
      expect(eventBus.subscriberCount).toBe(1);

      unsub2();
      expect(eventBus.subscriberCount).toBe(0);
    });

    it("counts filtered subscriptions", () => {
      eventBus.subscribe(["proposal:submitted"], vi.fn());
      expect(eventBus.subscriberCount).toBe(1);
    });
  });

  describe("clear", () => {
    it("removes all subscribers", () => {
      eventBus.subscribe(vi.fn());
      eventBus.subscribe(vi.fn());
      eventBus.subscribe(["proposal:submitted"], vi.fn());

      expect(eventBus.subscriberCount).toBe(3);

      eventBus.clear();

      expect(eventBus.subscriberCount).toBe(0);
    });

    it("cleared subscribers do not receive events", () => {
      const handler = vi.fn();
      eventBus.subscribe(handler);

      eventBus.clear();
      eventBus.emit(createMockEvent("proposal:submitted"));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("event type coverage", () => {
    it("handles all proposal lifecycle events", () => {
      const handler = vi.fn();
      eventBus.subscribe(handler);

      eventBus.emit(createMockEvent("proposal:submitted"));
      eventBus.emit(createMockEvent("proposal:evaluating"));
      eventBus.emit(createMockEvent("proposal:decided"));

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it("handles execution lifecycle events", () => {
      const handler = vi.fn();
      eventBus.subscribe(handler);

      eventBus.emit(createMockEvent("execution:started"));
      eventBus.emit(createMockEvent("execution:computing"));
      eventBus.emit(createMockEvent("execution:completed"));

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it("handles world lifecycle events", () => {
      const handler = vi.fn();
      eventBus.subscribe(handler);

      eventBus.emit(createMockEvent("world:created"));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
