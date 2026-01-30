/**
 * @fileoverview Strict graph validation tests.
 */

import { describe, it, expect } from "vitest";
import { createNodeId, validateGraph } from "../../index.js";
import type { IntentGraph } from "../../index.js";

describe("validateGraph (strict)", () => {
  it("fails when args contain unknown keys in strict mode", () => {
    const graph: IntentGraph = {
      nodes: [
        {
          id: createNodeId("n1"),
          ir: {
            v: "0.2",
            force: "DO",
            event: { lemma: "ASSIGN", class: "CONTROL" },
            args: ({ USERS: { kind: "entity", entityType: "user" } } as unknown) as IntentGraph["nodes"][number]["ir"]["args"],
          },
          dependsOn: [],
          resolution: { status: "Resolved", ambiguityScore: 0 },
        },
      ],
    };

    const result = validateGraph(graph, { strictIntentIR: true });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe("INVALID_IR");
    }
  });
});
