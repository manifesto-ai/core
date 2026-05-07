import { describe, expect, it } from "vitest";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
  type Intent,
} from "@manifesto-ai/core";

import { createHost } from "../../host.js";
import type { Runtime } from "../../types/execution.js";

const pp = semanticPathToPatchPath;

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

function createContextReentrySchema(): DomainSchema {
  return withHash({
    id: "manifesto:host-context-reentry",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        firstTimestamp: { type: "number", required: false, default: 0 },
        secondTimestamp: { type: "number", required: false, default: 0 },
        firstLocale: { type: "string", required: false, default: "" },
        secondLocale: { type: "string", required: false, default: "" },
      },
    },
    context: {
      fields: {
        locale: { type: "string", required: true },
      },
      fieldTypes: {
        locale: { kind: "primitive", type: "string" },
      },
    },
    computed: { fields: {} },
    actions: {
      capture: {
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "causalGuard",
              guardId: "capture-before",
              body: {
                kind: "seq",
                steps: [
                  {
                    kind: "patch",
                    op: "set",
                    path: pp("firstTimestamp"),
                    value: { kind: "get", path: "$runtime.time.timestamp" },
                  },
                  {
                    kind: "patch",
                    op: "set",
                    path: pp("firstLocale"),
                    value: { kind: "get", path: "$context.locale" },
                  },
                ],
              },
            },
            {
              kind: "causalGuard",
              guardId: "request-effect",
              body: {
                kind: "effect",
                type: "advance",
                params: {},
              },
            },
            {
              kind: "patch",
              op: "set",
              path: pp("secondTimestamp"),
              value: { kind: "get", path: "$runtime.time.timestamp" },
            },
            {
              kind: "patch",
              op: "set",
              path: pp("secondLocale"),
              value: { kind: "get", path: "$context.locale" },
            },
          ],
        },
      },
    },
  });
}

function createNoContextSchema(): DomainSchema {
  return withHash({
    id: "manifesto:host-no-context",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
      },
    },
    computed: { fields: {} },
    actions: {
      increment: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: { kind: "lit", value: 1 },
        },
      },
    },
  });
}

describe("ADR-027 Host context materialization", () => {
  it("reuses one materialized context across effect re-entry for a dispatch attempt", async () => {
    let now = 1000;
    const runtime: Runtime = {
      now: () => now,
      microtask: (fn) => queueMicrotask(fn),
      yield: () => Promise.resolve(),
    };
    const schema = createContextReentrySchema();
    const host = createHost(schema, {
      initialData: {},
      runtime,
    });
    host.registerEffect("advance", async () => {
      now = 2000;
      return [];
    });

    const intent: Intent = {
      type: "capture",
      intentId: "intent-context-1",
    };

    const result = await host.dispatch(intent, {
      externalContext: { locale: "ko-KR" },
    });

    expect(result.status).toBe("complete");
    expect(result.snapshot.state).toMatchObject({
      firstTimestamp: 1000,
      secondTimestamp: 1000,
      firstLocale: "ko-KR",
      secondLocale: "ko-KR",
    });
  });

  it("returns an error snapshot when external context violates schema.context", async () => {
    const schema = createContextReentrySchema();
    const host = createHost(schema, {
      initialData: {},
    });

    const result = await host.dispatch(
      {
        type: "capture",
        intentId: "intent-context-invalid",
      },
      {
        externalContext: { locale: 42 },
      },
    );

    expect(result.status).toBe("error");
    expect(result.snapshot.system.lastError).toMatchObject({
      code: "INVALID_CONTEXT",
    });
  });

  it("does not leak HostOptions.env into action external context", async () => {
    const host = createHost(createNoContextSchema(), {
      initialData: {},
      env: { locale: "ko-KR" },
    });

    const result = await host.dispatch({
      type: "increment",
      intentId: "intent-context-env-is-not-external",
    });

    expect(result.status).toBe("complete");
    expect(result.snapshot.state).toMatchObject({ count: 1 });
    expect(result.context?.external).toEqual({});
    expect(result.snapshot.system.lastError).toBeNull();
  });

  it("returns a HostResult error when external context is not JSON-clonable", async () => {
    const host = createHost(createContextReentrySchema(), {
      initialData: {},
    });

    const result = await host.dispatch(
      {
        type: "capture",
        intentId: "intent-context-unclonable",
      },
      {
        externalContext: { locale: undefined as never },
      },
    );
    const hostNamespace = result.snapshot.namespaces.host as {
      readonly lastError?: { readonly code?: string };
    };

    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("INVALID_STATE");
    expect(hostNamespace.lastError?.code).toBe("INVALID_CONTEXT");
  });
});
