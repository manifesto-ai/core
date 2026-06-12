import { describe, expect, it } from "vitest";
import { apply, applyNamespaceDeltas } from "../core/apply.js";
import { compute } from "../core/compute.js";
import { validate } from "../core/validate.js";
import { createIntent, createSnapshot } from "../factories.js";
import type { DomainSchema } from "../schema/domain.js";
import { TraceNodeKind } from "../schema/trace.js";
import { hashSchemaSync } from "../utils/hash.js";
import { semanticPathToPatchPath } from "../utils/patch-path.js";

const HOST_CONTEXT = {
  runtime: {
    time: { timestamp: 100 },
    random: { seed: "seed" },
  },
  external: {},
};
const NEXT_CONTEXT = {
  runtime: {
    time: { timestamp: 101 },
    random: { seed: "next-seed" },
  },
  external: {},
};
const pp = (path: string) => semanticPathToPatchPath(path);

function createSchema(
  stateFields: DomainSchema["state"]["fields"],
  actions: DomainSchema["actions"],
  computedFields: DomainSchema["computed"]["fields"] = {},
): DomainSchema {
  return {
    id: "manifesto:test",
    version: "1.0.0",
    hash: "test-hash",
    types: {},
    state: { fields: stateFields },
    computed: { fields: computedFields },
    actions,
  };
}

function createValidatedSchema(overrides: Partial<Omit<DomainSchema, "hash">> = {}): DomainSchema {
  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "manifesto:test",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: true },
        flag: { type: "boolean", required: true },
        outbox: {
          type: "object",
          required: true,
          fields: {
            requestId: { type: "string", required: true },
          },
        },
      },
    },
    computed: {
      fields: {
        double: {
          expr: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "get", path: "count" },
          },
          deps: ["count"],
        },
      },
    },
    actions: {
      noop: { flow: { kind: "halt", reason: "noop" } },
    },
    ...overrides,
  };

  return {
    ...schemaWithoutHash,
    hash: hashSchemaSync(schemaWithoutHash),
  };
}

