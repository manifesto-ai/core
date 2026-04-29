import { describe, expect, it } from "vitest";
import { apply, applySystemDelta } from "../../../index.js";
import { CORE_CTS_CASES } from "../core-cts-coverage.js";
import {
  NEXT_CONTEXT,
  caseTitle,
  createComplianceSchema,
  createComplianceSnapshot,
  pp,
} from "./helpers.js";

describe("Core CTS patch and system delta rules", () => {
  it(caseTitle(CORE_CTS_CASES.PATCH_DOMAIN_ROOT, "roots domain patches at snapshot.state and not platform roots"), () => {
    const schema = createComplianceSchema({
      state: {
        fields: {
          namespaces: {
            type: "object",
            required: true,
            default: { visible: false },
            fields: {
              visible: { type: "boolean", required: true, default: false },
            },
          },
          system: {
            type: "object",
            required: true,
            default: { status: "domain-idle" },
            fields: {
              status: { type: "string", required: true, default: "domain-idle" },
            },
          },
        },
      },
    });
    const snapshot = createComplianceSnapshot(
      { namespaces: { visible: false }, system: { status: "domain-idle" } },
      schema.hash,
    );

    const result = apply(
      schema,
      snapshot,
      [
        { op: "set", path: pp("namespaces.visible"), value: true },
        { op: "set", path: pp("system.status"), value: "domain-updated" },
      ],
      NEXT_CONTEXT,
    );

    expect(result.state).toEqual({
      namespaces: { visible: true },
      system: { status: "domain-updated" },
    });
    expect(result.namespaces).toBe(snapshot.namespaces);
    expect(result.system.status).toBe("idle");
  });

  it(caseTitle(CORE_CTS_CASES.PATCH_DOMAIN_ROOT, "rejects namespace-looking patches when no state field declares that root"), () => {
    const schema = createComplianceSchema();
    const snapshot = createComplianceSnapshot({ count: 1 }, schema.hash);

    const result = apply(
      schema,
      snapshot,
      [{ op: "merge", path: pp("$host.runtime"), value: { requestId: "req-1" } }],
      NEXT_CONTEXT,
    );

    expect(result.state).toEqual({ count: 1 });
    expect(result.namespaces).toEqual(snapshot.namespaces);
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("PATH_NOT_FOUND");
  });

  it(caseTitle(CORE_CTS_CASES.PATCH_DOMAIN_ROOT, "rejects invalid patch values as runtime validation failures"), () => {
    const schema = createComplianceSchema();
    const snapshot = createComplianceSnapshot({ count: 1 }, schema.hash);

    const result = apply(
      schema,
      snapshot,
      [{ op: "set", path: pp("count"), value: "not-a-number" }],
      NEXT_CONTEXT,
    );

    expect(result.state).toEqual({ count: 1 });
    expect(result.system.status).toBe("error");
    expect(result.system.lastError?.code).toBe("TYPE_MISMATCH");
  });

  it(caseTitle(CORE_CTS_CASES.SYSTEM_DELTA, "applies system transitions through SystemDelta and preserves domain state"), () => {
    const snapshot = createComplianceSnapshot({ count: 1 });
    const requirement = {
      id: "req-1",
      type: "http",
      params: { url: "/ok" },
      actionId: "load",
      flowPosition: { nodePath: "actions.load.flow", snapshotVersion: 0 },
      createdAt: NEXT_CONTEXT.now,
    };

    const result = applySystemDelta(snapshot, {
      status: "pending",
      currentAction: "load",
      lastError: null,
      addRequirements: [requirement],
      removeRequirementIds: [],
    });

    expect(result.state).toBe(snapshot.state);
    expect(result.system.status).toBe("pending");
    expect(result.system.currentAction).toBe("load");
    expect(result.system.pendingRequirements).toEqual([requirement]);
    expect(result.meta.version).toBe(snapshot.meta.version + 1);
  });
});
