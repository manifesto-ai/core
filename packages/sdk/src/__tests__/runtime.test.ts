import { describe, expect, it, vi } from "vitest";

import {
  DisposedError,
  ManifestoError,
  createManifesto,
} from "../index.js";
import { createCounterSchema, type CounterDomain } from "./helpers/schema.js";

describe("activated base runtime", () => {
  it("resolves with the published terminal snapshot on success", async () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const snapshot = await world.dispatchAsync(
      world.createIntent(world.MEL.actions.increment),
    );

    expect(snapshot.data.count).toBe(1);
    expect(world.getSnapshot().data.count).toBe(1);
    world.dispose();
  });

  it("checks availability at dequeue time and rejects without publication", async () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const subscriber = vi.fn();
    const rejected = vi.fn();

    world.subscribe((snapshot) => snapshot.data.count, subscriber);
    world.on("dispatch:rejected", rejected);

    const first = world.dispatchAsync(
      world.createIntent(world.MEL.actions.increment),
    );
    const second = world.dispatchAsync(
      world.createIntent(world.MEL.actions.incrementIfEven),
    );

    await expect(first).resolves.toMatchObject({ data: { count: 1 } });
    await expect(second).rejects.toMatchObject<Partial<ManifestoError>>({
      code: "ACTION_UNAVAILABLE",
    });

    expect(world.getSnapshot().data.count).toBe(1);
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(rejected).toHaveBeenCalledTimes(1);
    world.dispose();
  });

  it("publishes failed snapshots and emits dispatch:failed when host returns an error snapshot", async () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {
      "api.fetch": async () => {
        throw new Error("boom");
      },
    }).activate();

    const subscriber = vi.fn();
    const failed = vi.fn();

    world.subscribe((snapshot) => snapshot.system.status, subscriber);
    world.on("dispatch:failed", failed);

    await expect(
      world.dispatchAsync(world.createIntent(world.MEL.actions.load)),
    ).rejects.toBeInstanceOf(Error);

    const failedSnapshot = failed.mock.calls[0]?.[0].snapshot;
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(failedSnapshot).toBeDefined();
    expect(world.getSnapshot()).toMatchObject(failedSnapshot);
    world.dispose();
  });

  it("subscribers do not fire on registration and use selector projection with Object.is", async () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const listener = vi.fn();

    world.subscribe((snapshot) => snapshot.data.count > 0, listener);

    expect(listener).not.toHaveBeenCalled();

    await world.dispatchAsync(world.createIntent(world.MEL.actions.increment));
    await world.dispatchAsync(world.createIntent(world.MEL.actions.increment));

    expect(listener).toHaveBeenCalledTimes(1);
    world.dispose();
  });

  it("dispose rejects future dispatches and snapshot mutation does not leak back in", async () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    await world.dispatchAsync(world.createIntent(world.MEL.actions.add, 3));

    const snapshot = world.getSnapshot();
    (snapshot.data as { count: number }).count = 999;
    expect(world.getSnapshot().data.count).toBe(3);

    world.dispose();

    await expect(
      world.dispatchAsync(world.createIntent(world.MEL.actions.increment)),
    ).rejects.toBeInstanceOf(DisposedError);
  });
});
