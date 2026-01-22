/**
 * L5: Bridge Dispatch Tests
 *
 * Tests App dispatch and subscription over Host + WorldStore.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createApp, InMemoryWorldStore, type App } from "@manifesto-ai/app";
import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import type { DomainSchema } from "@manifesto-ai/core";
import { userActor } from "../fixtures/index.js";

// Import compiled schema
import CounterSchema from "../fixtures/schemas/counter-compiled.json";

const bridgeTestSchema = CounterSchema as unknown as DomainSchema;

// =============================================================================
// L5: Bridge Dispatch Tests
// =============================================================================

describe("L5: App Dispatch", () => {
  let host: ManifestoHost;
  let app: App;
  let worldStore: InMemoryWorldStore;

  beforeEach(async () => {
    host = createHost(bridgeTestSchema, {
      initialData: { count: 0, lastIntent: null },
    });

    worldStore = new InMemoryWorldStore();
    app = createApp({
      schema: bridgeTestSchema,
      host,
      worldStore,
      initialData: { count: 0, lastIntent: null },
      actorPolicy: {
        mode: "anonymous",
        defaultActor: {
          actorId: userActor.actorId,
          kind: "human",
        },
      },
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.dispose();
  });

  describe("dispatch", () => {
    it("should dispatch intent and update state", async () => {
      await app.act("increment").done();

      const state = app.getState();
      expect(state.data.count).toBe(1);
      // lastIntent is set by once() guard
      expect(state.data.lastIntent).toBeDefined();
    });

    it("should dispatch intent with parameters", async () => {
      await app.act("reset", { value: 42 }).done();

      const state = app.getState();
      expect(state.data.count).toBe(42);
    });

    it("should update computed values after dispatch", async () => {
      // Use different intentIds to bypass once() guard
      await app.act("increment").done();

      // Use reset to set count to 2 (since increment uses once() guard)
      await app.act("reset", { value: 2 }).done();

      const state = app.getState();
      expect(state.data.count).toBe(2);
      expect(state.computed["computed.doubled"]).toBe(4);
    });

    it("should handle sequential dispatches", async () => {
      // Use add action which doesn't have once() guard, just when(gte(amount, 0))
      await app.act("add", { amount: 1 }).done();
      await app.act("add", { amount: 1 }).done();
      await app.act("add", { amount: -1 }).done(); // Negative amount should be ignored (when guard)

      const state = app.getState();
      expect(state.data.count).toBe(2);
    });
  });

  describe("State subscriptions", () => {
    it("should notify subscribers on state change", async () => {
      const listener = vi.fn();
      app.subscribe((state) => state.data.count, listener);

      await app.act("increment").done();

      expect(listener).toHaveBeenCalled();
    });

    it("should provide AppState to subscribers", async () => {
      let receivedState: unknown;
      app.subscribe((state) => state, (state) => {
        receivedState = state;
      });

      await app.act("increment").done();

      expect(receivedState).toBeDefined();
      expect((receivedState as { data: unknown }).data).toBeDefined();
    });

    it("should allow unsubscribing", async () => {
      const listener = vi.fn();
      const unsubscribe = app.subscribe((state) => state.data.count, listener);

      unsubscribe();

      await app.act("increment").done();

      const callsAfterUnsubscribe = listener.mock.calls.length;
      await app.act("reset", { value: 5 }).done();

      expect(listener.mock.calls.length).toBe(callsAfterUnsubscribe);
    });
  });

  describe("App lifecycle", () => {
    it("should reject act after disposal", async () => {
      await app.dispose();

      expect(() => app.act("increment")).toThrow();
    });

    it("should reject getState after disposal", async () => {
      await app.dispose();

      expect(() => app.getState()).toThrow();
    });
  });
});

// =============================================================================
// L5: App State Access Tests
// =============================================================================

describe("L5: App State Access", () => {
  let host: ManifestoHost;
  let app: App;
  let worldStore: InMemoryWorldStore;

  beforeEach(async () => {
    host = createHost(bridgeTestSchema, {
      initialData: { count: 10, lastIntent: "init" },
    });

    worldStore = new InMemoryWorldStore();
    app = createApp({
      schema: bridgeTestSchema,
      host,
      worldStore,
      initialData: { count: 10, lastIntent: "init" },
      actorPolicy: {
        mode: "anonymous",
        defaultActor: {
          actorId: userActor.actorId,
          kind: "human",
        },
      },
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.dispose();
  });

  describe("getState", () => {
    it("should return current state", () => {
      const state = app.getState();

      expect(state.data.count).toBe(10);
      expect(state.data.lastIntent).toBe("init");
    });

    it("should include computed values after dispatch", async () => {
      // Note: Computed values may only be fully evaluated after dispatch
      // because the initial genesis snapshot might not include computed values
      await app.act("add", { amount: 0 }).done();

      const state = app.getState();

      // After dispatch, computed values should be available
      expect(state.computed["computed.doubled"]).toBe(20);
    });
  });
});
