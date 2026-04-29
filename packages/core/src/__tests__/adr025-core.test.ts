import { describe, expect, it } from "vitest";
import { apply, applyNamespaceDeltas } from "../core/apply.js";
import { compute } from "../core/compute.js";
import { validate } from "../core/validate.js";
import { createIntent, createSnapshot } from "../factories.js";
import type { DomainSchema } from "../schema/domain.js";
import { TraceNodeKind } from "../schema/trace.js";
import { hashSchemaSync } from "../utils/hash.js";
import { semanticPathToPatchPath } from "../utils/patch-path.js";

const HOST_CONTEXT = { now: 100, randomSeed: "seed" };
const NEXT_CONTEXT = { now: 101, randomSeed: "next-seed" };
const pp = (path: string) => semanticPathToPatchPath(path);

function createSchema(
  stateFields: DomainSchema["state"]["fields"],
  actions: DomainSchema["actions"],
  computedFields: DomainSchema["computed"]["fields"] = {}
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
          expr: { kind: "add", left: { kind: "get", path: "count" }, right: { kind: "get", path: "count" } },
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
      expect(Object.prototype.hasOwnProperty.call(snapshot, "data")).toBe(false);
      expect(snapshot.namespaces.host).toEqual({});
      expect(snapshot.namespaces.mel).toEqual({ guards: { intent: {} } });
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
        { noop: { flow: { kind: "halt", reason: "noop" } } }
      );
      const snapshot = createSnapshot({ namespaces: { visible: false } }, schema.hash, HOST_CONTEXT);

      const result = apply(
        schema,
        snapshot,
        [{ op: "set", path: pp("namespaces.visible"), value: true }],
        NEXT_CONTEXT
      );

      expect(result.state).toEqual({ namespaces: { visible: true } });
      expect(result.namespaces).toBe(snapshot.namespaces);
      expect(result.namespaces.host).toEqual({});
    });
  });

  describe("namespace deltas", () => {
    it("treats omitted namespaceDelta as empty and leaves empty deltas as a no-op", () => {
      const snapshot = createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT);

      expect(applyNamespaceDeltas(snapshot, [], NEXT_CONTEXT)).toBe(snapshot);
    });

    it("updates only namespaces and meta for valid namespace deltas", () => {
      const snapshot = {
        ...createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT),
        computed: { double: 2 },
        input: { draft: true },
      };

      const result = applyNamespaceDeltas(
        snapshot,
        [{ namespace: "host", patches: [{ op: "merge", path: pp("runtime"), value: { requestId: "req-1" } }] }],
        NEXT_CONTEXT
      );

      expect(result.state).toBe(snapshot.state);
      expect(result.computed).toBe(snapshot.computed);
      expect(result.input).toBe(snapshot.input);
      expect(result.system).toBe(snapshot.system);
      expect(result.namespaces.host).toEqual({ runtime: { requestId: "req-1" } });
      expect(result.meta).toEqual({
        ...snapshot.meta,
        version: snapshot.meta.version + 1,
        timestamp: NEXT_CONTEXT.now,
        randomSeed: NEXT_CONTEXT.randomSeed,
      });
    });

    it("rejects empty namespace identifiers without mutating domain state", () => {
      const snapshot = createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT);
      const result = applyNamespaceDeltas(
        snapshot,
        [{ namespace: "", patches: [{ op: "set", path: pp("runtime.requestId"), value: "req-1" }] }],
        NEXT_CONTEXT
      );

      expect(result.state).toBe(snapshot.state);
      expect(result.system.status).toBe("error");
      expect(result.system.lastError?.code).toBe("PATH_NOT_FOUND");
      expect(result.namespaces).toEqual(snapshot.namespaces);
    });

    it("rejects unsafe namespace patch paths", () => {
      const snapshot = createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT);
      const result = applyNamespaceDeltas(
        snapshot,
        [
          {
            namespace: "host",
            patches: [
              {
                op: "set",
                path: [{ kind: "prop", name: "__proto__" }, { kind: "prop", name: "polluted" }],
                value: true,
              },
            ],
          },
        ],
        NEXT_CONTEXT
      );

      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(result.system.status).toBe("error");
      expect(result.system.lastError?.code).toBe("PATH_NOT_FOUND");
      expect(result.namespaces.host).toEqual({});
    });

    it("rejects namespace merge targets that are present and non-object", () => {
      const snapshot = {
        ...createSnapshot({ count: 1 }, "test-hash", HOST_CONTEXT),
        namespaces: {
          host: { runtime: "ready" },
          mel: { guards: { intent: {} } },
        },
      };

      const result = applyNamespaceDeltas(
        snapshot,
        [{ namespace: "host", patches: [{ op: "merge", path: pp("runtime"), value: { requestId: "req-1" } }] }],
        NEXT_CONTEXT
      );

      expect(result.system.status).toBe("error");
      expect(result.system.lastError?.code).toBe("TYPE_MISMATCH");
      expect(result.namespaces.host).toEqual({ runtime: "ready" });
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
        }
      );
      const snapshot = createSnapshot({ count: 1 }, schema.hash, HOST_CONTEXT);

      const result = await compute(schema, snapshot, createIntent("inc", "intent-1"), NEXT_CONTEXT);

      expect(result.status).toBe("complete");
      expect(result.namespaceDelta).toEqual([]);
    });

    it("keeps error compute results on the same namespaceDelta surface", async () => {
      const schema = createSchema(
        { count: { type: "number", required: true } },
        { noop: { flow: { kind: "halt", reason: "noop" } } }
      );
      const snapshot = createSnapshot({ count: 1 }, schema.hash, HOST_CONTEXT);

      const result = await compute(schema, snapshot, createIntent("missing", "intent-1"), NEXT_CONTEXT);

      expect(result.status).toBe("error");
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
            "$host": { type: "string", required: true },
            nested: {
              type: "object",
              required: true,
              fields: {
                "$runtime": { type: "string", required: true },
              },
            },
          },
          fieldTypes: {
            "$lineage": { kind: "object", fields: {} },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "SCHEMA_ERROR", path: "state.fields.$host" }),
        expect.objectContaining({ code: "SCHEMA_ERROR", path: "state.fields.nested.$runtime" }),
        expect.objectContaining({ code: "SCHEMA_ERROR", path: "state.fieldTypes.$lineage" }),
      ]));
    });

    it("rejects namespace reads from computed expressions", () => {
      const schema = createValidatedSchema({
        computed: {
          fields: {
            double: {
              expr: { kind: "add", left: { kind: "get", path: "count" }, right: { kind: "get", path: "count" } },
              deps: ["count"],
            },
            hostRequestId: {
              expr: { kind: "get", path: "$host.requestId" },
              deps: [],
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "V-012", path: "computed.fields.hostRequestId" }),
      ]));
    });

    it("rejects namespace reads from user-authored action expressions", () => {
      const schema = createValidatedSchema({
        actions: {
          copyHostRequestId: {
            available: { kind: "get", path: "$host.available" },
            dispatchable: { kind: "get", path: "$host.dispatchable" },
            flow: {
              kind: "patch",
              op: "set",
              path: pp("outbox.requestId"),
              value: { kind: "get", path: "$host.requestId" },
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "V-003", path: "actions.copyHostRequestId" }),
      ]));
    });
  });
});
