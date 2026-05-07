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
import { projectedSnapshotsEqual } from "../projection/snapshot-projection.js";
import {
  createCounterSchema,
  type CounterDomain,
} from "./helpers/schema.js";

const pp = semanticPathToPatchPath;

type ContextDomain = {
  actions: {
    stamp: () => void;
    loadWithContext: () => void;
  };
  state: {
    tenantId: string;
    locale: string;
    runtimeValue: string;
    beforeLocale: string;
    afterLocale: string;
    status: string;
  };
  computed: {};
  context: {
    tenantId: string;
    locale: string;
    runtime: string;
  };
};

type NamespaceDomain = {
  actions: {};
  state: {
    namespaces: {
      visible: boolean;
    };
  };
  computed: {
    visibleValue: boolean;
  };
};

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

function createContextSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-context-runtime",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        tenantId: { type: "string", required: false, default: "" },
        locale: { type: "string", required: false, default: "" },
        runtimeValue: { type: "string", required: false, default: "" },
        beforeLocale: { type: "string", required: false, default: "" },
        afterLocale: { type: "string", required: false, default: "" },
        status: { type: "string", required: false, default: "idle" },
      },
    },
    context: {
      fields: {
        tenantId: { type: "string", required: true },
        locale: { type: "string", required: true },
        runtime: { type: "string", required: true },
      },
      fieldTypes: {
        tenantId: { kind: "primitive", type: "string" },
        locale: { kind: "primitive", type: "string" },
        runtime: { kind: "primitive", type: "string" },
      },
    },
    computed: { fields: {} },
    actions: {
      stamp: {
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "patch",
              op: "set",
              path: pp("tenantId"),
              value: { kind: "get", path: "$context.tenantId" },
            },
            {
              kind: "patch",
              op: "set",
              path: pp("locale"),
              value: { kind: "get", path: "$context.locale" },
            },
            {
              kind: "patch",
              op: "set",
              path: pp("runtimeValue"),
              value: { kind: "get", path: "$context.runtime" },
            },
          ],
        },
      },
      loadWithContext: {
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "causalGuard",
              guardId: "capture-before",
              body: {
                kind: "patch",
                op: "set",
                path: pp("beforeLocale"),
                value: { kind: "get", path: "$context.locale" },
              },
            },
            {
              kind: "causalGuard",
              guardId: "request-load",
              body: {
                kind: "effect",
                type: "api.load",
                params: {},
              },
            },
            {
              kind: "patch",
              op: "set",
              path: pp("afterLocale"),
              value: { kind: "get", path: "$context.locale" },
            },
            {
              kind: "patch",
              op: "set",
              path: pp("status"),
              value: { kind: "lit", value: "loaded" },
            },
          ],
        },
      },
    },
  });
}

function createNamespaceDomainSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-domain-namespaces",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        namespaces: {
          type: "object",
          required: true,
          default: { visible: true },
          fields: {
            visible: { type: "boolean", required: true },
          },
        },
      },
    },
    computed: {
      fields: {
        visibleValue: {
          expr: { kind: "get", path: "namespaces.visible" },
          deps: ["namespaces.visible"],
        },
      },
    },
    actions: {},
  });
}

const initialContext = {
  tenantId: "acme",
  locale: "ko-KR",
  runtime: "external-runtime",
} as const;