describe("ADR-025 core acceptance", () => {
  describe("snapshot ontology", () => {
    it("creates canonical state and namespace roots without a legacy data root", () => {
      const snapshot = createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT);

      expect(snapshot.state).toEqual({ count: 1 });
      expect(Object.hasOwn(snapshot, "data")).toBe(false);
      expect(snapshot.namespaces).toEqual({});
    });
  });

  describe("domain patch root", () => {
    it("applies a declared state.namespaces field as domain state, not Snapshot.namespaces", () => {
      const schema = createSchema(
        {
          namespaces: {
            type: "object",
            required: true,
            fields: {
              visible: { type: "boolean", required: true },
            },
          },
        },
        { noop: { flow: { kind: "halt", reason: "noop" } } },
      );
      const snapshot = createSnapshot(
        { namespaces: { visible: false } },
        schema.hash,
        HOST_CONTEXT,
      );

      const result = apply(schema, snapshot, [
        { op: "set", path: pp("namespaces.visible"), value: true },
      ]);

      expect(result.state).toEqual({ namespaces: { visible: true } });
      expect(result.namespaces).toBe(snapshot.namespaces);
      expect(result.namespaces).toEqual({});
    });
  });

  describe("namespace deltas", () => {
    it("treats omitted namespaceDelta as empty and leaves empty deltas as a no-op", () => {
      const snapshot = createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT);

      expect(applyNamespaceDeltas(snapshot, [])).toBe(snapshot);
    });

    it("updates only namespaces and snapshot version for valid namespace deltas", () => {
      const snapshot = {
        ...createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT),
        computed: { double: 2 },
        input: { draft: true },
      };

      const result = applyNamespaceDeltas(snapshot, [
        {
          namespace: "runtime",
          patches: [{ op: "merge", path: pp("request"), value: { requestId: "req-1" } }],
        },
      ]);

      expect(result.state).toBe(snapshot.state);
      expect(result.computed).toBe(snapshot.computed);
      expect(result.input).toBe(snapshot.input);
      expect(result.system).toBe(snapshot.system);
      expect(result.namespaces.runtime).toEqual({ request: { requestId: "req-1" } });
      expect(result.meta).toEqual({
        ...snapshot.meta,
        version: snapshot.meta.version + 1,
      });
    });

    it("treats prototype-named namespaces as ordinary namespace roots", () => {
      const snapshot = createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT);
      const result = applyNamespaceDeltas(snapshot, [
        { namespace: "toString", patches: [{ op: "set", path: pp("requestId"), value: "req-1" }] },
      ]);

      expect(result.system.status).toBe(snapshot.system.status);
      expect(result.namespaces.toString).toEqual({ requestId: "req-1" });
      expect(Object.getPrototypeOf(result.namespaces)).toBeNull();
    });

    it("rejects empty namespace identifiers without mutating domain state", () => {
      const snapshot = createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT);
      const result = applyNamespaceDeltas(snapshot, [
        { namespace: "", patches: [{ op: "set", path: pp("runtime.requestId"), value: "req-1" }] },
      ]);

      expect(result.state).toBe(snapshot.state);
      expect(result.system.status).toBe("error");
      expect(result.system.lastError?.code).toBe("PATH_NOT_FOUND");
      expect(result.namespaces).toEqual(snapshot.namespaces);
    });

    it("rejects unsafe namespace patch paths", () => {
      const snapshot = createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT);
      const result = applyNamespaceDeltas(snapshot, [
        {
          namespace: "runtime",
          patches: [
            {
              op: "set",
              path: [
                { kind: "prop", name: "__proto__" },
                { kind: "prop", name: "polluted" },
              ],
              value: true,
            },
          ],
        },
      ]);

      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(result.system.status).toBe("error");
      expect(result.system.lastError?.code).toBe("PATH_NOT_FOUND");
      expect(result.namespaces).toEqual({});
    });

    it("rejects namespace merge targets that are present and non-object", () => {
      const snapshot = {
        ...createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT),
        namespaces: {
          runtime: { request: "ready" },
        },
      };

      const result = applyNamespaceDeltas(snapshot, [
        {
          namespace: "runtime",
          patches: [{ op: "merge", path: pp("request"), value: { requestId: "req-1" } }],
        },
      ]);

      expect(result.system.status).toBe("error");
      expect(result.system.lastError?.code).toBe("TYPE_MISMATCH");
      expect(result.namespaces.runtime).toEqual({ request: "ready" });
    });
  });

  describe("compute result and trace surface", () => {
    it("always emits namespaceDelta on compute results even when no namespace changed", async () => {
      const schema = createSchema(
        { count: { type: "number", required: true } },
        {
          inc: {
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
        },
      );
      const snapshot = createSnapshot({ count: 1 }, schema.hash, HOST_CONTEXT);

      const result = await compute(schema, snapshot, createIntent("inc", "intent-1"), NEXT_CONTEXT);

      expect(result.status).toBe("complete");
      expect(result.namespaceDelta).toEqual([]);
    });

    it("keeps error compute results on the same namespaceDelta surface", async () => {
      const schema = createSchema(
        { count: { type: "number", required: true } },
        { noop: { flow: { kind: "halt", reason: "noop" } } },
      );
      const snapshot = createSnapshot({ count: 1 }, schema.hash, HOST_CONTEXT);

      const result = await compute(
        schema,
        snapshot,
        createIntent("missing", "intent-1"),
        NEXT_CONTEXT,
      );

      expect(result.status).toBe("error");
      expect(result.namespaceDelta).toEqual([]);
    });

    it("blocks unchecked computed expressions from reading transient input", async () => {
      const schema = createSchema(
        { value: { type: "string", required: true } },
        { noop: { flow: { kind: "halt", reason: "noop" } } },
        {
          fromInput: {
            expr: { kind: "get", path: "input.value" },
            deps: [],
          },
        },
      );
      const snapshot = createSnapshot({ value: "state" }, schema.hash, HOST_CONTEXT);

      const result = await compute(
        schema,
        snapshot,
        createIntent("noop", { value: "input" }, "intent-1"),
        NEXT_CONTEXT,
      );

      expect(result.status).toBe("error");
      expect(result.systemDelta.lastError?.code).toBe("PATH_NOT_FOUND");
      expect(result.namespaceDelta).toEqual([]);
    });

    it("admits namespace trace node kinds in the public trace schema", () => {
      expect(TraceNodeKind.options).toContain("namespaceRead");
      expect(TraceNodeKind.options).toContain("namespaceDelta");
    });
  });

  describe("schema validation", () => {
    it("rejects state fields that use the reserved namespace prefix", () => {
      const schema = createValidatedSchema({
        state: {
          fields: {
            count: { type: "number", required: true },
            $runtime: { type: "string", required: true },
            nested: {
              type: "object",
              required: true,
              fields: {
                $tooling: { type: "string", required: true },
              },
            },
          },
          fieldTypes: {
            $lineage: { kind: "object", fields: {} },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "SCHEMA_ERROR", path: "state.fields.$runtime" }),
          expect.objectContaining({ code: "SCHEMA_ERROR", path: "state.fields.nested.$tooling" }),
          expect.objectContaining({ code: "SCHEMA_ERROR", path: "state.fieldTypes.$lineage" }),
        ]),
      );
    });

    it("rejects namespace reads from computed expressions", () => {
      const schema = createValidatedSchema({
        computed: {
          fields: {
            double: {
              expr: {
                kind: "add",
                left: { kind: "get", path: "count" },
                right: { kind: "get", path: "count" },
              },
              deps: ["count"],
            },
            runtimeRequestId: {
              expr: { kind: "get", path: "$runtime.requestId" },
              deps: [],
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "V-012", path: "computed.fields.runtimeRequestId" }),
        ]),
      );
    });

    it("rejects namespace reads from user-authored action expressions", () => {
      const schema = createValidatedSchema({
        actions: {
          copyRuntimeRequestId: {
            available: { kind: "get", path: "$runtime.available" },
            dispatchable: { kind: "get", path: "$runtime.dispatchable" },
            flow: {
              kind: "patch",
              op: "set",
              path: pp("outbox.requestId"),
              value: { kind: "get", path: "$runtime.requestId" },
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "V-003", path: "actions.copyRuntimeRequestId" }),
        ]),
      );
    });
  });
});
