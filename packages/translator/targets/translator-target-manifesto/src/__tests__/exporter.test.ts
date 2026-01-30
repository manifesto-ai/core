/**
 * @fileoverview Manifesto exporter tests.
 */

import { describe, it, expect } from "vitest";
import { createNodeId, type IntentGraph } from "@manifesto-ai/translator";
import {
  createResolver as createIntentResolver,
  type Lexicon,
  type Resolver,
  type Role,
} from "@manifesto-ai/intent-ir";
import { manifestoExporter } from "../exporter.js";

function createTestLexicon(
  supported: string[] = ["CREATE"],
  requiredByLemma: Record<string, readonly Role[]> = {},
  classByLemma: Record<string, "OBSERVE" | "TRANSFORM" | "SOLVE" | "CREATE" | "DECIDE" | "CONTROL"> = {}
): Lexicon {
  const lexicon: Lexicon = {
    resolveEvent(lemma: string) {
      if (supported.includes(lemma)) {
        return {
          lemma,
          eventClass: classByLemma[lemma] ?? "CREATE",
          thetaFrame: {
            required: requiredByLemma[lemma] ?? [],
            optional: [],
            restrictions: {},
          },
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

  it("defers lowering when required roles are missing (lossy lowering)", async () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "ASSIGN", class: "CONTROL" },
            args: {},
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const lexicon = createTestLexicon(
      ["ASSIGN"],
      { ASSIGN: ["TARGET", "BENEFICIARY"] },
      { ASSIGN: "CONTROL" }
    );
    const result = await manifestoExporter.export(
      { graph },
      { lexicon, resolver: createResolver(), strictValidation: true }
    );

    expect(result.invocationPlan.steps[0].lowering.status).toBe("deferred");
  });

  it("blocks dependents when dependencies are not ready", async () => {
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
        {
          id: createNodeId("n2"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "ADD", class: "CREATE" },
            args: {},
          },
          dependsOn: [createNodeId("n1")],
          resolution: { status: "Ambiguous", ambiguityScore: 0.5, missing: ["THEME"] },
        },
        {
          id: createNodeId("n3"),
          ir: {
            v: "0.1",
            force: "DO",
            event: { lemma: "ASSIGN", class: "CONTROL" },
            args: {
              TARGET: { kind: "entity", entityType: "task" },
              BENEFICIARY: { kind: "entity", entityType: "user" },
            },
          },
          dependsOn: [createNodeId("n2")],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const lexicon = createTestLexicon(
      ["CREATE", "ADD", "ASSIGN"],
      { ASSIGN: ["TARGET", "BENEFICIARY"] },
      { ASSIGN: "CONTROL", ADD: "CREATE", CREATE: "CREATE" }
    );
    const result = await manifestoExporter.export(
      { graph },
      { lexicon, resolver: createResolver(), strictValidation: true }
    );

    const step = result.invocationPlan.steps.find((s) => s.nodeId === "n3");
    expect(step?.lowering.status).toBe("deferred");
  });
});
