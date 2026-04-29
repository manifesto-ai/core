import { describe, expect, it } from "vitest";
import {
  TraceNodeKind,
  computeSync,
  hashSchemaSync,
  type DomainSchema,
  type TraceNode,
} from "../../../index.js";
import { CORE_CTS_CASES } from "../core-cts-coverage.js";
import {
  NEXT_CONTEXT,
  caseTitle,
  createComplianceIntent,
  createComplianceSchema,
  createComplianceSnapshot,
  pp,
} from "./helpers.js";

function collectTraceNodes(node: TraceNode, ids: string[] = []): string[] {
  ids.push(node.id);
  for (const child of node.children) {
    collectTraceNodes(child, ids);
  }
  return ids;
}

describe("Core CTS trace and hash rules", () => {
  it(caseTitle(CORE_CTS_CASES.TRACE_AND_HASH, "emits complete trace graph metadata for compute results"), () => {
    const schema = createComplianceSchema({
      actions: {
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
    });
    const snapshot = createComplianceSnapshot({ count: 1 }, schema.hash);

    const result = computeSync(schema, snapshot, createComplianceIntent("inc"), NEXT_CONTEXT);

    expect(result.trace.intent).toEqual({ type: "inc", input: undefined });
    expect(result.trace.baseVersion).toBe(snapshot.meta.version);
    expect(result.trace.resultVersion).toBeGreaterThan(snapshot.meta.version);
    expect(result.trace.terminatedBy).toBe("complete");
    expect(Object.keys(result.trace.nodes).sort()).toEqual(collectTraceNodes(result.trace.root).sort());
    expect(result.namespaceDelta).toEqual([]);
  });

  it(caseTitle(CORE_CTS_CASES.TRACE_AND_HASH, "keeps namespace trace node kinds distinct from domain patch traces"), () => {
    expect(TraceNodeKind.options).toContain("namespaceRead");
    expect(TraceNodeKind.options).toContain("namespaceDelta");
    expect(TraceNodeKind.options).toContain("patch");
  });

  it(caseTitle(CORE_CTS_CASES.TRACE_AND_HASH, "computes deterministic schema hashes over canonical form"), () => {
    const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
      id: "manifesto:hash-cts",
      version: "1.0.0",
      types: {},
      state: { fields: { count: { type: "number", required: true, default: 0 } } },
      computed: { fields: { double: { deps: ["count"], expr: { kind: "add", left: { kind: "get", path: "count" }, right: { kind: "get", path: "count" } } } } },
      actions: { noop: { flow: { kind: "halt", reason: "noop" } } },
    };

    expect(hashSchemaSync(schemaWithoutHash)).toBe(hashSchemaSync({
      actions: schemaWithoutHash.actions,
      computed: schemaWithoutHash.computed,
      id: schemaWithoutHash.id,
      state: schemaWithoutHash.state,
      types: schemaWithoutHash.types,
      version: schemaWithoutHash.version,
    }));
  });
});
