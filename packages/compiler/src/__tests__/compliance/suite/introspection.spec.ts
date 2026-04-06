import {
  hashSchemaSync,
  semanticPathToPatchPath,
  type DomainSchema,
} from "@manifesto-ai/core";
import { describe, it } from "vitest";
import { extractSchemaGraph } from "../../../index.js";
import { createCompilerComplianceAdapter } from "../ccts-adapter.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../ccts-assertions.js";
import { CCTS_CASES, caseTitle } from "../ccts-coverage.js";
import { getRuleOrThrow } from "../ccts-rules.js";

const adapter = createCompilerComplianceAdapter();
const pp = semanticPathToPatchPath;

function withHash(schema: Omit<DomainSchema, "hash">): DomainSchema {
  return {
    ...schema,
    hash: hashSchemaSync(schema),
  };
}

describe("CCTS Introspection Suite", () => {
  it(
    caseTitle(
      CCTS_CASES.INTROSPECTION_GRAPH_SURFACE,
      "(SGRAPH-1/2/3/4/14/15) SchemaGraph emits projected nodes with stable ids and order.",
    ),
    () => {
      const compiled = adapter.compile(`
        domain Demo {
          state {
            tasks: Array<string> = []
            status: string = "idle"
          }

          computed taskCount = len(tasks)

          action createTask(task: string) {
            when true {
              patch tasks = append(tasks, task)
            }
          }
        }
      `);

      const graph = extractSchemaGraph(compiled.value!);
      const again = extractSchemaGraph(structuredClone(compiled.value!));
      const nodeIds = graph.nodes.map((node) => node.id);
      const stateNodes = graph.nodes.filter((node) => node.kind === "state");
      const computedNodes = graph.nodes.filter((node) => node.kind === "computed");
      const actionNodes = graph.nodes.filter((node) => node.kind === "action");
      const deterministic = JSON.stringify(graph) === JSON.stringify(again);
      const edgesSorted = graph.edges.every((edge, index, edges) =>
        index === 0
        || compareSchemaGraphEdges(edges[index - 1]!, edge) <= 0);

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("SGRAPH-1"),
          compiled.success
            && nodeIds.includes("state:tasks")
            && nodeIds.includes("state:status")
            && stateNodes.length === 2,
          {
            passMessage: "Projected top-level state nodes are emitted.",
            failMessage: "Projected top-level state nodes were not emitted as expected.",
            evidence: [noteEvidence("Observed node ids", nodeIds)],
          },
        ),
        evaluateRule(
          getRuleOrThrow("SGRAPH-2"),
          nodeIds.includes("computed:taskCount") && computedNodes.length === 1,
          {
            passMessage: "Projected computed nodes are emitted.",
            failMessage: "Projected computed nodes were not emitted as expected.",
            evidence: [noteEvidence("Observed computed nodes", computedNodes)],
          },
        ),
        evaluateRule(
          getRuleOrThrow("SGRAPH-3"),
          nodeIds.includes("action:createTask") && actionNodes.length === 1,
          {
            passMessage: "Action nodes are emitted for declared actions.",
            failMessage: "Action nodes were not emitted for declared actions.",
            evidence: [noteEvidence("Observed action nodes", actionNodes)],
          },
        ),
        evaluateRule(
          getRuleOrThrow("SGRAPH-4"),
          graph.nodes.every((node) => node.id.endsWith(node.name)),
          {
            passMessage: "SchemaGraph nodes carry bare names plus kind-prefixed ids.",
            failMessage: "SchemaGraph nodes did not carry the required bare-name/id pairing.",
            evidence: [noteEvidence("Observed nodes", graph.nodes)],
          },
        ),
        evaluateRule(
          getRuleOrThrow("SGRAPH-14"),
          compiled.success && graph.nodes.length > 0,
          {
            passMessage: "SchemaGraph extraction succeeds from DomainSchema alone.",
            failMessage: "SchemaGraph extraction did not succeed from the compiled DomainSchema.",
            evidence: [noteEvidence("Observed graph", graph)],
          },
        ),
        evaluateRule(
          getRuleOrThrow("SGRAPH-15"),
          deterministic && edgesSorted,
          {
            passMessage: "SchemaGraph ordering is deterministic for the same schema.",
            failMessage: "SchemaGraph ordering changed across equivalent extraction calls.",
            evidence: [
              noteEvidence("First extraction", graph),
              noteEvidence("Second extraction", again),
            ],
          },
        ),
      ]);
    },
  );

  it(
    caseTitle(
      CCTS_CASES.INTROSPECTION_FEEDS_UNLOCKS,
      "(SGRAPH-5/6/10/11) SchemaGraph extracts feeds and unlocks edges.",
    ),
    () => {
      const compiled = adapter.compile(`
        domain Demo {
          state { count: number = 0 }

          computed total = add(count, 1)
          computed final = add(total, 1)

          action finalize() available when gt(final, 0) {
            when true {
              stop "ok"
            }
          }
        }
      `);

      const graph = extractSchemaGraph(compiled.value!);
      const edges = graph.edges.map((edge) => `${edge.from}|${edge.relation}|${edge.to}`);

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("SGRAPH-5"),
          edges.includes("state:count|feeds|computed:total")
            && edges.includes("computed:total|feeds|computed:final"),
          {
            passMessage: "Computed deps emit feeds edges.",
            failMessage: "Computed deps did not emit the expected feeds edges.",
            evidence: [noteEvidence("Observed edges", edges)],
          },
        ),
        evaluateRule(
          getRuleOrThrow("SGRAPH-6"),
          edges.includes("state:count|feeds|computed:total")
            && edges.includes("computed:total|feeds|computed:final"),
          {
            passMessage: "Feeds edges reuse the compiler's extracted dependency roots.",
            failMessage: "Feeds edges did not align with extracted dependency roots.",
            evidence: [noteEvidence("Observed edges", edges)],
          },
        ),
        evaluateRule(
          getRuleOrThrow("SGRAPH-10"),
          edges.includes("computed:final|unlocks|action:finalize"),
          {
            passMessage: "available when emits unlocks edges into actions.",
            failMessage: "available when did not emit the expected unlocks edge.",
            evidence: [noteEvidence("Observed edges", edges)],
          },
        ),
        evaluateRule(
          getRuleOrThrow("SGRAPH-11"),
          !edges.some((edge) => edge.includes("$")),
          {
            passMessage: "Unlock extraction remains within the pure state/computed surface.",
            failMessage: "Unlock extraction leaked non-domain roots.",
            evidence: [noteEvidence("Observed edges", edges)],
          },
        ),
      ]);
    },
  );

  it(
    caseTitle(
      CCTS_CASES.INTROSPECTION_MUTATIONS,
      "(SGRAPH-7/8/9) SchemaGraph extracts mutates edges from patches and effect into roots.",
    ),
    () => {
      const compiled = adapter.compile(`
        domain Demo {
          state {
            box: { count: number } = { count: 0 }
            tasks: Array<string> = []
          }

          action mutate(task: string) {
            when true {
              patch tasks = append(tasks, task)
              effect api.fetch({ into: box.count })
            }
          }
        }
      `);

      const graph = extractSchemaGraph(compiled.value!);
      const edges = graph.edges.map((edge) => `${edge.from}|${edge.relation}|${edge.to}`);
      const normalizedSchema = withHash({
        id: "manifesto:ccts-introspection-normalized",
        version: "1.0.0",
        types: {},
        state: {
          fields: {
            box: {
              type: "object",
              required: false,
              default: { count: 0 },
              fields: {
                count: { type: "number", required: true },
              },
            },
            items: {
              type: "array",
              required: false,
              default: [],
              items: {
                type: "object",
                required: true,
                fields: {
                  done: { type: "boolean", required: true },
                },
              },
            },
            tasks: {
              type: "array",
              required: false,
              default: [],
              items: { type: "string", required: true },
            },
          },
        },
        computed: {
          fields: {},
        },
        actions: {
          mutatePaths: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: pp("tasks"),
                  value: { kind: "lit", value: ["a"] },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: pp("tasks"),
                  value: { kind: "lit", value: ["b"] },
                },
                {
                  kind: "effect",
                  type: "api.fetch",
                  params: {
                    into: { kind: "lit", value: "data.box.count" },
                  },
                },
                {
                  kind: "effect",
                  type: "api.fetch",
                  params: {
                    into: { kind: "lit", value: "/data/box/count" },
                  },
                },
                {
                  kind: "effect",
                  type: "api.fetch",
                  params: {
                    into: { kind: "lit", value: "items[0].done" },
                  },
                },
                {
                  kind: "effect",
                  type: "api.fetch",
                  params: {
                    into: { kind: "get", path: "tasks" },
                  },
                },
              ],
            },
          },
        },
      });
      const normalizedGraph = extractSchemaGraph(normalizedSchema);
      const normalizedEdges = normalizedGraph.edges.map((edge) =>
        `${edge.from}|${edge.relation}|${edge.to}`);
      const taskMutatesCount = normalizedGraph.edges.filter((edge) =>
        edge.from === "action:mutatePaths"
        && edge.relation === "mutates"
        && edge.to === "state:tasks").length;
      const boxMutatesCount = normalizedGraph.edges.filter((edge) =>
        edge.from === "action:mutatePaths"
        && edge.relation === "mutates"
        && edge.to === "state:box").length;

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("SGRAPH-7"),
          edges.includes("action:mutate|mutates|state:tasks")
            && taskMutatesCount === 1,
          {
            passMessage: "Patch targets emit mutates edges.",
            failMessage: "Patch targets did not emit the expected mutates edge.",
            evidence: [
              noteEvidence("Observed MEL edges", edges),
              noteEvidence("Observed normalized edges", normalizedEdges),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("SGRAPH-8"),
          edges.includes("action:mutate|mutates|state:box")
            && normalizedEdges.includes("action:mutatePaths|mutates|state:box")
            && normalizedEdges.includes("action:mutatePaths|mutates|state:items")
            && boxMutatesCount === 1,
          {
            passMessage: "effect into targets emit mutates edges.",
            failMessage: "effect into targets did not emit the expected mutates edge.",
            evidence: [
              noteEvidence("Observed MEL edges", edges),
              noteEvidence("Observed normalized edges", normalizedEdges),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("SGRAPH-9"),
          !edges.includes("action:mutate|mutates|state:count")
            && edges.includes("action:mutate|mutates|state:box")
            && !normalizedEdges.includes("action:mutatePaths|mutates|state:count")
            && normalizedEdges.includes("action:mutatePaths|mutates|state:box")
            && normalizedEdges.includes("action:mutatePaths|mutates|state:items"),
          {
            passMessage: "Mutation roots are extracted from the top-level target segment.",
            failMessage: "Mutation roots were not reduced to the top-level target segment.",
            evidence: [
              noteEvidence("Observed MEL edges", edges),
              noteEvidence("Observed normalized edges", normalizedEdges),
            ],
          },
        ),
      ]);
    },
  );

  it(
    caseTitle(
      CCTS_CASES.INTROSPECTION_PROJECTION,
      "(SGRAPH-12/13) SchemaGraph excludes $*-owned substrate and tainted computed nodes.",
    ),
    () => {
      const schema = withHash({
        id: "manifesto:ccts-introspection",
        version: "1.0.0",
        types: {},
        state: {
          fields: {
            count: { type: "number", required: false, default: 0 },
            $host: { type: "object", required: false, default: {} },
          },
        },
        computed: {
          fields: {
            publicCount: {
              deps: ["count"],
              expr: { kind: "get", path: "count" },
            },
            hostValue: {
              deps: ["$host.requestId"],
              expr: { kind: "get", path: "$host.requestId" },
            },
            hostDerived: {
              deps: ["hostValue"],
              expr: { kind: "get", path: "hostValue" },
            },
          },
        },
        actions: {
          inspect: {
            available: {
              kind: "eq",
              left: { kind: "get", path: "count" },
              right: { kind: "lit", value: 0 },
            },
            flow: { kind: "halt" },
          },
        },
      });

      const graph = extractSchemaGraph(schema);
      const nodeIds = graph.nodes.map((node) => node.id);
      const edges = graph.edges.map((edge) => `${edge.from}|${edge.relation}|${edge.to}`);

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("SGRAPH-12"),
          !nodeIds.includes("state:$host")
            && !edges.some((edge) => edge.includes("$")),
          {
            passMessage: "Platform-owned $* substrate is excluded from SchemaGraph.",
            failMessage: "Platform-owned $* substrate leaked into SchemaGraph.",
            evidence: [
              noteEvidence("Observed node ids", nodeIds),
              noteEvidence("Observed edges", edges),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("SGRAPH-13"),
          nodeIds.includes("computed:publicCount")
            && !nodeIds.includes("computed:hostValue")
            && !nodeIds.includes("computed:hostDerived"),
          {
            passMessage: "Computed nodes tainted by transitive $* deps are excluded.",
            failMessage: "Computed nodes tainted by transitive $* deps were not excluded.",
            evidence: [noteEvidence("Observed node ids", nodeIds)],
          },
        ),
      ]);
    },
  );
});

function compareSchemaGraphEdges(
  left: { from: string; to: string; relation: string },
  right: { from: string; to: string; relation: string },
): number {
  return (
    left.from.localeCompare(right.from)
    || left.to.localeCompare(right.to)
    || left.relation.localeCompare(right.relation)
  );
}
