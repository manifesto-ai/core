import { describe, expect, it } from "vitest";
import type { DomainSchema, JsonValue } from "@manifesto-ai/core";

import { ManifestoError, createManifesto } from "../index.js";
import { captureExternalContext, materializeExternalContext } from "../runtime/context.js";
import { createCounterSchema, withHash, type CounterDomain } from "./helpers/schema.js";

type PayloadContextDomain = {
  actions: {};
  state: {
    value: string;
  };
  computed: {};
  context: {
    tenantId: string;
    payload: Record<string, JsonValue>;
  };
};

function createPayloadContextSchema(): DomainSchema {
  return withHash({
    id: "manifesto:sdk-context-validation",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        value: { type: "string", required: false, default: "" },
      },
    },
    context: {
      fields: {
        tenantId: { type: "string", required: false },
        payload: { type: "object", required: false },
      },
    },
    computed: { fields: {} },
    actions: {},
  });
}

function captureError(run: () => unknown): ManifestoError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ManifestoError);
    return error as ManifestoError;
  }
  throw new Error("Expected the call to throw");
}

describe("materializeExternalContext()", () => {
  const schema = createPayloadContextSchema();

  it("defaults undefined to an empty frozen context", () => {
    const context = materializeExternalContext(schema, undefined, "test");

    expect(context).toEqual({});
    expect(Object.isFrozen(context)).toBe(true);
  });

  it("deep-clones and freezes nested records and arrays", () => {
    const source = {
      tenantId: "acme",
      payload: { tags: ["a", "b"], nested: { ok: true } },
    };
    const context = materializeExternalContext<PayloadContextDomain>(schema, source, "test");

    expect(context).toEqual(source);
    expect(context.payload).not.toBe(source.payload);
    expect(Object.isFrozen(context.payload)).toBe(true);
    expect(Object.isFrozen((context.payload as { tags: string[] }).tags)).toBe(true);

    source.payload.nested.ok = false;
    expect((context.payload as { nested: { ok: boolean } }).nested.ok).toBe(true);
  });

  it("rejects non-record top-level context values with a $context path", () => {
    for (const value of [null, [], "context", 42, new Date()]) {
      const error = captureError(() => materializeExternalContext(schema, value, "injectContext"));
      expect(error.code).toBe("INVALID_CONTEXT");
      expect(error.message).toBe(
        "Invalid context for injectContext at $context: Context must be a plain JSON object",
      );
    }
  });

  it("rejects undefined values at their rendered nested path", () => {
    const error = captureError(() =>
      materializeExternalContext(
        schema,
        {
          payload: { inner: undefined },
        },
        "updateContext",
      ),
    );

    expect(error.code).toBe("INVALID_CONTEXT");
    expect(error.message).toBe(
      "Invalid context for updateContext at $context.payload.inner: " +
        "Context must not contain undefined",
    );
  });

  it("rejects non-finite numbers", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const error = captureError(() =>
        materializeExternalContext(
          schema,
          {
            payload: { amount: bad },
          },
          "test",
        ),
      );
      expect(error.code).toBe("INVALID_CONTEXT");
      expect(error.message).toContain("at $context.payload.amount: Context numbers must be finite");
    }
  });

  it("rejects functions, symbols, and bigint values", () => {
    expect(
      captureError(() =>
        materializeExternalContext(
          schema,
          {
            payload: { run: () => 1 },
          },
          "test",
        ),
      ).message,
    ).toContain("Context must not contain functions");

    expect(
      captureError(() =>
        materializeExternalContext(
          schema,
          {
            payload: { tag: Symbol("x") },
          },
          "test",
        ),
      ).message,
    ).toContain("Context must not contain symbols");

    expect(
      captureError(() =>
        materializeExternalContext(
          schema,
          {
            payload: { big: 1n },
          },
          "test",
        ),
      ).message,
    ).toContain("Context must not contain bigint values");
  });

  it("rejects non-plain nested objects", () => {
    for (const bad of [new Date(), new Map(), Promise.resolve(1)]) {
      const error = captureError(() =>
        materializeExternalContext(
          schema,
          {
            payload: { bad },
          },
          "test",
        ),
      );
      expect(error.message).toContain(
        "at $context.payload.bad: Context objects must be plain JSON objects",
      );
    }
  });

  it("rejects arrays with holes at the hole index", () => {
    const holes: unknown[] = [];
    holes[0] = "a";
    holes[2] = "c";

    const error = captureError(() =>
      materializeExternalContext(
        schema,
        {
          payload: { items: holes },
        },
        "test",
      ),
    );

    expect(error.message).toBe(
      "Invalid context for test at $context.payload.items.1: " +
        "Context arrays must not contain holes",
    );
  });

  it("rejects cycles in records and arrays", () => {
    const cyclicRecord: Record<string, unknown> = {};
    cyclicRecord.self = cyclicRecord;
    expect(
      captureError(() =>
        materializeExternalContext(
          schema,
          {
            payload: cyclicRecord,
          },
          "test",
        ),
      ).message,
    ).toContain("Context must not contain cycles");

    const cyclicArray: unknown[] = [];
    cyclicArray.push(cyclicArray);
    expect(
      captureError(() =>
        materializeExternalContext(
          schema,
          {
            payload: { items: cyclicArray },
          },
          "test",
        ),
      ).message,
    ).toContain("Context must not contain cycles");
  });

  it("allows repeated references that do not form a cycle", () => {
    const shared = { kind: "shared" };
    const context = materializeExternalContext<PayloadContextDomain>(
      schema,
      {
        payload: { first: shared, second: shared },
      },
      "test",
    );

    expect(context.payload).toEqual({
      first: { kind: "shared" },
      second: { kind: "shared" },
    });
  });

  it("rejects getters, setters, and symbol keys", () => {
    const withGetter: Record<string, unknown> = {};
    Object.defineProperty(withGetter, "lazy", {
      enumerable: true,
      get: () => "value",
    });
    expect(
      captureError(() =>
        materializeExternalContext(
          schema,
          {
            payload: withGetter,
          },
          "test",
        ),
      ).message,
    ).toContain("Context must not contain getters or setters");

    const withSymbol: Record<PropertyKey, unknown> = { ok: true };
    withSymbol[Symbol("hidden")] = "x";
    expect(
      captureError(() =>
        materializeExternalContext(
          schema,
          {
            payload: withSymbol,
          },
          "test",
        ),
      ).message,
    ).toContain("Context must not contain symbol keys");
  });

  it("surfaces schema validation failures with the INVALID_CONTEXT code", () => {
    const error = captureError(() =>
      materializeExternalContext(
        schema,
        {
          unknownField: "x",
        },
        "createManifesto",
      ),
    );

    expect(error.code).toBe("INVALID_CONTEXT");
    expect(error.message).toContain("Invalid context for createManifesto");
    expect(error.message).toContain("Unknown context field: unknownField");
    expect(error.message).toContain("context.unknownField");
  });

  it("rejects any non-empty context when the schema declares none", () => {
    const error = captureError(() =>
      materializeExternalContext(createCounterSchema(), { tenantId: "acme" }, "createManifesto"),
    );

    expect(error.code).toBe("INVALID_CONTEXT");
    expect(error.message).toContain('Schema does not declare user context field "tenantId"');
  });
});

