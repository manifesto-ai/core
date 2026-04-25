# MEL Compiler SPEC v0.8.0 (Draft Addendum)

> **Version:** 0.8.0
> **Type:** Draft Addendum
> **Status:** Draft
> **Date:** 2026-04-06
> **Base:** v0.7.0 (REQUIRED - read [SPEC-v0.7.0.md](SPEC-v0.7.0.md) first)
> **Scope:** `SchemaGraph` extraction for projected SDK introspection
> **Compatible with:** Core SPEC v4.0.0, SDK living spec v3.1.0 current surface
> **Related:** [SDK FDR v3.1.0](../../sdk/docs/FDR-v3.1.0.md), ADR-015 Snapshot Ontological Purification

---

## 1. Purpose

This document adds the compiler-side contract for projected schema introspection.

Unless this addendum says otherwise, [SPEC-v0.7.0.md](SPEC-v0.7.0.md) remains the authoritative compiler contract.

The new responsibility introduced here is:

- extract a static projected dependency graph from compiled `DomainSchema`
- align that graph with the SDK projection boundary
- provide stable graph node ids that the SDK can query through typed refs or debug strings

This addendum does not change MEL surface syntax. It only adds a new extracted artifact derived from already compiled schema data.

---

## 2. Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

**Normative Rule IDs:**

| Prefix | Domain |
|--------|--------|
| `SGRAPH-*` | `SchemaGraph` extraction and projection rules |

---

## 3. Relationship to v0.7.0

`SchemaGraph` is derived from compiler artifacts that already exist in v0.7.0:

- computed dependency extraction from `ComputedFieldSpec.deps` (`COMP-DEP-1` through `COMP-DEP-6`)
- action `available when` expressions, which remain pure and state/computed-only per A28
- lowered action flow statements, including patch targets and effect `into:` paths

No new MEL syntax is introduced. The addendum only standardizes a new derived graph artifact over existing compiled schema information.

---

## 4. Public Extraction Contract

```typescript
type SchemaGraphNodeKind = "state" | "computed" | "action";

type SchemaGraphNodeId =
  | `state:${string}`
  | `computed:${string}`
  | `action:${string}`;

type SchemaGraphNode = {
  readonly id: SchemaGraphNodeId;
  readonly kind: SchemaGraphNodeKind;
  readonly name: string;
};

type SchemaGraphEdgeRelation = "feeds" | "mutates" | "unlocks";

type SchemaGraphEdge = {
  readonly from: SchemaGraphNodeId;
  readonly to: SchemaGraphNodeId;
  readonly relation: SchemaGraphEdgeRelation;
};

type SchemaGraph = {
  readonly nodes: readonly SchemaGraphNode[];
  readonly edges: readonly SchemaGraphEdge[];
};

declare function extractSchemaGraph(schema: DomainSchema): SchemaGraph;
```

`SchemaGraphNode.name` is the bare declared top-level field or action name.

`SchemaGraphNode.id` is the kind-prefixed debug identity. The compiler MUST NOT assume cross-kind name uniqueness, so plain names alone are not a valid debug lookup key.

The SDK may add traversal helpers such as `traceUp()` and `traceDown()`, but those helpers are consumer-layer behavior and do not change the compiler-produced node/edge contract.

---

## 5. Graph Semantics

`SchemaGraph` contains exactly three node kinds and three relation kinds.

| Kind | Meaning |
|------|---------|
| `state` | Top-level domain state field |
| `computed` | Top-level projected computed field |
| `action` | Action declaration |

| Relation | Direction | Meaning |
|----------|-----------|---------|
| `feeds` | state/computed -> computed | Source value participates in target computed evaluation |
| `mutates` | action -> state | Action may write the target state field |
| `unlocks` | state/computed -> action | Source value participates in target action availability |

All edges point in the direction of influence. The graph is therefore suitable for downstream impact traversal and upstream cause traversal in consumer layers.

This graph is a static may-affect analysis. If any reachable action path can write a state field, the `mutates` edge exists even if a particular runtime execution would not take that branch.

---

