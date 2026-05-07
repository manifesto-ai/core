import { describe, expect, it, vi } from "vitest";
import {
  apply,
  applyNamespaceDeltas,
  applySystemDelta,
  computeSync,
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
  type Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";
import {
  DisposedError,
  SubmissionFailedError,
  createManifesto,
} from "@manifesto-ai/sdk";

import {
  type LineageService,
} from "./types.js";
import { createInMemoryLineageStore } from "./store/in-memory-lineage-store.js";
import { createLineageService } from "./service/lineage-service.js";
import { withLineage } from "./with-lineage.js";

const pp = semanticPathToPatchPath;

type CounterDomain = {
  actions: {
    increment: () => void;
    add: (amount: number) => void;
    stop: () => void;
    fail: () => void;
  };
  state: {
    count: number;
    status: string;
  };
  computed: {};
};

type DispatchabilityDomain = {
  actions: {
    frozenSpend: (amount: number) => void;
  };
  state: {
    balance: number;
    enabled: boolean;
  };
  computed: {};
};

type ComputedDomain = {
  actions: {
    setCount: (count: number) => void;
  };
  state: {
    count: number;
  };
  computed: {
    double: number;
  };
};

type CyclicComputedDomain = {
  actions: {
    noop: () => void;
  };
  state: {
    count: number;
  };
  computed: {
    a: number;
    b: number;
  };
};

type ObjectInputDomain = {
  actions: {
    choose: (input: { id: string }) => void;
  };
  state: {
    selectedId: string;
  };
  computed: {};
};

type MultiArgDomain = {
  actions: {
    rename: (name: string, force?: boolean) => void;
  };
  state: {
    name: string;
  };
  computed: {};
};

type GuardedBoundDomain = {
  actions: {
    record: (label: string) => void;
  };
  state: {
    count: number;
    label: string;
    lastIntentId: string;
  };
  computed: {};
};

type EffectFailureDomain = {
  actions: {
    load: () => void;
  };
  state: {
    status: string;
  };
  computed: {};
};

type V5SubmitResult = {
  readonly ok: boolean;
  readonly mode: string;
  readonly status?: string;
  readonly action: string;
  readonly before?: { readonly state: Record<string, unknown> };
  readonly after?: { readonly state: Record<string, unknown> };
  readonly world?: {
    readonly worldId?: string;
    readonly terminalStatus?: string;
    readonly snapshotHash?: string;
  };
  readonly outcome?: { readonly kind: string };
  readonly admission?: {
    readonly layer: string;
    readonly code: string;
  };
  readonly report?: {
    readonly mode?: string;
    readonly action?: string;
    readonly worldId?: string;
    readonly branchId?: string;
    readonly headAdvanced?: boolean;
    readonly published?: boolean;
    readonly outcome?: { readonly kind: string };
    readonly changes?: readonly string[];
    readonly requirements?: readonly unknown[];
    readonly diagnostics?: unknown;
  };
};

type V5ActionHandle = {
  readonly check: (...args: readonly unknown[]) => {
    readonly ok: boolean;
    readonly layer?: string;
    readonly code?: string;
  };
  readonly preview: (...args: readonly unknown[]) => {
    readonly admitted: boolean;
    readonly admission?: {
      readonly layer: string;
      readonly code: string;
    };
  };
  readonly submit: (...args: readonly unknown[]) => Promise<V5SubmitResult>;
  readonly bind: (...args: readonly unknown[]) => {
    readonly input: unknown;
    readonly check: () => {
      readonly ok: boolean;
      readonly layer?: string;
      readonly code?: string;
    };
    readonly preview: () => {
      readonly admitted: boolean;
      readonly admission?: {
        readonly layer: string;
        readonly code: string;
      };
    };
    readonly submit: () => Promise<V5SubmitResult>;
    readonly intent: () => unknown;
  };
};

type V5LineageRuntime<TActions extends Record<string, V5ActionHandle>> = {
  readonly action: TActions;
  readonly observe: {
    readonly state: (
      selector: (snapshot: { readonly state: Record<string, unknown> }) => unknown,
      listener: (next: unknown, prev: unknown) => void,
    ) => () => void;
    readonly event: (event: string, listener: (payload: unknown) => void) => () => void;
  };
  readonly snapshot: () => {
    readonly state: Record<string, unknown>;
    readonly computed: Record<string, unknown>;
  };
  readonly inspect: {
    readonly canonicalSnapshot: () => unknown;
    readonly schemaHash: () => string;
  };
  readonly dispose: () => void;
  readonly getWorld: (worldId: string) => Promise<unknown | null>;
  readonly getWorldSnapshot: (worldId: string) => Promise<unknown | null>;
  readonly getLatestHead: () => Promise<{ readonly worldId: string } | null>;
  readonly getActiveBranch: () => Promise<{
    readonly id: string;
    readonly head: string;
    readonly tip: string;
  }>;
  readonly with: (view: { readonly report?: "none" | "summary" | "full" }) => V5LineageRuntime<TActions>;
  readonly restore: (worldId: string) => Promise<void>;
  readonly commitAsync?: unknown;
  readonly commitAsyncWithReport?: unknown;
  readonly dispatchAsync?: unknown;
  readonly dispatchAsyncWithReport?: unknown;
};

type V5CounterLineageRuntime = V5LineageRuntime<{
  readonly increment: V5ActionHandle;
  readonly add: V5ActionHandle;
  readonly stop: V5ActionHandle;
  readonly fail: V5ActionHandle;
}>;

type V5DispatchabilityLineageRuntime = V5LineageRuntime<{
  readonly frozenSpend: V5ActionHandle;
}>;

type V5ComputedLineageRuntime = V5LineageRuntime<{
  readonly setCount: V5ActionHandle;
}>;

type V5CyclicComputedLineageRuntime = V5LineageRuntime<{
  readonly noop: V5ActionHandle;
}>;

type V5ObjectInputLineageRuntime = V5LineageRuntime<{
  readonly choose: V5ActionHandle;
}>;

type V5MultiArgLineageRuntime = V5LineageRuntime<{
  readonly rename: V5ActionHandle;
}>;

type V5GuardedBoundLineageRuntime = V5LineageRuntime<{
  readonly record: V5ActionHandle;
}>;

type V5EffectFailureLineageRuntime = V5LineageRuntime<{
  readonly load: V5ActionHandle;
}>;

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

function createCounterSchema(): DomainSchema {
  return withHash({
    id: "manifesto:lineage-v5-counter",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
        status: { type: "string", required: false, default: "idle" },
      },
    },
    computed: { fields: {} },
    actions: {
      increment: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "lit", value: 1 },
          },
        },
      },
      add: {
        params: ["amount"],
        input: {
          type: "object",
          required: true,
          fields: {
            amount: { type: "number", required: true },
          },
        },
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "get", path: "input.amount" },
          },
        },
      },
      stop: {
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "patch",
              op: "set",
              path: pp("status"),
              value: { kind: "lit", value: "stopped" },
            },
            {
              kind: "halt",
              reason: "expected test stop",
            },
          ],
        },
      },
      fail: {
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "patch",
              op: "set",
              path: pp("status"),
              value: { kind: "lit", value: "failed" },
            },
            {
              kind: "fail",
              code: "LINEAGE_TEST_FAIL",
              message: { kind: "lit", value: "expected test failure" },
            },
          ],
        },
      },
    },
  });
}

