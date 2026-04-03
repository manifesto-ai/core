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
import { projectedSnapshotsEqual } from "../snapshot-projection.js";
import { createCounterSchema, type CounterDomain } from "./helpers/schema.js";

const pp = semanticPathToPatchPath;

type ProjectionDomain = {
  actions: {
    touchHost: () => void;
    touchHostCycle: () => void;
    touchDataCycle: () => void;
    capture: () => void;
  };
  state: {
    status: string;
    count: number;
    items?: { active: boolean }[];
    payload?: Record<string, unknown>;
  };
  computed: {
    safeCount: number;
    activeCount: number;
    literalPayload: { kind: string; path: string };
    literalPayloadDerived: { kind: string; path: string };
    hostValue: string | null;
    hostDerived: string | null;
    stealthHostValue: string | null;
    stealthHostDerived: string | null;
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
        items: {
          type: "array",
          required: false,
          default: [{ active: true }, { active: false }],
          items: {
            type: "object",
            required: true,
            fields: {
              active: { type: "boolean", required: true },
            },
          },
        },
        payload: { type: "object", required: false },
      },
    },
    computed: {
      fields: {
        safeCount: {
          deps: ["count"],
          expr: { kind: "get", path: "count" },
        },
        activeCount: {
          deps: ["items"],
          expr: {
            kind: "len",
            arg: {
              kind: "filter",
              array: {
                kind: "coalesce",
                args: [
                  { kind: "get", path: "items" },
                  { kind: "lit", value: [] },
                ],
              },
              predicate: { kind: "get", path: "$item.active" },
            },
          },
        },
        literalPayload: {
          deps: [],
          expr: {
            kind: "lit",
            value: {
              kind: "get",
              path: "$host.requestId",
            },
          },
        },
        literalPayloadDerived: {
          deps: ["literalPayload"],
          expr: { kind: "get", path: "literalPayload" },
        },
        hostValue: {
          deps: ["$host.requestId"],
          expr: { kind: "get", path: "$host.requestId" },
        },
        hostDerived: {
          deps: ["hostValue"],
          expr: { kind: "get", path: "hostValue" },
        },
        stealthHostValue: {
          deps: [],
          expr: { kind: "get", path: "$host.requestId" },
        },
        stealthHostDerived: {
          deps: ["stealthHostValue"],
          expr: { kind: "get", path: "stealthHostValue" },
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
      touchHostCycle: {
        flow: {
          kind: "if",
          cond: {
            kind: "isNull",
            arg: { kind: "get", path: "$host.cycle" },
          },
          then: {
            kind: "effect",
            type: "host.cycle",
            params: {},
          },
        },
      },
      touchDataCycle: {
        flow: {
          kind: "if",
          cond: {
            kind: "isNull",
            arg: { kind: "get", path: "payload" },
          },
          then: {
            kind: "effect",
            type: "state.cycle",
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

    expect(before.computed).toEqual({
      safeCount: 0,
      activeCount: 1,
      literalPayload: { kind: "get", path: "$host.requestId" },
      literalPayloadDerived: { kind: "get", path: "$host.requestId" },
    });
    expect(canonicalBefore.computed).toHaveProperty("hostValue");
    expect(canonicalBefore.computed).toHaveProperty("hostDerived");
    expect(canonicalBefore.computed).toHaveProperty("stealthHostValue");
    expect(canonicalBefore.computed).toHaveProperty("stealthHostDerived");

    const resolved = await world.dispatchAsync(
      world.createIntent(world.MEL.actions.touchHost),
    );
    const after = world.getSnapshot();
    const canonicalAfter = world.getCanonicalSnapshot();

    expect(resolved).toBe(after);
    expect(after).toBe(before);
    expect(after.computed).toEqual({
      safeCount: 0,
      activeCount: 1,
      literalPayload: { kind: "get", path: "$host.requestId" },
      literalPayloadDerived: { kind: "get", path: "$host.requestId" },
    });
    expect(subscriber).not.toHaveBeenCalled();
    expect(completed).toHaveBeenCalledTimes(1);
    expect(canonicalAfter.data.$host?.requestId).toBe("req-1");
    expect(canonicalAfter.computed.hostValue).toBe("req-1");
    expect(canonicalAfter.computed.hostDerived).toBe("req-1");
    expect(canonicalAfter.computed.stealthHostValue).toBe("req-1");
    expect(canonicalAfter.computed.stealthHostDerived).toBe("req-1");

    world.dispose();
  });

  it("guards canonical snapshot freezing against cyclic platform values", async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    const world = createManifesto<ProjectionDomain>(createProjectionSchema(), {
      "host.cycle": async () => [{
        op: "set",
        path: pp("$host.cycle"),
        value: cyclic,
      }],
    }).activate();

    const resolved = await world.dispatchAsync(
      world.createIntent(world.MEL.actions.touchHostCycle),
    );
    expect(resolved).toBe(world.getSnapshot());

    const canonical = world.getCanonicalSnapshot();
    const hostCycle = canonical.data.$host?.cycle as
      | Record<string, unknown>
      | undefined;

    expect(hostCycle).toBeDefined();
    expect(hostCycle?.self).toBe(hostCycle);
    expect(Object.isFrozen(hostCycle)).toBe(true);

    world.dispose();
  });

  it("keeps iterator-local computed values visible and compares cyclic projected data safely", async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    const world = createManifesto<ProjectionDomain>(createProjectionSchema(), {
      "state.cycle": async () => [{
        op: "set",
        path: pp("payload"),
        value: cyclic,
      }],
    }).activate();

    expect(world.getSnapshot().computed).toEqual({
      safeCount: 0,
      activeCount: 1,
      literalPayload: { kind: "get", path: "$host.requestId" },
      literalPayloadDerived: { kind: "get", path: "$host.requestId" },
    });

    const resolved = await world.dispatchAsync(
      world.createIntent(world.MEL.actions.touchDataCycle),
    );
    const snapshot = world.getSnapshot();
    expect(resolved).toBe(snapshot);
    const payload = snapshot.data.payload as Record<string, unknown> | undefined;

    expect(snapshot.computed).toEqual({
      safeCount: 0,
      activeCount: 1,
      literalPayload: { kind: "get", path: "$host.requestId" },
      literalPayloadDerived: { kind: "get", path: "$host.requestId" },
    });
    expect(payload).toBeDefined();
    expect(payload?.self).toBe(payload);
    expect(Object.isFrozen(payload)).toBe(true);

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
      computed: {
        safeCount: 0,
        activeCount: 1,
        literalPayload: { kind: "get", path: "$host.requestId" },
        literalPayloadDerived: { kind: "get", path: "$host.requestId" },
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

  it("publishes snapshots containing typed array values without freeze failures", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const world = createManifesto<ProjectionDomain>(createProjectionSchema(), {
      "state.cycle": async () => [{
        op: "set",
        path: pp("payload"),
        value: {
          bytes,
        },
      }],
    }).activate();

    const resolved = await world.dispatchAsync(
      world.createIntent(world.MEL.actions.touchDataCycle),
    );

    const snapshot = world.getSnapshot();
    const canonical = world.getCanonicalSnapshot();
    const projectedBytes = (snapshot.data.payload as { bytes?: Uint8Array } | undefined)?.bytes;
    const canonicalBytes = (canonical.data.payload as { bytes?: Uint8Array } | undefined)?.bytes;

    expect(resolved).toBe(snapshot);
    expect(projectedBytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(projectedBytes ?? [])).toEqual([1, 2, 3]);
    expect(canonicalBytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(canonicalBytes ?? [])).toEqual([1, 2, 3]);
    expect(Object.isFrozen(snapshot.data.payload as object)).toBe(true);
    expect(Object.isFrozen(canonical.data.payload as object)).toBe(true);

    if (projectedBytes) {
      projectedBytes[0] = 9;
      expect(Array.from(projectedBytes)).toEqual([9, 2, 3]);
    }

    const nextProjectedBytes = ((world.getSnapshot().data.payload as {
      bytes?: Uint8Array;
    } | undefined)?.bytes);
    const nextCanonicalBytes = ((world.getCanonicalSnapshot().data.payload as {
      bytes?: Uint8Array;
    } | undefined)?.bytes);

    expect(Array.from(nextProjectedBytes ?? [])).toEqual([1, 2, 3]);
    expect(Array.from(nextCanonicalBytes ?? [])).toEqual([1, 2, 3]);

    world.dispose();
  });

  it("treats sparse array holes as distinct projected values", () => {
    const sparse = new Array(1);
    const defined = [undefined];

    expect(projectedSnapshotsEqual(
      {
        data: { payload: sparse },
        computed: {},
        system: { status: "idle", lastError: null },
        meta: { schemaHash: "schema" },
      },
      {
        data: { payload: defined },
        computed: {},
        system: { status: "idle", lastError: null },
        meta: { schemaHash: "schema" },
      },
    )).toBe(false);

    expect(projectedSnapshotsEqual(
      {
        data: { payload: defined },
        computed: {},
        system: { status: "idle", lastError: null },
        meta: { schemaHash: "schema" },
      },
      {
        data: { payload: sparse },
        computed: {},
        system: { status: "idle", lastError: null },
        meta: { schemaHash: "schema" },
      },
    )).toBe(false);
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
