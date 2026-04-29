import type { PatchPath } from "@manifesto-ai/core";
import type {
  CoreExprNode,
  CoreFlowNode,
  DomainSchema,
} from "./generator/ir.js";

export type SchemaGraphNodeKind = "state" | "computed" | "action";

export type SchemaGraphNodeId =
  | `state:${string}`
  | `computed:${string}`
  | `action:${string}`;

export type SchemaGraphNode = {
  readonly id: SchemaGraphNodeId;
  readonly kind: SchemaGraphNodeKind;
  readonly name: string;
};

export type SchemaGraphEdgeRelation = "feeds" | "mutates" | "unlocks";

export type SchemaGraphEdge = {
  readonly from: SchemaGraphNodeId;
  readonly to: SchemaGraphNodeId;
  readonly relation: SchemaGraphEdgeRelation;
};

export type SchemaGraph = {
  readonly nodes: readonly SchemaGraphNode[];
  readonly edges: readonly SchemaGraphEdge[];
};

const COLLECTION_CONTEXT_ROOTS = new Set(["$item", "$index", "$array"]);

export function extractSchemaGraph(schema: DomainSchema): SchemaGraph {
  const stateNames = Object.keys(schema.state.fields)
    .filter((name) => !name.startsWith("$"));
  const visibleComputedNames = getVisibleComputedNames(schema);
  const visibleComputedNameSet = new Set(visibleComputedNames);
  const stateNameSet = new Set(stateNames);
  const actionNames = Object.keys(schema.actions);

  const nodes: SchemaGraphNode[] = [
    ...stateNames.map((name) => ({
      id: stateNodeId(name),
      kind: "state" as const,
      name,
    })),
    ...visibleComputedNames.map((name) => ({
      id: computedNodeId(name),
      kind: "computed" as const,
      name,
    })),
    ...actionNames.map((name) => ({
      id: actionNodeId(name),
      kind: "action" as const,
      name,
    })),
  ];

  const dedupe = new Set<string>();
  const edges: SchemaGraphEdge[] = [];

  const pushEdge = (
    from: SchemaGraphNodeId | null,
    to: SchemaGraphNodeId | null,
    relation: SchemaGraphEdgeRelation,
  ): void => {
    if (!from || !to) {
      return;
    }

    const key = `${from}|${relation}|${to}`;
    if (dedupe.has(key)) {
      return;
    }

    dedupe.add(key);
    edges.push({ from, to, relation });
  };

  for (const name of visibleComputedNames) {
    const field = schema.computed.fields[name];
    if (!field) {
      continue;
    }

    for (const dep of field.deps) {
      pushEdge(
        resolveSourceNodeId(dep, schema, visibleComputedNameSet, stateNameSet),
        computedNodeId(name),
        "feeds",
      );
    }
  }

  for (const actionName of actionNames) {
    const action = schema.actions[actionName];
    const actionId = actionNodeId(actionName);

    for (const root of collectMutationRootsFromFlow(action.flow, schema)) {
      if (stateNameSet.has(root)) {
        pushEdge(actionId, stateNodeId(root), "mutates");
      }
    }

    if (!action.available) {
      continue;
    }

    for (const dep of collectExprGetPaths(action.available)) {
      pushEdge(
        resolveSourceNodeId(dep, schema, visibleComputedNameSet, stateNameSet),
        actionId,
        "unlocks",
      );
    }
  }

  return freezeGraph({ nodes, edges });
}

function getVisibleComputedNames(schema: DomainSchema): string[] {
  const computedFields = schema.computed.fields;
  const memo = new Map<string, boolean>();

  const isVisibleComputed = (name: string, visiting: Set<string>): boolean => {
    const cached = memo.get(name);
    if (cached !== undefined) {
      return cached;
    }

    if (visiting.has(name)) {
      return false;
    }

    visiting.add(name);

    const field = computedFields[name];
    if (!field) {
      visiting.delete(name);
      memo.set(name, true);
      return true;
    }

    for (const path of collectExprGetPaths(field.expr)) {
      if (isPlatformDependency(path)) {
        visiting.delete(name);
        memo.set(name, false);
        return false;
      }

      const computedDependency = resolveComputedDependency(path, computedFields);
      if (
        computedDependency !== null
        && !isVisibleComputed(computedDependency, visiting)
      ) {
        visiting.delete(name);
        memo.set(name, false);
        return false;
      }
    }

    visiting.delete(name);
    memo.set(name, true);
    return true;
  };

  return Object.keys(computedFields)
    .filter((name) => isVisibleComputed(name, new Set()));
}

