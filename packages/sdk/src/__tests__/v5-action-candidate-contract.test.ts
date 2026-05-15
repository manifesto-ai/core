import { describe, expect, it, vi } from "vitest";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
  type Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";

import {
  SubmissionFailedError,
  createManifesto,
} from "../index.js";
import { createBaseRuntimeInstance } from "../runtime/base-runtime.js";
import { getRuntimeKernelFactory } from "../provider.js";
import {
  createCounterSchema,
  createDispatchabilitySchema,
  type CounterDomain,
  type DispatchabilityDomain,
} from "./helpers/schema.js";

const pp = semanticPathToPatchPath;

type CollisionDomain = {
  actions: {
    get: () => void;
    bind: () => void;
    state: () => void;
    computed: () => void;
    inspect: () => void;
    snapshot: () => void;
    context: () => void;
    injectContext: () => void;
    updateContext: () => void;
    with: () => void;
    dispose: () => void;
    getAction: () => void;
    toString: () => void;
    hasOwnProperty: () => void;
    valueOf: () => void;
    action: () => void;
  };
  state: {
    count: number;
  };
  computed: {};
};

type OutcomeDomain = {
  actions: {
    stop: () => void;
    fail: () => void;
  };
  state: {
    count: number;
  };
  computed: {};
};

type OptionDomain = {
  actions: {
    setOption: (value: { __kind: "PreviewOptions"; diagnostics: string }) => void;
  };
  state: {
    value: { __kind: "PreviewOptions"; diagnostics: string } | null;
  };
  computed: {};
};

type ToggleTodoInput = {
  readonly id: string;
};

type ObjectInputDomain = {
  actions: {
    toggleTodo: (input: ToggleTodoInput) => void;
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
    force: boolean;
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

type ObjectOnlyOptionsDomain = {
  actions: {
    configure: (input: { retries: number; label?: string }) => void;
  };
  state: {
    retries: number;
    label: string;
  };
  computed: {};
};

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

function setCountFlow(value: number): DomainSchema["actions"][string]["flow"] {
  return {
    kind: "patch",
    op: "set",
    path: pp("count"),
    value: { kind: "lit", value },
  };
}

function createCollisionSchema(): DomainSchema {
  const actionValues = {
    get: 1,
    bind: 2,
    state: 4,
    computed: 5,
    inspect: 6,
    snapshot: 7,
    context: 8,
    injectContext: 9,
    updateContext: 10,
    with: 11,
    dispose: 12,
    getAction: 13,
    toString: 14,
    hasOwnProperty: 15,
    valueOf: 16,
    action: 17,
  } as const;

  return withHash({
    id: "manifesto:sdk-v5-collisions",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
      },
    },
    computed: { fields: {} },
    actions: Object.fromEntries(
      Object.entries(actionValues).map(([name, value]) => [name, { flow: setCountFlow(value) }]),
    ),
  });
}

function createReservedActionSchema(name: string): DomainSchema {
  return withHash({
    id: `manifesto:sdk-v5-reserved-${name}`,
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
      },
    },
    computed: { fields: {} },
    actions: Object.fromEntries([[name, { flow: setCountFlow(1) }]]),
  });
}

function createOutcomeSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-v5-outcomes",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
      },
    },
    computed: { fields: {} },
    actions: {
      stop: {
        flow: {
          kind: "seq",
          steps: [
            setCountFlow(1),
            { kind: "halt", reason: "insufficient-evidence" },
          ],
        },
      },
      fail: {
        flow: {
          kind: "fail",
          code: "DOMAIN_FAIL",
          message: { kind: "lit", value: "repair required" },
        },
      },
    },
  });
}

function createOptionSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-v5-options",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        value: {
          type: "object",
          required: false,
          default: null,
          fields: {
            __kind: { type: "string", required: true },
            diagnostics: { type: "string", required: true },
          },
        },
      },
    },
    computed: { fields: {} },
    actions: {
      setOption: {
        params: ["value"],
        input: {
          type: "object",
          required: true,
          fields: {
            value: {
              type: "object",
              required: true,
              fields: {
                __kind: { type: "string", required: true },
                diagnostics: { type: "string", required: true },
              },
            },
          },
        },
        flow: {
          kind: "patch",
          op: "set",
          path: pp("value"),
          value: { kind: "get", path: "input.value" },
        },
      },
    },
  });
}

function createMultiArgSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-v5-multi-arg",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        name: { type: "string", required: false, default: "" },
        force: { type: "boolean", required: false, default: false },
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
            force: { type: "boolean", required: false, default: false },
          },
        },
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "patch",
              op: "set",
              path: pp("name"),
              value: { kind: "get", path: "input.name" },
            },
            {
              kind: "patch",
              op: "set",
              path: pp("force"),
              value: { kind: "get", path: "input.force" },
            },
          ],
        },
      },
    },
  });
}

function createGuardedBoundSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-v5-guarded-bound",
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

function createObjectOnlyOptionsSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-v5-object-only-options",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        retries: { type: "number", required: false, default: 0 },
        label: { type: "string", required: false, default: "" },
      },
    },
    computed: { fields: {} },
    actions: {
      configure: {
        input: {
          type: "object",
          required: true,
          fields: {
            retries: { type: "number", required: true },
            label: { type: "string", required: false, default: "" },
          },
        },
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "patch",
              op: "set",
              path: pp("retries"),
              value: { kind: "get", path: "input.retries" },
            },
            {
              kind: "patch",
              op: "set",
              path: pp("label"),
              value: { kind: "get", path: "input.label" },
            },
          ],
        },
      },
    },
  });
}

const objectInputMelSource = `
domain TodoProbe {
  type ToggleTodoInput = {
    id: string
  }

  state {
    selectedId: string = ""
  }

  action toggleTodo(input: ToggleTodoInput) {
    onceIntent {
      patch selectedId = input.id
    }
  }
}
`;

function expectProjectedSnapshotBoundary(snapshot: unknown): void {
  expect(snapshot).toHaveProperty("state");
  expect(snapshot).toHaveProperty("computed");
  expect(snapshot).toHaveProperty("system");
  expect(snapshot).toHaveProperty("meta");
  expect(snapshot).not.toHaveProperty("data");
  expect(snapshot).not.toHaveProperty("namespaces");
  expect(snapshot).not.toHaveProperty("input");
  expect(Object.keys((snapshot as { system: object }).system).sort()).toEqual([
    "lastError",
    "status",
  ]);
  expect(Object.keys((snapshot as { meta: object }).meta)).toEqual(["schemaHash"]);
}

