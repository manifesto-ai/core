import { describe, expect, it, vi } from "vitest";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
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
    snapshot: () => void;
    then: () => void;
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

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

function createCollisionSchema(): DomainSchema {
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
    actions: {
      snapshot: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: { kind: "lit", value: 1 },
        },
      },
      then: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: { kind: "lit", value: 2 },
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

describe("SDK v5 action-candidate contract", () => {
  it("exposes only the v5 root surface: snapshot, actions, action, observe, inspect, and dispose", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    expect(Object.keys(app).sort()).toEqual([
      "action",
      "actions",
      "dispose",
      "inspect",
      "observe",
      "snapshot",
    ]);
    expect(app.snapshot().state.count).toBe(0);
    expect(app.inspect.canonicalSnapshot().state.count).toBe(0);
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
    const handle = app.actions.increment;

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

  it("checks admission in first-failing-layer order: availability, input, dispatchability", async () => {
    const app = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();

    await app.actions.disable.submit();
    expect(app.actions.incrementGuarded.check("not-number" as unknown as number)).toMatchObject({
      ok: false,
      layer: "availability",
      code: "ACTION_UNAVAILABLE",
    });

    const fresh = createManifesto<DispatchabilityDomain>(
      createDispatchabilitySchema(),
      {},
    ).activate();
    expect(fresh.actions.incrementGuarded.check("not-number" as unknown as number)).toMatchObject({
      ok: false,
      layer: "input",
      code: "INVALID_INPUT",
    });
    expect(fresh.actions.incrementGuarded.check(0)).toMatchObject({
      ok: false,
      layer: "dispatchability",
      code: "INTENT_NOT_DISPATCHABLE",
    });
  });

  it("keeps preview pure, non-committing, non-publishing, and non-enqueuing", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const listener = vi.fn();
    app.observe.state((snapshot) => snapshot.state.count, listener);

    const preview = app.actions.increment.preview();

    expect(preview).toMatchObject({
      admitted: true,
      status: "complete",
    });
    expect(preview.admitted && preview.after.state.count).toBe(1);
    expect(app.snapshot().state.count).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it("returns base submit results with mode base, protocol ok, status settled, before, after, and outcome", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const result = await app.actions.increment.submit();

    expect(result).toMatchObject({
      ok: true,
      mode: "base",
      status: "settled",
      action: "increment",
      outcome: { kind: "ok" },
    });
    expect(result.ok && result.before.state.count).toBe(0);
    expect(result.ok && result.after.state.count).toBe(1);
    expect(app.snapshot().state.count).toBe(1);
  });

  it("keeps full projected before and after snapshots in settled submit results regardless of payload size", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const result = await app.actions.add.submit(5);

    expect(result.ok && result.before.state).toEqual({ count: 0, status: "idle" });
    expect(result.ok && result.after.state).toEqual({ count: 5, status: "idle" });
  });

  it("keeps action-name collisions accessible through action(name) without corrupting runtime members", async () => {
    const app = createManifesto<CollisionDomain>(createCollisionSchema(), {}).activate();

    expect(typeof app.snapshot).toBe("function");
    await app.action("snapshot").submit();
    expect(app.snapshot().state.count).toBe(1);
    await app.action("then").submit();
    expect(app.snapshot().state.count).toBe(2);
  });

  it("packs BoundAction.intent() inputs from activated action metadata, not runtime argument introspection", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const bound = app.actions.add.bind(3);

    expect(bound.input).toEqual({ amount: 3 });
    expect(bound.intent()).toMatchObject({
      type: "add",
      input: { amount: 3 },
    });
  });

  it("recognizes PreviewOptions and SubmitOptions only as extra final discriminated arguments", async () => {
    const app = createManifesto<OptionDomain>(createOptionSchema(), {}).activate();
    const optionLike = { __kind: "PreviewOptions" as const, diagnostics: "domain" };

    const preview = app.actions.setOption.preview(optionLike);
    expect(preview.admitted && preview.after.state.value).toEqual(optionLike);

    const submitted = await app.actions.setOption.submit(
      optionLike,
      { __kind: "SubmitOptions", report: "summary" },
    );
    expect(submitted.ok && submitted.after.state.value).toEqual(optionLike);
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

    await expect(app.actions.increment.submit()).rejects.toBeInstanceOf(SubmissionFailedError);
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

    await expect(app.actions.increment.submit()).rejects.toBeInstanceOf(SubmissionFailedError);

    expect(failed).toHaveBeenCalledWith(expect.objectContaining({
      action: "increment",
      mode: "base",
      stage: "runtime",
      error: expect.objectContaining({ message: "host exploded" }),
    }));
  });

  it("emits observe.event payloads matching ManifestoEventPayloadMap without full snapshots", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const settled = vi.fn();
    app.observe.event("submission:settled", settled);

    await app.actions.increment.submit();

    expect(settled).toHaveBeenCalledWith(expect.objectContaining({
      action: "increment",
      mode: "base",
      outcome: { kind: "ok" },
      schemaHash: app.inspect.schemaHash(),
      snapshotVersion: expect.any(Number),
    }));
    expect(settled.mock.calls[0]?.[0]).not.toHaveProperty("snapshot");
    expect(settled.mock.calls[0]?.[0]).not.toHaveProperty("canonicalSnapshot");
  });
});
