import { describe, expect, it } from "vitest";

import {
  apply,
  applyNamespaceDeltas,
  findJsonValueViolation,
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
  type NamespaceDelta,
  type Patch,
  type Snapshot,
} from "../index.js";

const pp = semanticPathToPatchPath;

/**
 * Regression tests for #480: snapshot/patch write boundaries must reject
 * non-JSON values instead of letting canonicalization silently drop or
 * coerce them later.
 */
function createSchema(): DomainSchema {
  const schema: Omit<DomainSchema, "hash"> = {
    id: "manifesto:core-480-json-boundary",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
        // Freeform object: structural validation accepts anything object-ish,
        // which is exactly where non-JSON values used to leak through.
        bag: { type: "object", required: false, default: {} },
        items: { type: "array", required: false, default: [] },
      },
    },
    computed: { fields: {} },
    actions: {},
  };
  return { ...schema, hash: hashSchemaSync(schema) };
}

function createTestSnapshot(schema: DomainSchema): Snapshot {
  return {
    state: { count: 0, bag: {}, items: [] },
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      pendingRequirements: [],
      currentAction: null,
    },
    input: undefined,
    meta: {
      version: 1,
      timestamp: 0,
      randomSeed: "test-seed",
      schemaHash: schema.hash,
    },
    namespaces: {},
  };
}

function setBag(value: unknown): Patch {
  return { op: "set", path: pp("bag"), value };
}

describe("apply() rejects non-JSON patch values (#480)", () => {
  const schema = createSchema();

  it.each([
    ["nested undefined", { a: undefined }, /undefined/],
    ["nested function", { fn: () => 1 }, /functions/],
    ["nested symbol", { s: Symbol("x") }, /symbols/],
    ["nested bigint", { b: 1n }, /bigints/],
    ["nested NaN", { n: Number.NaN }, /non-finite/],
    ["nested Infinity", { n: Number.POSITIVE_INFINITY }, /non-finite/],
    ["Date instance", { d: new Date(0) }, /non-plain object \(Date\)/],
    ["Map instance", { m: new Map() }, /non-plain object \(Map\)/],
  ])("rejects %s with INVALID_VALUE", (_label, bag, reason) => {
    const snapshot = createTestSnapshot(schema);
    const result = apply(schema, snapshot, [setBag(bag)]);

    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("INVALID_VALUE");
    expect(result.system.lastError?.message).toMatch(reason);
    // The invalid value must not become accepted state.
    expect(result.state.bag).toEqual({});
  });

  it("rejects circular references", () => {
    const snapshot = createTestSnapshot(schema);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    const result = apply(schema, snapshot, [setBag(cyclic)]);
    expect(result.system.lastError?.code).toBe("INVALID_VALUE");
    expect(result.system.lastError?.message).toMatch(/circular/);
  });

  it("accepts JSON-compatible values including shared references and -0", () => {
    const snapshot = createTestSnapshot(schema);
    const shared = { v: 1 };
    const result = apply(schema, snapshot, [
      setBag({ a: shared, b: shared, zero: -0, deep: [{ x: null }, "s", true] }),
    ]);

    expect(result.system.lastError).toBeNull();
    expect(result.state.bag).toMatchObject({ zero: -0 });
  });

  it("reports the violating path for nested values", () => {
    const snapshot = createTestSnapshot(schema);
    const result = apply(schema, snapshot, [setBag({ outer: { inner: [1, Number.NaN] } })]);

    expect(result.system.lastError?.message).toMatch(/outer\.inner\[1\]/);
  });
});

describe("applyNamespaceDeltas() rejects non-JSON values (#480)", () => {
  const schema = createSchema();

  it("rejects a namespace patch carrying a function", () => {
    const snapshot = createTestSnapshot(schema);
    const delta: NamespaceDelta = {
      namespace: "tooling",
      patches: [
        {
          op: "set",
          path: [{ kind: "prop", name: "callback" }],
          value: () => 1,
        },
      ],
    };

    const result = applyNamespaceDeltas(snapshot, [delta]);
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("INVALID_VALUE");
    expect((result.namespaces as Record<string, unknown>).tooling).toBeUndefined();
  });

  it("accepts JSON-compatible namespace values", () => {
    const snapshot = createTestSnapshot(schema);
    const delta: NamespaceDelta = {
      namespace: "tooling",
      patches: [
        {
          op: "set",
          path: [{ kind: "prop", name: "meta" }],
          value: { enabled: true, tags: ["a", "b"] },
        },
      ],
    };

    const result = applyNamespaceDeltas(snapshot, [delta]);
    expect(result.system.lastError).toBeNull();
    expect((result.namespaces as Record<string, unknown>).tooling).toEqual({
      meta: { enabled: true, tags: ["a", "b"] },
    });
  });
});

describe("findJsonValueViolation()", () => {
  it("is total on primitives and plain structures", () => {
    expect(findJsonValueViolation(null)).toBeNull();
    expect(findJsonValueViolation(0)).toBeNull();
    expect(findJsonValueViolation("")).toBeNull();
    expect(findJsonValueViolation(false)).toBeNull();
    expect(findJsonValueViolation([])).toBeNull();
    expect(findJsonValueViolation(Object.create(null))).toBeNull();
  });

  it("flags top-level undefined", () => {
    expect(findJsonValueViolation(undefined)).toMatchObject({
      reason: expect.stringContaining("undefined"),
    });
  });
});