describe("SDK v5 action-candidate contract", () => {
  it("exposes only the v5 root surface including ADR-027 context lifecycle methods", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    expect(Object.keys(app).sort()).toEqual([
      "action",
      "computed",
      "context",
      "dispose",
      "getAction",
      "injectContext",
      "inspect",
      "observe",
      "snapshot",
      "state",
      "updateContext",
      "with",
    ]);
    expect(Object.keys(app.state).sort()).toEqual(["count", "status"]);
    expect(Object.keys(app.computed).sort()).toEqual(["doubled"]);
    expect(app.snapshot().state.count).toBe(0);
    expect(app.inspect.canonicalSnapshot().state.count).toBe(0);
    expectProjectedSnapshotBoundary(app.snapshot());
    expect(app.inspect.canonicalSnapshot()).toHaveProperty("namespaces");
  });

  it("exposes projected state and computed read handles as read-only field views", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const count = app.state.count;
    const doubled = app.computed.doubled;
    const countListener = vi.fn();
    const doubledListener = vi.fn();

    expect(Object.keys(count).sort()).toEqual(["name", "observe", "ref", "value"]);
    expect(count).toMatchObject({
      name: "count",
      ref: { __kind: "FieldRef", name: "count" },
    });
    expect(doubled).toMatchObject({
      name: "doubled",
      ref: { __kind: "ComputedRef", name: "doubled" },
    });
    expect(count.value()).toBe(0);
    expect(doubled.value()).toBe(0);

    for (const forbidden of [
      "set",
      "merge",
      "patch",
      "submit",
      "dispatch",
      "commit",
      "propose",
      "namespaces",
      "input",
      "meta",
    ]) {
      expect(forbidden in count).toBe(false);
      expect(forbidden in doubled).toBe(false);
    }

    const unsubscribeCount = count.observe(countListener);
    const unsubscribeDoubled = doubled.observe(doubledListener);
    expect(countListener).not.toHaveBeenCalled();
    expect(doubledListener).not.toHaveBeenCalled();

    await app.action.increment.submit();
    expect(count.value()).toBe(1);
    expect(doubled.value()).toBe(2);
    expect(countListener).toHaveBeenCalledTimes(1);
    expect(countListener).toHaveBeenLastCalledWith(1, 0);
    expect(doubledListener).toHaveBeenCalledTimes(1);
    expect(doubledListener).toHaveBeenLastCalledWith(2, 0);

    await app.action.increment.submit();
    expect(countListener).toHaveBeenCalledTimes(2);
    expect(countListener).toHaveBeenLastCalledWith(2, 1);
    expect(doubledListener).toHaveBeenCalledTimes(2);
    expect(doubledListener).toHaveBeenLastCalledWith(4, 2);

    unsubscribeCount();
    unsubscribeDoubled();
    await app.action.increment.submit();
    expect(countListener).toHaveBeenCalledTimes(2);
    expect(doubledListener).toHaveBeenCalledTimes(2);
  });

  it("keeps v3 root verbs absent from the canonical v5 runtime root", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    for (const name of [
      "createIntent",
      "dispatchAsync",
      "dispatchAsyncWithReport",
      "getSnapshot",
      "getCanonicalSnapshot",
      "getSchemaGraph",
      "simulate",
      "simulateIntent",
      "subscribe",
      "on",
      "why",
      "whyNot",
      "explainIntent",
      "getActionMetadata",
    ]) {
      expect(name in app).toBe(false);
    }
  });

  it("exposes action handles with info, available, check, preview, submit, and bind", () => {
    const app = createManifesto<CounterDomain>(
      createCounterSchema(),
      {},
      { annotations: { increment: { title: "Increment" } } },
    ).activate();
    const handle = app.action.increment;

    expect(Object.keys(handle).sort()).toEqual([
      "available",
      "bind",
      "check",
      "info",
      "preview",
      "submit",
    ]);
    expect(handle.info()).toMatchObject({
      name: "increment",
      title: "Increment",
      parameters: [],
    });
    expect(handle.available()).toBe(true);
    expect(handle.bind().intent()).toMatchObject({ type: "increment" });
  });

  it("resolves declared action handles from root getAction", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const handle = app.getAction("increment");

    expect(handle).toBeDefined();
    expect(handle.info().name).toBe("increment");
  });

  it("returns undefined for unknown dynamic action names", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    expect(app.getAction("doesNotExist")).toBeUndefined();
  });

  it("returns handles for declared actions even when currently unavailable", async () => {
    const app = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();

    await app.action.disable.submit();
    const handle = app.getAction("incrementGuarded");

    expect(handle).toBeDefined();
    expect(handle!.available()).toBe(false);
    expect(handle!.check(10)).toMatchObject({
      ok: false,
      layer: "availability",
      code: "ACTION_UNAVAILABLE",
    });
  });

  it("matches static action handle behavior for dynamic lookups", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const staticHandle = app.action.increment;
    const dynamicHandle = app.getAction("increment");

    expect(dynamicHandle).toBe(staticHandle);
    expect(dynamicHandle.info()).toEqual(staticHandle.info());
    expect(dynamicHandle.available()).toBe(staticHandle.available());

    const result = await dynamicHandle.submit();
    expect(result).toMatchObject({
      ok: true,
      mode: "base",
      status: "settled",
      action: "increment",
    });
    expect(app.snapshot().state.count).toBe(1);
  });

  it("preserves execution views selected before dynamic action lookup", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const handle = app.with({ report: "none" }).getAction("increment");

    expect(handle).toBeDefined();
    const result = await handle!.submit();

    expect(result).toMatchObject({
      ok: true,
      mode: "base",
      status: "settled",
      action: "increment",
    });
    expect(result.ok && "report" in result).toBe(false);
    expect(app.snapshot().state.count).toBe(1);
  });

  it("checks admission in first-failing-layer order: availability, input, dispatchability", async () => {
    const app = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();

    await app.action.disable.submit();
    const unavailable = app.action.incrementGuarded.check("not-number" as unknown as number);
    expect(unavailable).toMatchObject({
      ok: false,
      layer: "availability",
      code: "ACTION_UNAVAILABLE",
    });
    if (unavailable.ok) {
      throw new Error("expected unavailable admission");
    }
    expect(unavailable.blockers).toHaveLength(1);
    expect(unavailable.blockers[0]).toMatchObject({
      code: "ACTION_UNAVAILABLE",
      message: "Increment only while enabled and below the caller-provided max",
      detail: { layer: "available" },
    });

    const fresh = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();
    expect(fresh.action.incrementGuarded.check("not-number" as unknown as number)).toMatchObject({
      ok: false,
      layer: "input",
      code: "INVALID_INPUT",
    });
    expect(fresh.action.incrementGuarded.bind("not-number" as unknown as number).intent()).toBeNull();
    expect(fresh.action.incrementGuarded.check(0)).toMatchObject({
      ok: false,
      layer: "dispatchability",
      code: "INTENT_NOT_DISPATCHABLE",
    });
  });

  it("keeps availability blockers when invalid input cannot form an intent", async () => {
    const app = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();
    const guarded = app.action.incrementGuarded as unknown as {
      readonly check: (input: unknown) => unknown;
    };

    await app.action.disable.submit();
    const unavailable = guarded.check(() => undefined);

    expect(unavailable).toMatchObject({
      ok: false,
      layer: "availability",
      code: "ACTION_UNAVAILABLE",
      blockers: [{
        code: "ACTION_UNAVAILABLE",
        message: "Increment only while enabled and below the caller-provided max",
        detail: { layer: "available" },
      }],
    });
  });

  it("rejects stray input on zero-arg actions without executing", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const increment = app.action.increment as unknown as {
      readonly check: (input: unknown) => unknown;
      readonly preview: (input: unknown) => unknown;
      readonly submit: (input: unknown) => Promise<unknown>;
      readonly bind: (input: unknown) => { readonly intent: () => unknown };
    };
    const strayInput = { report: "summary" };

    expect(increment.check(strayInput)).toMatchObject({
      ok: false,
      layer: "input",
      code: "INVALID_INPUT",
      message: 'Action "increment" does not accept input',
    });
    expect(increment.preview(strayInput)).toMatchObject({
      admitted: false,
      admission: {
        layer: "input",
        code: "INVALID_INPUT",
      },
    });
    await expect(increment.submit(strayInput)).resolves.toMatchObject({
      ok: false,
      mode: "base",
      action: "increment",
      admission: {
        layer: "input",
        code: "INVALID_INPUT",
      },
    });
    expect(increment.bind(strayInput).intent()).toBeNull();
    expect(app.snapshot().state.count).toBe(0);
  });

  it("keeps preview pure, non-committing, non-publishing, and non-enqueuing", async () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(manifesto)();
    const enqueue = vi.fn(kernel.enqueue);
    const app = createBaseRuntimeInstance({
      ...kernel,
      enqueue,
    });
    const listener = vi.fn();
    app.observe.state((snapshot) => snapshot.state.count, listener);

    const preview = app.action.increment.preview();

    expect(preview).toMatchObject({
      admitted: true,
      status: "complete",
    });
    expect(preview.admitted && preview.after.state.count).toBe(1);
    expect(app.snapshot().state.count).toBe(0);
    expect(listener).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();

    await app.action.increment.submit();
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("returns base submit results with mode base, protocol ok, status settled, before, after, and outcome", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const result = await app.action.increment.submit();

    expect(result).toMatchObject({
      ok: true,
      mode: "base",
      status: "settled",
      action: "increment",
      outcome: { kind: "ok" },
    });
    expect(result.ok && result.before.state.count).toBe(0);
    expect(result.ok && result.after.state.count).toBe(1);
    if (result.ok) {
      expectProjectedSnapshotBoundary(result.before);
      expectProjectedSnapshotBoundary(result.after);
    }
    expect(app.snapshot().state.count).toBe(1);
  });

  it("maps halted and error terminal statuses to stop and fail outcomes without turning protocol ok false", async () => {
    const app = createManifesto<OutcomeDomain>(createOutcomeSchema(), {}).activate();

    const stopped = await app.action.stop.submit();
    expect(stopped).toMatchObject({
      ok: true,
      mode: "base",
      status: "settled",
      outcome: { kind: "stop", reason: "insufficient-evidence" },
    });
    expect(stopped.ok && stopped.after.state.count).toBe(1);

    const failed = await app.with({ report: "full" }).action.fail.submit();
    expect(failed).toMatchObject({
      ok: true,
      mode: "base",
      status: "settled",
      outcome: {
        kind: "fail",
        error: {
          message: "repair required",
        },
      },
    });
    expect(failed.ok && failed.report).toMatchObject({
      mode: "base",
      action: "fail",
      outcome: {
        kind: "fail",
        error: {
          message: "repair required",
        },
      },
    });
    expect(failed.ok && Array.isArray(failed.report?.changes)).toBe(true);
    expect(failed.ok && Array.isArray(failed.report?.requirements)).toBe(true);
  });

  it("keeps full projected before and after snapshots in settled submit results regardless of payload size", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const result = await app.action.add.submit(5);

    expect(result.ok && result.before.state).toEqual({ count: 0, status: "idle" });
    expect(result.ok && result.after.state).toEqual({ count: 5, status: "idle" });
  });

  it("keeps root-name actions accessible through static action.* without corrupting runtime members", async () => {
    const app = createManifesto<CollisionDomain>(createCollisionSchema(), {}).activate();

    const runtimeMembers = {
      action: app.action,
      context: app.context,
      computed: app.computed,
      dispose: app.dispose,
      getAction: app.getAction,
      injectContext: app.injectContext,
      inspect: app.inspect,
      observe: app.observe,
      snapshot: app.snapshot,
      state: app.state,
      updateContext: app.updateContext,
      with: app.with,
    };

    for (const [name, value] of Object.entries({
      get: 1,
      bind: 2,
      state: 4,
      computed: 5,
      inspect: 6,
      snapshot: 7,
      context: 8,
      injectContext: 9,
      updateContext: 10,
      with: 11,
      dispose: 12,
      getAction: 13,
      toString: 14,
      hasOwnProperty: 15,
      valueOf: 16,
      action: 17,
    }) as Array<[keyof CollisionDomain["actions"], number]>) {
      expect(app.action).toHaveProperty(name);
      expect(app.getAction(name)).toBe(app.action[name]);
      await app.action[name].submit();
      expect(app.snapshot().state.count).toBe(value);
      expect(app.action).toBe(runtimeMembers.action);
      expect(app.context).toBe(runtimeMembers.context);
      expect(app.computed).toBe(runtimeMembers.computed);
      expect(app.dispose).toBe(runtimeMembers.dispose);
      expect(app.getAction).toBe(runtimeMembers.getAction);
      expect(app.injectContext).toBe(runtimeMembers.injectContext);
      expect(app.inspect).toBe(runtimeMembers.inspect);
      expect(app.observe).toBe(runtimeMembers.observe);
      expect(app.snapshot).toBe(runtimeMembers.snapshot);
      expect(app.state).toBe(runtimeMembers.state);
      expect(app.updateContext).toBe(runtimeMembers.updateContext);
      expect(app.with).toBe(runtimeMembers.with);
    }

    expect("actions" in app).toBe(false);
  });

  it("rejects reserved public action names before activation", () => {
    for (const name of ["then", "constructor", "prototype", "__proto__"]) {
      expect(() => createManifesto(createReservedActionSchema(name), {}).activate())
        .toThrowError(expect.objectContaining({ code: "RESERVED_ACTION_NAME" }));
    }
  });

  it("packs BoundAction.intent() inputs from activated action metadata, not runtime argument introspection", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const bound = app.action.add.bind(3);

    expect(bound.input).toBe(3);
    expect(bound.intent()).toMatchObject({
      type: "add",
      input: { amount: 3 },
    });
  });

  it("preserves ordered public input for multi-arg bound actions", () => {
    const app = createManifesto<MultiArgDomain>(createMultiArgSchema(), {}).activate();

    const bound = app.action.rename.bind("Ada", true);

    expect(bound.input).toEqual(["Ada", true]);
    expect(bound.intent()).toMatchObject({
      type: "rename",
      input: { name: "Ada", force: true },
    });
  });

  it("preserves tuple public input for optional trailing multi-arg bound actions", () => {
    const app = createManifesto<MultiArgDomain>(createMultiArgSchema(), {}).activate();

    const bound = app.action.rename.bind("Ada");

    expect(bound.input).toEqual(["Ada"]);
    expect(bound.intent()).toMatchObject({
      type: "rename",
      input: { name: "Ada" },
    });
  });

  it("keeps object-valued single param public input separate from Core-packed intent input", async () => {
    const app = createManifesto<ObjectInputDomain>(objectInputMelSource, {}).activate();

    const result = await app.action.toggleTodo.submit({ id: "todo-1" });
    const bound = app.action.toggleTodo.bind({ id: "todo-2" });

    expect(result.ok && result.after.state.selectedId).toBe("todo-1");
    expect(bound.input).toEqual({ id: "todo-2" });
    expect(bound.intent()).toMatchObject({
      type: "toggleTodo",
      input: { input: { id: "todo-2" } },
    });
  });

  it("captures object-valued bound input immutably at bind time", () => {
    const app = createManifesto<ObjectInputDomain>(objectInputMelSource, {}).activate();
    const original = { id: "todo-2" };

    const bound = app.action.toggleTodo.bind(original);
    original.id = "todo-mutated";

    expect(bound.input).toEqual({ id: "todo-2" });
    expect(Object.isFrozen(bound.input)).toBe(true);
    expect(bound.intent()).toMatchObject({
      type: "toggleTodo",
      input: { input: { id: "todo-2" } },
    });
  });

  it("creates a fresh intent for each bound submit while preserving bound input", async () => {
    const app = createManifesto<GuardedBoundDomain>(createGuardedBoundSchema(), {}).activate();
    const bound = app.action.record.bind("same");

    const first = await bound.submit();
    const second = await bound.submit();

    if (!first.ok || !second.ok) {
      throw new Error("expected both bound submissions to settle");
    }
    expect(bound.input).toBe("same");
    expect(first.after.state.count).toBe(1);
    expect(second.after.state.count).toBe(2);
    expect(first.after.state.lastIntentId).not.toBe(second.after.state.lastIntentId);
    expect(second.after.state.label).toBe("same");
  });

  it("treats option-shaped values as domain input when declared by action arity", async () => {
    const app = createManifesto<OptionDomain>(createOptionSchema(), {}).activate();
    const optionLike = { __kind: "PreviewOptions" as const, diagnostics: "domain" };

    const preview = app.action.setOption.preview(optionLike);
    expect(preview.admitted && preview.after.state.value).toEqual(optionLike);

    const submitted = await app.action.setOption.submit(optionLike);
    expect(submitted.ok && submitted.after.state.value).toEqual(optionLike);
  });

  it("uses execution views for preview diagnostics and submit reports", async () => {
    const app = createManifesto<ObjectOnlyOptionsDomain>(
      createObjectOnlyOptionsSchema(),
      {},
    ).activate();

    const preview = app.with({ diagnostics: "none" }).action.configure.preview({
      retries: 3,
      label: "fast",
    });
    expect(preview.admitted && preview.after.state).toMatchObject({
      retries: 3,
      label: "fast",
    });
    expect(preview.admitted && "diagnostics" in preview).toBe(false);

    const submitted = await app.with({ report: "none" }).action.configure.submit({
      retries: 5,
    });
    expect(submitted.ok && submitted.after.state).toMatchObject({
      retries: 5,
      label: null,
    });
    expect(submitted.ok && "report" in submitted).toBe(false);
  });

  it("treats non-structured-clone inputs as input admission failures", async () => {
    const app = createManifesto<ObjectOnlyOptionsDomain>(
      createObjectOnlyOptionsSchema(),
      {},
    ).activate();
    const invalid = {
      retries: 1,
      callback: () => undefined,
    } as unknown as { retries: number; label?: string };

    expect(app.action.configure.check(invalid)).toMatchObject({
      ok: false,
      layer: "input",
      code: "INVALID_INPUT",
    });
    expect(app.action.configure.preview(invalid)).toMatchObject({
      admitted: false,
      admission: {
        layer: "input",
        code: "INVALID_INPUT",
      },
    });
    await expect(app.action.configure.submit(invalid)).resolves.toMatchObject({
      ok: false,
      mode: "base",
      action: "configure",
      admission: {
        layer: "input",
        code: "INVALID_INPUT",
      },
    });
    expect(app.action.configure.bind(invalid).intent()).toBeNull();
  });

  it("honors preview and submit option detail suppression", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const preview = app.with({ diagnostics: "none" }).action.increment.preview();
    expect(preview.admitted && "diagnostics" in preview).toBe(false);

    const submitted = await app.with({ report: "none" }).action.increment.submit();
    expect(submitted.ok && "report" in submitted).toBe(false);
  });

  it("returns distinct full submit reports when requested", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const submitted = await app.with({ report: "full" }).action.increment.submit();

    expect(submitted.ok && submitted.report).toMatchObject({
      mode: "base",
      action: "increment",
      requirements: [],
      outcome: {
        kind: "ok",
      },
    });
    expect(submitted.ok && submitted.report?.changes).toEqual(
      expect.arrayContaining([
        { path: ["state", "count"], kind: "changed" },
        { path: ["computed", "doubled"], kind: "changed" },
      ]),
    );
    expect(submitted.ok && submitted.report?.diagnostics).toBeDefined();

    const summary = await app.with({ report: "summary" }).action.increment.submit();
    expect(summary.ok && summary.report !== undefined).toBe(true);
    expect(summary.ok && summary.report !== undefined && "diagnostics" in summary.report).toBe(false);
  });

  it("passes a call-entry materialized context into base submit execution", async () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(manifesto)();
    let receivedContext: unknown;
    const materializedContext = Object.freeze({
      runtime: Object.freeze({
        time: Object.freeze({ timestamp: 1000 }),
        random: Object.freeze({ seed: "call-entry-seed" }),
      }),
      external: Object.freeze({}),
    });
    const app = createBaseRuntimeInstance({
      ...kernel,
      createComputeContext: vi.fn(() => materializedContext),
      executeHost: async (intent, options) => {
        receivedContext = options?.context;
        return kernel.executeHost(intent, options);
      },
    });

    await app.action.increment.submit();

    expect(receivedContext).toBe(materializedContext);
  });

  it("rejects operational submit failure before terminal result with SubmissionFailedError", async () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(manifesto)();
    const app = createBaseRuntimeInstance({
      ...kernel,
      executeHost: async () => {
        throw new Error("host exploded");
      },
    });

    await expect(app.action.increment.submit()).rejects.toBeInstanceOf(SubmissionFailedError);
  });

  it("emits submission:failed for operational submit failure before terminal result", async () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(manifesto)();
    const app = createBaseRuntimeInstance({
      ...kernel,
      executeHost: async () => {
        throw new Error("host exploded");
      },
    });
    const failed = vi.fn();
    app.observe.event("submission:failed", failed);

    await expect(app.action.increment.submit()).rejects.toBeInstanceOf(SubmissionFailedError);

    expect(failed).toHaveBeenCalledWith(expect.objectContaining({
      action: "increment",
      mode: "base",
      stage: "runtime",
      error: expect.objectContaining({ message: "host exploded" }),
    }));
  });

  it("rejects HostResult errors while preserving the diagnostic canonical snapshot", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {
      "api.fetch": async () => {
        throw new Error("effect exploded");
      },
    }).activate();
    const failed = vi.fn();
    app.observe.event("submission:failed", failed);

    await expect(app.action.load.submit()).rejects.toBeInstanceOf(SubmissionFailedError);

    const canonical = app.inspect.canonicalSnapshot() as CoreSnapshot;
    const hostNamespace = canonical.namespaces.host as {
      readonly lastError?: { readonly code?: string; readonly message?: string };
    };
    expect(canonical.system.lastError).toBeNull();
    expect(hostNamespace.lastError).toMatchObject({
      code: "EFFECT_EXECUTION_FAILED",
      message: "effect exploded",
    });
    expect(app.snapshot().state.status).toBe("loading");
    expect(failed).toHaveBeenCalledWith(expect.objectContaining({
      action: "load",
      mode: "base",
      stage: "runtime",
      error: expect.objectContaining({
        code: "EFFECT_EXECUTION_FAILED",
        message: "effect exploded",
      }),
    }));
  });

  it("emits observe.event payloads matching ManifestoEventPayloadMap without full snapshots", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const settled = vi.fn();
    const proposalCreated = vi.fn();
    app.observe.event("submission:settled", settled);
    app.observe.event("proposal:created", proposalCreated);

    await app.action.increment.submit();

    expect(settled).toHaveBeenCalledWith(expect.objectContaining({
      action: "increment",
      mode: "base",
      outcome: { kind: "ok" },
      schemaHash: app.inspect.schemaHash(),
      snapshotVersion: expect.any(Number),
    }));
    expect(proposalCreated).not.toHaveBeenCalled();
    expect(settled.mock.calls[0]?.[0]).not.toHaveProperty("snapshot");
    expect(settled.mock.calls[0]?.[0]).not.toHaveProperty("canonicalSnapshot");
  });

  it("isolates observe.event handler failures from submit results and other handlers", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const afterThrow = vi.fn();

    app.observe.event("submission:settled", () => {
      throw new Error("handler failed");
    });
    app.observe.event("submission:settled", afterThrow);

    const result = await app.action.increment.submit();

    expect(result.ok).toBe(true);
    expect(afterThrow).toHaveBeenCalledWith(expect.objectContaining({
      action: "increment",
      mode: "base",
      outcome: { kind: "ok" },
    }));
  });

  it("does not call observe.state listeners during registration and supplies the previous selected value on publication", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const listener = vi.fn();

    app.observe.state((snapshot) => snapshot.state.count, listener);

    expect(listener).not.toHaveBeenCalled();

    await app.action.increment.submit();

    expect(listener).toHaveBeenCalledWith(1, 0);
  });

  it("compares observe.state selector results with Object.is", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const listener = vi.fn();

    app.observe.state((snapshot) => snapshot.state.status, listener);

    await app.action.increment.submit();

    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps observe.state registrations alive across selector failures", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const listener = vi.fn();
    let selectorEnabled = false;

    app.observe.state((snapshot) => {
      if (!selectorEnabled) {
        throw new Error("selector unavailable");
      }
      return snapshot.state.count;
    }, listener);

    await app.action.increment.submit();
    expect(listener).not.toHaveBeenCalled();

    selectorEnabled = true;
    await app.action.increment.submit();

    expect(listener).toHaveBeenCalledWith(2, undefined);
  });

  it("does not notify observe.state subscribers for canonical-only snapshot movement", () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(manifesto)();
    const app = createBaseRuntimeInstance(kernel);
    const listener = vi.fn();

    app.observe.state((snapshot) => snapshot.state.count, listener);

    const canonical = structuredClone(kernel.getCanonicalSnapshot()) as CoreSnapshot;
    kernel.setVisibleSnapshot({
      ...canonical,
      meta: {
        ...canonical.meta,
        version: canonical.meta.version + 1,
      },
      namespaces: {
        ...canonical.namespaces,
        host: {
          marker: "canonical-only",
        },
      },
    });

    expect(listener).not.toHaveBeenCalled();
    expect(app.snapshot().state.count).toBe(0);
    expect(app.inspect.canonicalSnapshot().namespaces.host).toEqual({
      marker: "canonical-only",
    });
  });
});
