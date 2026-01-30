/**
 * @fileoverview Regression tests for level-3 assignment case.
 */

import { describe, it, expect } from "vitest";
import type { Chunk, IntentGraph } from "../../index.js";
import {
  TranslatorPipeline,
  createChunk,
  createNodeId,
  type DecomposeStrategy,
  type TranslateStrategy,
  type MergeStrategy,
  taskEnumerationPlugin,
  validateGraph,
} from "../../index.js";

const LEVEL3_INPUT =
  "Create a project, add tasks for design and implementation, assign them to Alice and Bob, and set due dates next week.";

function createMockDecomposer(text: string): DecomposeStrategy {
  return {
    name: "MockDecomposer",
    async decompose(): Promise<Chunk[]> {
      return [createChunk(0, text, { start: 0, end: text.length })];
    },
  };
}

function createMockTranslator(graph: IntentGraph): TranslateStrategy {
  return {
    name: "MockTranslator",
    async translate(): Promise<IntentGraph> {
      return graph;
    },
  };
}

function createMockMerger(): MergeStrategy {
  return {
    name: "MockMerger",
    merge(graphs: readonly IntentGraph[]): IntentGraph {
      return graphs[0];
    },
  };
}

describe("level-3 regression", () => {
  it("extracts task names and resolves ambiguous task node", async () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.2",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {
              TARGET: { kind: "entity", entityType: "project" },
            },
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("n2"),
          ir: {
            v: "0.2",
            force: "DO",
            event: { lemma: "ADD", class: "CREATE" },
            args: {
              TARGET: { kind: "entity", entityType: "project", ref: { kind: "id", id: "n1" } },
              THEME: { kind: "entity", entityType: "task" },
            },
          },
          dependsOn: [createNodeId("n1")],
          resolution: {
            status: "Ambiguous",
            ambiguityScore: 0.6,
            missing: ["TASK NAMES" as unknown as "TARGET"],
          },
        },
      ],
    };

    const pipeline = new TranslatorPipeline(
      createMockDecomposer(LEVEL3_INPUT),
      createMockTranslator(graph),
      createMockMerger(),
      {},
      [taskEnumerationPlugin]
    );

    const result = await pipeline.process(LEVEL3_INPUT);
    const validation = validateGraph(result.graph);
    expect(validation.valid).toBe(true);

    const taskNode = result.graph.nodes.find((node) => node.id === "n2");
    expect(taskNode).toBeDefined();
    expect(taskNode?.resolution.status).toBe("Resolved");
    expect(taskNode?.resolution.missing?.length ?? 0).toBe(0);
    expect(
      (taskNode?.ir.ext as Record<string, unknown> | undefined)?.[
        "manifesto.ai/translator"
      ]
    ).toMatchObject({
      taskNames: ["design", "implementation"],
    });
  });
});
