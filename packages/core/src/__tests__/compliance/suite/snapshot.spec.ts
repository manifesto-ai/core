import { describe, expect, it } from "vitest";
import { applyNamespaceDeltas } from "../../../index.js";
import { CORE_CTS_CASES } from "../core-cts-coverage.js";
import {
  HOST_CONTEXT,
  NEXT_CONTEXT,
  caseTitle,
  createComplianceSnapshot,
  pp,
} from "./helpers.js";

describe("Core CTS snapshot and namespace rules", () => {
  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_ONTOLOGY, "creates canonical state and normalized built-in namespaces"), () => {
    const snapshot = createComplianceSnapshot({ count: 1 });

    expect(snapshot.state).toEqual({ count: 1 });
    expect(Object.prototype.hasOwnProperty.call(snapshot, "data")).toBe(false);
    expect(snapshot.namespaces).toEqual({
      host: {},
      mel: { guards: { intent: {} } },
    });
    expect(snapshot.meta).toEqual({
      version: 0,
      timestamp: HOST_CONTEXT.now,
      randomSeed: HOST_CONTEXT.randomSeed,
      schemaHash: "test-hash",
    });
  });

  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS, "applies namespace deltas only under the named namespace root"), () => {
    const snapshot = {
      ...createComplianceSnapshot({ count: 1 }),
      computed: { double: 2 },
      input: { draft: true },
    };

    const result = applyNamespaceDeltas(
      snapshot,
      [{ namespace: "host", patches: [{ op: "merge", path: pp("runtime"), value: { requestId: "req-1" } }] }],
      NEXT_CONTEXT,
    );

    expect(result.state).toBe(snapshot.state);
    expect(result.computed).toBe(snapshot.computed);
    expect(result.input).toBe(snapshot.input);
    expect(result.system).toBe(snapshot.system);
    expect(result.namespaces.host).toEqual({ runtime: { requestId: "req-1" } });
    expect(result.meta.version).toBe(snapshot.meta.version + 1);
    expect(result.meta.timestamp).toBe(NEXT_CONTEXT.now);
    expect(result.meta.randomSeed).toBe(NEXT_CONTEXT.randomSeed);
  });

  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS, "rejects invalid namespace roots, unsafe paths, and invalid merge targets"), () => {
    const snapshot = {
      ...createComplianceSnapshot({ count: 1 }),
      namespaces: {
        host: { runtime: "ready" },
        mel: { guards: { intent: {} } },
      },
    };

    const emptyNamespace = applyNamespaceDeltas(
      snapshot,
      [{ namespace: "", patches: [{ op: "set", path: pp("runtime.requestId"), value: "req-1" }] }],
      NEXT_CONTEXT,
    );
    expect(emptyNamespace.system.status).toBe("error");
    expect(emptyNamespace.system.lastError?.code).toBe("PATH_NOT_FOUND");

    const unsafe = applyNamespaceDeltas(
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
      NEXT_CONTEXT,
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(unsafe.system.status).toBe("error");
    expect(unsafe.system.lastError?.code).toBe("PATH_NOT_FOUND");

    const badMerge = applyNamespaceDeltas(
      snapshot,
      [{ namespace: "host", patches: [{ op: "merge", path: pp("runtime"), value: { requestId: "req-1" } }] }],
      NEXT_CONTEXT,
    );
    expect(badMerge.system.status).toBe("error");
    expect(badMerge.system.lastError?.code).toBe("TYPE_MISMATCH");
    expect(badMerge.namespaces.host).toEqual({ runtime: "ready" });
  });

  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS, "treats omitted namespace deltas as an empty no-op"), () => {
    const snapshot = createComplianceSnapshot({ count: 1 });

    expect(applyNamespaceDeltas(snapshot, [], NEXT_CONTEXT)).toBe(snapshot);
  });
});
