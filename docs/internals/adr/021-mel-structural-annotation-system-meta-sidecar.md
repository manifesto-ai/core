# ADR-021: MEL Structural Annotation System — `@meta` Sidecar

> **Status:** Accepted
> **Date:** 2026-04-15
> **Deciders:** 정성우 (Architect), Manifesto Architecture Team
> **Scope:** Compiler (MEL language surface + output contract)
> **Related ADRs:** ADR-001 (Layer Separation), ADR-006 (PUB/CHAN/CAN — schema hash identity), ADR-018 (Public Snapshot Boundary), ADR-020 (Intent-Level Dispatchability)
> **Related SPECs:** Compiler SPEC v1.0.0, Core SPEC v4.2.0, SDK SPEC v3.x
> **Breaking:** No — additive MEL syntax; Core/Host/SDK runtime layers unchanged

> **Current Contract Status:** Accepted. The current compiler spec and maintained MEL docs now define the v1 annotation-sidecar contract. `action_param` remains deferred pending a separate grammar decision.

---

## 1. Context

### 1.1 The Problem

MEL describes pure domain semantics: state, computed, actions, guards. This is sufficient for Core to compute and Host to execute. However, external consumers — UI renderers, test harnesses, documentation generators, analytics SDKs, accessibility tools — need supplementary metadata that MEL's semantic layer does not and should not express.

Examples of consumer needs:

- A UI renderer needs to know "this action should surface as a drag-drop interaction"
- A test runner needs to know "skip this action in smoke tests"
- A documentation generator needs to know "this computed is the primary metric"

Currently there is no standard mechanism for attaching this metadata. Consumers either hardcode knowledge about specific MEL structures or rely on ad-hoc conventions that are invisible to the compiler.

### 1.2 The Constraint

Manifesto's architecture enforces strict boundaries:

- `DomainSchema` hash is semantic identity (ADR-006 CAN-3, CAN-4)
- Core computes purely over `DomainSchema` — no IO, no UI knowledge, no external concerns
- `compute()`, `available`, `dispatchable`, and schema hash must be impervious to non-semantic changes
- The harness engineering principle: safety through structural impossibility, not behavioral prohibition

Any metadata system must respect these boundaries absolutely.

### 1.3 What This Is

This is not a UI annotation system. It is a **generic, namespace-blind structural annotation infrastructure** for MEL. `ui:*` is one consumer convention that may be built on top of it, alongside `test:*`, `analytics:*`, `doc:*`, or any future namespace. The annotation system itself is agnostic to all of them.

---

## 2. Decision

### 2.1 MEL Syntax

Annotations use the `@meta` keyword with a string-literal tag and optional literal payload:

```mel
@meta("namespace:kind")
@meta("namespace:kind", { key: "value", size: 42, enabled: true })
```

Annotations attach to the MEL construct that immediately follows them:

```mel
@meta("ui:drag-drop")
@meta("ui:context-menu")
action moveTask(taskId: string, newStatus: Status)
  available when gt(taskCount, 0) {
  ...
}

@meta("ui:current-tasks")
computed currentVisibleTasks = cond(...)

@meta("test:skip")
action dangerousReset() { ... }
```

The tag is an opaque string to the compiler. The `namespace:kind` convention is a consumer-level pattern, not a compiler-enforced structure. The compiler does not parse, validate, or interpret the tag contents.

### 2.2 Attachable Targets

Annotations may attach to:

| MEL Construct | Example |
|---------------|---------|
| `domain` | `@meta("doc:description", { summary: "Task management" })` |
| `type` | `@meta("doc:entity")` on a named type |
| type field | `@meta("ui:hidden")` on a field within a type |
| `state` field | `@meta("analytics:track")` on a state field |
| `computed` | `@meta("ui:primary-metric")` on a computed |
| `action` | `@meta("ui:button")` on an action |
| action parameter | `@meta("ui:date-picker")` on an action param |

The compiler validates that `@meta` appears only in these positions. Floating annotations (not attached to a construct) are a syntax error.

### 2.3 Compiler Output — Out-of-Schema Sidecar

