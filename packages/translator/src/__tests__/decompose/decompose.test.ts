/**
 * @fileoverview Decompose Layer Tests (ADR-003)
 *
 * Tests for decomposition strategies and merge functionality.
 */

import { describe, it, expect } from "vitest";
import {
  DeterministicDecompose,
  ShallowLLMDecompose,
  conservativeMerge,
  createNodeId,
  type IntentGraph,
} from "../../index.js";

// =============================================================================
// DeterministicDecompose Tests
// =============================================================================

describe("DeterministicDecompose", () => {
  const strategy = new DeterministicDecompose();

  it("splits text by sentence boundaries", async () => {
    const text = "Create a project. Add tasks to it. Delete the old one.";
    const result = await strategy.decompose(text);

    expect(result.chunks.length).toBe(3);
    expect(result.chunks[0].meta?.sourceText).toBe("Create a project.");
    expect(result.chunks[1].meta?.sourceText).toBe("Add tasks to it.");
    expect(result.chunks[2].meta?.sourceText).toBe("Delete the old one.");
  });

  it("handles single sentence", async () => {
    const text = "Create a project.";
    const result = await strategy.decompose(text);

    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0].meta?.sourceText).toBe("Create a project.");
  });

  it("handles empty text", async () => {
    const text = "";
    const result = await strategy.decompose(text);

    expect(result.chunks.length).toBe(0);
  });

  it("handles text with exclamation marks", async () => {
    const text = "Do it now! Make it happen!";
    const result = await strategy.decompose(text);

    expect(result.chunks.length).toBe(2);
    expect(result.chunks[0].meta?.sourceText).toBe("Do it now!");
    expect(result.chunks[1].meta?.sourceText).toBe("Make it happen!");
  });

  it("handles text with question marks", async () => {
    const text = "Can you help? What should I do?";
    const result = await strategy.decompose(text);

    expect(result.chunks.length).toBe(2);
    expect(result.chunks[0].meta?.sourceText).toBe("Can you help?");
    expect(result.chunks[1].meta?.sourceText).toBe("What should I do?");
  });

  it("sets correct metadata", async () => {
    const text = "First. Second.";
    const result = await strategy.decompose(text);

    expect(result.meta.strategy).toBe("deterministic");
    expect(result.meta.chunkCount).toBe(2);
    expect(result.meta.decomposedAt).toBeDefined();

    expect(result.chunks[0].meta?.chunkIndex).toBe(0);
    expect(result.chunks[1].meta?.chunkIndex).toBe(1);
  });
});

// =============================================================================
// ShallowLLMDecompose Tests
// =============================================================================

describe("ShallowLLMDecompose", () => {
  it("reports not configured when no API key", () => {
    const strategy = new ShallowLLMDecompose();
    // Without OPENAI_API_KEY env var, should not be configured
    expect(strategy.isConfigured()).toBe(false);
  });

  it("reports configured when API key provided", () => {
    const strategy = new ShallowLLMDecompose({ apiKey: "test-key" });
    expect(strategy.isConfigured()).toBe(true);
  });

  it("falls back to single chunk when not configured", async () => {
    const strategy = new ShallowLLMDecompose(); // No API key
    const text = "Create a project and add tasks to it";
    const result = await strategy.decompose(text);

    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0].meta?.sourceText).toBe(text);
    expect(result.meta.strategy).toBe("shallow-llm");
  });

  it("handles empty text", async () => {
    const strategy = new ShallowLLMDecompose({ apiKey: "test-key" });
    const result = await strategy.decompose("");

    expect(result.chunks.length).toBe(0);
    expect(result.meta.chunkCount).toBe(0);
  });

  it("handles very short text (< 10 chars)", async () => {
    const strategy = new ShallowLLMDecompose({ apiKey: "test-key" });
    const result = await strategy.decompose("Hi");

    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0].meta?.sourceText).toBe("Hi");
  });

  it("sets correct metadata", async () => {
    const strategy = new ShallowLLMDecompose();
    const text = "Create a project";
    const result = await strategy.decompose(text);

    expect(result.meta.strategy).toBe("shallow-llm");
    expect(result.meta.decomposedAt).toBeDefined();
  });

  it("uses custom config values", () => {
    const strategy = new ShallowLLMDecompose({
      apiKey: "custom-key",
      model: "gpt-4",
      baseUrl: "https://custom.api.com",
      timeout: 60000,
      temperature: 0.5,
    });

    expect(strategy.isConfigured()).toBe(true);
    expect(strategy.name).toBe("shallow-llm");
  });
});