describe("activated v5 base runtime", () => {
  it("uses initial context for preview and submit while exposing a frozen flat context", async () => {
    const app = createManifesto<ContextDomain>(createContextSchema(), {}, {
      context: initialContext,
    }).activate();

    expect(app.context()).toEqual(initialContext);
    expect(Object.isFrozen(app.context())).toBe(true);
    expect(() => {
      (app.context() as { locale: string }).locale = "en-US";
    }).toThrow(TypeError);

    const preview = app.action.stamp.preview();
    expect(preview.admitted && preview.after.state).toMatchObject({
      tenantId: "acme",
      locale: "ko-KR",
      runtimeValue: "external-runtime",
    });
    expect(app.snapshot().state.locale).toBe("");

    const result = await app.action.stamp.submit();
    expect(result.ok && result.after.state).toMatchObject({
      tenantId: "acme",
      locale: "ko-KR",
      runtimeValue: "external-runtime",
    });
  });

  it("full-replaces context through injectContext and updateContext without publishing runtime events", async () => {
    const app = createManifesto<ContextDomain>(createContextSchema(), {}, {
      context: initialContext,
    }).activate();
    const stateListener = vi.fn();
    const eventListener = vi.fn();

    app.observe.state((snapshot) => snapshot.state.locale, stateListener);
    app.observe.event("submission:submitted", eventListener);

    app.injectContext({
      tenantId: "acme",
      locale: "en-US",
      runtime: "external-runtime",
    });
    expect(app.context().locale).toBe("en-US");
    expect(stateListener).not.toHaveBeenCalled();
    expect(eventListener).not.toHaveBeenCalled();

    const updated = app.updateContext((current) => ({
      ...current,
      locale: "ja-JP",
    }));
    expect(updated.locale).toBe("ja-JP");
    expect(app.context().locale).toBe("ja-JP");
    expect(stateListener).not.toHaveBeenCalled();
    expect(eventListener).not.toHaveBeenCalled();

    const result = await app.action.stamp.submit();
    expect(result.ok && result.after.state.locale).toBe("ja-JP");
  });

  it("applies execution view context only to transitions triggered through that view", async () => {
    const app = createManifesto<ContextDomain>(createContextSchema(), {}, {
      context: initialContext,
    }).activate();

    const requestApp = app.with({
      context: {
        tenantId: "other",
        locale: "en-US",
        runtime: "override-runtime",
      },
    });

    const preview = requestApp.action.stamp.preview();
    expect(preview.admitted && preview.after.state).toMatchObject({
      tenantId: "other",
      locale: "en-US",
      runtimeValue: "override-runtime",
    });
    expect(app.context()).toEqual(initialContext);
    expect(requestApp.context()).toEqual({
      tenantId: "other",
      locale: "en-US",
      runtime: "override-runtime",
    });

    const submitApp = app.with({
      context: {
        tenantId: "other",
        locale: "fr-FR",
        runtime: "submit-runtime",
      },
    });
    const result = await submitApp.action.stamp.submit();
    expect(result.ok && result.after.state).toMatchObject({
      tenantId: "other",
      locale: "fr-FR",
      runtimeValue: "submit-runtime",
    });
    expect(app.context()).toEqual(initialContext);
  });

  it("keeps in-flight submit and host re-entry pinned to the call-entry context", async () => {
    let resolveEffect: (() => void) | null = null;
    const effectStarted = new Promise<void>((resolve) => {
      resolveEffect = resolve;
    });

    const app = createManifesto<ContextDomain>(
      createContextSchema(),
      {
        "api.load": async () => {
          await effectStarted;
          return [];
        },
      },
      { context: initialContext },
    ).activate();

    const submitted = app.action.loadWithContext.submit();
    app.injectContext({
      tenantId: "acme",
      locale: "en-US",
      runtime: "external-runtime",
    });
    resolveEffect?.();

    const result = await submitted;
    expect(result.ok && result.after.state.beforeLocale).toBe("ko-KR");
    expect(result.ok && result.after.state.afterLocale).toBe("ko-KR");
    expect(app.context().locale).toBe("en-US");
  });

  it("rejects invalid context values before runtime execution", () => {
    const schema = createContextSchema();

    expect(() => createManifesto<ContextDomain>(schema, {}, {
      context: { tenantId: "acme", locale: "ko-KR" },
    }).activate()).toThrow(ManifestoError);

    expect(() => createManifesto<ContextDomain>(schema, {}, {
      context: {
        ...initialContext,
        extra: "nope",
      },
    }).activate()).toThrow(/Unknown context field/);

    const withProtoKey: Record<string, unknown> = { ...initialContext };
    Object.defineProperty(withProtoKey, "__proto__", {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    expect(() => createManifesto<ContextDomain>(schema, {}, {
      context: withProtoKey as never,
    }).activate()).toThrow(/Unknown context field/);

    expect(() => createManifesto<ContextDomain>(schema, {}, {
      context: {
        ...initialContext,
        locale: 123,
      },
    }).activate()).toThrow(/Expected string/);

    expect(() => createManifesto<ContextDomain>(schema, {}, {
      context: {
        ...initialContext,
        getId: () => "id",
      } as never,
    }).activate()).toThrow(/functions/);

    expect(() => createManifesto<ContextDomain>(schema, {}, {
      context: {
        ...initialContext,
        pending: Promise.resolve("x"),
      } as never,
    }).activate()).toThrow(/plain JSON objects/);

    expect(() => createManifesto<ContextDomain>(schema, {}, {
      context: new Date() as never,
    }).activate()).toThrow(/plain JSON object/);

    const withGetter = {
      ...initialContext,
    } as { tenantId: string; locale: string; runtime: string };
    Object.defineProperty(withGetter, "locale", {
      enumerable: true,
      get: () => "ko-KR",
    });
    expect(() => createManifesto<ContextDomain>(schema, {}, {
      context: withGetter,
    }).activate()).toThrow(/getters/);

    const circular: Record<string, unknown> = { ...initialContext };
    circular.self = circular;
    expect(() => createManifesto<ContextDomain>(schema, {}, {
      context: circular as never,
    }).activate()).toThrow(/cycles/);
  });

  it("rejects async updateContext results and non-empty context for schemas without context", () => {
    const app = createManifesto<ContextDomain>(createContextSchema(), {}, {
      context: initialContext,
    }).activate();

    expect(() => app.updateContext((() =>
      Promise.resolve(initialContext)) as never)).toThrow(/synchronous/);

    expect(() => createManifesto<CounterDomain>(createCounterSchema(), {}, {
      context: { tenantId: "acme" },
    }).activate()).toThrow(/does not declare/);
  });

  it("submits through action handles and publishes the terminal projected snapshot", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const listener = vi.fn();
    app.observe.state((snapshot) => snapshot.state.count, listener);

    const result = await app.action.increment.submit();

    expect(result.ok && result.before.state.count).toBe(0);
    expect(result.ok && result.after.state.count).toBe(1);
    expect(app.snapshot().state.count).toBe(1);
    expect(listener).toHaveBeenCalledWith(1, 0);
  });

  it("returns projected snapshots from snapshot() and canonical substrate from inspect", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const projected = app.snapshot();
    const canonical = app.inspect.canonicalSnapshot();

    expect(projected.state).toEqual({ count: 0, status: "idle" });
    expect(projected).not.toHaveProperty("namespaces");
    expect(canonical.state).not.toHaveProperty("$host");
    expect(canonical.state).not.toHaveProperty("$mel");
    expect(canonical.namespaces).toBeDefined();
  });

  it("keeps computed fields that depend on domain state.namespaces paths visible", () => {
    const app = createManifesto<NamespaceDomain>(
      createNamespaceDomainSchema(),
      {},
    ).activate();

    expect(app.snapshot().computed.visibleValue).toBe(true);
  });

  it("previews without publishing state and preserves pending status", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const before = app.snapshot();

    const preview = app.action.load.preview();

    expect(preview.admitted).toBe(true);
    expect(preview.admitted && preview.status).toBe("pending");
    expect(preview.admitted && preview.after.state.status).toBe("loading");
    expect(preview.admitted && preview.requirements).toHaveLength(1);
    expect(app.snapshot()).toBe(before);
    expect(app.snapshot().state.status).toBe("idle");
  });

  it("keeps extension-kernel arbitrary-snapshot simulation read-only", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const ext = getExtensionKernel(app);
    const canonical = ext.getCanonicalSnapshot();
    const intent = ext.createIntent(ext.refs.actions.increment);

    const first = ext.simulateSync(canonical, intent);
    const second = ext.simulateSync(canonical, intent);

    expect(first.status).toBe("complete");
    expect(first.snapshot.state.count).toBe(1);
    expect(second.snapshot.state.count).toBe(1);
    expect(app.inspect.canonicalSnapshot().state.count).toBe(0);
  });

  it("compares projected snapshots using state/computed/system/meta only", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const before = app.snapshot();
    await app.action.increment.submit();
    const after = app.snapshot();

    expect(projectedSnapshotsEqual(before, before)).toBe(true);
    expect(projectedSnapshotsEqual(before, after)).toBe(false);
  });

  it("disposes idempotently and rejects future submit calls", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    app.dispose();
    app.dispose();

    await expect(app.action.increment.submit()).rejects.toBeInstanceOf(DisposedError);
    expect(app.snapshot().state.count).toBe(0);
  });

  it("does not let projected snapshot mutation leak back into runtime state", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    await app.action.add.submit(3);

    const snapshot = app.snapshot();
    expect(() => {
      (snapshot.state as { count: number }).count = 999;
    }).toThrow(TypeError);
    expect(app.snapshot().state.count).toBe(3);
  });
});