## 6. Extraction Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SGRAPH-1 | MUST | `extractSchemaGraph()` MUST emit one `state` node per top-level domain state field, excluding all `data.$*` platform namespaces |
| SGRAPH-2 | MUST | `extractSchemaGraph()` MUST emit one `computed` node per computed field whose transitive dependency closure is free of any `data.$*` reference |
| SGRAPH-3 | MUST | `extractSchemaGraph()` MUST emit one `action` node per action declaration |
| SGRAPH-4 | MUST | each emitted node MUST carry both bare `name` and kind-prefixed `id`, using `state:<name>`, `computed:<name>`, or `action:<name>` |
| SGRAPH-5 | MUST | for each computed field, the compiler MUST emit a `feeds` edge from every included dependency in `deps` to the computed node |
| SGRAPH-6 | MUST | `feeds` edges MUST use the same dependency roots already extracted under `COMP-DEP-1` through `COMP-DEP-6` |
| SGRAPH-7 | MUST | for each action, the compiler MUST emit a `mutates` edge from the action node to every top-level state field targeted by patch statements reachable in the action flow |
| SGRAPH-8 | MUST | for each action, the compiler MUST also emit a `mutates` edge from the action node to every top-level state field named by an effect statement's `into:` path |
| SGRAPH-9 | MUST | mutation extraction MUST use the root segment of the write target path. Example: `tasks.items[0].done` contributes `state:tasks` |
| SGRAPH-10 | MUST | for each action with `available when`, the compiler MUST emit an `unlocks` edge from every included referenced state/computed node to the action node |
| SGRAPH-11 | MUST | `available when` extraction MUST only consider pure state/computed reads already permitted by v0.7.0 A28 |
| SGRAPH-12 | MUST | `extractSchemaGraph()` MUST exclude nodes for `data.$host`, `data.$mel`, and every other `data.$*` namespace, and MUST exclude any edge whose source or target would be such a node |
| SGRAPH-13 | MUST | computed fields tainted by any transitive `data.$*` dependency MUST be excluded entirely: no node and no edge may be emitted for them |
| SGRAPH-14 | MUST | `extractSchemaGraph()` MUST depend on `DomainSchema` alone and MUST NOT read runtime snapshot state |
| SGRAPH-15 | SHOULD | the emitted node and edge collections SHOULD be deterministic in ordering for a given canonical `DomainSchema` |

---

## 7. Projection Alignment

The graph defined here is a projected introspection artifact, not a full compiler-internal graph.

Projection alignment is required for consistency with SDK public reads:

- `getSnapshot()` excludes `data.$*`
- projected computed values exclude transitive `$*`-tainted computed fields
- `simulate().changedPaths` is defined only over the projected public snapshot

Because of that boundary, the compiler MUST hide all `$*` infrastructure from `SchemaGraph`, including:

- guard-lowering writes into `$mel.guards.*`
- system-value staging slots such as `$mel.sys.*`
- any future compiler or host substrate under `data.$*`

This addendum intentionally treats `SchemaGraph` as domain self-knowledge, not compiler implementation leakage.

---

## 8. Debug Node Id Format

The canonical user-facing introspection path is ref-based lookup in the SDK:

- `instance.MEL.state.tasks`
- `instance.MEL.computed.todoCount`
- `instance.MEL.actions.createTask`

String lookup remains a debug and REPL convenience only. When used, the string format is fixed:

- `state:<name>`
- `computed:<name>`
- `action:<name>`

Plain names are not a valid debug id format for this contract.

---

## 9. Example

Given:

```mel
state {
  tasks: Array<Task> = []
}

computed activeTasks = filter(tasks, isNull($item.deletedAt))
computed todoCount = len(activeTasks)

action createTask(task: Task) {
  onceIntent {
    patch tasks = append(tasks, task)
  }
}

action finalize() available when gt(todoCount, 0) {
  stop
}
```

`extractSchemaGraph()` emits:

```json
{
  "nodes": [
    { "id": "state:tasks", "kind": "state", "name": "tasks" },
    { "id": "computed:activeTasks", "kind": "computed", "name": "activeTasks" },
    { "id": "computed:todoCount", "kind": "computed", "name": "todoCount" },
    { "id": "action:createTask", "kind": "action", "name": "createTask" },
    { "id": "action:finalize", "kind": "action", "name": "finalize" }
  ],
  "edges": [
    { "from": "state:tasks", "to": "computed:activeTasks", "relation": "feeds" },
    { "from": "computed:activeTasks", "to": "computed:todoCount", "relation": "feeds" },
    { "from": "action:createTask", "to": "state:tasks", "relation": "mutates" },
    { "from": "computed:todoCount", "to": "action:finalize", "relation": "unlocks" }
  ]
}
```

---

## 10. Invariants

- `SchemaGraph` is schema-derived, never snapshot-derived.
- `SchemaGraph` is projected and MUST NOT leak `$*` substrate.
- `feeds`, `mutates`, and `unlocks` are the only public relation kinds in v0.8.0.
- Debug string ids are kind-prefixed because cross-kind uniqueness is not assumed.

---

## 11. References

- [Compiler Version Index](VERSION-INDEX.md)
- [Compiler SPEC v0.7.0](SPEC-v0.7.0.md)
- [SDK SPEC (Living)](../../sdk/docs/sdk-SPEC.md)
- [SDK FDR v3.1.0](../../sdk/docs/FDR-v3.1.0.md)
- [Core SPEC v4.0.0](../../core/docs/core-SPEC.md)
