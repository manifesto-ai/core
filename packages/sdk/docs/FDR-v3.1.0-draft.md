# Manifesto SDK - Foundational Design Rationale (FDR)

> **Version:** 3.1.0
> **Status:** Draft
> **Purpose:** Document the rationale for projected additive SDK introspection APIs
> **Scope:** SDK, with compiler-produced schema graph metadata consumed by the SDK
> **Related:** ADR-015 Snapshot Ontological Purification, PROJ-COMP-1/2, Core `explain()`, Core `computeSync()`, Core `applySystemDelta()`
> **Changelog:**
> - v3.1.0: `SchemaGraph` projected static introspection and `simulate()` full-transition pure dry-run projection

---

## Scope

This document is the draft rationale track for projected additive SDK v3.1.0 introspection work.

The current normative SDK contract lives in [`sdk-SPEC.md`](sdk-SPEC.md). The living spec now stages the accepted v3.1.0 introspection additions; this document remains the rationale companion for why those additions exist and how the design was chosen.

---

## Table of Contents

1. [FDR-SDK-001: SchemaGraph - Schema-level Static Introspection](#fdr-sdk-001-schemagraph---schema-level-static-introspection)
2. [FDR-SDK-002: Simulate - Pure Dry-Run via Core Determinism](#fdr-sdk-002-simulate---pure-dry-run-via-core-determinism)
3. [Appendix: Manifesto Introspection API Summary](#appendix-manifesto-introspection-api-summary)

---

## FDR-SDK-001: SchemaGraph - Schema-level Static Introspection

> **Status:** Proposed - GO (Rev 4)
> **Date:** 2026-04-06
> **Scope:** Compiler (producer), SDK (consumer)
> **Related:** COMP-DEP-1~6, PROJ-COMP-1/2, Core `explain()`, ADR-015 Snapshot Ontological Purification

### Decision

**The Compiler MUST provide `extractSchemaGraph(schema: DomainSchema): SchemaGraph` that extracts a complete static dependency graph from a compiled DomainSchema. The SDK MUST expose this via `instance.getSchemaGraph()`, computed once at activation time and cached.**

SchemaGraph encodes three edge types, all oriented in the data-flow direction, from source toward downstream effect:

| Edge | Direction | Meaning |
|------|-----------|---------|
| `feeds` | state/computed -> computed | This node's value feeds into the target's computation |
| `mutates` | action -> state | This action's patches modify the target state field |
| `unlocks` | state/computed -> action | This node's value appears in the target action's `available when` condition |

**All edges flow in the direction of influence.** This guarantees a single consistent traversal semantics:

- `traceDown(node)` = "what does this node affect downstream?" - follow outgoing edges transitively
- `traceUp(node)` = "what feeds into or controls this node?" - follow incoming edges transitively

SchemaGraph supports subgraph extraction via `traceUp()` and `traceDown()`. Typed refs from the existing `ActionRef`, `FieldRef`, and `ComputedRef` surface are canonical; kind-prefixed string node ids remain convenience/debug-only.

### Context

#### The Problem

Manifesto's DomainSchema contains all information needed to understand a World's causal structure - computed dependencies, action mutations, availability conditions. However, this information is distributed across `ComputedSpec.fields[*].deps`, `ActionSpec.statements`, and `ActionSpec.available`, requiring consumers to manually traverse and correlate multiple structures.

#### Ablation Evidence

The MEL Self-Reference Ablation (2026-04-06) demonstrated that exposing full MEL source to an agent reasoner improved retry-time decision quality (`predAcc 0.8333` vs `0.6667` baseline). Analysis identified that the benefit came specifically from causal structure - the dependency relationships between fields - not from implementation details like `map`, `cond`, or `coalesce` expressions.

Full MEL consumed about 21K tokens of context window. The causal structure alone requires only hundreds of tokens, roughly a 100x compression with equivalent informational value for agent decision-making.

#### Why Not a New Package?

SchemaGraph is a view over existing DomainSchema data. The Compiler already extracts `deps` for computed fields (COMP-DEP-1~6) and parses `available when` expressions. Extending this extraction to action mutation targets and availability conditions reuses the same `get`-node collection pattern. No new architectural concept is introduced.

### Design

#### Edge Direction Rationale

**All edges point in the direction of data flow / influence propagation.** This is a deliberate design choice over the alternative of pointing edges in the "depends-on" direction.

Why data-flow direction wins:

1. **Traversal semantics are unambiguous.** `traceDown` always means "follow outgoing edges" and `traceUp` always means "follow incoming edges." There is no case where the English name of the edge type disagrees with the traversal direction.
2. **Impact analysis is the primary use case.** Agents and developers most often ask "what happens if I change X?" This is a downstream traversal. Data-flow direction makes this the natural direction.
3. **Consistent with the visual mental model.** In the canonical SchemaGraph visualization (actions at top -> state -> computed tiers -> leaf computed), edges flow top-to-bottom. `traceDown` is visually downward.

Alternative considered and rejected:

| Direction | `traceDown(todoCount)` | Problem |
|-----------|------------------------|---------|
| Data-flow (adopted) | Returns leaf consumers of `todoCount` (if any) | None - traversal matches edge direction |
| Dependency (rejected) | Should return upstream sources, but "down" + outgoing edges point to dependencies = confusion | English meaning of "down" conflicts with dependency direction |

#### SchemaGraph Type

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

type SchemaGraphNodeRef =
  | ActionRef
  | FieldRef<unknown>
  | ComputedRef<unknown>;

type SchemaGraph = {
  readonly nodes: readonly SchemaGraphNode[];
  readonly edges: readonly SchemaGraphEdge[];

  /**
   * Return the subgraph of all upstream nodes that feed into the given node.
   * Follows incoming edges transitively.
   *
   * "What does this node depend on? What feeds it? What controls it?"
   */
  traceUp(ref: SchemaGraphNodeRef): SchemaGraph;
  traceUp(nodeId: SchemaGraphNodeId): SchemaGraph;

  /**
   * Return the subgraph of all downstream nodes affected by the given node.
   * Follows outgoing edges transitively.
   *
   * "What does this node affect? What does it feed? What does it unlock?"
   */
  traceDown(ref: SchemaGraphNodeRef): SchemaGraph;
  traceDown(nodeId: SchemaGraphNodeId): SchemaGraph;
};
```

Graph nodes use kind-prefixed ids only for debug lookup and serialization. The canonical SDK lookup surface is the typed ref, whose normative identity is the ref's `name`.

#### Traversal Examples with Edge Directions

Given this MEL:

```mel
state { tasks: Array<Task> = [] }
computed activeTasks = filter(tasks, isNull($item.deletedAt))
computed todoTasks = filter(activeTasks, eq($item.status, "todo"))
computed todoCount = len(todoTasks)
action createTask(task: Task) { onceIntent { patch tasks = append(tasks, task) } }
action finalize() available when gte(todoCount, 0) { ... }
```

Edges produced:

```text
createTask --mutates--> tasks
tasks --feeds--> activeTasks
activeTasks --feeds--> todoTasks
todoTasks --feeds--> todoCount
todoCount --unlocks--> finalize
```

Traversals:

```typescript
// "What does createTask affect?" - follow outgoing edges downstream
graph.traceDown(MEL.actions.createTask);
// -> createTask ->(mutates)-> tasks ->(feeds)-> activeTasks ->(feeds)-> todoTasks
//    ->(feeds)-> todoCount ->(unlocks)-> finalize

// "What feeds into todoCount?" - follow incoming edges upstream
graph.traceUp(MEL.computed.todoCount);
// -> tasks ->(feeds)-> activeTasks ->(feeds)-> todoTasks ->(feeds)-> todoCount

// "What does tasks affect downstream?" - follow outgoing edges
graph.traceDown(MEL.state.tasks);
// -> tasks ->(feeds)-> activeTasks ->(feeds)-> todoTasks ->(feeds)-> todoCount
//    tasks ->(feeds)-> deletedTasks ->(feeds)-> deletedCount

// "What feeds into finalize?" - follow incoming edges upstream
graph.traceUp(MEL.actions.finalize);
// -> tasks ->(feeds)-> activeTasks ->(feeds)-> todoTasks ->(feeds)-> todoCount
//    ->(unlocks)-> finalize
```

Every traversal follows a single direction along edges. No reversal is needed.

#### Extraction Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SGRAPH-1 | MUST | `extractSchemaGraph` MUST produce one `state` node per top-level domain state field, excluding `data.$*` platform namespaces. See SGRAPH-11 |
| SGRAPH-2 | MUST | `extractSchemaGraph` MUST produce one `computed` node per computed field whose transitive dependency closure is free of `data.$*` paths. See SGRAPH-13 |
| SGRAPH-3 | MUST | `extractSchemaGraph` MUST produce one `action` node per action |
| SGRAPH-4 | MUST | For each computed field, `extractSchemaGraph` MUST emit a `feeds` edge **from** each node in its `deps` **to** the computed node |
| SGRAPH-5 | MUST | For each action, `extractSchemaGraph` MUST emit a `mutates` edge **from** the action node **to** each state field targeted by its patch statements **and** by any effect statement's `into:` path |
| SGRAPH-6 | MUST | For each action with `available when`, `extractSchemaGraph` MUST emit an `unlocks` edge **from** each referenced included, non-`$*`, state/computed node **to** the action node |
| SGRAPH-7 | MUST | `traceUp` MUST return a SchemaGraph containing only the transitive upstream sources, following incoming edges, of the given node, plus the node itself and all edges between included nodes |
| SGRAPH-8 | MUST | `traceDown` MUST return a SchemaGraph containing only the transitive downstream targets, following outgoing edges, of the given node, plus the node itself and all edges between included nodes |
| SGRAPH-9 | MUST | SchemaGraph MUST be computed from DomainSchema alone, with no runtime state dependency |
| SGRAPH-10 | SHOULD | SDK SHOULD compute SchemaGraph once at activation time and cache it for the lifetime of the instance |
| SGRAPH-11 | MUST | `extractSchemaGraph` MUST NOT emit nodes for `data.$*` platform-owned state fields (`$host`, `$mel`, or any future `$*` namespace) |
| SGRAPH-12 | MUST | `extractSchemaGraph` MUST NOT emit edges whose source or target would be a `data.$*` path. If a patch statement or effect `into:` path targets a `$*` path, that edge is silently excluded |
| SGRAPH-13 | MUST | `extractSchemaGraph` MUST exclude computed fields whose transitive dependency closure references any `data.$*` path, consistent with PROJ-COMP-1/2. No node or edge is emitted for such computed fields |

#### Mutation Target Extraction

Action mutation targets are extracted from two sources:

**1. Patch statement targets** - the root path segment of each patch target:

```mel
action moveTask(taskId, newStatus) {
  onceIntent {
    patch tasks = map(tasks, ...)
  }
}
```

Patch target path: `tasks` -> emit edge `{ from: "moveTask", to: "tasks", relation: "mutates" }`.

**2. Effect `into:` paths** - the root path segment of each effect's `into:` destination:

```mel
action fetchTasks() {
  once(fetching) {
    patch fetching = $meta.intentId
    effect api.fetch({ url: "/tasks", into: tasks })
  }
}
```

Effect `into:` path: `tasks` -> emit edge `{ from: "fetchTasks", to: "tasks", relation: "mutates" }`.

Both sources produce the same `mutates` edge type. From the SchemaGraph consumer's perspective, there is no distinction between a state field modified by a patch and one modified by an effect's `into:`. Both are state mutations caused by the action.

When an action has `when` guards containing nested patches or effects, all conditionally reachable mutation targets are included. The graph is a static **may-affect** analysis, not a runtime **did-affect** analysis.

#### Available-When Extraction

Available-when conditions are extracted by collecting all `get` node paths in the `available` expression, reusing the same pattern as COMP-DEP-1:

```mel
action refine() available when gt(confidence, 0.5) { ... }
```

Expression references `confidence` -> emit edge `{ from: "confidence", to: "refine", relation: "unlocks" }`.

#### Platform Namespace Exclusion

SchemaGraph represents the **domain-level** causal structure. Platform-owned namespaces (`data.$host`, `data.$mel`, and any `data.$*`) are compiler/host infrastructure - guard markers, system-value slots, session state - not domain semantics. Including them would:

1. **Leak compiler internals.** Every `onceIntent` action would show `mutates -> $mel.guards.intent.*` edges. This exposes the compiler's guard-lowering mechanism, which is an implementation detail the domain consumer should never see.
2. **Create nodes with no domain meaning.** `$mel.sys.__sys__addTask__uuid` is a compiler-generated system-value slot. It has no place in a graph meant to answer "what does my World do?"
3. **Break the projection boundary.** `getSnapshot()` and `simulate().changedPaths` already exclude `data.$*`. SchemaGraph must enforce the same boundary, or consumers would see static edges referencing nodes that never appear in any runtime API.

SGRAPH-11/12/13 align SchemaGraph with the SDK projection boundary established by ADR-015 section 2.8 and PROJ-COMP-1/2. The canonical DomainSchema retains all `$*` information. SchemaGraph is the projected view.

**Practical effect on extraction:** When the compiler encounters `patch $mel.guards.intent.abc123 = $meta.intentId` inside a lowered `onceIntent`, SGRAPH-12 silently drops that edge. The action's domain-level patches, for example `patch tasks = append(tasks, task)`, are still captured. The consumer sees the domain causality without the guard machinery.

#### SDK Surface

```typescript
interface ManifestoBaseInstance<T> {
  // ... existing surface ...

  /** Static dependency graph of this World's schema. Cached at activation time. */
  getSchemaGraph(): SchemaGraph;
}
```

Usage with TypedMEL:

```typescript
const instance = manifesto.activate();

// Full graph
const graph = instance.getSchemaGraph();

// What does moveTask affect downstream?
const downstream = graph.traceDown(instance.MEL.actions.moveTask);

// What feeds into todoCount?
const upstream = graph.traceUp(instance.MEL.computed.todoCount);

// What is downstream of tasks?
const taskImpact = graph.traceDown(instance.MEL.state.tasks);

// What feeds into finalize's availability?
const finalizeUpstream = graph.traceUp(instance.MEL.actions.finalize);
```

### Relationship to Existing Introspection APIs

SchemaGraph completes a three-layer introspection stack:

| Layer | API | Scope | Changes? |
|-------|-----|-------|----------|
| **Static structure** | `getSchemaGraph()` | Schema-level dependency graph | Never (schema-fixed) |
| **Runtime state** | `getAvailableActions()`, `isActionAvailable()` | Current action availability | Per snapshot |
| **Runtime explanation** | `explain(schema, snapshot, path)` | Why a value is what it is | Per snapshot + path |

These three layers together are designated the **Manifesto Introspection API**.

### Rationale

#### Why Compiler, Not SDK?

The Compiler already owns dependency extraction (COMP-DEP-1~6) and expression analysis. Placing `extractSchemaGraph` in the Compiler:

1. Keeps SDK dependency-free from expression analysis internals
2. Reuses existing `get`-node collection logic
3. Follows the same ownership pattern as `ComputedSpec.deps`

SDK consumes the result, caches it, and exposes it - same as it does with `DomainSchema` today.

#### Why Not Guard-Level Granularity?

Action guards (`when` conditions inside action bodies) create conditional mutation paths. Including guard conditions in the graph would require encoding conditional edges, significantly increasing complexity. The initial SchemaGraph uses **may-affect** semantics: if any code path in an action can reach a patch target, the edge exists.

This is a deliberate simplification. Guard-level granularity can be added as a future refinement if proven necessary by real usage.

#### Why Ref-Canonical Querying in `traceUp()` / `traceDown()`?

Making `ActionRef | FieldRef | ComputedRef` the canonical query surface preserves the SDK's zero-string-path discipline while still enabling type-safe subgraph queries via `instance.MEL.*`. The `__kind` discriminant plus the ref's normative `name` gives SchemaGraph enough identity to resolve the projected node unambiguously.

Kind-prefixed string node ids remain useful for debugging, REPL work, and serialized tooling payloads, but they are intentionally secondary. Keeping strings as convenience/debug-only avoids promoting two equal public lookup surfaces that must be maintained forever.

#### Why "feeds" Instead of "depends"?

"A depends on B" naturally points from A to B, consumer to source. This is the reverse of data-flow direction. Using "depends" would require either:

- edges pointing against data-flow, which breaks traversal intuition
- or `depends` edges pointing in data-flow direction, which breaks English meaning

`feeds` resolves this: "`tasks` feeds `activeTasks`" is both English-correct and data-flow-aligned. Similarly, `unlocks` replaces `enables` for clarity: "`confidence` unlocks `finalize`" reads naturally in the data-flow direction.

### Consequences

| Enables | Constrains |
|---------|------------|
| Agent self-model at about 100x compression vs full MEL | SchemaGraph is may-affect, not did-affect |
| Studio auto-visualization of World structure | Guard-level edges deferred |
| Cross-world causal reasoning in Federation | Schema changes require SchemaGraph recomputation |
| Impact analysis without reading MEL source | |
| LLM knowledge packages (`@manifesto-ai/skills`) | |
| Automated testing boundary detection | |

#### Canonical Statement

> **SchemaGraph is the projected static dependency graph of a DomainSchema. It contains only domain-level nodes and edges; platform-owned `$*` paths are excluded. All edges flow in the direction of influence: `feeds` (data propagation), `mutates` (action effect), `unlocks` (availability control). `traceDown` follows influence forward; `traceUp` follows it backward. This is the World's self-knowledge at rest.**

---

## FDR-SDK-002: Simulate - Pure Dry-Run via Core Determinism

> **Status:** Proposed - GO (Rev 2)
> **Date:** 2026-04-06
> **Scope:** SDK
> **Related:** Core `computeSync()`, `apply()`, `applySystemDelta()`, FDR-C001 Pure Compute Equation, ADR-015 Snapshot Ontological Purification

### Decision

**The SDK MUST expose `instance.simulate(actionRef, input?)` as a public convenience method that performs a pure dry-run of an action against the current snapshot without committing the result.**

Simulate does not introduce new computation semantics. It is a projection of Core's existing `computeSync()` + `apply()` + `applySystemDelta()` through the SDK's public surface, returning enriched results suitable for agent and developer consumption.

### Context

#### The Problem

Core's `computeSync()` is pure - same inputs always produce the same outputs, with no side effects. This means any `computeSync()` call is inherently a simulation: it produces a new snapshot without modifying the current one.

However, `computeSync()` is a Core-level API not exposed on the SDK's public surface. SDK consumers, agents, application code, and developer tools, currently cannot perform dry-runs without importing Core directly and manually constructing the required parameters: schema, snapshot, intent, and host context.

#### Why This Is Valuable

An agent deciding between actions needs to predict outcomes. Without simulation, the agent must either:

1. Reason abstractly about effects, which is error-prone and requires full MEL comprehension
2. Actually execute and observe, which is irreversible and consumes real resources

With simulation, the agent can evaluate multiple candidate actions, compare their outcomes, and choose optimally - analogous to Monte Carlo Tree Search on a Manifesto World.

#### Core Contract Requirements

The current Core v4.0.0 contract mandates the following sequence for a complete state transition:

```text
computeSync() -> ComputeResult { patches, systemDelta, trace, status }
apply(schema, snapshot, patches, context) -> Snapshot  (data + computed only)
applySystemDelta(snapshot, systemDelta) -> Snapshot     (system fields)
```

`apply()` without `applySystemDelta()` produces an incomplete snapshot - `system.status` and `system.lastError` may be stale or incorrect. `simulate()` MUST apply both to produce a valid simulated snapshot.

`ComputeResult.status` is `"complete" | "pending" | "halted" | "error"`. All four values MUST be reflected in `SimulateResult`.

### Design

#### Signature

```typescript
interface ManifestoBaseInstance<T> {
  // ... existing surface ...

  /** Pure dry-run: compute the result of an action without committing. */
  simulate<K extends keyof T["actions"]>(
    actionRef: TypedActionRef<T, K>,
    ...args: CreateIntentArgs<T, K>
  ): SimulateResult<T>;
}
```

#### SimulateResult Type

```typescript
type SimulateResult<T extends ManifestoDomainShape = ManifestoDomainShape> = {
  /** The projected snapshot that would result from this action. */
  readonly snapshot: Snapshot<T["state"]>;

  /**
   * Inspection/debug-only paths whose values differ from the current projected
   * snapshot. Results are sorted deterministically.
   */
  readonly changedPaths: readonly string[];

  /** Actions that would be available after this action. */
  readonly newAvailableActions: readonly (keyof T["actions"])[];

  /** Effect requirements that this action would produce (empty if pure). */
  readonly requirements: readonly Requirement[];

  /** Compute status - mirrors Core `ComputeResult.status` exactly. */
  readonly status: "complete" | "pending" | "halted" | "error";

  /** Optional debug-grade dry-run diagnostics. */
  readonly diagnostics?: SimulationDiagnostics;
};

type SimulationDiagnostics = {
  readonly trace: TraceGraph;
};
```

#### Behavioral Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SIM-1 | MUST | `simulate` MUST NOT modify the instance's current snapshot |
| SIM-2 | MUST | `simulate` MUST apply both `core.apply()` and `core.applySystemDelta()` to produce the simulated snapshot, matching the complete Core transition contract |
| SIM-3 | MUST | `simulate` MUST project the simulated snapshot through the same SDK projection used by `getSnapshot()`, excluding `data.$host`, `data.$mel`, and all `data.$*` platform namespaces |
| SIM-4 | MUST | `SimulateResult.status` MUST mirror `ComputeResult.status` exactly, including the `halted` value |
| SIM-5 | MUST | `changedPaths` MUST be computed by diffing the projected, public, simulated snapshot against the projected current snapshot, and the returned paths MUST be sorted deterministically. `changedPaths` is an inspection/debug surface, not the canonical branching API |
| SIM-6 | MUST | `newAvailableActions` MUST reflect availability evaluated against the canonical simulated snapshot, since `available when` may reference `data.$*` fields internally even though those fields are excluded from the projected snapshot |
| SIM-7 | MUST | `simulate` MUST throw `ManifestoError` with code `ACTION_UNAVAILABLE` if the action is not available against the current snapshot |
| SIM-8 | MUST | `simulate` MUST use the same `HostContext` construction as `dispatchAsync` for determinism |
| SIM-9 | MUST | if `diagnostics` is present, `diagnostics.trace` MUST equal the Core `ComputeResult.trace` from the same admitted dry-run compute pass |
| SIM-10 | MUST | the presence or absence of diagnostics MUST NOT change legality, snapshot projection, status, requirements, changed paths, or new available actions |

#### Implementation

```typescript
simulate(actionRef, ...args) {
  const actionName = actionRef.name;

  // SIM-7: Check availability first
  if (!core.isActionAvailable(this._schema, this._canonicalSnapshot, actionName)) {
    throw new ManifestoError("ACTION_UNAVAILABLE", `Action "${actionName}" is not available`);
  }

  const intent = this.createIntent(actionRef, ...args);
  const context = this._buildHostContext();

  // Core compute - pure, no side effects
  const result = core.computeSync(this._schema, this._canonicalSnapshot, intent, context);

  // SIM-2: Apply BOTH patches AND systemDelta for a complete snapshot
  const afterPatches = core.apply(this._schema, this._canonicalSnapshot, result.patches, context);
  const canonicalSimulated = core.applySystemDelta(afterPatches, result.systemDelta);

  // SIM-3: Project through the same lens as getSnapshot()
  const projectedSimulated = this._project(canonicalSimulated);
  const projectedCurrent = this.getSnapshot();

  // SIM-5: Diff projected snapshots only - no $* leakage
  const changedPaths = diffProjectedPaths(projectedCurrent, projectedSimulated);

  // SIM-6: Availability against canonical (may reference $* internally)
  const newAvailableActions = core.getAvailableActions(this._schema, canonicalSimulated);

  return {
    snapshot: projectedSimulated,
    changedPaths,
    newAvailableActions,
    requirements: result.systemDelta.addRequirements,
    status: result.status,
  };
}
```

#### `diffProjectedPaths` Semantics

`diffProjectedPaths` compares two projected snapshots, post-`_project()`, and returns sorted paths where values differ:

- Compares `data.*`, excluding `data.$*`, already removed by projection
- Compares `computed.*`, excluding `$*`-tainted computed values, already removed by PROJ-COMP-1/2
- Compares the projected `system.*` surface
- Compares the projected `meta.*` surface, which is currently only `meta.schemaHash`
- Uses structural deep equality

This guarantees that `changedPaths` only contains paths visible to the SDK consumer, matching the same boundary enforced by `getSnapshot()`. It is suitable for explanation, preview, and logging, but not as the canonical API for programmatic branching.

#### Halted Status Semantics

`halted` occurs when Core encounters a `stop` `FlowNode`, the action's flow explicitly halted without error. In simulation context:

- `complete`: action ran to completion, all patches applied, no pending effects
- `pending`: action produced effect requirements; `requirements` array is non-empty
- `halted`: action's flow hit a `stop` node; patches up to that point are applied
- `error`: action's flow hit a `fail` node; `snapshot.system.lastError` reflects the failure

All four statuses produce a valid simulated snapshot. The consumer decides how to interpret each status for their planning purpose.

### Rationale

#### Why SDK, Not Core?

Core already has `computeSync()`. Adding `simulate()` to Core would duplicate semantics. The value of `simulate()` is in the **ergonomic enrichment**: projected snapshot, changed paths, new available actions - all computed from Core primitives but assembled at the SDK level where instance context exists.

#### Why Not Just Document `computeSync()`?

Three reasons:

1. **Surface gap:** `computeSync()` is not on the SDK public surface. Exposing it would leak Core's API contract into SDK consumers.
2. **Ergonomic gap:** `computeSync()` requires manual schema, snapshot, and context construction. `simulate()` uses the instance's current state.
3. **Semantic clarity:** `simulate()` communicates intent - "I want to see what would happen." `computeSync()` communicates mechanism - "compute a state transition."

#### Why Diff Projected, Not Canonical?

If `changedPaths` included canonical-only paths like `data.$mel.guards.intent.*`, every `onceIntent`-bearing action would report guard marker changes - internal compiler infrastructure, not domain semantics. The consumer would need to filter these out manually, violating the SDK's projection boundary.

By diffing projected snapshots, `changedPaths` reports only domain-meaningful changes, consistent with the same boundary the consumer sees via `getSnapshot()`.

#### Why Include `changedPaths` At All?

SchemaGraph provides static **may-affect** analysis. `changedPaths` provides runtime **did-affect** analysis for a specific action with specific inputs. The comparison between the two is itself valuable:

- SchemaGraph says "moveTask may affect `activeTasks`, `todoTasks`, `todoCount`, ..."
- `simulate("moveTask", { taskId: "1", newStatus: "done" })` says "this specific call actually changed: `tasks`, `activeTasks`, `todoTasks`, `todoCount`, `doneTasks`, `doneCount`"

The difference reveals which static edges were actually exercised - useful for agent learning and debugging.

### Consequences

| Enables | Constrains |
|---------|------------|
| Agent MCTS-style action planning | Effect-bearing actions return partial results (`pending`) |
| Developer preview of action outcomes | Simulation uses point-in-time snapshot and may diverge from real execution under concurrency |
| Testing without side effects | `diffProjectedPaths` adds minor compute cost |
| Impact comparison: static (SchemaGraph) vs runtime (simulate) | |
| Safe exploration of `halted` and `error` outcomes | |

#### Canonical Statement

> **`simulate()` is a pure dry-run that leverages Core's determinism. It applies the full Core transition contract - `computeSync` + `apply` + `applySystemDelta` - and projects the result through the SDK's public boundary. The current snapshot is never modified. All four Core statuses - `complete`, `pending`, `halted`, `error` - are faithfully reflected.**

---

## Appendix: Manifesto Introspection API Summary

The following APIs collectively form the **Manifesto Introspection API**:

| API | Owner | Input | Output | Scope |
|-----|-------|-------|--------|-------|
| `getSchemaGraph()` | SDK (Compiler-produced) | None (cached) | `SchemaGraph` | Static structure |
| `traceUp(ref)` | SchemaGraph method | Node ref or debug node id | Subgraph of ancestors | Static structure |
| `traceDown(ref)` | SchemaGraph method | Node ref or debug node id | Subgraph of descendants | Static structure |
| `simulate(action, input)` | SDK | Action + input | `SimulateResult` | Runtime dry-run |
| `explain(schema, snapshot, path)` | Core | Path | `ExplainResult` | Runtime explanation |
| `getAvailableActions(schema, snapshot)` | Core | None (current snapshot) | `string[]` | Runtime availability |
| `isActionAvailable(schema, snapshot, name)` | Core | Action name | `boolean` | Runtime availability |

Together, these enable any consumer - agent, developer, tool, or other World - to understand a Manifesto World's structure, predict action outcomes, and explain current state without reading MEL source.