function collectMutationRootsFromFlow(
  flow: CoreFlowNode,
  schema: DomainSchema,
): string[] {
  const roots = new Set<string>();

  const visit = (
    node: CoreFlowNode | undefined,
    callStack: ReadonlySet<string>,
  ): void => {
    if (!node) {
      return;
    }

    switch (node.kind) {
      case "seq":
        node.steps.forEach((step) => visit(step, callStack));
        return;
      case "if":
        visit(node.then, callStack);
        visit(node.else, callStack);
        return;
      case "patch": {
        const root = rootFromPatchPath(node.path);
        if (root) {
          roots.add(root);
        }
        return;
      }
      case "namespacePatch":
        return;
      case "effect": {
        const root = rootFromEffectInto(node.params.into);
        if (root) {
          roots.add(root);
        }
        return;
      }
      case "call": {
        if (callStack.has(node.flow)) {
          return;
        }

        const action = schema.actions[node.flow];
        if (!action) {
          return;
        }

        const nextCallStack = new Set(callStack);
        nextCallStack.add(node.flow);
        visit(action.flow, nextCallStack);
        return;
      }
      case "halt":
      case "fail":
        return;
    }
  };

  visit(flow, new Set());
  return [...roots];
}

function rootFromPatchPath(path: PatchPath): string | null {
  const [head] = path;
  if (!head || head.kind !== "prop" || head.name.startsWith("$")) {
    return null;
  }

  return head.name;
}

function rootFromEffectInto(value: unknown): string | null {
  if (
    typeof value !== "object"
    || value === null
    || (value as { kind?: unknown }).kind !== "lit"
    || typeof (value as { value?: unknown }).value !== "string"
  ) {
    return null;
  }

  return rootFromSemanticPath((value as { value: string }).value);
}

function resolveSourceNodeId(
  dep: string,
  schema: DomainSchema,
  visibleComputedNames: ReadonlySet<string>,
  stateNames: ReadonlySet<string>,
): SchemaGraphNodeId | null {
  const computedDependency = resolveComputedDependency(dep, schema.computed.fields);
  if (
    computedDependency !== null
    && visibleComputedNames.has(computedDependency)
  ) {
    return computedNodeId(computedDependency);
  }

  if (isPlatformDependency(dep)) {
    return null;
  }

  const root = rootFromSemanticPath(dep);
  if (!root || !stateNames.has(root)) {
    return null;
  }

  return stateNodeId(root);
}

function resolveComputedDependency(
  dep: string,
  computedFields: DomainSchema["computed"]["fields"],
): string | null {
  if (Object.prototype.hasOwnProperty.call(computedFields, dep)) {
    return dep;
  }

  if (!dep.startsWith("computed.")) {
    return null;
  }

  const candidate = dep.slice("computed.".length);
  return Object.prototype.hasOwnProperty.call(computedFields, candidate)
    ? candidate
    : null;
}

function rootFromSemanticPath(path: string): string | null {
  const normalized = normalizeSemanticPath(path);
  const withoutDataRoot = normalized.startsWith("data.")
    ? normalized.slice("data.".length)
    : normalized;
  const match = /^([^.[\]]+)/.exec(withoutDataRoot);
  if (!match) {
    return null;
  }

  const [root] = match.slice(1);
  if (!root || root.startsWith("$")) {
    return null;
  }

  return root;
}

function normalizeSemanticPath(path: string): string {
  if (path.startsWith("/")) {
    return path.slice(1).replace(/\//g, ".");
  }

  return path;
}

function isPlatformDependency(dep: string): boolean {
  const normalized = normalizeSemanticPath(dep);
  const withoutDataRoot = normalized.startsWith("data.")
    ? normalized.slice("data.".length)
    : normalized;
  const match = /^([^.[\]]+)/.exec(withoutDataRoot);
  const root = match?.[1] ?? "";
  if (!root.startsWith("$")) {
    return false;
  }

  return !COLLECTION_CONTEXT_ROOTS.has(root);
}

function collectExprGetPaths(expr: CoreExprNode | unknown): string[] {
  const paths: string[] = [];
  const seen = new WeakSet<object>();

  const visit = (node: unknown): void => {
    if (node === null || node === undefined) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    const objectNode = node as Record<string, unknown>;
    if (seen.has(objectNode)) {
      return;
    }
    seen.add(objectNode);

    if (objectNode.kind === "lit") {
      return;
    }

    if (objectNode.kind === "get" && typeof objectNode.path === "string") {
      paths.push(objectNode.path);
      return;
    }

    for (const value of Object.values(objectNode)) {
      visit(value);
    }
  };

  visit(expr);
  return paths;
}

function stateNodeId(name: string): SchemaGraphNodeId {
  return `state:${name}`;
}

function computedNodeId(name: string): SchemaGraphNodeId {
  return `computed:${name}`;
}

function actionNodeId(name: string): SchemaGraphNodeId {
  return `action:${name}`;
}

function freezeGraph(graph: SchemaGraph): SchemaGraph {
  return Object.freeze({
    nodes: Object.freeze(graph.nodes.map((node) => Object.freeze(node))),
    edges: Object.freeze(
      [...graph.edges]
        .sort(compareSchemaGraphEdges)
        .map((edge) => Object.freeze(edge)),
    ),
  });
}

function compareSchemaGraphEdges(
  left: SchemaGraphEdge,
  right: SchemaGraphEdge,
): number {
  return (
    left.from.localeCompare(right.from)
    || left.to.localeCompare(right.to)
    || left.relation.localeCompare(right.relation)
  );
}
