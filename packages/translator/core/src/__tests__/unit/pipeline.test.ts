/**
 * @fileoverview Unit Tests for TranslatorPipeline
 *
 * Tests the pipeline orchestrator with mock strategies and plugins.
 */

import { describe, it, expect, vi } from "vitest";
import {
  TranslatorPipeline,
  DiagnosticsBagImpl,
  createDiagnosticsBag,
  type DecomposeStrategy,
  type TranslateStrategy,
  type MergeStrategy,
  type PipelinePlugin,
  type IntentGraph,
  type Chunk,
  createChunk,
  createNodeId,
  validateGraph,
} from "../../index.js";

// =============================================================================
// Mock Strategies
// =============================================================================

function createMockDecomposer(chunks?: Chunk[]): DecomposeStrategy {
  return {
    name: "MockDecomposer",
    async decompose(text: string): Promise<Chunk[]> {
      if (chunks) {
        return chunks;
      }
      // Default: single chunk covering entire input
      return [createChunk(0, text, { start: 0, end: text.length })];
    },
  };
}

function createMockTranslator(nodes?: IntentGraph["nodes"]): TranslateStrategy {
  return {
    name: "MockTranslator",
    async translate(text: string): Promise<IntentGraph> {
      if (nodes) {
        return { nodes };
      }
      // Default: single resolved node
      return {
        nodes: [
          {
            id: createNodeId("n1"),
            ir: {
              v: "0.2" as const,
              force: "DO" as const,
              event: { lemma: "CREATE", class: "CREATE" as const },
              args: {},
            },
            resolution: { status: "Resolved", ambiguityScore: 0 },
            dependsOn: [],
          },
        ],
      };
    },
  };
}

function createMockMerger(): MergeStrategy {
  return {
    name: "MockMerger",
    merge(graphs: readonly IntentGraph[]): IntentGraph {
      // Simple merge: concatenate nodes with prefix
      const allNodes = graphs.flatMap((g, graphIdx) =>
        g.nodes.map((node) => ({
          ...node,
          id: createNodeId(`g${graphIdx}_${node.id}`),
          dependsOn: node.dependsOn.map((dep) =>
            createNodeId(`g${graphIdx}_${dep}`)
          ),
        }))
      );
      return { nodes: allNodes };
    },
  };
}

// =============================================================================
// Pipeline Tests
// =============================================================================

