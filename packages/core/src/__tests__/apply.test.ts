import { describe, it, expect } from "vitest";
import { apply } from "../core/apply.js";
import { createSnapshot } from "../factories.js";
import type { DomainSchema } from "../schema/domain.js";

const HOST_CONTEXT = { now: 0, randomSeed: "seed" };

describe("apply", () => {
  it("should surface computed evaluation errors as values", () => {
    const schema: DomainSchema = {
      id: "manifesto:test",
      version: "1.0.0",
      hash: "test-hash",
      types: {},
      state: {
        fields: {
          dummy: { type: "string", required: true },
        },
      },
      computed: {
        fields: {
          "computed.a": {
            expr: { kind: "get", path: "computed.b" },
            deps: ["computed.b"],
          },
          "computed.b": {
            expr: { kind: "get", path: "computed.a" },
            deps: ["computed.a"],
          },
        },
      },
      actions: {
        noop: { flow: { kind: "halt", reason: "noop" } },
      },
    };

    const snapshot = createSnapshot({ dummy: "initial" }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "set", path: "dummy", value: "updated" }],
      HOST_CONTEXT
    );

    expect(result.data).toEqual({ dummy: "updated" });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("CYCLIC_DEPENDENCY");
    expect(result.computed).toEqual({});
  });

  it("should record errors for unknown patch paths", () => {
    const schema: DomainSchema = {
      id: "manifesto:test",
      version: "1.0.0",
      hash: "test-hash",
      types: {},
      state: {
        fields: {
          dummy: { type: "string", required: true },
        },
      },
      computed: { fields: {} },
      actions: {
        noop: { flow: { kind: "halt", reason: "noop" } },
      },
    };

    const snapshot = createSnapshot({ dummy: "initial" }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "set", path: "missing", value: "value" }],
      HOST_CONTEXT
    );

    expect(result.data).toEqual({ dummy: "initial" });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("PATH_NOT_FOUND");
  });

  it("should record errors for invalid patch value types", () => {
    const schema: DomainSchema = {
      id: "manifesto:test",
      version: "1.0.0",
      hash: "test-hash",
      types: {},
      state: {
        fields: {
          dummy: { type: "string", required: true },
        },
      },
      computed: { fields: {} },
      actions: {
        noop: { flow: { kind: "halt", reason: "noop" } },
      },
    };

    const snapshot = createSnapshot({ dummy: "initial" }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "set", path: "dummy", value: 42 }],
      HOST_CONTEXT
    );

    expect(result.data).toEqual({ dummy: "initial" });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("TYPE_MISMATCH");
  });

  it("should ignore patches to computed and meta", () => {
    const schema: DomainSchema = {
      id: "manifesto:test",
      version: "1.0.0",
      hash: "test-hash",
      types: {},
      state: {
        fields: {
          count: { type: "number", required: true },
        },
      },
      computed: {
        fields: {
          "computed.double": {
            expr: {
              kind: "mul",
              left: { kind: "get", path: "count" },
              right: { kind: "lit", value: 2 },
            },
            deps: ["count"],
          },
        },
      },
      actions: {
        noop: { flow: { kind: "halt", reason: "noop" } },
      },
    };

    const snapshot = createSnapshot({ count: 2 }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [
        { op: "set", path: "computed.double", value: 999 },
        { op: "set", path: "meta.version", value: 999 },
        { op: "set", path: "count", value: 3 },
      ],
      HOST_CONTEXT
    );

    expect(result.data).toEqual({ count: 3 });
    expect(result.computed["computed.double"]).toBe(6);
    expect(result.meta.version).toBe(snapshot.meta.version + 1);
  });

  it("should record errors for merge patches on non-object fields", () => {
    const schema: DomainSchema = {
      id: "manifesto:test",
      version: "1.0.0",
      hash: "test-hash",
      types: {},
      state: {
        fields: {
          name: { type: "string", required: true },
        },
      },
      computed: { fields: {} },
      actions: {
        noop: { flow: { kind: "halt", reason: "noop" } },
      },
    };

    const snapshot = createSnapshot({ name: "initial" }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "merge", path: "name", value: { extra: "value" } }],
      HOST_CONTEXT
    );

    expect(result.data).toEqual({ name: "initial" });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("TYPE_MISMATCH");
  });

  it("should allow merge on platform namespace paths not declared in StateSpec", () => {
    const schema: DomainSchema = {
      id: "manifesto:test",
      version: "1.0.0",
      hash: "test-hash",
      types: {},
      state: {
        fields: {
          count: { type: "number", required: true },
        },
      },
      computed: { fields: {} },
      actions: {
        noop: { flow: { kind: "halt", reason: "noop" } },
      },
    };

    const snapshot = createSnapshot({ count: 1 }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "merge", path: "$mel.guards.intent", value: { addTodo: "intent-1" } }],
      HOST_CONTEXT
    );

    expect(result.data).toEqual({
      count: 1,
      $mel: {
        guards: {
          intent: {
            addTodo: "intent-1",
          },
        },
      },
    });
    expect(result.system.status).toBe("idle");
    expect(result.system.lastError).toBeNull();
  });

  it("should record TYPE_MISMATCH for non-object values at platform namespace root", () => {
    const schema: DomainSchema = {
      id: "manifesto:test",
      version: "1.0.0",
      hash: "test-hash",
      types: {},
      state: {
        fields: {
          count: { type: "number", required: true },
        },
      },
      computed: { fields: {} },
      actions: {
        noop: { flow: { kind: "halt", reason: "noop" } },
      },
    };

    const snapshot = createSnapshot({ count: 1 }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "set", path: "$mel", value: "invalid" }],
      HOST_CONTEXT
    );

    expect(result.data).toEqual({ count: 1 });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("TYPE_MISMATCH");
  });

  it("should create missing object paths for merge targets", () => {
    const schema: DomainSchema = {
      id: "manifesto:test",
      version: "1.0.0",
      hash: "test-hash",
      types: {},
      state: {
        fields: {
          profile: {
            type: "object",
            required: false,
            fields: {
              meta: {
                type: "object",
                required: false,
                fields: {
                  source: { type: "string", required: false },
                },
              },
            },
          },
        },
      },
      computed: { fields: {} },
      actions: {
        noop: { flow: { kind: "halt", reason: "noop" } },
      },
    };

    const snapshot = createSnapshot({}, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "merge", path: "profile.meta", value: { source: "import" } }],
      HOST_CONTEXT
    );

    expect(result.data).toEqual({
      profile: {
        meta: {
          source: "import",
        },
      },
    });
    expect(result.system.status).toBe("idle");
    expect(result.system.lastError).toBeNull();
  });

  it("should record TYPE_MISMATCH when merge target path resolves to non-object runtime value", () => {
    const schema: DomainSchema = {
      id: "manifesto:test",
      version: "1.0.0",
      hash: "test-hash",
      types: {},
      state: {
        fields: {
          profile: {
            type: "object",
            required: false,
            fields: {
              meta: {
                type: "object",
                required: false,
                fields: {
                  source: { type: "string", required: false },
                },
              },
            },
          },
        },
      },
      computed: { fields: {} },
      actions: {
        noop: { flow: { kind: "halt", reason: "noop" } },
      },
    };

    const snapshot = createSnapshot(
      {
        profile: {
          meta: "not-object",
        },
      } as unknown,
      schema.hash,
      HOST_CONTEXT
    );
    const result = apply(
      schema,
      snapshot,
      [{ op: "merge", path: "profile.meta", value: { source: "import" } }],
      HOST_CONTEXT
    );

    expect(result.data).toEqual({
      profile: {
        meta: "not-object",
      },
    });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("TYPE_MISMATCH");
  });
});
