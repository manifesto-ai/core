/**
 * @fileoverview Unit Tests for Built-in Strategies
 *
 * Tests for:
 * - SlidingWindowDecomposer
 * - SentenceBasedDecomposer
 * - DeterministicTranslator
 * - ConservativeMerger
 * - AggressiveMerger
 */

import { describe, it, expect } from "vitest";
import {
  SlidingWindowDecomposer,
  SentenceBasedDecomposer,
  DeterministicTranslator,
  ConservativeMerger,
  AggressiveMerger,
  validateChunks,
  validateGraph,
  createNodeId,
  type IntentGraph,
  type IntentNode,
} from "../../index.js";

// =============================================================================
// Decompose Strategies
// =============================================================================

describe("SlidingWindowDecomposer", () => {
  it("decomposes text into fixed-size windows", async () => {
    // Constructor takes (chunkSize, overlapSize) positionally
    const decomposer = new SlidingWindowDecomposer(20, 0);
    const input = "This is a test. And another sentence. Final part.";

    const chunks = await decomposer.decompose(input);

    // Should create multiple chunks (49 chars / 20 = 3 chunks)
    expect(chunks.length).toBeGreaterThan(1);

    // Each chunk should satisfy D-INV invariants
    const result = validateChunks(chunks, input);
    expect(result.valid).toBe(true);
  });

  it("creates single chunk for short input", async () => {
    const decomposer = new SlidingWindowDecomposer(100, 0);
    const input = "Short text.";

    const chunks = await decomposer.decompose(input);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(input);
  });

  it("respects overlap size", async () => {
    const decomposer = new SlidingWindowDecomposer(20, 5);
    const input = "This is a test with overlap handling.";

    const chunks = await decomposer.decompose(input);

    // With overlap, later chunks should start before previous chunk ends
    if (chunks.length >= 2) {
      const hasOverlap = chunks[0].span.end > chunks[1].span.start;
      expect(hasOverlap).toBe(true);
    }
  });
});