// =============================================================================
// conservativeMerge Tests
// =============================================================================

describe("conservativeMerge", () => {
  it("merges empty chunks array", () => {
    const result = conservativeMerge([]);

    expect(result.graph.nodes.length).toBe(0);
    expect(result.mergedFrom.length).toBe(0);
  });

  it("merges single chunk without modification", () => {
    const chunk: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
      meta: {
        sourceText: "Create project",
        translatedAt: new Date().toISOString(),
      },
    };

    const result = conservativeMerge([chunk]);

    expect(result.graph.nodes.length).toBe(1);
    expect(result.graph.nodes[0].id).toBe("chunk_0_n1");
    expect(result.mergedFrom).toEqual(["chunk_0"]);
  });

  it("prefixes node IDs to avoid collisions", () => {
    const chunk1: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
      meta: {
        sourceText: "Create",
        translatedAt: new Date().toISOString(),
      },
    };

    const chunk2: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"), // Same ID as chunk1
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
      meta: {
        sourceText: "Update",
        translatedAt: new Date().toISOString(),
      },
    };

    const result = conservativeMerge([chunk1, chunk2]);

    expect(result.graph.nodes.length).toBe(2);
    expect(result.graph.nodes[0].id).toBe("chunk_0_n1");
    expect(result.graph.nodes[1].id).toBe("chunk_1_n1");
  });

  it("remaps dependencies within chunks", () => {
    const chunk: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
        {
          id: createNodeId("n2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [createNodeId("n1")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
      meta: {
        sourceText: "Create and update",
        translatedAt: new Date().toISOString(),
      },
    };

    const result = conservativeMerge([chunk]);

    expect(result.graph.nodes[1].dependsOn).toContain("chunk_0_n1");
  });

  it("adds cross-chunk dependencies by default", () => {
    const chunk1: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
      meta: {
        sourceText: "Create",
        translatedAt: new Date().toISOString(),
      },
    };

    const chunk2: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
      meta: {
        sourceText: "Update",
        translatedAt: new Date().toISOString(),
      },
    };

    const result = conservativeMerge([chunk1, chunk2]);

    // Second chunk's first node should depend on first chunk's last node
    expect(result.graph.nodes[1].dependsOn).toContain("chunk_0_n1");
  });

  it("skips cross-chunk deps when disabled", () => {
    const chunk1: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
      meta: {
        sourceText: "Create",
        translatedAt: new Date().toISOString(),
      },
    };

    const chunk2: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "UPDATE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
      meta: {
        sourceText: "Update",
        translatedAt: new Date().toISOString(),
      },
    };

    const result = conservativeMerge([chunk1, chunk2], {
      addCrossChunkDeps: false,
    });

    // No cross-chunk dependencies
    expect(result.graph.nodes[1].dependsOn).toHaveLength(0);
  });

  it("uses custom ID prefix", () => {
    const chunk: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
      meta: {
        sourceText: "Create",
        translatedAt: new Date().toISOString(),
      },
    };

    const result = conservativeMerge([chunk], { idPrefix: "segment" });

    expect(result.graph.nodes[0].id).toBe("segment_0_n1");
  });

  it("excludes Abstract nodes from cross-chunk dependency chain", () => {
    const chunk1: IntentGraph = {
      nodes: [
        {
          id: createNodeId("abstract"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "IMPROVE", class: "TRANSFORM" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Abstract", ambiguityScore: 1 },
        },
      ],
      meta: {
        sourceText: "Improve things",
        translatedAt: new Date().toISOString(),
      },
    };

    const chunk2: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "CREATE", class: "CREATE" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
      meta: {
        sourceText: "Create",
        translatedAt: new Date().toISOString(),
      },
    };

    const result = conservativeMerge([chunk1, chunk2]);

    // Chunk2's node should NOT depend on chunk1's Abstract node
    expect(result.graph.nodes[1].dependsOn).toHaveLength(0);
  });

  it("combines source texts from all chunks", () => {
    const chunk1: IntentGraph = {
      nodes: [],
      meta: {
        sourceText: "First sentence.",
        translatedAt: new Date().toISOString(),
      },
    };

    const chunk2: IntentGraph = {
      nodes: [],
      meta: {
        sourceText: "Second sentence.",
        translatedAt: new Date().toISOString(),
      },
    };

    const result = conservativeMerge([chunk1, chunk2]);

    expect(result.graph.meta?.sourceText).toBe(
      "First sentence. Second sentence."
    );
  });
});
