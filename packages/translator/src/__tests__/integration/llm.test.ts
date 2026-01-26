/**
 * @fileoverview LLM Integration Tests
 *
 * Real OpenAI API integration tests.
 * Requires OPENAI_API_KEY in .env.local or environment.
 *
 * Run with: pnpm test:integration
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { translate, createOpenAIProvider, type LLMProvider } from "../../index.js";

// =============================================================================
// Setup
// =============================================================================

// Load .env.local if exists
function loadEnvLocal(): void {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // .env.local not found, skip
  }
}

loadEnvLocal();

const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
let provider: LLMProvider;

// =============================================================================
// Tests
// =============================================================================

describe.skipIf(!hasApiKey)("LLM Integration", () => {
  beforeAll(() => {
    provider = createOpenAIProvider();
  });

  describe("Simple intents", () => {
    it("translates 'Create a project'", async () => {
      const result = await translate("Create a project", {
        llm: { provider },
      });

      expect(result.graph.nodes.length).toBeGreaterThanOrEqual(1);

      const node = result.graph.nodes[0];
      expect(node.ir.event.lemma).toMatch(/CREATE/i);
      expect(node.ir.event.class).toBe("CREATE");
      expect(node.ir.args.THEME).toBeDefined();
      expect(node.resolution.status).toBe("Resolved");
    }, 30000);

    it("translates 'Show all tasks'", async () => {
      const result = await translate("Show all tasks", {
        llm: { provider },
      });

      expect(result.graph.nodes.length).toBeGreaterThanOrEqual(1);

      const node = result.graph.nodes[0];
      expect(node.ir.event.class).toBe("OBSERVE");
    }, 30000);

    it("translates 'Delete the completed items'", async () => {
      const result = await translate("Delete the completed items", {
        llm: { provider },
      });

      expect(result.graph.nodes.length).toBeGreaterThanOrEqual(1);

      const node = result.graph.nodes[0];
      expect(node.ir.event.lemma).toMatch(/DELETE|REMOVE/i);
      expect(node.ir.event.class).toBe("CONTROL");
    }, 30000);
  });

  describe("Multi-step intents", () => {
    it("translates 'Create a project and add tasks to it'", async () => {
      const result = await translate("Create a project and add tasks to it", {
        llm: { provider },
      });

      // Should have at least 2 nodes
      expect(result.graph.nodes.length).toBeGreaterThanOrEqual(2);

      // First node should be CREATE
      const createNode = result.graph.nodes.find(
        (n) => n.ir.event.lemma.match(/CREATE/i) && n.ir.args.THEME?.kind === "entity"
      );
      expect(createNode).toBeDefined();

      // Second node should depend on first
      const addNode = result.graph.nodes.find(
        (n) => n.ir.event.lemma.match(/ADD/i)
      );
      if (addNode && createNode) {
        expect(addNode.dependsOn).toContain(createNode.id);
      }
    }, 30000);

    it("translates complex instruction with 3 steps", async () => {
      const result = await translate(
        "Create a new project, add three tasks, and mark the first task as completed",
        { llm: { provider } }
      );

      // Should have at least 3 nodes
      expect(result.graph.nodes.length).toBeGreaterThanOrEqual(3);

      // Check dependency chain exists
      const hasDepChain = result.graph.nodes.some((n) => n.dependsOn.length > 0);
      expect(hasDepChain).toBe(true);
    }, 45000);
  });

  describe("Discourse references", () => {
    it("handles 'update it' with discourse ref", async () => {
      const result = await translate("Update it with a new title", {
        llm: { provider },
      });

      expect(result.graph.nodes.length).toBeGreaterThanOrEqual(1);

      const node = result.graph.nodes[0];
      expect(node.ir.event.lemma).toMatch(/UPDATE|EDIT|MODIFY/i);

      // Should have discourse ref or high ambiguity
      const hasDiscourseRef =
        node.ir.args.TARGET?.kind === "entity" &&
        "ref" in node.ir.args.TARGET &&
        node.ir.args.TARGET.ref?.kind === "that";

      const isAmbiguous =
        node.resolution.status === "Ambiguous" ||
        node.resolution.ambiguityScore > 0.3;

      expect(hasDiscourseRef || isAmbiguous).toBe(true);
    }, 30000);
  });

  describe("Ambiguity detection", () => {
    it("detects ambiguity in vague input", async () => {
      const result = await translate("Do something with it", {
        llm: { provider },
      });

      expect(result.graph.nodes.length).toBeGreaterThanOrEqual(1);

      const node = result.graph.nodes[0];
      // Should have higher ambiguity score
      expect(node.resolution.ambiguityScore).toBeGreaterThan(0.1);
    }, 30000);
  });

  describe("Korean input", () => {
    it("translates Korean input", async () => {
      const result = await translate("새 프로젝트를 만들어줘", {
        llm: { provider },
        language: "ko",
      });

      expect(result.graph.nodes.length).toBeGreaterThanOrEqual(1);

      const node = result.graph.nodes[0];
      expect(node.ir.event.lemma).toMatch(/CREATE/i);
      expect(node.ir.event.class).toBe("CREATE");
    }, 30000);
  });

  describe("Error recovery", () => {
    it("handles empty input gracefully", async () => {
      const result = await translate("", {
        llm: { provider },
      });

      // Should return empty or fallback
      expect(result.graph).toBeDefined();
      expect(result.warnings).toBeDefined();
    }, 30000);
  });
});

// =============================================================================
// Skip message
// =============================================================================

describe.runIf(!hasApiKey)("LLM Integration (skipped)", () => {
  it("requires OPENAI_API_KEY", () => {
    console.log("⚠️  LLM integration tests skipped: OPENAI_API_KEY not set");
    console.log("   Set it in .env.local or environment to run these tests");
    expect(true).toBe(true);
  });
});
