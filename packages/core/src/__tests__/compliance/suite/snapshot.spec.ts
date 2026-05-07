import { describe, expect, it } from "vitest";
import { applyNamespaceDeltas } from "../../../index.js";
import { CORE_CTS_CASES } from "../core-cts-coverage.js";
import {
  HOST_CONTEXT,
  caseTitle,
  createComplianceSnapshot,
  pp,
} from "./helpers.js";

describe("Core CTS snapshot and namespace rules", () => {
  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_ONTOLOGY, "creates canonical state and an empty namespace container"), () => {
    const snapshot = createComplianceSnapshot({ count: 1 });

    expect(snapshot.state).toEqual({ count: 1 });
    expect(Object.prototype.hasOwnProperty.call(snapshot, "data")).toBe(false);
    expect(snapshot.namespaces).toEqual({});
    expect(snapshot.meta).toEqual({
      version: 0,
      timestamp: HOST_CONTEXT.runtime.time.timestamp,
      randomSeed: HOST_CONTEXT.runtime.random.seed,
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
      [{ namespace: "runtime", patches: [{ op: "merge", path: pp("request"), value: { requestId: "req-1" } }] }],
    );

    expect(result.state).toBe(snapshot.state);
    expect(result.computed).toBe(snapshot.computed);
    expect(result.input).toBe(snapshot.input);
    expect(result.system).toBe(snapshot.system);
    expect(result.namespaces.runtime).toEqual({ request: { requestId: "req-1" } });
    expect(result.meta.version).toBe(snapshot.meta.version + 1);
    expect(result.meta.timestamp).toBe(snapshot.meta.timestamp);
    expect(result.meta.randomSeed).toBe(snapshot.meta.randomSeed);
  });

  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS, "rejects invalid namespace roots, unsafe paths, and invalid merge targets"), () => {
    const snapshot = {
      ...createComplianceSnapshot({ count: 1 }),
      namespaces: {
        runtime: { request: "ready" },
      },
    };

    const emptyNamespace = applyNamespaceDeltas(
      snapshot,
      [{ namespace: "", patches: [{ op: "set", path: pp("runtime.requestId"), value: "req-1" }] }],
    );
    expect(emptyNamespace.system.status).toBe("error");
    expect(emptyNamespace.system.lastError?.code).toBe("PATH_NOT_FOUND");

    const unsafe = applyNamespaceDeltas(
      snapshot,
      [
        {
          namespace: "runtime",
          patches: [
            {
              op: "set",
              path: [{ kind: "prop", name: "__proto__" }, { kind: "prop", name: "polluted" }],
              value: true,
            },
          ],
        },
      ],
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(unsafe.system.status).toBe("error");
    expect(unsafe.system.lastError?.code).toBe("PATH_NOT_FOUND");

    const badMerge = applyNamespaceDeltas(
      snapshot,
      [{ namespace: "runtime", patches: [{ op: "merge", path: pp("request"), value: { requestId: "req-1" } }] }],
    );
    expect(badMerge.system.status).toBe("error");
    expect(badMerge.system.lastError?.code).toBe("TYPE_MISMATCH");
    expect(badMerge.namespaces.runtime).toEqual({ request: "ready" });
  });

  it(caseTitle(CORE_CTS_CASES.SNAPSHOT_NAMESPACE_DELTAS, "treats omitted namespace deltas as an empty no-op"), () => {
    const snapshot = createComplianceSnapshot({ count: 1 });

    expect(applyNamespaceDeltas(snapshot, [])).toBe(snapshot);
  });
});