The compiler emits annotations as a **separate sidecar**, never inside `DomainSchema`:

```typescript
type DomainModule = {
  schema: DomainSchema;          // Core/SDK — zero annotation traces
  graph: SchemaGraph;            // Studio — zero annotation traces
  annotations: AnnotationIndex;  // External consumers only
};
```

```typescript
type AnnotationIndex = {
  schemaHash: string;
  entries: Record<LocalTargetKey, Annotation[]>;
};

// LocalTargetKey = "{kind}:{name}"
// kind ∈ { "domain", "type", "type_field", "state_field",
//          "computed", "action", "action_param" }
type LocalTargetKey = string;

type Annotation = {
  tag: string;                   // opaque — e.g. "ui:button", "test:skip"
  payload?: JsonLiteral;         // optional, JSON-like literal only
};

type JsonLiteral =
  | string | number | boolean | null
  | JsonLiteral[]
  | { [key: string]: JsonLiteral };
```

### 2.4 Local Target Key Grammar

Target keys follow this grammar:

```
LocalTargetKey ::= Kind ":" Name
                 | Kind ":" ParentName "." ChildName

Kind ::= "domain" | "type" | "type_field" | "state_field"
       | "computed" | "action" | "action_param"
```

Examples:

```
domain:TaskBoard
type:Task
type_field:Task.title
type_field:Task.status
state_field:tasks
state_field:filter
computed:currentVisibleTasks
action:createTask
action_param:createTask.title
```

`Kind` is a closed set matching MEL's structural constructs. `Name` mirrors `DomainSchema` key structure. Dotted names are used only for child constructs (type fields, action parameters) — nesting beyond one level is not permitted in v1.

The compiler validates that every emitted `LocalTargetKey` corresponds to an existing construct in the emitted `DomainSchema`. A dangling target key (referencing a renamed or removed construct) is a compile error.

### 2.5 Payload Constraints

**v1 payload is JSON-like literal only.**

Permitted: strings, numbers, booleans, null, arrays of literals, objects of literals. Maximum nesting depth: 2 levels.

```mel
// Permitted
@meta("ui:button", { variant: "primary", size: "lg" })
@meta("ui:column", { order: 3 })

// Forbidden — MEL expression
@meta("ui:button", { disabled: eq(len(items), 0) })

// Forbidden — MEL path reference
@meta("ui:button", { labelFrom: computed.taskCount })

// Forbidden — depth > 2
@meta("ui:card", { config: { pricing: { free: "$0" } } })
```

**Permanent prohibition:** MEL expressions, runtime predicates, guard references, and any construct requiring semantic evaluation.

**v1 prohibition, future extension reserved:** Structured target references (payload values that point to other MEL constructs by `LocalTargetKey`). If consumer evidence demonstrates a need, this may be opened in a future ADR without violating the permanent prohibitions above.

---

## 3. Normative Rules

| ID | Rule | Scope |
|----|------|-------|
| META-1 | **Namespace-blind compiler.** The compiler does not parse, validate, or interpret annotation tag contents. All tags are opaque strings. | Permanent |
| META-2 | **Out-of-schema sidecar.** Annotations exist only in `AnnotationIndex`, never in `DomainSchema` or `SchemaGraph`. | Permanent |
| META-3 | **Zero semantic influence.** Annotation presence or absence does not affect `DomainSchema`, schema hash, `SchemaGraph`, `compute()`, `available`, `dispatchable`, or any runtime behavior. | Permanent |
| META-4 | **Tooling-only artifact.** `DomainModule` is a tooling artifact. Runtime entry points (`createManifesto()`, Core, SDK) accept `DomainSchema` only. `DomainModule` must never become a runtime input. | Permanent |
| META-5 | **Schema-structural target.** `LocalTargetKey` uses `{kind}:{name}` format. `schemaHash` scopes the entire `AnnotationIndex`. Compiler validates target existence. | v1 (opaque stable id reserved for future evaluation) |
| META-6 | **Literal-only payload.** Payload is JSON-like literal only. MEL expressions and semantic references are permanently forbidden. Structured target references are reserved for future extension. | v1 payload constraint; permanent expression prohibition |
| META-7 | **Consumer-owned semantic validation.** Namespace/kind/payload semantic correctness is the responsibility of consumers, LSP plugins, or external validators. | Permanent |

