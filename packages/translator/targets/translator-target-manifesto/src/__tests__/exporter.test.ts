/**
 * @fileoverview Manifesto exporter tests.
 */

import { describe, it, expect } from "vitest";
import { createNodeId, type IntentGraph } from "@manifesto-ai/translator";
import { createResolver as createIntentResolver, type Lexicon, type Resolver } from "@manifesto-ai/intent-ir";
import { manifestoExporter } from "../exporter.js";

function createTestLexicon(supported: string[] = ["CREATE"]): Lexicon {
  const lexicon: Lexicon = {
    resolveEvent(lemma: string) {
      if (supported.includes(lemma)) {
        return {
          lemma,
          eventClass: "CREATE",
          thetaFrame: { required: [], optional: [], restrictions: {} },
        };
      }
      return undefined;
    },
    resolveEntity() {
      return { fields: {} };
    },
    resolveActionType(lemma: string) {
      return supported.includes(lemma) ? `domain.${lemma.toLowerCase()}` : undefined;
    },
    mapArgsToInput(args: Record<string, unknown>) {
      return Object.keys(args).length > 0 ? args : undefined;
    },
  };

  return lexicon;
}

function createResolver(): Resolver {
  return createIntentResolver();
}

describe("manifestoExporter", () => {
  it("returns ready lowering for supported action", async () => {
    const graph: IntentGraph = {
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
    };

    const result = await manifestoExporter.export(
      { graph },
      { lexicon: createTestLexicon(), resolver: createResolver() }
    );

    expect(result.invocationPlan.steps).toHaveLength(1);
    expect(result.invocationPlan.steps[0].lowering.status).toBe("ready");
    expect(result.extensionCandidates).toHaveLength(0);
  });

  it("returns failed lowering and MEL extension candidate when action is missing", async () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "ARCHIVE", class: "CONTROL" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const result = await manifestoExporter.export(
      { graph },
      { lexicon: createTestLexicon(["CREATE"]), resolver: createResolver() }
    );

    expect(result.invocationPlan.steps[0].lowering.status).toBe("failed");
    expect(result.extensionCandidates).toHaveLength(1);
    expect(result.extensionCandidates[0].kind).toBe("mel");
  });

  it("returns deferred lowering when resolution is ambiguous", async () => {
    const graph: IntentGraph = {
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
          resolution: { status: "Ambiguous", ambiguityScore: 0.4 },
        },
      ],
    };

    const result = await manifestoExporter.export(
      { graph },
      { lexicon: createTestLexicon(), resolver: createResolver() }
    );

    expect(result.invocationPlan.steps[0].lowering.status).toBe("deferred");
    expect(result.extensionCandidates).toHaveLength(0);
  });
});
