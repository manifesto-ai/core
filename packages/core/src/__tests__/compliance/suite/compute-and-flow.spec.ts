import { describe, expect, it } from "vitest";
import { Patch, computeSync, validate } from "../../../index.js";
import { CORE_CTS_CASES } from "../core-cts-coverage.js";
import {
  NEXT_CONTEXT,
  caseTitle,
  computeAndMaterialize,
  createComplianceIntent,
  createComplianceSchema,
  createComplianceSnapshot,
  expectValidationCode,
  pp,
} from "./helpers.js";

describe("Core CTS compute and flow rules", () => {
  it(caseTitle(CORE_CTS_CASES.COMPUTE_ADMISSION, "validates intent input and records failures as values"), () => {
    const schema = createComplianceSchema({
      actions: {
        setName: {
          input: {
            type: "object",
            required: true,
            fields: {
              name: { type: "string", required: true },
            },
          },
          flow: {
            kind: "patch",
            op: "set",
            path: pp("name"),
            value: { kind: "get", path: "input.name" },
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot({ name: "" }, schema.hash);

    const { result, snapshot: finalSnapshot } = computeAndMaterialize(
      schema,
      snapshot,
      createComplianceIntent("setName", { name: 42 }),
    );

    expect(result.status).toBe("error");
    expect(finalSnapshot.system.status).toBe("error");
    expect(finalSnapshot.system.lastError?.code).toBe("INVALID_INPUT");
    expect(finalSnapshot.state).toEqual({ name: "" });
  });

  it(caseTitle(CORE_CTS_CASES.COMPUTE_ADMISSION, "checks availability on initial invocation and skips it on re-entry"), () => {
    const schema = createComplianceSchema({
      actions: {
        run: {
          available: { kind: "get", path: "enabled" },
          flow: {
            kind: "patch",
            op: "set",
            path: pp("done"),
            value: { kind: "lit", value: true },
          },
        },
      },
    });
    const unavailable = createComplianceSnapshot({ enabled: false, done: false }, schema.hash);

    const blocked = computeAndMaterialize(schema, unavailable, createComplianceIntent("run"));
    expect(blocked.result.status).toBe("error");
    expect(blocked.snapshot.system.lastError?.code).toBe("ACTION_UNAVAILABLE");
    expect(blocked.snapshot.state).toEqual({ enabled: false, done: false });

    const reEntry = {
      ...unavailable,
      system: {
        ...unavailable.system,
        currentAction: "run",
      },
    };
    const admitted = computeAndMaterialize(schema, reEntry, createComplianceIntent("run"));
    expect(admitted.result.status).toBe("complete");
    expect(admitted.snapshot.state).toEqual({ enabled: false, done: true });
  });

  it(caseTitle(CORE_CTS_CASES.FLOW_EFFECT_AND_ERROR, "terminates at effects and records pending requirements in SystemDelta"), () => {
    const schema = createComplianceSchema({
      actions: {
        load: {
          flow: {
            kind: "seq",
            steps: [
              { kind: "effect", type: "http.get", params: { url: { kind: "lit", value: "/resource" } } },
              {
                kind: "patch",
                op: "set",
                path: pp("done"),
                value: { kind: "lit", value: true },
              },
            ],
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot({ done: false }, schema.hash);

    const { result, snapshot: finalSnapshot } = computeAndMaterialize(
      schema,
      snapshot,
      createComplianceIntent("load"),
    );

    expect(result.status).toBe("pending");
    expect(result.patches).toEqual([]);
    expect(finalSnapshot.state).toEqual({ done: false });
    expect(finalSnapshot.system.status).toBe("pending");
    expect(finalSnapshot.system.pendingRequirements).toHaveLength(1);
    expect(finalSnapshot.system.pendingRequirements[0]).toMatchObject({
      type: "http.get",
      params: { url: "/resource" },
      actionId: "load",
    });
  });

  it(caseTitle(CORE_CTS_CASES.FLOW_EFFECT_AND_ERROR, "records fail nodes as error values without throwing"), () => {
    const schema = createComplianceSchema({
      actions: {
        failNow: {
          flow: {
            kind: "fail",
            code: "INVALID_STATE",
            message: { kind: "lit", value: "invalid state" },
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot({}, schema.hash);

    expect(() => computeSync(schema, snapshot, createComplianceIntent("failNow"), NEXT_CONTEXT)).not.toThrow();
    const { result, snapshot: finalSnapshot } = computeAndMaterialize(
      schema,
      snapshot,
      createComplianceIntent("failNow"),
    );

    expect(result.status).toBe("error");
    expect(finalSnapshot.system.lastError).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "invalid state",
      context: { code: "INVALID_STATE" },
    });
  });

  it(caseTitle(CORE_CTS_CASES.DYNAMIC_FLOW_PATCH_TARGETS, "resolves dynamic string targets to concrete patches"), () => {
    const schema = createComplianceSchema({
      state: {
        fields: {
          records: { type: "object", required: true, default: {} },
        },
        fieldTypes: {
          records: {
            kind: "record",
            key: { kind: "primitive", type: "string" },
            value: { kind: "primitive", type: "string" },
          },
        },
      },
      actions: {
        writeRecord: {
          input: {
            type: "object",
            required: true,
            fields: {
              id: { type: "string", required: true },
              value: { type: "string", required: true },
            },
          },
          flow: {
            kind: "patch",
            op: "set",
            path: [
              { kind: "prop", name: "records" },
              { kind: "expr", expr: { kind: "get", path: "input.id" } },
            ],
            value: { kind: "get", path: "input.value" },
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot({ records: {} }, schema.hash);

    const { result, snapshot: finalSnapshot } = computeAndMaterialize(
      schema,
      snapshot,
      createComplianceIntent("writeRecord", { id: "alpha", value: "A" }),
    );

    expect(result.status).toBe("complete");
    expect(result.patches).toEqual([
      { op: "set", path: pp("records.alpha"), value: "A" },
    ]);
    expect(result.trace.root.kind).toBe("patch");
    expect(result.trace.root.sourcePath).toBe("actions.writeRecord.flow");
    expect(result.trace.root.inputs).toMatchObject({ op: "set", path: "records.alpha" });
    expect(finalSnapshot.state).toEqual({ records: { alpha: "A" } });
  });

  it(caseTitle(CORE_CTS_CASES.DYNAMIC_FLOW_PATCH_TARGETS, "resolves dynamic integer targets to array index segments"), () => {
    const schema = createComplianceSchema({
      actions: {
        completeItem: {
          input: {
            type: "object",
            required: true,
            fields: {
              index: { type: "number", required: true },
            },
          },
          flow: {
            kind: "patch",
            op: "set",
            path: [
              { kind: "prop", name: "items" },
              { kind: "expr", expr: { kind: "get", path: "input.index" } },
              { kind: "prop", name: "completed" },
            ],
            value: { kind: "lit", value: true },
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot({
      items: [{ title: "a", completed: false }],
    }, schema.hash);

    const { result, snapshot: finalSnapshot } = computeAndMaterialize(
      schema,
      snapshot,
      createComplianceIntent("completeItem", { index: 0 }),
    );

    expect(result.status).toBe("complete");
    expect(result.patches).toEqual([
      {
        op: "set",
        path: [
          { kind: "prop", name: "items" },
          { kind: "index", index: 0 },
          { kind: "prop", name: "completed" },
        ],
        value: true,
      },
    ]);
    expect(finalSnapshot.state).toEqual({
      items: [{ title: "a", completed: true }],
    });
  });

  it(caseTitle(CORE_CTS_CASES.DYNAMIC_FLOW_PATCH_TARGETS, "reports invalid dynamic target values as semantic failures"), () => {
    const schema = createComplianceSchema({
      state: {
        fields: {
          records: { type: "object", required: true, default: {} },
        },
        fieldTypes: {
          records: {
            kind: "record",
            key: { kind: "primitive", type: "string" },
            value: { kind: "primitive", type: "string" },
          },
        },
      },
      actions: {
        invalidTarget: {
          input: {
            type: "object",
            required: true,
            fields: {
              target: {
                type: "object",
                required: true,
                fields: { id: { type: "string", required: true } },
              },
            },
          },
          flow: {
            kind: "patch",
            op: "set",
            path: [
              { kind: "prop", name: "records" },
              { kind: "expr", expr: { kind: "get", path: "input.target" } },
            ],
            value: { kind: "lit", value: "bad" },
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot({ records: {} }, schema.hash);

    const { result, snapshot: finalSnapshot } = computeAndMaterialize(
      schema,
      snapshot,
      createComplianceIntent("invalidTarget", { target: { id: "x" } }),
    );

    expect(result.status).toBe("error");
    expect(result.patches).toEqual([]);
    expect(finalSnapshot.system.lastError?.code).toBe("INVALID_PATCH_PATH");
    expect(finalSnapshot.system.lastError?.source).toEqual({
      actionId: "invalidTarget",
      nodePath: "actions.invalidTarget.flow.path[1]",
    });
    expect(finalSnapshot.state).toEqual({ records: {} });
  });

  for (const { label, value } of [
    { label: "empty string", value: "" },
    { label: "null", value: null },
    { label: "array", value: ["x"] },
    { label: "negative integer", value: -1 },
    { label: "fractional number", value: 1.5 },
  ] as const) {
    it(caseTitle(CORE_CTS_CASES.DYNAMIC_FLOW_PATCH_TARGETS, `rejects ${label} dynamic target values`), () => {
      const schema = createComplianceSchema({
        state: {
          fields: {
            records: { type: "object", required: true, default: {} },
          },
          fieldTypes: {
            records: {
              kind: "record",
              key: { kind: "primitive", type: "string" },
              value: { kind: "primitive", type: "string" },
            },
          },
        },
        actions: {
          invalidTargetValue: {
            flow: {
              kind: "patch",
              op: "set",
              path: [
                { kind: "prop", name: "records" },
                { kind: "expr", expr: { kind: "lit", value } },
              ],
              value: { kind: "lit", value: "bad" },
            },
          },
        },
      });
      const snapshot = createComplianceSnapshot({ records: {} }, schema.hash);

      const { result, snapshot: finalSnapshot } = computeAndMaterialize(
        schema,
        snapshot,
        createComplianceIntent("invalidTargetValue"),
      );

      expect(result.status).toBe("error");
      expect(result.patches).toEqual([]);
      expect(finalSnapshot.system.lastError).toMatchObject({
        code: "INVALID_PATCH_PATH",
        source: {
          actionId: "invalidTargetValue",
          nodePath: "actions.invalidTargetValue.flow.path[1]",
        },
      });
      expect(finalSnapshot.state).toEqual({ records: {} });
    });
  }

  it(caseTitle(CORE_CTS_CASES.DYNAMIC_FLOW_PATCH_TARGETS, "rejects unsafe dynamic target values before emitting patches"), () => {
    const schema = createComplianceSchema({
      state: {
        fields: {
          records: { type: "object", required: true, default: {} },
        },
        fieldTypes: {
          records: {
            kind: "record",
            key: { kind: "primitive", type: "string" },
            value: { kind: "primitive", type: "string" },
          },
        },
      },
      actions: {
        unsafeTarget: {
          input: {
            type: "object",
            required: true,
            fields: {
              target: { type: "string", required: true },
            },
          },
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: [
                  { kind: "prop", name: "records" },
                  { kind: "expr", expr: { kind: "get", path: "input.target" } },
                ],
                value: { kind: "lit", value: "bad" },
              },
              {
                kind: "patch",
                op: "set",
                path: pp("done"),
                value: { kind: "lit", value: true },
              },
            ],
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot({ records: {}, done: false }, schema.hash);

    const { result, snapshot: finalSnapshot } = computeAndMaterialize(
      schema,
      snapshot,
      createComplianceIntent("unsafeTarget", { target: "__proto__" }),
    );

    expect(result.status).toBe("error");
    expect(result.patches).toEqual([]);
    expect(finalSnapshot.system.lastError).toMatchObject({
      code: "INVALID_PATCH_PATH",
      source: {
        actionId: "unsafeTarget",
        nodePath: "actions.unsafeTarget.flow.steps[0].path[1]",
      },
    });
    expect(finalSnapshot.state).toEqual({ records: {}, done: false });
  });

  it(caseTitle(CORE_CTS_CASES.DYNAMIC_FLOW_PATCH_TARGETS, "evaluates dynamic targets before patch values"), () => {
    const schema = createComplianceSchema({
      state: {
        fields: {
          records: { type: "object", required: true, default: {} },
        },
        fieldTypes: {
          records: {
            kind: "record",
            key: { kind: "primitive", type: "string" },
            value: { kind: "primitive", type: "string" },
          },
        },
      },
      actions: {
        targetBeforeValue: {
          flow: {
            kind: "patch",
            op: "set",
            path: [
              { kind: "prop", name: "records" },
              { kind: "expr", expr: { kind: "lit", value: { key: "not-valid" } } },
            ],
            value: { kind: "get", path: "missing.value" },
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot({ records: {} }, schema.hash);

    const { result, snapshot: finalSnapshot } = computeAndMaterialize(
      schema,
      snapshot,
      createComplianceIntent("targetBeforeValue"),
    );

    expect(result.status).toBe("error");
    expect(result.patches).toEqual([]);
    expect(finalSnapshot.system.lastError).toMatchObject({
      code: "INVALID_PATCH_PATH",
      source: {
        actionId: "targetBeforeValue",
        nodePath: "actions.targetBeforeValue.flow.path[1]",
      },
    });
    expect(finalSnapshot.system.lastError?.message).not.toContain("missing.value");
    expect(finalSnapshot.state).toEqual({ records: {} });
  });

  it(caseTitle(CORE_CTS_CASES.DYNAMIC_FLOW_PATCH_TARGETS, "reports missing resolved targets and merge target mismatches"), () => {
    const missingPathSchema = createComplianceSchema({
      state: {
        fields: {
          profile: {
            type: "object",
            required: true,
            default: { known: "" },
            fields: { known: { type: "string", required: true, default: "" } },
          },
        },
      },
      actions: {
        writeProfile: {
          input: {
            type: "object",
            required: true,
            fields: { key: { type: "string", required: true } },
          },
          flow: {
            kind: "patch",
            op: "set",
            path: [
              { kind: "prop", name: "profile" },
              { kind: "expr", expr: { kind: "get", path: "input.key" } },
            ],
            value: { kind: "lit", value: "x" },
          },
        },
      },
    });
    const missing = computeAndMaterialize(
      missingPathSchema,
      createComplianceSnapshot({ profile: { known: "" } }, missingPathSchema.hash),
      createComplianceIntent("writeProfile", { key: "unknown" }),
    );

    expect(missing.result.status).toBe("error");
    expect(missing.snapshot.system.lastError?.code).toBe("PATH_NOT_FOUND");
    expect(missing.snapshot.state).toEqual({ profile: { known: "" } });

    const mergeSchema = createComplianceSchema({
      state: {
        fields: {
          label: { type: "string", required: true, default: "" },
        },
      },
      actions: {
        mergeLabel: {
          flow: {
            kind: "patch",
            op: "merge",
            path: [{ kind: "expr", expr: { kind: "lit", value: "label" } }],
            value: {
              kind: "object",
              fields: { next: { kind: "lit", value: "x" } },
            },
          },
        },
      },
    });
    const merge = computeAndMaterialize(
      mergeSchema,
      createComplianceSnapshot({ label: "old" }, mergeSchema.hash),
      createComplianceIntent("mergeLabel"),
    );

    expect(merge.result.status).toBe("error");
    expect(merge.snapshot.system.lastError?.code).toBe("TYPE_MISMATCH");
    expect(merge.snapshot.state).toEqual({ label: "old" });
  });

  it(caseTitle(CORE_CTS_CASES.DYNAMIC_FLOW_PATCH_TARGETS, "uses same-flow working snapshot for later dynamic targets and values"), () => {
    const schema = createComplianceSchema({
      state: {
        fields: {
          targetKey: { type: "string", required: true, default: "" },
          source: { type: "string", required: true, default: "" },
          records: { type: "object", required: true, default: {} },
        },
        fieldTypes: {
          records: {
            kind: "record",
            key: { kind: "primitive", type: "string" },
            value: { kind: "primitive", type: "string" },
          },
        },
      },
      actions: {
        writeAfterPrepare: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: pp("targetKey"),
                value: { kind: "lit", value: "next" },
              },
              {
                kind: "patch",
                op: "set",
                path: pp("source"),
                value: { kind: "lit", value: "value" },
              },
              {
                kind: "patch",
                op: "set",
                path: [
                  { kind: "prop", name: "records" },
                  { kind: "expr", expr: { kind: "get", path: "targetKey" } },
                ],
                value: { kind: "get", path: "source" },
              },
            ],
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot({ targetKey: "", source: "", records: {} }, schema.hash);

    const { result, snapshot: finalSnapshot } = computeAndMaterialize(
      schema,
      snapshot,
      createComplianceIntent("writeAfterPrepare"),
    );

    expect(result.status).toBe("complete");
    expect(result.patches).toEqual([
      { op: "set", path: pp("targetKey"), value: "next" },
      { op: "set", path: pp("source"), value: "value" },
      { op: "set", path: pp("records.next"), value: "value" },
    ]);
    expect(finalSnapshot.state).toEqual({ targetKey: "next", source: "value", records: { next: "value" } });
  });

  it(caseTitle(CORE_CTS_CASES.DYNAMIC_FLOW_PATCH_TARGETS, "keeps runtime allocation deterministic and apply-time patches concrete-only"), () => {
    const schema = createComplianceSchema({
      state: {
        fields: {
          records: { type: "object", required: true, default: {} },
        },
        fieldTypes: {
          records: {
            kind: "record",
            key: { kind: "primitive", type: "string" },
            value: { kind: "primitive", type: "string" },
          },
        },
      },
      actions: {
        allocate: {
          flow: {
            kind: "patch",
            op: "set",
            path: [
              { kind: "prop", name: "records" },
              { kind: "expr", expr: { kind: "get", path: "$runtime.random.uuid" } },
            ],
            value: { kind: "get", path: "$runtime.random.uuid" },
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot({ records: {} }, schema.hash);
    const intent = createComplianceIntent("allocate", undefined, "intent-uuid");

    const first = computeSync(schema, snapshot, intent, NEXT_CONTEXT);
    const second = computeSync(schema, snapshot, intent, NEXT_CONTEXT);

    expect(second.patches).toEqual(first.patches);
    expect(first.patches).toHaveLength(1);
    const [patch] = first.patches;
    if (!patch || patch.op !== "set") {
      throw new Error("Expected one set patch");
    }
    const keySegment = patch.path[1];
    if (!keySegment || keySegment.kind !== "prop") {
      throw new Error("Expected dynamic target to resolve to a prop segment");
    }
    expect(typeof keySegment.name).toBe("string");
    expect(typeof patch.value).toBe("string");
    expect(keySegment.name).not.toBe(patch.value);

    expect(Patch.safeParse({
      op: "set",
      path: [{ kind: "expr", expr: { kind: "lit", value: "records" } }],
      value: "x",
    }).success).toBe(false);
  });

  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS, "materializes Core-owned intent guard namespace deltas during flow evaluation"), () => {
    const schema = createComplianceSchema({
      state: {
        fields: {
          observed: { type: "string", required: true, default: "" },
        },
      },
      actions: {
        markIntent: {
          flow: {
            kind: "causalGuard",
            guardId: "guardA",
            body: {
              kind: "seq",
              steps: [
              {
                kind: "patch",
                op: "set",
                path: pp("observed"),
                value: { kind: "get", path: "$runtime.intent.id" },
              },
              ],
            },
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot({ observed: "" }, schema.hash);

    expect(validate(schema).valid).toBe(true);

    const { result, snapshot: finalSnapshot } = computeAndMaterialize(
      schema,
      snapshot,
      createComplianceIntent("markIntent", undefined, "intent-A"),
    );

    expect(result.status).toBe("complete");
    expect(result.patches).toEqual([
      { op: "set", path: pp("observed"), value: "intent-A" },
    ]);
    expect(result.namespaceDelta).toEqual([
      {
        namespace: "core",
        patches: [
          { op: "merge", path: pp("causalGuards"), value: { guardA: "intent-A" } },
        ],
      },
    ]);
    expect(result.trace.root.children[0]?.kind).toBe("namespaceDelta");
    expect(result.trace.root.children[1]?.kind).toBe("flow");
    expect(finalSnapshot.state).toEqual({ observed: "intent-A" });
    expect(finalSnapshot.namespaces.core).toMatchObject({
      causalGuards: { guardA: "intent-A" },
    });
  });

  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS, "skips Core intent guard bodies already marked for the current intent"), () => {
    const schema = createComplianceSchema({
      state: {
        fields: {
          observed: { type: "string", required: true, default: "" },
        },
      },
      actions: {
        markIntent: {
          flow: {
            kind: "causalGuard",
            guardId: "guardA",
            body: {
              kind: "seq",
              steps: [
              {
                kind: "patch",
                op: "set",
                path: pp("observed"),
                value: { kind: "get", path: "$runtime.intent.id" },
              },
              ],
            },
          },
        },
      },
    });
    const snapshot = {
      ...createComplianceSnapshot({ observed: "" }, schema.hash),
      namespaces: { core: { causalGuards: { guardA: "intent-A" } } },
    } as never;

    const { result, snapshot: finalSnapshot } = computeAndMaterialize(
      schema,
      snapshot,
      createComplianceIntent("markIntent", undefined, "intent-A"),
    );

    expect(result.status).toBe("complete");
    expect(result.patches).toEqual([]);
    expect(result.namespaceDelta).toEqual([]);
    expect(finalSnapshot.state).toEqual({ observed: "" });
  });

  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS, "rejects namespacePatch flow nodes from Core schemas"), () => {
    const schema = createComplianceSchema({
      actions: {
        badNamespacePatch: {
          flow: {
            kind: "namespacePatch",
            namespace: "runtime",
            op: "set",
            path: pp("arbitrary"),
            value: { kind: "lit", value: "bad" },
          } as never,
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(false);
    expectValidationCode(result.errors, "SCHEMA_ERROR");
  });
});