---

## 4. Invariants (CI-Enforced)

These invariants must be tested in CI. Failure of any invariant is a release blocker.

| ID | Invariant |
|----|-----------|
| INV-META-1 | `DomainSchema` emitted with annotations present is byte-identical to `DomainSchema` emitted after stripping all `@meta` from MEL source. |
| INV-META-2 | `SchemaGraph` emitted with annotations present is identical to `SchemaGraph` emitted after stripping all `@meta`. |
| INV-META-3 | For any snapshot and intent, `compute()` results are identical regardless of annotation presence. |
| INV-META-4 | For any snapshot, `getAvailableActions()` returns identical results regardless of annotation presence. |
| INV-META-5 | For any snapshot and intent, `isIntentDispatchable()` returns identical results regardless of annotation presence. |
| INV-META-6 | `DomainModule` is not accepted by `createManifesto()` or any runtime entry point. Only `DomainSchema` is accepted. |

---

## 5. Consumer Binding Model

Annotations serve as **binding points** — when a consumer sees `@meta("ui:button")` on an action, it can look up that action's full semantic context directly from `DomainSchema`:

- `action.available` — a legality signal that consumers may use for visibility/reachability decisions
- `action.dispatchable` — a legality signal that consumers may use for interactability decisions
- `action.input` / `action.inputType` — parameter structure for form generation
- `computed` type information — data shape for rendering strategy

**Critical distinction:** `available` and `dispatchable` are **legality signals**, not UI policies. Whether `available = false` means "hide the button" or "show it grayed out" is a consumer rendering decision, not a MEL-level truth. The current contract defines availability as coarse action-family legality and dispatchability as fine intent-level legality (ADR-020). Consumers interpret these signals according to their own policies.

**Loading state:** How a consumer determines whether an action is currently executing depends on the consumer's runtime surface. The generic annotation system does not prescribe or assume access to any specific canonical substrate field (e.g., `system.currentAction`). Consumers using projected `getSnapshot()` and consumers with canonical access may use different strategies. This is consumer implementation territory.

This binding model means annotations do not need to carry cross-references like `disabledFrom`, `labelFrom`, or `loadingFrom`. The annotation declares the binding point; the `DomainSchema` already holds the semantic facts at that point.

---

## 6. Non-Goals

This ADR does **not:**

- Define any namespace vocabulary (`ui:*`, `test:*`, etc.). These are consumer conventions.
- Prescribe UI rendering behavior or policy.
- Change Core, Host, SDK, Lineage, or Governance contracts.
- Change `DomainSchema` structure or schema hash computation.
- Change `SchemaGraph` structure or content.
- Introduce a Consumer Projection Spec or assembly layer. Consumer assembly of multiple semantic constructs into composite widgets is consumer implementation responsibility. This ADR does not prohibit future consumer-side assembly contracts but does not include them.
- Introduce namespace registry or schema validation infrastructure (future LSP/plugin scope).

---

## 7. Consequences

### 7.1 Positive

1. MEL gains a standard mechanism for external metadata without polluting semantic identity.
2. Erasability is structurally guaranteed — not a policy, but an architectural impossibility of contamination.
3. Any tooling ecosystem can build conventions on top of the same infrastructure.
4. Computed chains + `available when` + `dispatchable when` remain the sole source of semantic facts. Annotations cannot create shadow semantics.
5. The `DomainModule` boundary prevents annotation from becoming a runtime dependency path.

### 7.2 Trade-offs

1. Consumer assembly (composing multiple semantic constructs into one widget) has no compiler-enforced contract. This is intentional — consumers own their interpretation — but means assembly errors are caught at consumer level, not compile time.
2. `LocalTargetKey` is name-based; renames require annotation updates. LSP rename integration mitigates this but does not eliminate it for external artifacts.
3. Namespace-blind compiler means annotation tag typos pass silently. Consumer-side or LSP-plugin validation is required for strictness.

