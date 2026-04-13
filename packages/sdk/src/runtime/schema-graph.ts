import {
  type SchemaGraph as RawSchemaGraph,
} from "@manifesto-ai/compiler";

import {
  ManifestoError,
} from "../errors.js";
import type {
  SchemaGraph,
  SchemaGraphNodeId,
  SchemaGraphNodeRef,
} from "../types.js";

const SCHEMA_GRAPH_NODE_ID_PATTERN = /^(state|computed|action):.+$/;

export function createSdkSchemaGraph(rawGraph: RawSchemaGraph): SchemaGraph {
  const nodeIds = new Set(rawGraph.nodes.map((node) => node.id));
  const outgoing = new Map<SchemaGraphNodeId, Set<SchemaGraphNodeId>>();
  const incoming = new Map<SchemaGraphNodeId, Set<SchemaGraphNodeId>>();

  const link = (
    index: Map<SchemaGraphNodeId, Set<SchemaGraphNodeId>>,
    from: SchemaGraphNodeId,
    to: SchemaGraphNodeId,
  ): void => {
    const next = index.get(from);
    if (next) {
      next.add(to);
      return;
    }
    index.set(from, new Set([to]));
  };

  for (const edge of rawGraph.edges) {
    link(outgoing, edge.from, edge.to);
    link(incoming, edge.to, edge.from);
  }

  const materialize = (included: ReadonlySet<SchemaGraphNodeId>): SchemaGraph => {
    const subgraph: RawSchemaGraph = Object.freeze({
      nodes: Object.freeze(
        rawGraph.nodes.filter((node) => included.has(node.id)),
      ),
      edges: Object.freeze(
        rawGraph.edges.filter(
          (edge) => included.has(edge.from) && included.has(edge.to),
        ),
      ),
    });
    return createSdkSchemaGraph(subgraph);
  };

  const trace = (
    target: SchemaGraphNodeRef | SchemaGraphNodeId,
    direction: "incoming" | "outgoing",
  ): SchemaGraph => {
    const seed = resolveSchemaGraphNodeId(target, nodeIds);
    const frontier: SchemaGraphNodeId[] = [seed];
    const seen = new Set<SchemaGraphNodeId>([seed]);
    const index = direction === "incoming" ? incoming : outgoing;

    while (frontier.length > 0) {
      const current = frontier.shift();
      if (!current) {
        continue;
      }

      for (const next of index.get(current) ?? []) {
        if (seen.has(next)) {
          continue;
        }

        seen.add(next);
        frontier.push(next);
      }
    }

    return materialize(seen);
  };

  return Object.freeze({
    nodes: rawGraph.nodes,
    edges: rawGraph.edges,
    traceUp(target: SchemaGraphNodeRef | SchemaGraphNodeId): SchemaGraph {
      return trace(target, "incoming");
    },
    traceDown(target: SchemaGraphNodeRef | SchemaGraphNodeId): SchemaGraph {
      return trace(target, "outgoing");
    },
  });
}

function resolveSchemaGraphNodeId(
  target: SchemaGraphNodeRef | SchemaGraphNodeId,
  nodeIds: ReadonlySet<SchemaGraphNodeId>,
): SchemaGraphNodeId {
  if (typeof target === "string") {
    if (!SCHEMA_GRAPH_NODE_ID_PATTERN.test(target)) {
      throw new ManifestoError(
        "SCHEMA_ERROR",
        'SchemaGraph node id must use "state:<name>", "computed:<name>", or "action:<name>"',
      );
    }

    if (!nodeIds.has(target as SchemaGraphNodeId)) {
      throw new ManifestoError(
        "SCHEMA_ERROR",
        `Unknown SchemaGraph node id "${target}"`,
      );
    }

    return target as SchemaGraphNodeId;
  }

  let nodeId: SchemaGraphNodeId;
  switch (target.__kind) {
    case "ActionRef":
      nodeId = `action:${String(target.name)}`;
      break;
    case "FieldRef":
      nodeId = `state:${target.name}`;
      break;
    case "ComputedRef":
      nodeId = `computed:${target.name}`;
      break;
    default:
      throw new ManifestoError(
        "SCHEMA_ERROR",
        "Unsupported SchemaGraph ref lookup target",
      );
  }

  if (!nodeIds.has(nodeId)) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      `SchemaGraph node "${nodeId}" is not part of the projected graph`,
    );
  }

  return nodeId;
}
