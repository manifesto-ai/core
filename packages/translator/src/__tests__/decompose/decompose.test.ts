/**
 * @fileoverview Decompose Layer Tests (ADR-003)
 *
 * Tests for decomposition strategies and merge functionality.
 *
 * Per ADR-003 v0.11:
 * - C-DEC-1: Each chunk.text MUST be a contiguous substring of input
 * - C-DEC-2: Chunks MUST preserve original order
 * - C-DEC-5: LLM strategies MUST include span and verify
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
    expect(result.chunks[0].text).toBe("Create a project.");
    expect(result.chunks[1].text).toBe("Add tasks to it.");
    expect(result.chunks[2].text).toBe("Delete the old one.");
  });

  it("handles single sentence", async () => {
    const text = "Create a project.";
    const result = await strategy.decompose(text);

    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0].text).toBe("Create a project.");
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
    expect(result.chunks[0].text).toBe("Do it now!");
    expect(result.chunks[1].text).toBe("Make it happen!");
  });

  it("handles text with question marks", async () => {
    const text = "Can you help? What should I do?";
    const result = await strategy.decompose(text);

    expect(result.chunks.length).toBe(2);
    expect(result.chunks[0].text).toBe("Can you help?");
    expect(result.chunks[1].text).toBe("What should I do?");
  });

  it("sets correct chunk IDs", async () => {
    const text = "First. Second.";
    const result = await strategy.decompose(text);

    expect(result.chunks[0].id).toBe("chunk_0");
    expect(result.chunks[1].id).toBe("chunk_1");
  });

  // ADR-003 C-DEC-1: Substring verification
  it("C-DEC-1: chunk.text is contiguous substring of input", async () => {
    const text = "Create a project. Add tasks to it.";
    const result = await strategy.decompose(text);

    for (const chunk of result.chunks) {
      // Verify text exists in input
      expect(text).toContain(chunk.text);

      // Verify span matches
      if (chunk.span) {
        const extracted = text.slice(chunk.span[0], chunk.span[1]);
        expect(extracted.trim()).toBe(chunk.text);
      }
    }
  });

  // ADR-003 C-DEC-2: Order preservation
  it("C-DEC-2: chunks preserve original order by span", async () => {
    const text = "First. Second. Third.";
    const result = await strategy.decompose(text);

    for (let i = 1; i < result.chunks.length; i++) {
      const prevSpan = result.chunks[i - 1].span;
      const currSpan = result.chunks[i].span;
      if (prevSpan && currSpan) {
        expect(currSpan[0]).toBeGreaterThanOrEqual(prevSpan[1]);
      }
    }
  });

  // ADR-003: span information
  it("includes span information in chunks", async () => {
    const text = "Create a project. Add tasks.";
    const result = await strategy.decompose(text);

    for (const chunk of result.chunks) {
      expect(chunk.span).toBeDefined();
      expect(Array.isArray(chunk.span)).toBe(true);
      expect(chunk.span!.length).toBe(2);
    }
  });

  it("respects maxChunkChars context", async () => {
    // Create a long text with many sentences
    const text =
      "A. B. C. D. E. F. G. H. I. J. K. L. M. N. O. P. Q. R. S. T.";
    const result = await strategy.decompose(text, { maxChunkChars: 100 });

    // Each chunk should respect the budget (some merging should occur)
    for (const chunk of result.chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(100);
    }
  });

  it("respects maxChunks context", async () => {
    const text = "A. B. C. D. E. F. G. H.";
    const result = await strategy.decompose(text, { maxChunks: 3 });

    expect(result.chunks.length).toBeLessThanOrEqual(3);
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
    expect(result.chunks[0].text).toBe(text);

    // Should have warning about not being configured
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.some((w) => w.code === "LLM_NOT_CONFIGURED")).toBe(
      true
    );
  });

  it("handles empty text", async () => {
    const strategy = new ShallowLLMDecompose({ apiKey: "test-key" });
    const result = await strategy.decompose("");

    expect(result.chunks.length).toBe(0);
  });

  it("handles very short text (< 10 chars)", async () => {
    const strategy = new ShallowLLMDecompose({ apiKey: "test-key" });
    const result = await strategy.decompose("Hi");

    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0].text).toBe("Hi");
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

  // ADR-003 C-DEC-5: span verification for LLM
  it("C-DEC-5: fallback includes span information", async () => {
    const strategy = new ShallowLLMDecompose(); // Not configured, will fallback
    const text = "Create a project and add tasks to it";
    const result = await strategy.decompose(text);

    for (const chunk of result.chunks) {
      expect(chunk.span).toBeDefined();
      expect(chunk.id).toBeDefined();
    }
  });

  // ADR-003 C-LLM-DEC-1/2: fallback on failure
  it("C-LLM-DEC-2: falls back to deterministic on error", async () => {
    const strategy = new ShallowLLMDecompose(); // No API key = will fallback
    const text = "First sentence. Second sentence.";
    const result = await strategy.decompose(text);

    // Should still get valid chunks even without LLM
    expect(result.chunks.length).toBeGreaterThan(0);

    // Each chunk should be a substring
    for (const chunk of result.chunks) {
      expect(text).toContain(chunk.text);
    }
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