### 7.3 Deferred Decisions

| Item | Precondition | Timing |
|------|-------------|--------|
| Structured target references in payload | Consumer evidence of need | Future ADR |
| Namespace schema registry | Multiple consumers with validated vocabularies | Future LSP/plugin work |
| Opaque stable target id | External annotation bundles requiring rename resilience | Future ADR if evidence warrants |
| Consumer Projection Spec | Assembly errors demonstrably unacceptable at consumer level | Future ADR if evidence warrants |
| Nested dotted target keys beyond one level | Deeply nested type structures in practice | Future extension |

---

## 8. Worked Example

```mel
domain TaskBoard {
  type Task = {
    id: string,
    title: string,
    status: "todo" | "doing" | "done",
    deletedAt: number | null
  }

  state {
    tasks: Task[] = []
    viewMode: "board" | "list" | "calendar" = "board"
    selectedTaskId: string | null = null
    clock: ClockStamp | null = null
  }

  computed activeTasks = filter(tasks, isNull($item.deletedAt))
  computed deletedTasks = filter(tasks, isNotNull($item.deletedAt))
  computed deletedCount = len(deletedTasks)
  computed todoTasks = filter(activeTasks, eq($item.status, "todo"))
  computed doneTasks = filter(activeTasks, eq($item.status, "done"))
  computed overdueTasks = cond(
    isNull(clock), [],
    filter(activeTasks, lt($item.dueDateTimestamp, clock.todayStartTs))
  )

  @meta("ui:current-tasks")
  computed currentVisibleTasks = cond(
    eq(viewMode, "board"), activeTasks,
    eq(viewMode, "list"), activeTasks,
    []
  )

  @meta("ui:selected-task")
  computed selectedTask = findById(tasks, selectedTaskId)

  @meta("ui:button")
  action createTask(task: Task, stamp: ClockStamp)
    available when true {
    onceIntent {
      patch tasks = append(tasks, task)
      patch clock = stamp
    }
  }

  @meta("ui:drag-drop")
  @meta("ui:context-menu")
  action moveTask(taskId: string, newStatus: "todo" | "doing" | "done")
    available when gt(len(activeTasks), 0) {
    when isNull(findById(tasks, taskId)) {
      fail "NOT_FOUND"
    }
    onceIntent when isNotNull(findById(tasks, taskId)) {
      patch tasks = updateById(tasks, taskId, { status: newStatus })
    }
  }

  @meta("ui:confirm", { variant: "destructive" })
  action deleteTask(taskId: string, stamp: ClockStamp)
    available when gt(len(activeTasks), 0) {
    when isNull(findById(tasks, taskId)) {
      fail "NOT_FOUND"
    }
    onceIntent when isNotNull(findById(tasks, taskId)) {
      patch tasks = updateById(tasks, taskId, { deletedAt: stamp.now })
      patch clock = stamp
    }
  }

  @meta("ui:button")
  action emptyTrash(stamp: ClockStamp)
    available when gt(deletedCount, 0) {
    onceIntent {
      patch tasks = filter(tasks, isNull($item.deletedAt))
      patch clock = stamp
    }
  }

  @meta("ui:button", { role: "view-change" })
  action changeView(mode: "board" | "list" | "calendar", stamp: ClockStamp) {
    onceIntent {
      patch viewMode = mode
      patch clock = stamp
    }
  }
}
```

**What a UI consumer sees:**

1. `@meta("ui:button")` on `emptyTrash` → render a button. Check `action.available` (`gt(deletedCount, 0)`) as legality signal. Action has `available when`, so consumer knows when to disable/hide based on its own policy.
2. `@meta("ui:drag-drop")` + `@meta("ui:context-menu")` on `moveTask` → two interaction paths for the same action. Both use the same `action.available` and `action.input`.
3. `@meta("ui:current-tasks")` on `currentVisibleTasks` → this computed is the main data source. Consumer reads its type (`Task[]`) from `DomainSchema` and renders accordingly.
4. `@meta("ui:confirm", { variant: "destructive" })` on `deleteTask` → render with confirmation dialog, destructive styling. The semantic guard (`available when`) is still the source of truth for when the action is reachable.
5. Actions and computed without `@meta` → consumer decides whether to render based on its own defaults and conventions.

