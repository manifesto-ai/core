import { describe, expect, it } from "vitest";
import type { SchemaGraph as RawSchemaGraph } from "@manifesto-ai/compiler";

import { ManifestoError, createManifesto } from "../index.js";
import { createSdkSchemaGraph } from "../runtime/schema-graph.js";
import type { SchemaGraphNodeId } from "../types.js";
import {
  createCounterSchema,
  type CounterDomain,
} from "./helpers/schema.js";

function createRawGraph(): RawSchemaGraph {
  return {
    nodes: [
      { id: "state:count", kind: "state", name: "count" },
      { id: "computed:doubled", kind: "computed", name: "doubled" },
      { id: "computed:quadrupled", kind: "computed", name: "quadrupled" },
      { id: "action:increment", kind: "action", name: "increment" },
      { id: "state:isolated", kind: "state", name: "isolated" },
    ],
    edges: [
      { from: "state:count", to: "computed:doubled", relation: "feeds" },
      { from: "computed:doubled", to: "computed:quadrupled", relation: "feeds" },
      { from: "action:increment", to: "state:count", relation: "mutates" },
    ],
  };
}

function nodeIds(graph: { nodes: readonly { id: SchemaGraphNodeId }[] }): string[] {
  return [...graph.nodes.map((node) => node.id)].sort();
}

function captureError(run: () => unknown): ManifestoError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ManifestoError);
    return error as ManifestoError;
  }
  throw new Error("Expected the call to throw");
}

describe("createSdkSchemaGraph()", () => {
  it("preserves the raw nodes and edges and freezes the graph", () => {
    const raw = createRawGraph();
    const graph = createSdkSchemaGraph(raw);

    expect(graph.nodes).toEqual(raw.nodes);
    expect(graph.edges).toEqual(raw.edges);
    expect(Object.isFrozen(graph)).toBe(true);
  });

  it("traces downstream transitively through outgoing edges", () => {
    const graph = createSdkSchemaGraph(createRawGraph());

    const downstream = graph.traceDown("state:count");

    expect(nodeIds(downstream)).toEqual([
      "computed:doubled",
      "computed:quadrupled",
      "state:count",
    ]);
    expect(downstream.edges).toEqual([
      { from: "state:count", to: "computed:doubled", relation: "feeds" },
      { from: "computed:doubled", to: "computed:quadrupled", relation: "feeds" },
    ]);
  });

  it("traces upstream transitively through incoming edges", () => {
    const graph = createSdkSchemaGraph(createRawGraph());

    const upstream = graph.traceUp("computed:quadrupled");

    expect(nodeIds(upstream)).toEqual([
      "action:increment",
      "computed:doubled",
      "computed:quadrupled",
      "state:count",
    ]);
  });

  it("includes mutating actions in the upstream trace of a state node", () => {
    const graph = createSdkSchemaGraph(createRawGraph());

    const upstream = graph.traceUp("state:count");

    expect(nodeIds(upstream)).toEqual(["action:increment", "state:count"]);
  });

  it("returns a single-node subgraph for an isolated node", () => {
    const graph = createSdkSchemaGraph(createRawGraph());

    const isolated = graph.traceDown("state:isolated");

    expect(nodeIds(isolated)).toEqual(["state:isolated"]);
    expect(isolated.edges).toEqual([]);
  });

  it("returns traversable subgraphs that reject nodes outside the slice", () => {
    const graph = createSdkSchemaGraph(createRawGraph());
    const subgraph = graph.traceDown("computed:doubled");

    expect(nodeIds(subgraph.traceUp("computed:quadrupled"))).toEqual([
      "computed:doubled",
      "computed:quadrupled",
    ]);

    const error = captureError(() => subgraph.traceUp("state:count"));
    expect(error.code).toBe("SCHEMA_ERROR");
    expect(error.message).toBe('Unknown SchemaGraph node id "state:count"');
  });

  it("resolves ActionRef, FieldRef, and ComputedRef lookups", () => {
    const graph = createSdkSchemaGraph(createRawGraph());

    expect(nodeIds(graph.traceDown({ __kind: "FieldRef", name: "count" })))
      .toEqual(["computed:doubled", "computed:quadrupled", "state:count"]);
    expect(nodeIds(graph.traceDown({ __kind: "ActionRef", name: "increment" })))
      .toEqual([
        "action:increment",
        "computed:doubled",
        "computed:quadrupled",
        "state:count",
      ]);
    expect(nodeIds(graph.traceUp({ __kind: "ComputedRef", name: "doubled" })))
      .toEqual(["action:increment", "computed:doubled", "state:count"]);
  });

  it("rejects malformed string node ids with SCHEMA_ERROR", () => {
    const graph = createSdkSchemaGraph(createRawGraph());

    const error = captureError(() => graph.traceDown("count" as SchemaGraphNodeId));
    expect(error.code).toBe("SCHEMA_ERROR");
    expect(error.message).toBe(
      'SchemaGraph node id must use "state:<name>", "computed:<name>", or "action:<name>"',
    );
  });

  it("rejects unknown string node ids with SCHEMA_ERROR", () => {
    const graph = createSdkSchemaGraph(createRawGraph());

    const error = captureError(() => graph.traceUp("state:missing"));
    expect(error.code).toBe("SCHEMA_ERROR");
    expect(error.message).toBe('Unknown SchemaGraph node id "state:missing"');
  });

  it("rejects refs that are not part of the projected graph", () => {
    const graph = createSdkSchemaGraph(createRawGraph());

    const error = captureError(() =>
      graph.traceUp({ __kind: "FieldRef", name: "missing" }));
    expect(error.code).toBe("SCHEMA_ERROR");
    expect(error.message).toBe(
      'SchemaGraph node "state:missing" is not part of the projected graph',
    );
  });

  it("rejects unsupported ref lookup targets", () => {
    const graph = createSdkSchemaGraph(createRawGraph());

    const error = captureError(() =>
      graph.traceUp({ __kind: "EffectRef", name: "count" } as never));
    expect(error.code).toBe("SCHEMA_ERROR");
    expect(error.message).toBe("Unsupported SchemaGraph ref lookup target");
  });
});

describe("inspect.graph() on an activated runtime", () => {
  it("projects schema nodes and supports upstream/downstream traversal", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const graph = app.inspect.graph();
    const ids = nodeIds(graph);

    expect(ids).toContain("state:count");
    expect(ids).toContain("computed:doubled");
    expect(ids).toContain("action:increment");

    const downstream = graph.traceDown({ __kind: "FieldRef", name: "count" });
    expect(nodeIds(downstream)).toContain("computed:doubled");

    const upstream = graph.traceUp("computed:doubled");
    expect(nodeIds(upstream)).toContain("state:count");
    expect(nodeIds(upstream)).not.toContain("state:status");
  });
});