function createDispatchabilitySchema(): DomainSchema {
  return withHash({
    id: "manifesto:lineage-v5-dispatchability",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        balance: { type: "number", required: true, default: 10 },
        enabled: { type: "boolean", required: true, default: true },
      },
    },
    computed: { fields: {} },
    actions: {
      frozenSpend: {
        params: ["amount"],
        input: {
          type: "object",
          required: true,
          fields: {
            amount: { type: "number", required: true },
          },
        },
        available: { kind: "lit", value: false },
        dispatchable: { kind: "lit", value: "not-a-boolean" },
        description: "Frozen while disabled",
        flow: { kind: "halt", reason: "frozenSpend" },
      },
    },
  });
}

function createComputedSchema(): DomainSchema {
  return withHash({
    id: "manifesto:lineage-v5-computed",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
      },
    },
    computed: {
      fields: {
        double: {
          deps: ["count"],
          expr: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "get", path: "count" },
          },
        },
      },
    },
    actions: {
      setCount: {
        params: ["count"],
        input: {
          type: "object",
          required: true,
          fields: {
            count: { type: "number", required: true },
          },
        },
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: { kind: "get", path: "input.count" },
        },
      },
    },
  });
}

function createCyclicComputedSchema(): DomainSchema {
  return withHash({
    id: "manifesto:lineage-v5-cyclic-computed",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
      },
    },
    computed: {
      fields: {
        a: {
          deps: ["b"],
          expr: { kind: "get", path: "b" },
        },
        b: {
          deps: ["a"],
          expr: { kind: "get", path: "a" },
        },
      },
    },
    actions: {
      noop: {
        flow: { kind: "halt", reason: "noop" },
      },
    },
  });
}

