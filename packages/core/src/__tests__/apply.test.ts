import { describe, it, expect } from "vitest";
import { apply, applyNamespaceDeltas } from "../core/apply.js";
import { createSnapshot } from "../factories.js";
import type { DomainSchema } from "../schema/domain.js";
import { semanticPathToPatchPath } from "../utils/patch-path.js";

const HOST_CONTEXT = { now: 0, randomSeed: "seed" };
const pp = (path: string) => semanticPathToPatchPath(path);

function createCountSchema(): DomainSchema {
  return {
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
}

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
          "a": {
            expr: { kind: "get", path: "b" },
            deps: ["b"],
          },
          "b": {
            expr: { kind: "get", path: "a" },
            deps: ["a"],
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
      [{ op: "set", path: pp("dummy"), value: "updated" }],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({ dummy: "updated" });
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
      [{ op: "set", path: pp("missing"), value: "value" }],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({ dummy: "initial" });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("PATH_NOT_FOUND");
  });

  it("should reject patch roots that exist only in state.fieldTypes", () => {
    const schema: DomainSchema = {
      id: "manifesto:test",
      version: "1.0.0",
      hash: "test-hash",
      types: {},
      state: {
        fields: {
          dummy: { type: "string", required: true },
        },
        fieldTypes: {
          ghost: { kind: "primitive", type: "string" },
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
      [{ op: "set", path: pp("ghost"), value: "value" }],
      HOST_CONTEXT,
    );

    expect(result.state).toEqual({ dummy: "initial" });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("PATH_NOT_FOUND");
  });

  it("should preserve dotted record keys in patch paths", () => {
    const schema: DomainSchema = {
      id: "manifesto:test",
      version: "1.0.0",
      hash: "test-hash",
      types: {},
      state: {
        fields: {
          history: {
            type: "object",
            required: true,
            fields: {
              files: {
                type: "object",
                required: false,
                fields: {
                  "file:///proof.lean": { type: "string", required: false },
                  "TACTIC_FAILED:simp": { type: "string", required: false },
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

    const snapshot = createSnapshot({ history: { files: {} } }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "set", path: pp("history.files.file:///proof\\.lean"), value: "recorded" }],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({
      history: {
        files: {
          "file:///proof.lean": "recorded",
        },
      },
    });
    expect(result.system.status).toBe("idle");
    expect(result.system.lastError).toBeNull();
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
      [{ op: "set", path: pp("dummy"), value: 42 }],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({ dummy: "initial" });
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
          "double": {
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
        { op: "set", path: pp("double"), value: 999 },
        { op: "set", path: pp("meta.version"), value: 999 },
        { op: "set", path: pp("count"), value: 3 },
      ],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({ count: 3 });
    expect(result.computed["double"]).toBe(6);
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
      [{ op: "merge", path: pp("name"), value: { extra: "value" } }],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({ name: "initial" });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("TYPE_MISMATCH");
  });

  it("should reject namespace-looking paths through domain apply", () => {
    const schema = createCountSchema();
    const snapshot = createSnapshot({ count: 1 }, schema.hash, HOST_CONTEXT);
    const result = apply(
      schema,
      snapshot,
      [{ op: "merge", path: pp("$mel.guards.intent"), value: { addTodo: "intent-1" } }],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({ count: 1 });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("PATH_NOT_FOUND");
  });

  it("should apply namespace deltas at namespace root", () => {
    const schema = createCountSchema();
    const snapshot = createSnapshot({ count: 1 }, schema.hash, HOST_CONTEXT);
    const result = applyNamespaceDeltas(
      snapshot,
      [{ namespace: "mel", patches: [{ op: "merge", path: pp("guards.intent"), value: { addTodo: "intent-1" } }] }],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({
      count: 1,
    });
    expect(result.namespaces.mel).toEqual({
      guards: {
        intent: {
          addTodo: "intent-1",
        },
      },
    });
    expect(result.system.status).toBe("idle");
    expect(result.system.lastError).toBeNull();
  });

  it("should apply arbitrary namespace deltas", () => {
    const schema = createCountSchema();
    const snapshot = createSnapshot({ count: 1 }, schema.hash, HOST_CONTEXT);
    const result = applyNamespaceDeltas(
      snapshot,
      [{ namespace: "runtime", patches: [{ op: "merge", path: pp("cache"), value: { warmed: true } }] }],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({ count: 1 });
    expect(result.namespaces.runtime).toEqual({
      cache: {
        warmed: true,
      },
    });
    expect(result.system.status).toBe("idle");
    expect(result.system.lastError).toBeNull();
  });

  it("should record TYPE_MISMATCH for non-object namespace roots", () => {
    const schema = createCountSchema();
    const snapshot = createSnapshot({ count: 1 }, schema.hash, HOST_CONTEXT);
    const result = applyNamespaceDeltas(
      {
        ...snapshot,
        namespaces: {
          ...snapshot.namespaces,
          runtime: "invalid",
        },
      },
      [{ namespace: "runtime", patches: [{ op: "set", path: pp("cache"), value: "value" }] }],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({ count: 1 });
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
      [{ op: "merge", path: pp("profile.meta"), value: { source: "import" } }],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({
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
      [{ op: "merge", path: pp("profile.meta"), value: { source: "import" } }],
      HOST_CONTEXT
    );

    expect(result.state).toEqual({
      profile: {
        meta: "not-object",
      },
    });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("TYPE_MISMATCH");
  });
});
