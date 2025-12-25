import { defineDerived, type Expression, type SemanticMeta } from "@manifesto-ai/core";

// Helper to create semantic metadata
const semantic = (
  type: string,
  description: string
): SemanticMeta => ({
  type,
  description,
  readable: true,
});

export const derived = {
  // All defined paths (sources + derived)
  allPaths: defineDerived({
    deps: ["data.sources", "data.derived"],
    expr: [
      "concat",
      ["map", ["values", ["get", "data.sources"]], ["get", "$.path"]],
      ["map", ["values", ["get", "data.derived"]], ["get", "$.path"]],
    ] as Expression,
    semantic: semantic("array", "All defined semantic paths"),
  }),

  // Source paths only
  sourcePaths: defineDerived({
    deps: ["data.sources"],
    expr: [
      "filter",
      ["map", ["values", ["get", "data.sources"]], ["get", "$.path"]],
      ["!=", ["get", "$"], ""],
    ] as Expression,
    semantic: semantic("array", "Source paths only (data.*)"),
  }),

  // Derived paths only
  derivedPaths: defineDerived({
    deps: ["data.derived"],
    expr: [
      "filter",
      ["map", ["values", ["get", "data.derived"]], ["get", "$.path"]],
      ["!=", ["get", "$"], ""],
    ] as Expression,
    semantic: semantic("array", "Derived paths only (derived.*)"),
  }),

  // Check if there's any content
  hasContent: defineDerived({
    deps: ["data.sources", "data.derived"],
    expr: [
      "any",
      [">", ["length", ["keys", ["get", "data.sources"]]], 0],
      [">", ["length", ["keys", ["get", "data.derived"]]], 0],
    ] as Expression,
    semantic: semantic("boolean", "Whether any blocks exist"),
  }),

  // Source count
  sourceCount: defineDerived({
    deps: ["data.sources"],
    expr: ["length", ["keys", ["get", "data.sources"]]] as Expression,
    semantic: semantic("number", "Number of source blocks"),
  }),

  // Derived count
  derivedCount: defineDerived({
    deps: ["data.derived"],
    expr: ["length", ["keys", ["get", "data.derived"]]] as Expression,
    semantic: semantic("number", "Number of derived blocks"),
  }),

  // Total block count
  totalBlocks: defineDerived({
    deps: ["derived.sourceCount", "derived.derivedCount"],
    expr: [
      "+",
      ["get", "derived.sourceCount"],
      ["get", "derived.derivedCount"],
    ] as Expression,
    semantic: semantic("number", "Total number of blocks"),
  }),
};