function createObjectInputSchema(): DomainSchema {
  return withHash({
    id: "manifesto:lineage-v5-object-input",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        selectedId: { type: "string", required: false, default: "" },
      },
    },
    computed: { fields: {} },
    actions: {
      choose: {
        params: ["input"],
        input: {
          type: "object",
          required: true,
          fields: {
            input: {
              type: "object",
              required: true,
              fields: {
                id: { type: "string", required: true },
              },
            },
          },
        },
        flow: {
          kind: "patch",
          op: "set",
          path: pp("selectedId"),
          value: { kind: "get", path: "input.input.id" },
        },
      },
    },
  });
}

function createMultiArgSchema(): DomainSchema {
  return withHash({
    id: "manifesto:lineage-v5-multi-arg",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        name: { type: "string", required: false, default: "" },
      },
    },
    computed: { fields: {} },
    actions: {
      rename: {
        params: ["name", "force"],
        input: {
          type: "object",
          required: true,
          fields: {
            name: { type: "string", required: true },
            force: { type: "boolean", required: false },
          },
        },
        flow: {
          kind: "patch",
          op: "set",
          path: pp("name"),
          value: { kind: "get", path: "input.name" },
        },
      },
    },
  });
}

function createGuardedBoundSchema(): DomainSchema {
  return withHash({
    id: "manifesto:lineage-v5-guarded-bound",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
        label: { type: "string", required: false, default: "" },
        lastIntentId: { type: "string", required: false, default: "" },
      },
    },
    computed: { fields: {} },
    actions: {
      record: {
        params: ["label"],
        input: {
          type: "object",
          required: true,
          fields: {
            label: { type: "string", required: true },
          },
        },
        flow: {
          kind: "causalGuard",
          guardId: "record-bound-submit",
          body: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: pp("count"),
                value: {
                  kind: "add",
                  left: { kind: "get", path: "count" },
                  right: { kind: "lit", value: 1 },
                },
              },
              {
                kind: "patch",
                op: "set",
                path: pp("label"),
                value: { kind: "get", path: "input.label" },
              },
              {
                kind: "patch",
                op: "set",
                path: pp("lastIntentId"),
                value: { kind: "get", path: "$runtime.intent.id" },
              },
            ],
          },
        },
      },
    },
  });
}

function createEffectFailureSchema(): DomainSchema {
  return withHash({
    id: "manifesto:lineage-v5-effect-failure",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        status: { type: "string", required: false, default: "idle" },
      },
    },
    computed: { fields: {} },
    actions: {
      load: {
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "patch",
              op: "set",
              path: pp("status"),
              value: { kind: "lit", value: "loading" },
            },
            {
              kind: "causalGuard",
              guardId: "lineage-effect-failure",
              body: {
                kind: "effect",
                type: "api.fetch",
                params: {},
              },
            },
          ],
        },
      },
    },
  });
}