describe("captureExternalContext()", () => {
  const schema = createPayloadContextSchema();

  it("returns the current context unchanged when no override is provided", () => {
    const current = materializeExternalContext<PayloadContextDomain>(
      schema,
      {
        tenantId: "acme",
      },
      "test",
    );

    expect(captureExternalContext<PayloadContextDomain>(schema, current, undefined, "test")).toBe(
      current,
    );
  });

  it("materializes and validates the override when provided", () => {
    const current = materializeExternalContext<PayloadContextDomain>(
      schema,
      {
        tenantId: "acme",
      },
      "test",
    );

    const next = captureExternalContext<PayloadContextDomain>(
      schema,
      current,
      {
        tenantId: "other",
      },
      "test",
    );
    expect(next.tenantId).toBe("other");
    expect(Object.isFrozen(next)).toBe(true);

    const error = captureError(() =>
      captureExternalContext<PayloadContextDomain>(
        schema,
        current,
        { tenantId: () => "acme" },
        "with",
      ),
    );
    expect(error.code).toBe("INVALID_CONTEXT");
    expect(error.message).toContain("Invalid context for with at $context.tenantId");
  });
});

describe("runtime context error surfaces", () => {
  it("rejects invalid injectContext values with INVALID_CONTEXT", () => {
    const app = createManifesto<PayloadContextDomain>(
      createPayloadContextSchema(),
      {},
      { context: { tenantId: "acme", payload: {} } },
    ).activate();

    const error = captureError(() =>
      app.injectContext({ tenantId: "acme", payload: { bad: Number.NaN } }),
    );
    expect(error.code).toBe("INVALID_CONTEXT");
    expect(app.context()).toEqual({ tenantId: "acme", payload: {} });
  });

  it("rejects invalid updateContext return values and keeps the old context", () => {
    const app = createManifesto<PayloadContextDomain>(
      createPayloadContextSchema(),
      {},
      { context: { tenantId: "acme", payload: {} } },
    ).activate();

    const error = captureError(() =>
      app.updateContext(() => ({ tenantId: "acme", unknownField: "x" }) as never),
    );
    expect(error.code).toBe("INVALID_CONTEXT");
    expect(error.message).toContain("Unknown context field: unknownField");
    expect(app.context()).toEqual({ tenantId: "acme", payload: {} });
  });

  it("rejects non-empty context for schemas that declare none", () => {
    const error = captureError(() =>
      createManifesto<CounterDomain>(
        createCounterSchema(),
        {},
        {
          context: { tenantId: "acme" },
        },
      ).activate(),
    );

    expect(error.code).toBe("INVALID_CONTEXT");
    expect(error.message).toContain("does not declare");
  });
});