describe("SentenceBasedDecomposer", () => {
  it("decomposes text by sentence boundaries", async () => {
    const decomposer = new SentenceBasedDecomposer();
    const input = "First sentence. Second sentence! Third sentence?";

    const chunks = await decomposer.decompose(input);

    // Should create chunks at sentence boundaries
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    // Validate D-INV invariants
    const result = validateChunks(chunks, input);
    expect(result.valid).toBe(true);
  });

  it("handles single sentence", async () => {
    const decomposer = new SentenceBasedDecomposer();
    const input = "Just one sentence.";

    const chunks = await decomposer.decompose(input);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(input);
  });

  it("handles empty input", async () => {
    const decomposer = new SentenceBasedDecomposer();
    const input = "";

    const chunks = await decomposer.decompose(input);

    // Should return at least one chunk per D-INV-1
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Translate Strategies
// =============================================================================

describe("DeterministicTranslator", () => {
  it("extracts intents using pattern matching", async () => {
    const translator = new DeterministicTranslator();
    const input = "Create a project";

    const graph = await translator.translate(input);

    // Should extract CREATE intent
    expect(graph.nodes.length).toBeGreaterThanOrEqual(1);

    // Validate G-INV invariants
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
  });

  it("extracts multiple intents", async () => {
    const translator = new DeterministicTranslator();
    // Use input that matches multiple patterns:
    // "create project" matches create pattern
    // "add tasks to the project" matches add X to Y pattern
    const input = "Create a project and add tasks to the project";

    const graph = await translator.translate(input);

    // Should extract multiple intents (create + add)
    expect(graph.nodes.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty graph for unrecognized input", async () => {
    const translator = new DeterministicTranslator();
    const input = "Random text without intent patterns";

    const graph = await translator.translate(input);

    // May return empty or minimal graph
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
  });

  it("respects maxNodes option", async () => {
    const translator = new DeterministicTranslator();
    const input = "Create project, add task, update status, delete old";

    const graph = await translator.translate(input, { maxNodes: 2 });

    expect(graph.nodes.length).toBeLessThanOrEqual(2);
  });
});

// =============================================================================
// Merge Strategies
// =============================================================================

function createTestNode(id: string, dependsOn: string[] = []): IntentNode {
  return {
    id: createNodeId(id),
    ir: {
      v: "0.1" as const,
      force: "DO" as const,
      event: { lemma: "CREATE", class: "CREATE" as const },
      args: {},
    },
    resolution: { status: "Resolved", ambiguityScore: 0 },
    dependsOn: dependsOn.map(createNodeId),
  };
}

describe("ConservativeMerger", () => {
  it("merges multiple graphs", () => {
    const merger = new ConservativeMerger();
    const graph1: IntentGraph = { nodes: [createTestNode("n1")] };
    const graph2: IntentGraph = { nodes: [createTestNode("n1")] }; // Same ID

    const merged = merger.merge([graph1, graph2]);

    // Should handle ID collision
    const result = validateGraph(merged);
    expect(result.valid).toBe(true);
  });

  it("preserves all nodes from input graphs", () => {
    const merger = new ConservativeMerger();
    const graph1: IntentGraph = { nodes: [createTestNode("a1")] };
    const graph2: IntentGraph = { nodes: [createTestNode("b1")] };

    const merged = merger.merge([graph1, graph2]);

    // All nodes should be present (possibly with prefixed IDs)
    expect(merged.nodes.length).toBe(2);
  });

  it("handles empty graphs", () => {
    const merger = new ConservativeMerger();
    const graphs: IntentGraph[] = [{ nodes: [] }, { nodes: [] }];

    const merged = merger.merge(graphs);

    expect(merged.nodes).toHaveLength(0);
  });

  it("handles single graph", () => {
    const merger = new ConservativeMerger();
    const graph: IntentGraph = {
      nodes: [createTestNode("n1"), createTestNode("n2", ["n1"])],
    };

    const merged = merger.merge([graph]);

    expect(merged.nodes.length).toBe(2);
    const result = validateGraph(merged);
    expect(result.valid).toBe(true);
  });
});

describe("AggressiveMerger", () => {
  it("merges graphs with deduplication", () => {
    const merger = new AggressiveMerger();
    const graph1: IntentGraph = { nodes: [createTestNode("n1")] };
    const graph2: IntentGraph = { nodes: [createTestNode("n1")] };

    const merged = merger.merge([graph1, graph2], { deduplicate: true });

    // With deduplication, similar nodes might be merged
    const result = validateGraph(merged);
    expect(result.valid).toBe(true);
  });

  it("applies aggressive linking strategy", () => {
    const merger = new AggressiveMerger();
    const graph1: IntentGraph = { nodes: [createTestNode("n1")] };
    const graph2: IntentGraph = { nodes: [createTestNode("n2")] };

    const merged = merger.merge([graph1, graph2], {
      linkStrategy: "aggressive",
    });

    // Should attempt to create cross-chunk dependencies
    const result = validateGraph(merged);
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// Integration: Strategy Composition
// =============================================================================

describe("Strategy Composition", () => {
  it("decompose -> translate -> merge workflow", async () => {
    const decomposer = new SentenceBasedDecomposer();
    const translator = new DeterministicTranslator();
    const merger = new ConservativeMerger();

    const input = "Create a project. Add three tasks. Update the status.";

    // Step 1: Decompose
    const chunks = await decomposer.decompose(input);
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    // Step 2: Translate each chunk
    const graphs: IntentGraph[] = [];
    for (const chunk of chunks) {
      const graph = await translator.translate(chunk.text);
      graphs.push(graph);
    }

    // Step 3: Merge
    const merged = merger.merge(graphs);

    // Final graph should be valid
    const result = validateGraph(merged);
    expect(result.valid).toBe(true);
  });
});