function proxyLineageService(
  realService: LineageService,
  overrides: Partial<LineageService>,
): LineageService {
  return {
    prepareSealGenesis: realService.prepareSealGenesis.bind(realService),
    prepareSealNext: realService.prepareSealNext.bind(realService),
    commitPrepared: realService.commitPrepared.bind(realService),
    createBranch: realService.createBranch.bind(realService),
    getBranch: realService.getBranch.bind(realService),
    getBranches: realService.getBranches.bind(realService),
    getActiveBranch: realService.getActiveBranch.bind(realService),
    switchActiveBranch: realService.switchActiveBranch.bind(realService),
    getWorld: realService.getWorld.bind(realService),
    getSnapshot: realService.getSnapshot.bind(realService),
    getAttempts: realService.getAttempts.bind(realService),
    getAttemptsByBranch: realService.getAttemptsByBranch.bind(realService),
    getLineage: realService.getLineage.bind(realService),
    getHeads: realService.getHeads.bind(realService),
    getLatestHead: realService.getLatestHead.bind(realService),
    restore: realService.restore.bind(realService),
    ...overrides,
  };
}

function activateCounterLineage(
  service = createLineageService(createInMemoryLineageStore()),
): { readonly app: V5CounterLineageRuntime; readonly service: LineageService } {
  return {
    app: withLineage(
      createManifesto<CounterDomain>(createCounterSchema(), {}),
      { service },
    ).activate() as unknown as V5CounterLineageRuntime,
    service,
  };
}

function activateDispatchabilityLineage(): V5DispatchabilityLineageRuntime {
  return withLineage(
    createManifesto<DispatchabilityDomain>(createDispatchabilitySchema(), {}),
    { store: createInMemoryLineageStore() },
  ).activate() as unknown as V5DispatchabilityLineageRuntime;
}

function activateComputedLineage(
  service = createLineageService(createInMemoryLineageStore()),
): { readonly app: V5ComputedLineageRuntime; readonly service: LineageService } {
  return {
    app: withLineage(
      createManifesto<ComputedDomain>(createComputedSchema(), {}),
      { service },
    ).activate() as unknown as V5ComputedLineageRuntime,
    service,
  };
}

function activateCyclicComputedLineage(
  service = createLineageService(createInMemoryLineageStore()),
): { readonly app: V5CyclicComputedLineageRuntime; readonly service: LineageService } {
  return {
    app: withLineage(
      createManifesto<CyclicComputedDomain>(createCyclicComputedSchema(), {}),
      { service },
    ).activate() as unknown as V5CyclicComputedLineageRuntime,
    service,
  };
}

function activateObjectInputLineage(): V5ObjectInputLineageRuntime {
  return withLineage(
    createManifesto<ObjectInputDomain>(createObjectInputSchema(), {}),
    { store: createInMemoryLineageStore() },
  ).activate() as unknown as V5ObjectInputLineageRuntime;
}

function activateMultiArgLineage(): V5MultiArgLineageRuntime {
  return withLineage(
    createManifesto<MultiArgDomain>(createMultiArgSchema(), {}),
    { store: createInMemoryLineageStore() },
  ).activate() as unknown as V5MultiArgLineageRuntime;
}

function activateGuardedBoundLineage(): V5GuardedBoundLineageRuntime {
  return withLineage(
    createManifesto<GuardedBoundDomain>(createGuardedBoundSchema(), {}),
    { store: createInMemoryLineageStore() },
  ).activate() as unknown as V5GuardedBoundLineageRuntime;
}

function activateEffectFailureLineage(): V5EffectFailureLineageRuntime {
  return withLineage(
    createManifesto<EffectFailureDomain>(createEffectFailureSchema(), {
      "api.fetch": async () => {
        throw new Error("boom");
      },
    }),
    { store: createInMemoryLineageStore() },
  ).activate() as unknown as V5EffectFailureLineageRuntime;
}

