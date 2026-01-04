/**
 * L5: Bridge Dispatch Tests
 *
 * Tests SourceEvent → Projection → Intent → World flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createBridge, type Bridge } from "@manifesto-ai/bridge";
import { createManifestoWorld, type ManifestoWorld } from "@manifesto-ai/world";
import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import type { DomainSchema } from "@manifesto-ai/core";
import { userActor } from "../fixtures/index.js";

// Import compiled schema
import CounterSchema from "../fixtures/schemas/counter-compiled.json";

const bridgeTestSchema = CounterSchema as unknown as DomainSchema;

// =============================================================================
// L5: Bridge Dispatch Tests
// =============================================================================

describe("L5: Bridge Dispatch", () => {
  let host: ManifestoHost;
  let world: ManifestoWorld;
  let bridge: Bridge;

  beforeEach(async () => {
    host = createHost(bridgeTestSchema, {
      initialData: { count: 0, lastIntent: null },
    });

    world = createManifestoWorld({
      schemaHash: bridgeTestSchema.hash,
      host,
    });

    world.registerActor(userActor, { mode: "auto_approve" });

    const snapshot = await host.getSnapshot();
    await world.createGenesis(snapshot);

    bridge = createBridge({
      world,
      schemaHash: bridgeTestSchema.hash,
      defaultActor: userActor,
    });

    await bridge.refresh();
  });

  afterEach(() => {
    bridge.dispose();
    // Note: ManifestoWorld doesn't have dispose()
  });

  describe("dispatch", () => {
    it("should dispatch intent and update state", async () => {
      await bridge.dispatch({ type: "increment", input: {} });

      const snapshot = bridge.getSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.data.count).toBe(1);
      // lastIntent is set by once() guard
      expect(snapshot!.data.lastIntent).toBeDefined();
    });

    it("should dispatch intent with parameters", async () => {
      await bridge.dispatch({ type: "reset", input: { value: 42 } });

      const snapshot = bridge.getSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.data.count).toBe(42);
    });

    it("should update computed values after dispatch", async () => {
      // Use different intentIds to bypass once() guard
      await bridge.dispatch({ type: "increment", input: {} });

      // Use reset to set count to 2 (since increment uses once() guard)
      await bridge.dispatch({ type: "reset", input: { value: 2 } });

      const snapshot = bridge.getSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.data.count).toBe(2);
      // SnapshotView strips "computed." prefix from keys
      expect(snapshot!.computed["doubled"]).toBe(4);
    });

    it("should handle sequential dispatches", async () => {
      // Use add action which doesn't have once() guard, just when(gte(amount, 0))
      await bridge.dispatch({ type: "add", input: { amount: 1 } });
      await bridge.dispatch({ type: "add", input: { amount: 1 } });
      await bridge.dispatch({ type: "add", input: { amount: -1 } }); // Negative amount should be ignored (when guard)

      const snapshot = bridge.getSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.data.count).toBe(2);
    });
  });

  describe("Snapshot subscriptions", () => {
    it("should notify subscribers on state change", async () => {
      const listener = vi.fn();
      bridge.subscribe(listener);

      await bridge.dispatch({ type: "increment", input: {} });

      expect(listener).toHaveBeenCalled();
    });

    it("should provide frozen SnapshotView", async () => {
      let receivedSnapshot: unknown;
      bridge.subscribe((snapshot) => {
        receivedSnapshot = snapshot;
      });

      await bridge.dispatch({ type: "increment", input: {} });

      expect(receivedSnapshot).toBeDefined();
      expect((receivedSnapshot as { data: unknown }).data).toBeDefined();
    });

    it("should allow unsubscribing", async () => {
      const listener = vi.fn();
      const unsubscribe = bridge.subscribe(listener);

      unsubscribe();

      await bridge.dispatch({ type: "increment", input: {} });

      // Listener should not be called after unsubscribe
      // (May have been called once during initial subscription)
      const callsAfterUnsubscribe = listener.mock.calls.length;
      await bridge.dispatch({ type: "reset", input: { value: 5 } });

      expect(listener.mock.calls.length).toBe(callsAfterUnsubscribe);
    });
  });

  describe("Bridge lifecycle", () => {
    it("should reject dispatch after disposal", async () => {
      bridge.dispose();

      await expect(
        bridge.dispatch({ type: "increment", input: {} })
      ).rejects.toThrow();
    });

    it("should return null snapshot after disposal", () => {
      bridge.dispose();

      expect(bridge.getSnapshot()).toBeNull();
    });
  });
});

// =============================================================================
// L5: Bridge State Access Tests
// =============================================================================

describe("L5: Bridge State Access", () => {
  let host: ManifestoHost;
  let world: ManifestoWorld;
  let bridge: Bridge;

  beforeEach(async () => {
    host = createHost(bridgeTestSchema, {
      initialData: { count: 10, lastIntent: "init" },
    });

    world = createManifestoWorld({
      schemaHash: bridgeTestSchema.hash,
      host,
    });

    world.registerActor(userActor, { mode: "auto_approve" });

    const snapshot = await host.getSnapshot();
    await world.createGenesis(snapshot);

    bridge = createBridge({
      world,
      schemaHash: bridgeTestSchema.hash,
      defaultActor: userActor,
    });

    await bridge.refresh();
  });

  afterEach(() => {
    bridge.dispose();
  });

  describe("getSnapshot", () => {
    it("should return current snapshot", () => {
      const snapshot = bridge.getSnapshot();

      expect(snapshot).not.toBeNull();
      expect(snapshot!.data.count).toBe(10);
      expect(snapshot!.data.lastIntent).toBe("init");
    });

    it("should include computed values after dispatch", async () => {
      // Note: Computed values may only be fully evaluated after dispatch
      // because the initial genesis snapshot might not include computed values
      await bridge.dispatch({ type: "add", input: { amount: 0 } });

      const snapshot = bridge.getSnapshot();

      expect(snapshot).not.toBeNull();
      // After dispatch, computed values should be available
      // SnapshotView strips "computed." prefix from keys
      expect(snapshot!.computed["doubled"]).toBe(20);
    });
  });

  describe("get", () => {
    it("should return value at path", () => {
      const count = bridge.get("count");
      expect(count).toBe(10);
    });

    it("should return computed value", () => {
      const doubled = bridge.get("computed.doubled");
      expect(doubled).toBe(20);
    });
  });
});
