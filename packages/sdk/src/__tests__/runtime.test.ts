import { describe, expect, it, vi } from "vitest";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";

import {
  DisposedError,
  ManifestoError,
  createManifesto,
} from "../index.js";
import { createCounterSchema, type CounterDomain } from "./helpers/schema.js";

const pp = semanticPathToPatchPath;

type ProjectionDomain = {
  actions: {
    touchHost: () => void;
    capture: () => void;
  };
  state: {
    status: string;
    count: number;
  };
  computed: {
    safeCount: number;
    hostValue: string | null;
    hostDerived: string | null;
  };
};

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

function createProjectionSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-v3-projection",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        status: { type: "string", required: false, default: "idle" },
        count: { type: "number", required: false, default: 0 },
      },
    },
    computed: {
      fields: {
        safeCount: {
          deps: ["count"],
          expr: { kind: "get", path: "count" },
        },
        hostValue: {
          deps: ["$host.requestId"],
          expr: { kind: "get", path: "$host.requestId" },
        },
        hostDerived: {
          deps: ["hostValue"],
          expr: { kind: "get", path: "hostValue" },
        },
      },
    },
    actions: {
      touchHost: {
        flow: {
          kind: "if",
          cond: {
            kind: "isNull",
            arg: { kind: "get", path: "$host.requestId" },
          },
          then: {
            kind: "effect",
            type: "host.touch",
            params: {},
          },
        },
      },
      capture: {
        flow: {
          kind: "if",
          cond: {
            kind: "isNull",
            arg: { kind: "get", path: "$host.requestId" },
          },
          then: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: pp("status"),
                value: { kind: "lit", value: "loading" },
              },
              {
                kind: "effect",
                type: "api.fetch",
                params: {},
              },
            ],
          },
        },
      },
    },
  });
}

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

  it("returns projected snapshots by default and exposes the canonical substrate explicitly", () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const snapshot = world.getSnapshot();
    const canonical = world.getCanonicalSnapshot();

    expect(snapshot.data).not.toHaveProperty("$host");
    expect(snapshot.data).not.toHaveProperty("$mel");
    expect(snapshot.system).toEqual({
      status: "idle",
      lastError: null,
    });
    expect(snapshot.meta).toEqual({
      schemaHash: canonical.meta.schemaHash,
    });
    expect("input" in snapshot).toBe(false);

    expect(canonical.data.$host).toBeDefined();
    expect(canonical.data.$mel).toBeDefined();
    expect(canonical.system.pendingRequirements).toEqual([]);
    expect(canonical.system.currentAction).toBeNull();
    expect(canonical.meta.version).toBe(0);
    expect(canonical.meta.timestamp).toEqual(expect.any(Number));
    expect(canonical.meta.randomSeed).toBe("initial");

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
    expect(failedSnapshot?.data).not.toHaveProperty("$host");
    expect("pendingRequirements" in (failedSnapshot?.system ?? {})).toBe(false);
    expect("input" in (failedSnapshot ?? {})).toBe(false);
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

  it("does not publish canonical-only changes and filters $*-dependent computed values", async () => {
    const completed = vi.fn();
    const subscriber = vi.fn();
    const world = createManifesto<ProjectionDomain>(createProjectionSchema(), {
      "host.touch": async () => [{
        op: "set",
        path: pp("$host.requestId"),
        value: "req-1",
      }],
    }).activate();

    const before = world.getSnapshot();
    const canonicalBefore = world.getCanonicalSnapshot();

    world.subscribe((snapshot) => snapshot, subscriber);
    world.on("dispatch:completed", completed);

    expect(before.computed).toEqual({ safeCount: 0 });
    expect(canonicalBefore.computed).toHaveProperty("hostValue");
    expect(canonicalBefore.computed).toHaveProperty("hostDerived");

    const resolved = await world.dispatchAsync(
      world.createIntent(world.MEL.actions.touchHost),
    );
    const after = world.getSnapshot();
    const canonicalAfter = world.getCanonicalSnapshot();

    expect(resolved).toBe(after);
    expect(after).toBe(before);
    expect(after.computed).toEqual({ safeCount: 0 });
    expect(subscriber).not.toHaveBeenCalled();
    expect(completed).toHaveBeenCalledTimes(1);
    expect(canonicalAfter.data.$host?.requestId).toBe("req-1");
    expect(canonicalAfter.computed.hostValue).toBe("req-1");
    expect(canonicalAfter.computed.hostDerived).toBe("req-1");

    world.dispose();
  });

  it("passes projected snapshots to SDK effect handlers", async () => {
    const seenSnapshots: unknown[] = [];
    const world = createManifesto<ProjectionDomain>(createProjectionSchema(), {
      "api.fetch": async (_params, ctx) => {
        seenSnapshots.push(ctx.snapshot);
        return [{
          op: "set",
          path: pp("$host.requestId"),
          value: "req-2",
        }];
      },
    }).activate();

    await world.dispatchAsync(world.createIntent(world.MEL.actions.capture));

    expect(seenSnapshots).toHaveLength(1);
    expect(seenSnapshots[0]).toMatchObject({
      data: {
        count: 0,
        status: "loading",
      },
      system: {
        status: "pending",
      },
      meta: {
        schemaHash: world.getCanonicalSnapshot().meta.schemaHash,
      },
    });
    expect((seenSnapshots[0] as { data: Record<string, unknown> }).data).not.toHaveProperty("$host");
    expect((seenSnapshots[0] as { system: Record<string, unknown> }).system).not.toHaveProperty("pendingRequirements");
    expect("input" in (seenSnapshots[0] as object)).toBe(false);

    world.dispose();
  });

  it("dispose rejects future dispatches and snapshot mutation does not leak back in", async () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    await world.dispatchAsync(world.createIntent(world.MEL.actions.add, 3));

    const snapshot = world.getSnapshot();
    expect(() => {
      (snapshot.data as { count: number }).count = 999;
    }).toThrow(TypeError);
    expect(world.getSnapshot().data.count).toBe(3);

    world.dispose();

    await expect(
      world.dispatchAsync(world.createIntent(world.MEL.actions.increment)),
    ).rejects.toBeInstanceOf(DisposedError);
  });
});