function withHostIntentSlot(
  snapshot: CoreSnapshot,
  intent: { readonly type: string; readonly intentId: string; readonly input?: unknown },
): CoreSnapshot {
  const host = snapshot.namespaces.host;
  const hostRecord = typeof host === "object" && host !== null && !Array.isArray(host)
    ? host as Record<string, unknown>
    : {};
  const intentSlots = typeof hostRecord.intentSlots === "object"
    && hostRecord.intentSlots !== null
    && !Array.isArray(hostRecord.intentSlots)
    ? hostRecord.intentSlots as Record<string, unknown>
    : {};
  const intentSlot = intent.input === undefined
    ? { type: intent.type }
    : { type: intent.type, input: intent.input };

  return applyNamespaceDeltas(snapshot, [{
    namespace: "host",
    patches: [{
      op: "set",
      path: [{ kind: "prop", name: "intentSlots" }],
      value: {
        ...intentSlots,
        [intent.intentId]: intentSlot,
      },
    }],
  }]);
}

describe("@manifesto-ai/lineage v5 submit CTS", () => {
  it("exposes the v5 action-candidate write surface and removes v3 root write verbs", () => {
    const { app } = activateCounterLineage();

    expect("actions" in app).toBe(false);
    expect(app.action).toBeDefined();
    expect(app.action.increment.submit).toEqual(expect.any(Function));
    expect(app.action.add.submit).toEqual(expect.any(Function));
    expect("commitAsync" in app).toBe(false);
    expect("commitAsyncWithReport" in app).toBe(false);
    expect("dispatchAsync" in app).toBe(false);
    expect("dispatchAsyncWithReport" in app).toBe(false);

    app.dispose();
  });

  it("captures object-valued bound input immutably before lineage submission", async () => {
    const app = activateObjectInputLineage();
    const original = { id: "before" };

    const bound = app.action.choose.bind(original);
    original.id = "after";

    const result = await bound.submit();

    expect(bound.input).toEqual({ id: "before" });
    expect(Object.isFrozen(bound.input)).toBe(true);
    expect(bound.intent()).toMatchObject({
      type: "choose",
      input: { input: { id: "before" } },
    });
    expect(result).toMatchObject({
      ok: true,
      after: { state: { selectedId: "before" } },
    });

    app.dispose();
  });

  it("creates a fresh intent for each lineage bound submit while preserving bound input", async () => {
    const app = activateGuardedBoundLineage();
    const bound = app.action.record.bind("same");

    const first = await bound.submit();
    const second = await bound.submit();

    if (!first.ok || !second.ok) {
      throw new Error("expected both lineage bound submissions to settle");
    }
    expect(bound.input).toBe("same");
    expect(first.after?.state.count).toBe(1);
    expect(second.after?.state.count).toBe(2);
    expect(first.after?.state.lastIntentId).not.toBe(second.after?.state.lastIntentId);
    expect(second.after?.state.label).toBe("same");

    app.dispose();
  });

  it("preserves optional trailing multi-arg public input on lineage bound actions", () => {
    const app = activateMultiArgLineage();

    const bound = app.action.rename.bind("Ada");

    expect(bound.input).toEqual(["Ada"]);
    expect(bound.intent()).toMatchObject({
      type: "rename",
      input: { name: "Ada" },
    });

    app.dispose();
  });

  it("treats non-structured-clone lineage inputs as input admission failures", async () => {
    const app = activateObjectInputLineage();
    const invalid = {
      id: "bad",
      callback: () => undefined,
    };

    expect(app.action.choose.check(invalid)).toMatchObject({
      ok: false,
      layer: "input",
      code: "INVALID_INPUT",
    });
    expect(app.action.choose.preview(invalid)).toMatchObject({
      admitted: false,
      admission: {
        layer: "input",
        code: "INVALID_INPUT",
      },
    });
    await expect(app.action.choose.submit(invalid)).resolves.toMatchObject({
      ok: false,
      mode: "lineage",
      action: "choose",
      admission: {
        layer: "input",
        code: "INVALID_INPUT",
      },
    });
    expect(app.action.choose.bind(invalid).intent()).toBeNull();

    app.dispose();
  });

  it("settles successful submissions only after sealing the lineage world", async () => {
    const { app } = activateCounterLineage();
    const observedState = vi.fn();
    const settled = vi.fn();

    app.observe.state((snapshot) => snapshot.state.count, observedState);
    app.observe.event("submission:settled", settled);

    const result = await app.action.increment.submit();

    expect(result).toMatchObject({
      ok: true,
      mode: "lineage",
      status: "settled",
      action: "increment",
      outcome: { kind: "ok" },
      after: { state: { count: 1 } },
      report: {
        mode: "lineage",
        action: "increment",
        headAdvanced: true,
        published: true,
        outcome: { kind: "ok" },
      },
    });
    expect(result.world?.worldId).toEqual(expect.any(String));
    expect(result.report?.worldId).toBe(result.world?.worldId);
    expect(result.report).not.toHaveProperty("diagnostics");

    const { app: fullApp } = activateCounterLineage();
    const fullResult = await fullApp.with({ report: "full" }).action.increment.submit();
    expect(fullResult.report).toHaveProperty("diagnostics");
    fullApp.dispose();
    expect(app.snapshot().state.count).toBe(1);
    expect((await app.getLatestHead())?.worldId).toBe(result.world?.worldId);
    expect(await app.getWorld(result.world!.worldId!)).toEqual(expect.objectContaining({
      worldId: result.world?.worldId,
      terminalStatus: "completed",
    }));
    expect(await app.getWorldSnapshot(result.world!.worldId!)).not.toBeNull();
    expect(observedState).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledWith(expect.objectContaining({
      action: "increment",
      mode: "lineage",
      worldId: result.world?.worldId,
      outcome: { kind: "ok" },
    }));

    app.dispose();
  });

  it("stores a replayable intent and full context envelope on the sealed attempt", async () => {
    const schema = createCounterSchema();
    const service = createLineageService(createInMemoryLineageStore());
    const app = withLineage(
      createManifesto<CounterDomain>(schema, {}),
      { service },
    ).activate() as unknown as V5CounterLineageRuntime;
    const result = await app.action.add.submit(2);
    const worldId = result.world?.worldId;
    if (!worldId) {
      throw new Error("expected sealed world");
    }
    const [attempt] = await service.getAttempts(worldId);
    const terminalSnapshot = await service.getSnapshot(worldId);
    if (!attempt?.computeEnvelope || !terminalSnapshot) {
      throw new Error("expected stored compute envelope and terminal snapshot");
    }
    if (!attempt.baseWorldId) {
      throw new Error("expected next seal base world");
    }
    const baseSnapshot = await service.getSnapshot(attempt.baseWorldId);
    if (!baseSnapshot) {
      throw new Error("expected lineage base snapshot");
    }

    expect(attempt.computeEnvelope.intent).toEqual({
      type: "add",
      intentId: expect.any(String),
      input: { amount: 2 },
    });
    expect(attempt.computeEnvelope.context).toEqual({
      runtime: {
        time: { timestamp: expect.any(Number) },
        random: { seed: attempt.computeEnvelope.intent.intentId },
      },
      external: {},
    });

    const baseline = withHostIntentSlot(
      baseSnapshot,
      attempt.computeEnvelope.intent,
    );
    const replay = computeSync(
      schema,
      baseline,
      attempt.computeEnvelope.intent,
      attempt.computeEnvelope.context,
    );
    const replayed = applySystemDelta(
      applyNamespaceDeltas(
        apply(schema, baseline, replay.patches),
        replay.namespaceDelta ?? [],
      ),
      replay.systemDelta,
    );

    expect(replayed.state).toEqual(terminalSnapshot.state);
    expect(replayed.system.status).toBe(terminalSnapshot.system.status);

    app.dispose();
  });

  it("rehydrates computed values before publishing restored snapshots", async () => {
    const realService = createLineageService(createInMemoryLineageStore());
    const service = proxyLineageService(realService, {
      async restore(worldId) {
        const restored = await realService.restore(worldId);
        return {
          ...restored,
          computed: { double: 999 },
        };
      },
    });
    const { app } = activateComputedLineage(service);

    const result = await app.action.setCount.submit(2);
    const worldId = result.world!.worldId!;

    expect(app.snapshot().computed.double).toBe(4);
    expect(((await app.getWorldSnapshot(worldId)) as CoreSnapshot | null)?.computed.double).toBe(4);

    await app.action.setCount.submit(7);
    await app.restore(worldId);

    expect(app.snapshot().state.count).toBe(2);
    expect(app.snapshot().computed.double).toBe(4);
    expect(((await app.getWorldSnapshot(worldId)) as CoreSnapshot | null)?.computed.double).toBe(4);

    app.dispose();
  });

  it("rejects restore rehydration failures without publishing partial snapshots", async () => {
    const realService = createLineageService(createInMemoryLineageStore());
    const service = proxyLineageService(realService, {
      async restore(worldId) {
        const restored = await realService.restore(worldId);
        return {
          ...restored,
          state: {
            ...(restored.state as Record<string, unknown>),
            count: 42,
          },
        };
      },
    });
    const { app } = activateCyclicComputedLineage(service);

    const head = await app.getLatestHead();
    expect(head?.worldId).toEqual(expect.any(String));
    expect(app.snapshot().state.count).toBe(0);

    await expect(app.restore(head!.worldId)).rejects.toMatchObject({
      code: "SNAPSHOT_REHYDRATION_FAILED",
    });

    expect(app.snapshot().state.count).toBe(0);

    app.dispose();
  });

  it("resolves admission failures without sealing or publishing", async () => {
    const app = activateDispatchabilityLineage();
    const rejected = vi.fn();

    app.observe.event("submission:rejected", rejected);

    const result = await app.action.frozenSpend.submit(1);

    expect(result).toMatchObject({
      ok: false,
      mode: "lineage",
      action: "frozenSpend",
      admission: {
        layer: "availability",
        code: "ACTION_UNAVAILABLE",
      },
    });
    expect(app.snapshot().state.balance).toBe(10);
    expect(rejected).toHaveBeenCalledWith(expect.objectContaining({
      action: "frozenSpend",
      mode: "lineage",
      admission: expect.objectContaining({
        code: "ACTION_UNAVAILABLE",
      }),
    }));

    app.dispose();
  });

  it("seals failed domain outcomes without publishing them as the visible head", async () => {
    const { app } = activateCounterLineage();

    const result = await app.action.fail.submit();

    expect(result).toMatchObject({
      ok: true,
      mode: "lineage",
      status: "settled",
      action: "fail",
      outcome: { kind: "fail" },
      after: { state: { status: "failed" } },
      report: {
        mode: "lineage",
        action: "fail",
        headAdvanced: false,
        published: false,
        outcome: { kind: "fail" },
      },
    });
    expect(result.world?.worldId).toEqual(expect.any(String));
    expect(app.snapshot().state.status).toBe("idle");

    const activeBranch = await app.getActiveBranch();
    expect(activeBranch.head).not.toBe(result.world?.worldId);
    expect(activeBranch.tip).toBe(result.world?.worldId);

    app.dispose();
  });

  it("surfaces host namespace failures as failed lineage outcomes", async () => {
    const app = activateEffectFailureLineage();

    const result = await app.action.load.submit();

    expect(result).toMatchObject({
      ok: true,
      mode: "lineage",
      status: "settled",
      action: "load",
      outcome: {
        kind: "fail",
        error: { code: "EFFECT_EXECUTION_FAILED" },
      },
      report: {
        mode: "lineage",
        headAdvanced: false,
        published: false,
        outcome: {
          kind: "fail",
          error: { code: "EFFECT_EXECUTION_FAILED" },
        },
      },
    });
    if (!result.ok || !result.world?.worldId) {
      throw new Error("expected failed host dispatch to seal a lineage world");
    }
    expect(result.world.terminalStatus).toBe("failed");
    expect(app.snapshot().state.status).toBe("idle");

    const stored = await app.getWorldSnapshot(result.world.worldId);
    const hostNamespace = stored?.namespaces.host as {
      readonly lastError?: { readonly code?: string };
    } | undefined;

    expect(stored?.system.lastError).toBeNull();
    expect(hostNamespace?.lastError?.code).toBe("EFFECT_EXECUTION_FAILED");

    app.dispose();
  });

  it("seals halted domain outcomes without publishing them as the visible head", async () => {
    const { app } = activateCounterLineage();

    const result = await app.action.stop.submit();

    expect(result).toMatchObject({
      ok: true,
      mode: "lineage",
      status: "settled",
      action: "stop",
      outcome: { kind: "stop", reason: "expected test stop" },
      after: { state: { status: "stopped" } },
      report: {
        mode: "lineage",
        action: "stop",
        headAdvanced: false,
        published: false,
        outcome: { kind: "stop", reason: "expected test stop" },
      },
    });
    expect(result.world?.worldId).toEqual(expect.any(String));
    expect(app.snapshot().state.status).toBe("idle");

    const activeBranch = await app.getActiveBranch();
    expect(activeBranch.head).not.toBe(result.world?.worldId);
    expect(activeBranch.tip).toBe(result.world?.worldId);

    app.dispose();
  });

  it("rejects seal commit failures without fabricating lineage submit results", async () => {
    const store = createInMemoryLineageStore();
    const realService = createLineageService(store);
    let commitCount = 0;
    const service: LineageService = {
      prepareSealGenesis: realService.prepareSealGenesis.bind(realService),
      prepareSealNext: realService.prepareSealNext.bind(realService),
      async commitPrepared(prepared) {
        commitCount += 1;
        if (commitCount > 1) {
          throw new Error("seal commit failed");
        }
        return realService.commitPrepared(prepared);
      },
      createBranch: realService.createBranch.bind(realService),
      getBranch: realService.getBranch.bind(realService),
      getBranches: realService.getBranches.bind(realService),
      getActiveBranch: realService.getActiveBranch.bind(realService),
      switchActiveBranch: realService.switchActiveBranch.bind(realService),
      getWorld: realService.getWorld.bind(realService),
      getSnapshot: realService.getSnapshot.bind(realService),
      getAttempts: realService.getAttempts.bind(realService),
      getAttemptsByBranch: realService.getAttemptsByBranch.bind(realService),
      getLineage: realService.getLineage.bind(realService),
      getHeads: realService.getHeads.bind(realService),
      getLatestHead: realService.getLatestHead.bind(realService),
      restore: realService.restore.bind(realService),
    };
    const { app } = activateCounterLineage(service);
    const failed = vi.fn();

    app.observe.event("submission:failed", failed);

    await expect(app.action.increment.submit()).rejects.toBeInstanceOf(SubmissionFailedError);
    expect(app.snapshot().state.count).toBe(0);
    expect(failed).toHaveBeenCalledWith(expect.objectContaining({
      action: "increment",
      mode: "lineage",
      stage: "settlement",
      error: expect.objectContaining({
        message: "seal commit failed",
      }),
    }));

    app.dispose();
  });

  it("rejects submit after dispose through the SDK disposed surface", async () => {
    const { app } = activateCounterLineage();

    app.dispose();

    await expect(app.action.increment.submit()).rejects.toBeInstanceOf(DisposedError);
  });
});