**What the compiler emits as `AnnotationIndex`:**

```json
{
  "schemaHash": "a7f3c2",
  "entries": {
    "computed:currentVisibleTasks": [
      { "tag": "ui:current-tasks" }
    ],
    "computed:selectedTask": [
      { "tag": "ui:selected-task" }
    ],
    "action:createTask": [
      { "tag": "ui:button" }
    ],
    "action:moveTask": [
      { "tag": "ui:drag-drop" },
      { "tag": "ui:context-menu" }
    ],
    "action:deleteTask": [
      { "tag": "ui:confirm", "payload": { "variant": "destructive" } }
    ],
    "action:emptyTrash": [
      { "tag": "ui:button" }
    ],
    "action:changeView": [
      { "tag": "ui:button", "payload": { "role": "view-change" } }
    ]
  }
}
```

`DomainSchema` and `SchemaGraph` contain zero traces of these annotations.

---

## 9. Implementation Scope

### 9.1 Compiler API Surface

`DomainModule` exposure MUST be additive to the existing compiler API. `compile()` / `compileMelDomain()` continue to return `DomainSchema` as before. A new entry point (e.g., `compileMelModule()`) or an additive field on the existing result provides access to `AnnotationIndex`. Existing consumers that only read `schema` are unaffected.

### 9.2 Compiler Changes

| Component | Change |
|-----------|--------|
| Parser | Recognize `@meta(...)` preceding attachable constructs |
| Analyzer | Validate attachment position, payload literal-only, depth ≤ 2 |
| Emitter | Emit `AnnotationIndex` as sidecar in `DomainModule` |
| Target validation | Verify every `LocalTargetKey` maps to an existing `DomainSchema` entry |

### 9.3 Pre-Implementation Grammar Decision

`action_param` is listed as an attachable target (§2.2), but inline parameter annotation grammar is not yet finalized. Before implementation begins, the following must be decided:

- Whether parameter annotations use inline syntax (e.g., `action create(@meta("ui:date-picker") dueDate: ClockStamp)`)
- Or whether `action_param` attachment is deferred to a future version

This is a grammar decision, not an architectural one. The sidecar model supports `action_param` targets regardless of syntax choice.

### 9.4 No Changes Required

| Component | Reason |
|-----------|--------|
| Core | Does not receive `AnnotationIndex` |
| Host | Does not receive `AnnotationIndex` |
| SDK | Runtime entry accepts `DomainSchema` only |
| Lineage | Schema hash computation unchanged |
| Governance | Proposal/approval unchanged |

### 9.5 Downstream Enablement (Not This ADR)

| Consumer | What they build on top |
|----------|----------------------|
| `json-render` | `ui:*` vocabulary and rendering conventions |
| `mel-lsp` | Namespace-specific completion, hover, validation plugins |
| `studio-core` | Annotation-aware domain visualization |
| Test harnesses | `test:*` vocabulary for selective execution |

---

## 10. Relationship to Existing Concepts

### 10.1 Effect vs Annotation

| | Effect | Annotation |
|---|---|---|
| Core awareness | Yes — semantic loop participant | No — structurally invisible to Core |
| Runtime impact | Yes — generates requirements, Host executes | Zero |
| Erasability | Not erasable — alters state transitions | Fully erasable — zero semantic impact |
| Analogy | Opaque declaration within the world | Structured preserved comment about the world |

### 10.2 `available when` / `dispatchable when` vs Annotation

`available when` and `dispatchable when` are semantic legality gates — they determine what is possible in the world. Annotations are consumer hints — they suggest how to surface what is possible. The two layers must never be conflated. Annotations cannot create, modify, or override legality.

---

*End of ADR-021 v1*