describe("TranslatorPipeline", () => {
  describe("Basic operation", () => {
    it("processes input through decompose -> translate -> merge", async () => {
      const pipeline = new TranslatorPipeline(
        createMockDecomposer(),
        createMockTranslator(),
        createMockMerger()
      );

      const result = await pipeline.process("Create a project");

      expect(result.graph).toBeDefined();
      expect(result.graph.nodes.length).toBeGreaterThanOrEqual(1);
      expect(result.diagnostics).toBeDefined();
    });

    it("returns valid graph", async () => {
      const pipeline = new TranslatorPipeline(
        createMockDecomposer(),
        createMockTranslator(),
        createMockMerger()
      );

      const result = await pipeline.process("Test input");

      const validation = validateGraph(result.graph);
      expect(validation.valid).toBe(true);
    });

    it("includes meta information", async () => {
      const input = "Create a project and add tasks";
      const chunks = [
        createChunk(0, "Create a project", { start: 0, end: 16 }),
        createChunk(1, " and add tasks", { start: 16, end: 30 }),
      ];

      const pipeline = new TranslatorPipeline(
        createMockDecomposer(chunks),
        createMockTranslator(),
        createMockMerger()
      );

      const result = await pipeline.process(input);

      expect(result.meta.chunkCount).toBe(2);
      expect(result.meta.nodeCount).toBeGreaterThanOrEqual(0);
      expect(typeof result.meta.processingTimeMs).toBe("number");
    });
  });

  describe("Plugin integration", () => {
    it("executes inspector plugins", async () => {
      const inspectorCalls: string[] = [];

      const plugin: PipelinePlugin = {
        name: "test-inspector",
        kind: "inspector",
        createRunHooks() {
          return {
            beforeDecompose(ctx) {
              inspectorCalls.push("beforeDecompose");
            },
            afterDecompose(ctx) {
              inspectorCalls.push("afterDecompose");
            },
            afterMerge(ctx) {
              inspectorCalls.push("afterMerge");
            },
          };
        },
      };

      const pipeline = new TranslatorPipeline(
        createMockDecomposer(),
        createMockTranslator(),
        createMockMerger(),
        {},
        [plugin]
      );

      await pipeline.process("Test");

      expect(inspectorCalls).toContain("beforeDecompose");
      expect(inspectorCalls).toContain("afterDecompose");
      expect(inspectorCalls).toContain("afterMerge");
    });

    it("executes transformer plugins and uses returned graph", async () => {
      const transformedNode = {
        id: createNodeId("transformed"),
        ir: {
          v: "0.2" as const,
          force: "DO" as const,
          event: { lemma: "TRANSFORMED", class: "CREATE" as const },
          args: {},
        },
        resolution: { status: "Resolved" as const, ambiguityScore: 0 },
        dependsOn: [],
      };

      const plugin: PipelinePlugin = {
        name: "test-transformer",
        kind: "transformer",
        createRunHooks() {
          return {
            afterMerge(ctx): IntentGraph {
              // Return a completely new graph
              return { nodes: [transformedNode] };
            },
          };
        },
      };

      const pipeline = new TranslatorPipeline(
        createMockDecomposer(),
        createMockTranslator(),
        createMockMerger(),
        {},
        [plugin]
      );

      const result = await pipeline.process("Test");

      // Pipeline should use the transformed graph
      expect(result.graph.nodes).toHaveLength(1);
      expect(result.graph.nodes[0].id).toBe(createNodeId("transformed"));
    });

    it("executes plugins in order", async () => {
      const order: string[] = [];

      const plugin1: PipelinePlugin = {
        name: "first",
        kind: "inspector",
        createRunHooks() {
          return {
            afterMerge() {
              order.push("first");
            },
          };
        },
      };

      const plugin2: PipelinePlugin = {
        name: "second",
        kind: "inspector",
        createRunHooks() {
          return {
            afterMerge() {
              order.push("second");
            },
          };
        },
      };

      const pipeline = new TranslatorPipeline(
        createMockDecomposer(),
        createMockTranslator(),
        createMockMerger(),
        {},
        [plugin1, plugin2]
      );

      await pipeline.process("Test");

      expect(order).toEqual(["first", "second"]);
    });
  });

  describe("Options", () => {
    it("respects concurrency option", async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const slowTranslator: TranslateStrategy = {
        name: "SlowTranslator",
        async translate(): Promise<IntentGraph> {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          await new Promise((r) => setTimeout(r, 20));
          currentConcurrent--;
          return {
            nodes: [
              {
                id: createNodeId("n1"),
                ir: {
                  v: "0.2" as const,
                  force: "DO" as const,
                  event: { lemma: "CREATE", class: "CREATE" as const },
                  args: {},
                },
                resolution: { status: "Resolved", ambiguityScore: 0 },
                dependsOn: [],
              },
            ],
          };
        },
      };

      const chunks = [
        createChunk(0, "a", { start: 0, end: 1 }),
        createChunk(1, "b", { start: 1, end: 2 }),
        createChunk(2, "c", { start: 2, end: 3 }),
        createChunk(3, "d", { start: 3, end: 4 }),
      ];

      const pipeline = new TranslatorPipeline(
        createMockDecomposer(chunks),
        slowTranslator,
        createMockMerger(),
        { concurrency: 2 }
      );

      await pipeline.process("abcd");

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });
});

// =============================================================================
// DiagnosticsBag Tests
// =============================================================================

describe("DiagnosticsBag", () => {
  it("collects warnings", () => {
    const bag = createDiagnosticsBag();

    bag.warn("TEST_WARN", "Test warning message");
    bag.warn("TEST_WARN_2", "Another warning", "node-1");

    expect(bag.warnings).toHaveLength(2);
    expect(bag.warnings[0].code).toBe("TEST_WARN");
    expect(bag.warnings[1].nodeId).toBe("node-1");
  });

  it("collects info", () => {
    const bag = createDiagnosticsBag();

    bag.info("TEST_INFO", "Info message");

    expect(bag.infos).toHaveLength(1);
    expect(bag.infos[0].code).toBe("TEST_INFO");
  });

  it("records metrics (last-write-wins)", () => {
    const bag = createDiagnosticsBag();

    bag.metric("count", 10);
    bag.metric("count", 20); // Overwrites

    expect(bag.metrics.get("count")).toBe(20);
  });

  it("accumulates metrics with metricAdd", () => {
    const bag = createDiagnosticsBag();

    bag.metricAdd("total", 10);
    bag.metricAdd("total", 5);
    bag.metricAdd("total", 3);

    expect(bag.metrics.get("total")).toBe(18);
  });

  it("observes metrics with metricObserve", () => {
    const bag = createDiagnosticsBag();

    bag.metricObserve("latency", 100);
    bag.metricObserve("latency", 150);
    bag.metricObserve("latency", 50);

    const observations = bag.metricObservations.get("latency");
    expect(observations).toEqual([100, 150, 50]);
  });
});
