import { describe, expect, it } from "vitest";
import { computeSync, validate } from "../../../index.js";
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

  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS, "materializes compiler-owned MEL namespace deltas during flow evaluation"), () => {
    const schema = createComplianceSchema({
      state: {
        fields: {
          observed: { type: "string", required: true, default: "" },
        },
      },
      actions: {
        markIntent: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "namespacePatch",
                namespace: "mel",
                op: "merge",
                path: pp("guards.intent"),
                value: {
                  kind: "object",
                  fields: {
                    guardA: { kind: "get", path: "meta.intentId" },
                  },
                },
              },
              {
                kind: "patch",
                op: "set",
                path: pp("observed"),
                value: { kind: "get", path: "$mel.guards.intent.guardA" },
              },
            ],
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
        namespace: "mel",
        patches: [
          { op: "merge", path: pp("guards.intent"), value: { guardA: "intent-A" } },
        ],
      },
    ]);
    expect(finalSnapshot.state).toEqual({ observed: "intent-A" });
    expect(finalSnapshot.namespaces.mel).toMatchObject({
      guards: { intent: { guardA: "intent-A" } },
    });
    expect(Object.values(result.trace.nodes).some((node) => node.kind === "namespaceDelta")).toBe(true);
  });

  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS, "rejects non-MEL namespacePatch flow nodes"), () => {
    const schema = createComplianceSchema({
      actions: {
        badNamespace: {
          flow: {
            kind: "namespacePatch",
            namespace: "host",
            op: "merge",
            path: pp("guards.intent"),
            value: { kind: "lit", value: { guardA: "intent-A" } },
          } as never,
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(false);
    expectValidationCode(result.errors, "SCHEMA_ERROR");
  });
});
