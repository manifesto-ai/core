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
import { getExtensionKernel } from "../extensions.js";
import { getRuntimeKernelFactory } from "../provider.js";
import { projectedSnapshotsEqual } from "../snapshot-projection.js";
import {
  createCounterSchema,
  createDispatchabilitySchema,
  type CounterDomain,
  type DispatchabilityDomain,
} from "./helpers/schema.js";

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
    slashHostValue: string | null;
    slashHostDerived: string | null;
    stealthHostValue: string | null;
    stealthHostDerived: string | null;
  };
};

type InvalidDispatchabilityDomain = {
  actions: {
    blockedInvalid: () => void;
  };
  state: {
    enabled: boolean;
  };
  computed: {};
};

type FlowInvalidInputDomain = {
  actions: {
    brokenMap: () => void;
  };
  state: {
    items: number[];
  };
  computed: {};
};

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

function createInvalidDispatchabilitySchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-v3-invalid-dispatchability",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        enabled: { type: "boolean", required: false, default: false },
      },
    },
    computed: { fields: {} },
    actions: {
      blockedInvalid: {
        available: { kind: "get", path: "enabled" },
        dispatchable: { kind: "lit", value: "not-a-boolean" },
        flow: { kind: "halt", reason: "blockedInvalid" },
      },
    },
  });
}

function createFlowInvalidInputSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-v3-flow-invalid-input",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        items: {
          type: "array",
          required: false,
          default: [],
          items: { type: "number", required: true },
        },
      },
    },
    computed: { fields: {} },
    actions: {
      brokenMap: {
        flow: {
          kind: "effect",
          type: "array.map",
          params: {
            into: { kind: "lit", value: "items" },
            select: { kind: "lit", value: 1 },
          },
        },
      },
    },
  });
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
        slashHostValue: {
          deps: ["/$host.requestId"],
          expr: { kind: "get", path: "/$host.requestId" },
        },
        slashHostDerived: {
          deps: ["slashHostValue"],
          expr: { kind: "get", path: "slashHostValue" },
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

  it("exposes projected SchemaGraph traversal through refs and kind-prefixed debug ids", () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const graph = world.getSchemaGraph();
    const downstream = graph.traceDown(world.MEL.state.count);
    const upstream = graph.traceUp(world.MEL.actions.incrementIfEven);
    const debug = graph.traceDown("state:count");
    let rejectedPlainName = false;
    let rejectedMalformedId = false;

    try {
      graph.traceDown("count" as never);
    } catch (error) {
      rejectedPlainName = error instanceof ManifestoError
        && error.code === "SCHEMA_ERROR";
    }

    try {
      graph.traceDown("state:" as never);
    } catch (error) {
      rejectedMalformedId = error instanceof ManifestoError
        && error.code === "SCHEMA_ERROR";
    }

    expect(graph.nodes.map((node) => node.id)).toEqual([
      "state:count",
      "state:status",
      "computed:doubled",
      "action:increment",
      "action:add",
      "action:incrementIfEven",
      "action:load",
    ]);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: "state:count", to: "computed:doubled", relation: "feeds" },
        { from: "state:count", to: "action:incrementIfEven", relation: "unlocks" },
        { from: "action:increment", to: "state:count", relation: "mutates" },
      ]),
    );
    expect(graph.nodes.every((node) => !node.id.includes("$"))).toBe(true);
    expect(downstream.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "state:count",
        "computed:doubled",
        "action:incrementIfEven",
      ]),
    );
    expect(upstream.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "state:count",
        "action:incrementIfEven",
      ]),
    );
    expect(debug.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["state:count"]),
    );
    expect(rejectedPlainName).toBe(true);
    expect(rejectedMalformedId).toBe(true);

    world.dispose();
  });

  it("rejects refs that are not part of the projected graph", () => {
    const world = createManifesto<ProjectionDomain>(createProjectionSchema(), {}).activate();
    const graph = world.getSchemaGraph();
    const snapshot = world.getSnapshot();

    expect(() => graph.traceDown(world.MEL.computed.hostValue)).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "SCHEMA_ERROR",
      }),
    );
    expect(() => graph.traceDown(world.MEL.computed.slashHostValue)).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "SCHEMA_ERROR",
      }),
    );
    expect(snapshot.computed).not.toHaveProperty("hostValue");
    expect(snapshot.computed).not.toHaveProperty("slashHostValue");

    world.dispose();
  });

  it("simulates pending actions without publishing state and diffs only the projected surface", () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const before = world.getSnapshot();
    const simulated = world.simulate(world.MEL.actions.load);
    const after = world.getSnapshot();

    expect(before.data.status).toBe("idle");
    expect(after.data.status).toBe("idle");
    expect(after.data.count).toBe(before.data.count);
    expect(simulated.status).toBe("pending");
    expect(simulated.snapshot).toMatchObject({
      data: {
        count: 0,
        status: "loading",
      },
      computed: {
        doubled: 0,
      },
      system: {
        status: "pending",
      },
    });
    expect(simulated.changedPaths).toEqual(
      expect.arrayContaining(["data.status", "system.status"]),
    );
    expect(simulated.changedPaths).toEqual(
      [...simulated.changedPaths].sort(),
    );
    expect(simulated.changedPaths.every((path) =>
      !path.includes("$")
      && path !== "system.pendingRequirements"
      && path !== "system.currentAction")).toBe(true);
    expect(simulated.requirements).toHaveLength(1);
    expect(simulated.newAvailableActions).toEqual(
      expect.arrayContaining(["incrementIfEven"]),
    );
    expect(world.getCanonicalSnapshot().system.pendingRequirements).toEqual([]);

    world.dispose();
  });

  it("simulates projected no-op actions with empty changedPaths and stable repeated results", () => {
    type NoOpProjectedDomain = {
      actions: {
        touchHostDirect: () => void;
      };
      state: {
        count: number;
      };
      computed: {};
    };

    const world = createManifesto<NoOpProjectedDomain>(withHash({
      id: "manifesto:sdk-v3-noop-simulate",
      version: "1.0.0",
      types: {},
      state: {
        fields: {
          count: { type: "number", required: false, default: 0 },
        },
      },
      computed: {
        fields: {},
      },
      actions: {
        touchHostDirect: {
          flow: {
            kind: "patch",
            op: "set",
            path: pp("count"),
            value: { kind: "get", path: "count" },
          },
        },
      },
    }), {}).activate();

    const before = world.getSnapshot();
    const first = world.simulate(world.MEL.actions.touchHostDirect);
    const second = world.simulate(world.MEL.actions.touchHostDirect);
    const after = world.getSnapshot();

    expect(first.status).toBe("complete");
    expect(first.changedPaths).toEqual([]);
    expect(first.requirements).toEqual([]);
    expect(first.snapshot).toEqual(before);
    expect(second).toEqual(first);
    expect(after).toEqual(before);

    world.dispose();
  });

  it("simulates from the same host intent-slot baseline as dispatch", async () => {
    type IntentSlotDomain = {
      actions: {
        markViaSlot: () => void;
      };
      state: {
        status: string;
      };
      computed: {};
    };

    const world = createManifesto<IntentSlotDomain>(withHash({
      id: "manifesto:sdk-v3-intent-slot-simulate",
      version: "1.0.0",
      types: {},
      state: {
        fields: {
          status: { type: "string", required: false, default: "idle" },
        },
      },
      computed: {
        fields: {},
      },
      actions: {
        markViaSlot: {
          flow: {
            kind: "patch",
            op: "set",
            path: pp("status"),
            value: {
              kind: "if",
              cond: {
                kind: "isNull",
                arg: { kind: "get", path: "$host.intentSlots" },
              },
              then: { kind: "lit", value: "missing" },
              else: { kind: "lit", value: "present" },
            },
          },
        },
      },
    }), {}).activate();

    const simulated = world.simulate(world.MEL.actions.markViaSlot);
    const before = world.getSnapshot();
    const resolved = await world.dispatchAsync(
      world.createIntent(world.MEL.actions.markViaSlot),
    );

    expect(before.data.status).toBe("idle");
    expect(simulated.status).toBe("complete");
    expect(simulated.snapshot.data.status).toBe("present");
    expect(world.getSnapshot().data.status).toBe("present");
    expect(resolved.data.status).toBe("present");

    world.dispose();
  });

  it("simulates halted actions and unavailable actions without committing runtime state", async () => {
    type HaltingDomain = {
      actions: {
        finalize: () => void;
      };
      state: {
        status: string;
      };
      computed: {};
    };

    const haltingWorld = createManifesto<HaltingDomain>(withHash({
      id: "manifesto:sdk-v3-halting",
      version: "1.0.0",
      types: {},
      state: {
        fields: {
          status: { type: "string", required: false, default: "idle" },
        },
      },
      computed: {
        fields: {},
      },
      actions: {
        finalize: {
          flow: {
            kind: "halt",
            reason: "done",
          },
        },
      },
    }), {}).activate();

    const halted = haltingWorld.simulate(haltingWorld.MEL.actions.finalize);
    expect(halted.status).toBe("halted");
    expect(halted.changedPaths).toEqual([]);
    expect(haltingWorld.getSnapshot().data.status).toBe("idle");
    haltingWorld.dispose();

    const counterWorld = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    await counterWorld.dispatchAsync(counterWorld.createIntent(counterWorld.MEL.actions.increment));
    expect(() => counterWorld.simulate(counterWorld.MEL.actions.incrementIfEven)).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "ACTION_UNAVAILABLE",
      }),
    );
    expect(counterWorld.getSnapshot().data.count).toBe(1);
    counterWorld.dispose();
  });

  it("simulates arbitrary canonical snapshots without mutating visible runtime state", () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(manifesto)();
    const canonical = kernel.getCanonicalSnapshot();
    const intent = kernel.createIntent(kernel.MEL.actions.increment);
    const first = kernel.simulateSync(canonical, intent);
    const second = kernel.simulateSync(canonical, intent);
    const normalizeTimestamp = (
      result: typeof first,
    ) => ({
      ...result,
      snapshot: {
        ...result.snapshot,
        meta: {
          ...result.snapshot.meta,
          timestamp: 0,
        },
      },
    });

    expect(normalizeTimestamp(first)).toEqual(normalizeTimestamp(second));
    expect(first.status).toBe("complete");
    expect(first.snapshot.data.count).toBe(1);
    expect(canonical.data.count).toBe(0);
    expect(kernel.getCanonicalSnapshot().data.count).toBe(0);

    kernel.dispose();
  });

  it("queries action availability against arbitrary canonical snapshots through RuntimeKernel", () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(manifesto)();
    const canonical = kernel.getCanonicalSnapshot();
    const incremented = kernel.simulateSync(
      canonical,
      kernel.createIntent(kernel.MEL.actions.increment),
    );

    expect(kernel.isActionAvailableFor(canonical, "incrementIfEven")).toBe(true);
    expect(kernel.isActionAvailableFor(incremented.snapshot, "incrementIfEven")).toBe(false);
    expect(kernel.isActionAvailable("incrementIfEven")).toBe(true);
    expect(kernel.getAvailableActionsFor(incremented.snapshot)).not.toContain("incrementIfEven");
    expect(kernel.getAvailableActions()).toContain("incrementIfEven");

    kernel.dispose();
  });

  it("returns canonical simulation metadata for pending results and rejects unavailable arbitrary-snapshot dry-runs", () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(manifesto)();
    const canonical = kernel.getCanonicalSnapshot();
    const pending = kernel.simulateSync(
      canonical,
      kernel.createIntent(kernel.MEL.actions.load),
    );
    const odd = kernel.simulateSync(
      canonical,
      kernel.createIntent(kernel.MEL.actions.increment),
    );

    expect(pending.status).toBe("pending");
    expect(pending.patches).toHaveLength(1);
    expect(pending.requirements).toHaveLength(1);
    expect(pending.systemDelta.addRequirements).toHaveLength(1);
    expect(pending.snapshot.system.pendingRequirements).toHaveLength(1);
    expect(kernel.getCanonicalSnapshot().system.pendingRequirements).toEqual([]);

    expect(() =>
      kernel.simulateSync(
        odd.snapshot,
        kernel.createIntent(kernel.MEL.actions.incrementIfEven),
      )).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "ACTION_UNAVAILABLE",
      }),
    );

    kernel.dispose();
  });

  it("queries bound-intent dispatchability and blockers through the base runtime", async () => {
    const world = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();

    expect(world.isIntentDispatchable(world.MEL.actions.incrementGuarded, 1)).toBe(true);
    expect(world.getIntentBlockers(world.MEL.actions.incrementGuarded, 1)).toEqual([]);

    await world.dispatchAsync(world.createIntent(world.MEL.actions.increment));

    expect(world.isIntentDispatchable(world.MEL.actions.incrementGuarded, 1)).toBe(false);
    expect(world.getIntentBlockers(world.MEL.actions.incrementGuarded, 1)).toEqual([
      expect.objectContaining({
        layer: "dispatchable",
        evaluatedResult: false,
      }),
    ]);

    await world.dispatchAsync(world.createIntent(world.MEL.actions.disable));

    expect(world.getIntentBlockers(world.MEL.actions.incrementGuarded, 5)).toEqual([
      expect.objectContaining({
        layer: "available",
        evaluatedResult: false,
      }),
    ]);

    world.dispose();
  });

  it("rejects non-dispatchable dry-runs before compute begins", async () => {
    const world = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();

    await world.dispatchAsync(world.createIntent(world.MEL.actions.increment));

    expect(() => world.simulate(world.MEL.actions.incrementGuarded, 1)).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "INTENT_NOT_DISPATCHABLE",
      }),
    );
    expect(world.getSnapshot().data.count).toBe(1);

    world.dispose();
  });

  it("rejects invalid input before dispatchability during dry-runs", () => {
    const world = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();
    const ext = getExtensionKernel(world);

    const invalidIntent = {
      ...world.createIntent(world.MEL.actions.incrementGuarded, 1),
      input: { max: "not-a-number" },
    } as Parameters<typeof ext.simulateSync>[1];

    expect(() => ext.simulateSync(
      world.getCanonicalSnapshot(),
      invalidIntent,
    )).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "INVALID_INPUT",
      }),
    );
    expect(world.getSnapshot().data.count).toBe(0);

    world.dispose();
  });

  it("short-circuits invalid dispatchability behind availability across runtime queries", () => {
    const world = createManifesto<InvalidDispatchabilityDomain>(
      createInvalidDispatchabilitySchema(),
      {},
    ).activate();

    expect(world.isIntentDispatchable(world.MEL.actions.blockedInvalid)).toBe(false);
    expect(world.getIntentBlockers(world.MEL.actions.blockedInvalid)).toEqual([
      expect.objectContaining({
        layer: "available",
        evaluatedResult: false,
      }),
    ]);
    expect(() => world.simulate(world.MEL.actions.blockedInvalid)).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "ACTION_UNAVAILABLE",
      }),
    );

    world.dispose();
  });

  it("checks dispatchability against arbitrary canonical snapshots through RuntimeKernel", () => {
    const manifesto = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    );
    const kernel = getRuntimeKernelFactory(manifesto)();
    const canonical = kernel.getCanonicalSnapshot();
    const guardedIntent = kernel.createIntent(kernel.MEL.actions.incrementGuarded, 1);
    const incremented = kernel.simulateSync(
      canonical,
      kernel.createIntent(kernel.MEL.actions.increment),
    );

    expect(kernel.isIntentDispatchableFor(canonical, guardedIntent)).toBe(true);
    expect(kernel.isIntentDispatchableFor(incremented.snapshot, guardedIntent)).toBe(false);

    kernel.dispose();
  });

  it("exposes a pure extension kernel with current-snapshot simulate parity", () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const ext = getExtensionKernel(world);
    const subscriber = vi.fn();
    const completed = vi.fn();

    world.subscribe((snapshot) => snapshot.data.count, subscriber);
    world.on("dispatch:completed", completed);

    const beforeProjected = world.getSnapshot();
    const beforeCanonical = world.getCanonicalSnapshot();
    const intent = ext.createIntent(ext.MEL.actions.increment);
    const simulated = ext.simulateSync(ext.getCanonicalSnapshot(), intent);
    const projected = ext.projectSnapshot(simulated.snapshot);
    const publicSimulated = world.simulate(world.MEL.actions.increment);

    expect(ext.MEL).toBe(world.MEL);
    expect(ext.schema).toBe(world.schema);
    expect(ext.getCanonicalSnapshot()).toEqual(beforeCanonical);
    expect(projected).toEqual(publicSimulated.snapshot);
    expect(simulated.status).toBe(publicSimulated.status);
    expect(simulated.requirements).toEqual(publicSimulated.requirements);
    expect(ext.getAvailableActionsFor(simulated.snapshot)).toEqual(publicSimulated.newAvailableActions);
    expect(world.getSnapshot()).toBe(beforeProjected);
    expect(world.getCanonicalSnapshot()).toEqual(beforeCanonical);
    expect(subscriber).not.toHaveBeenCalled();
    expect(completed).not.toHaveBeenCalled();

    world.dispose();
  });

  it("keeps extension-kernel methods available after runtime disposal", () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const ext = getExtensionKernel(world);
    const canonical = ext.getCanonicalSnapshot();
    const intent = ext.createIntent(ext.MEL.actions.increment);

    world.dispose();

    expect(ext.getCanonicalSnapshot()).toEqual(canonical);
    expect(ext.projectSnapshot(canonical)).toEqual(world.getSnapshot());

    const simulated = ext.simulateSync(canonical, intent);
    expect(simulated.snapshot.data.count).toBe(1);
    expect(ext.getAvailableActionsFor(simulated.snapshot)).not.toContain("incrementIfEven");
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
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({ code: "ACTION_UNAVAILABLE" });
    world.dispose();
  });

  it("checks dispatchability at dequeue time and rejects without publication", async () => {
    const world = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();
    const subscriber = vi.fn();
    const rejected = vi.fn();

    world.subscribe((snapshot) => snapshot.data.count, subscriber);
    world.on("dispatch:rejected", rejected);

    const first = world.dispatchAsync(
      world.createIntent(world.MEL.actions.increment),
    );
    const second = world.dispatchAsync(
      world.createIntent(world.MEL.actions.incrementGuarded, 1),
    );

    await expect(first).resolves.toMatchObject({ data: { count: 1 } });
    await expect(second).rejects.toMatchObject<Partial<ManifestoError>>({
      code: "INTENT_NOT_DISPATCHABLE",
    });

    expect(world.getSnapshot().data.count).toBe(1);
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({
      code: "INTENT_NOT_DISPATCHABLE",
    });
    world.dispose();
  });

  it("rejects invalid input before dispatchability checks", async () => {
    const world = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();
    const subscriber = vi.fn();
    const rejected = vi.fn();

    world.subscribe((snapshot) => snapshot.data.count, subscriber);
    world.on("dispatch:rejected", rejected);

    const invalidIntent = {
      ...world.createIntent(world.MEL.actions.incrementGuarded, 1),
      input: { max: "not-a-number" },
    } as unknown as Parameters<typeof world.dispatchAsync>[0];

    await expect(world.dispatchAsync(invalidIntent)).rejects.toMatchObject<Partial<ManifestoError>>({
      code: "INVALID_INPUT",
    });

    expect(world.getSnapshot().data.count).toBe(0);
    expect(subscriber).not.toHaveBeenCalled();
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(rejected.mock.calls[0]?.[0]).toMatchObject({
      code: "INVALID_INPUT",
    });
    world.dispose();
  });

  it("does not pre-classify flow INVALID_INPUT failures as rejected input", async () => {
    const world = createManifesto<FlowInvalidInputDomain>(
      createFlowInvalidInputSchema(),
      {},
    ).activate();
    const rejected = vi.fn();
    const failed = vi.fn();

    world.on("dispatch:rejected", rejected);
    world.on("dispatch:failed", failed);

    await expect(
      world.dispatchAsync(world.createIntent(world.MEL.actions.brokenMap)),
    ).rejects.toMatchObject<Partial<ManifestoError>>({
      code: "EFFECT_EXECUTION_FAILED",
    });

    expect(rejected).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledTimes(1);
    expect(failed.mock.calls[0]?.[0]).toMatchObject({
      error: expect.objectContaining({
        code: "EFFECT_EXECUTION_FAILED",
        details: expect.objectContaining({
          lastError: expect.objectContaining({
            code: "INVALID_INPUT",
          }),
        }),
      }),
      snapshot: expect.objectContaining({
        system: expect.objectContaining({
          lastError: expect.objectContaining({
            code: "INVALID_INPUT",
          }),
        }),
      }),
    });

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
    expect(canonicalBefore.computed).toHaveProperty("slashHostValue");
    expect(canonicalBefore.computed).toHaveProperty("slashHostDerived");
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
    expect(canonicalAfter.computed).toHaveProperty("slashHostValue");
    expect(canonicalAfter.computed).toHaveProperty("slashHostDerived");
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
