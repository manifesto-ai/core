# ADR-013b: Entity Collection Primitives — `findById`, `existsById`, `updateById`, `removeById`

> **Status:** Proposed
> **Date:** 2026-03-24
> **Deciders:** Manifesto Architecture Team
> **Scope:** `@manifesto-ai/compiler` (MEL builtin surface + lowering)
> **Depends On:** Compiler SPEC v0.6.0, Core SPEC v3.0.0, FDR-MEL-062 (Primitive Aggregation)
> **Triggered By:** `Array<Entity>` id-based update boilerplate (F-004)
> **Related:** ADR-013a (flow/include — separate approval gate), ADR-013c (define — deferred)
> **Supersedes:** ADR-013 (Withdrawn — mixed three independent decisions)
> **Breaking:** No — additive builtin functions only; existing syntax unaffected; Core IR unchanged; runtime layers unchanged
> **Internal Structure:** §4 Query Primitives (013b-1) and §5 Transform Primitives (013b-2) have **separate acceptance criteria** and may be approved independently.

---

## 1. Context

### 1.1 The Entity Update Boilerplate

In `Array<Entity>` state, the pattern "find an item by id and update some of its fields" is currently solved with an effect pipeline:

```mel
// Current: multi-step effect pipeline for a single-item id-based update
action softDeleteTask(id: string) {
  onceIntent {
    effect array.map({
      source: tasks,
      select: cond(eq($item.id, id),
        merge($item, { deletedAt: $system.time.now, updatedAt: $system.time.now }),
        $item),
      into: tasks
    })
  }
}
```

This is disproportionately verbose for the intent. Expressing "update the item whose id matches" requires a 4-step mechanical implementation — `map` → `cond` → `eq` → `merge` — every single time.

This is not unique to TaskFlow. Task management, shopping carts, chat messages, file management, trade records — every domain with `Array<Entity>` state encounters the same boilerplate.

### 1.2 Why Opening General `map`/`filter` on the Expression Surface Is Not the Answer

The original ADR-013 attempted to solve this with expression macros like `define updateById(...) = map(tasks, cond(eq($item.id, ...), ...))`. This is impossible under current MEL for two reasons.

**First**, `map`/`filter` are not MEL expression builtins. Compiler SPEC §8.2:

```mel
filter(items, ...)
// SemanticError: 'filter' is not a builtin function. Use effect array.filter() instead.
```

**Second**, `$item` is only permitted in effect args context (FDR-MEL-068).

More fundamentally, opening general `map`/`filter` on the expression surface would violate core MEL principles:

- **A6 (One pattern per concept)**: The same "collection transform" would be expressible via both `effect array.map` and `patch x = map(...)` — two syntaxes for one concept.
- **Spirit of FDR-MEL-018 (No Nested Effects)**: Nestable collection transforms make execution order implicit and trace decomposition harder.
- **LLM generation accuracy**: More contexts where `$item` may appear increases scope reasoning difficulty for LLMs.

### 1.3 The Correct Framing: "Adding Intention Vocabulary"

Reframing the problem: **MEL lacks vocabulary to directly express "id-based single-item lookup/update."**

FDR-MEL-062's justification for allowing `sum(prices)` provides exactly the same principle:

> `sum(prices)` is a **fact** — "the sum of prices."
> `reduce(prices, (acc, p) => acc + p, 0)` is a **procedure** — "how to compute the sum."

Likewise:
- `findById(tasks, id)` — **fact**: "the task with this id"
- `first(filter(tasks, eq($item.id, id)))` — **procedure**: "how to find that task"
- `updateById(tasks, id, { status: "done" })` — **fact**: "the tasks collection with the matching item updated"
- `map(tasks, cond(eq($item.id, id), merge($item, ...), $item))` — **procedure**: "how to produce that collection"

This ADR does not open a general collection expression surface. It adds **bounded, non-nestable, intention-revealing primitives**.

---

## 2. Decision

Four expression-level builtin functions are added to MEL. All have fixed `.id` semantics, do not expose `$item`, and lower to existing Core ExprNode kinds.

| Primitive | Signature | Nature | Section |
|-----------|-----------|--------|---------|
| `findById(collection, id)` | ``(Array<T>, T.id \| null) → T \| null`` | Query | §4 (013b-1) |
| `existsById(collection, id)` | ``(Array<T>, T.id \| null) → boolean`` | Query | §4 (013b-1) |
| `updateById(collection, id, updates)` | ``(Array<T>, T.id \| null, Partial<T>) → Array<T>`` | Transform | §5 (013b-2) |
| `removeById(collection, id)` | ``(Array<T>, T.id \| null) → Array<T>`` | Transform | §5 (013b-2) |

Where `T.id` is constrained to `string | number` by ENTITY-2a, and `null` is always accepted per ENTITY-8 (semantics: "no match").

**Approval structure**: Query primitives (§4) and Transform primitives (§5) may be approved independently. If Transform is rejected, Query can still proceed.

---

## 3. Design Constraints — Shared

### 3.1 Fixed `.id` Semantics

| Rule ID | Level | Description |
|---------|-------|-------------|
| ENTITY-1 | MUST | The key field is always `.id`. User-specified key fields are not supported |
| ENTITY-2 | MUST | The collection's element type MUST have an `.id` field — compile error otherwise |
| ENTITY-2a | MUST | The `.id` field MUST be a primitive type (`string` or `number`). Core's `eq` is primitive-only (FDR-MEL-042) |
| ENTITY-2b | MUST | `.id` values MUST be unique within the collection. This is a **domain invariant** — see §3.1.1 |

Why `.id` is fixed:
- `.id` is the de facto universal primary key pattern in `Array<Entity>` domains
- Alternative key searches (`.sku`, `.email`) are a different class of query better served by effect pipelines
- Parameterizing the key field would effectively open a `$item[keyField]` predicate, breaching FDR-MEL-068

#### 3.1.1 The `.id` Uniqueness Invariant (ENTITY-2b)

The "ById" in each primitive's name promises **entity identity** semantics: one id identifies exactly one item. Without a uniqueness guarantee, this promise is broken.

The lowering makes this concrete:
- `findById` lowers to Core `find`, which returns the **first** match
- `updateById` lowers to Core `map` + `eq`, which transforms **all** matches
- `removeById` lowers to Core `filter` + `not(eq)`, which removes **all** matches

If duplicate ids exist, `findById` and `updateById` silently disagree on cardinality — one returns a single item, the other modifies multiple. This is not an edge case; it is a semantic contradiction where the query half sees "entity identity" and the transform half performs "bulk predicate match."

**The invariant**: Collections passed to entity primitives MUST have unique `.id` values. This is a domain-level contract, not a type-level one — current `StateSpec` defines structure (field types, defaults) but cannot express collection invariants like "unique within array."

**Enforcement layers (v1)**:

| Layer | Mechanism | Level |
|-------|-----------|-------|
| Compile-time | The compiler MUST reject statically detectable violations (e.g., duplicate literal ids in state initializers) | MUST |
| Compile-time | The compiler SHOULD emit a warning when entity primitives are used on collections whose uniqueness cannot be statically verified (e.g., collections built via `concat` without dedup) | SHOULD |
| Runtime | If uniqueness is violated at runtime, behavior is **defined but degraded**: `findById` returns first match; `updateById`/`removeById` affect all matches. No crash, no undefined behavior — but the "single entity" intent is not honored | — |
| Documentation | Domain authors MUST document the uniqueness invariant for collections used with entity primitives | MUST |

**Why not require runtime enforcement?** Runtime uniqueness checks on every `updateById` call would require scanning the entire collection — an O(n) cost that contradicts Core's "compute, don't execute" philosophy. The invariant is a domain design contract analogous to how `call` references "MUST NOT form cycles" (Core SPEC §8.6) — a structural property the system relies on, enforced by design discipline and compile-time assistance where possible.

### 3.2 `$item` Not Exposed

| Rule ID | Level | Description |
|---------|-------|-------------|
| ENTITY-3 | MUST | These primitives MUST NOT expose `$item` to the caller |

The `.id` matching inside the primitive is handled by fixed semantics. No context is created where the user writes `$item`. Conflict with FDR-MEL-068 is structurally impossible.

### 3.3 Core IR Invariance and Lowering Boundary

| Rule ID | Level | Description |
|---------|-------|-------------|
| ENTITY-4 | MUST | No new ExprNode kinds are added to Core IR |
| ENTITY-5 | MUST | The compiler lowers to existing Core ExprNode kinds: `find`, `filter`, `map`, `if`, `eq`, `merge`, `not`, `isNull`, `get`, `field` |
| ENTITY-6 | MUST | The lowered IR MUST be semantically identical to a hand-written equivalent |
| ENTITY-9 | MUST | Entity primitives MUST remain as MEL Canonical IR `call` nodes through validation and type checking. Lowering to Core Runtime IR MUST occur only at the existing MEL → Core lowering boundary (FDR-MEL-064, A34) |

ENTITY-9 is critical. `$item` references in the lowered `find`/`map`/`filter` predicates exist only in Core Runtime IR — they are never present in MEL Canonical IR. This preserves FDR-MEL-068's "$item is ONLY allowed in effect.args context" at the MEL surface level.

This follows the same pattern as `onceIntent` lowering to `once()` + `$mel` guard: the surface speaks intent; the compiler generates the mechanical implementation at the appropriate boundary.

### 3.4 A6 Compliance — Not a Replacement for `effect array.*`

| Rule ID | Level | Description |
|---------|-------|-------------|
| ENTITY-7 | MUST | These primitives are NOT a general replacement for `effect array.map/filter/find` |

Entity primitives handle `.id`-based single-item operations only. Arbitrary predicates, multi-item operations, sorting, grouping, etc. remain in effect pipelines. The two mechanisms have non-overlapping use cases, so A6 (one pattern per concept) is not violated.

| Use case | Mechanism |
|----------|-----------|
| Single-item lookup by id | `findById` |
| Single-item update by id | `updateById` |
| Arbitrary-predicate filtering | `effect array.filter` |
| Whole-collection transform | `effect array.map` |
| Sorting | `effect array.sort` |
| Grouping | `effect array.groupBy` |

### 3.5 `null` Id Behavior

| Rule ID | Level | Description |
|---------|-------|-------------|
| ENTITY-8 | MUST | If the `id` argument is `null`, the primitive MUST behave as if no item matches |

Rationale: Core's `eq(null, x)` returns `true` only when `x` is also `null` (FDR-MEL-034). An item with `.id == null` would match, which is technically correct but likely unintended. However, ENTITY-2a already constrains `.id` to `string | number`. If a schema declares `.id: string`, then `null` ids in the collection would be a schema violation upstream. The primitive does not add special-case logic for `null` — it relies on `eq` semantics and upstream type enforcement.

For `findById`: returns `null` (no match). For `existsById`: returns `false`. For `updateById`: returns original collection unchanged. For `removeById`: returns original collection unchanged.

---

## 4. Query Primitives (013b-1)

### 4.1 `findById`

```mel
findById(collection, id)
```

**Semantics**: Returns the first item in `collection` where `.id == id`. Returns `null` if no match.

**Allowed contexts**: Anywhere an expression is permitted.

```mel
// In computed
computed selectedTask = findById(tasks, selectedId)

// In guard condition
action moveTask(taskId: string, newStatus: string) {
  when isNull(findById(tasks, taskId)) {
    fail "NOT_FOUND" with concat("Task not found: ", taskId)
  }
  // ...
}

// In available condition (pure expression — A28 compliant)
action editTask(taskId: string, title: string)
  available when isNotNull(findById(tasks, taskId)) {
  // ...
}
```

**Lowering** (two stages per FDR-MEL-064):

```
// MEL surface
findById(tasks, id)

// → MEL Canonical IR (call-based, used through validation + type check)
{ kind: "call", fn: "findById", args: [get("tasks"), get("id")] }

// → Core Runtime IR (at the lowering boundary)
{
  kind: "find",
  array: { kind: "get", path: "tasks" },
  predicate: {
    kind: "eq",
    left: { kind: "get", path: "$item.id" },
    right: { kind: "get", path: "id" }
  }
}
// Note: $item.id is generated only in Core IR — never visible at MEL surface
```

Core's `find` ExprNode returns `null` when no item matches (Core SPEC §7.2). Semantics are exact.

### 4.2 `existsById`

```mel
existsById(collection, id)
```

**Semantics**: Returns `true` if `collection` contains an item where `.id == id`, `false` otherwise.

```mel
// In guard condition
action softDeleteTask(id: string) {
  when not(existsById(tasks, id)) {
    fail "NOT_FOUND" with concat("Task not found: ", id)
  }
  // ...
}

// In available condition
action editTask(taskId: string, title: string)
  available when existsById(tasks, taskId) {
  // ...
}
```

**Lowering**:

```
// MEL surface
existsById(tasks, id)

// → MEL Canonical IR
{ kind: "call", fn: "existsById", args: [get("tasks"), get("id")] }

// → Core Runtime IR (at the lowering boundary)
{
  kind: "not",
  arg: {
    kind: "isNull",
    arg: {
      kind: "find",
      array: { kind: "get", path: "tasks" },
      predicate: {
        kind: "eq",
        left: { kind: "get", path: "$item.id" },
        right: { kind: "get", path: "id" }
      }
    }
  }
}
```

### 4.3 Query Primitive Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| QUERY-1 | MUST | Allowed in all expression contexts: computed, guard condition, patch RHS, available |
| QUERY-2 | MUST | `$system.*` interaction follows existing rules: forbidden in computed (FDR-MEL-054) |
| QUERY-3 | — | No composition restriction: `findById` is an expression on par with `sum`, `len`, etc. |

---

## 5. Transform Primitives (013b-2)

### 5.1 `updateById`

```mel
updateById(collection, id, updates)
```

**Semantics**: Returns a new collection where the item with `.id == id` is shallow-merged with `updates`. If no item matches, the original collection is returned unchanged. **Requires** the `.id` uniqueness invariant (ENTITY-2b) — under this invariant, exactly one item is modified. If uniqueness is violated, the lowered `map` + `eq` affects all matching items (defined but degraded behavior; see §3.1.1).

```mel
action softDeleteTask(id: string) {
  onceIntent {
    patch tasks = updateById(tasks, id, {
      deletedAt: $system.time.now,
      updatedAt: $system.time.now
    })
  }
}

action moveTask(taskId: string, newStatus: string) {
  onceIntent {
    patch tasks = updateById(tasks, taskId, {
      status: newStatus,
      updatedAt: $system.time.now
    })
  }
}
```

**Lowering**:

```
// MEL surface
updateById(tasks, id, { status: newStatus, updatedAt: $system.time.now })

// → MEL Canonical IR
{ kind: "call", fn: "updateById", args: [get("tasks"), get("id"),
    { kind: "obj", fields: [
      { key: "status", value: get("newStatus") },
      { key: "updatedAt", value: sys(["system","time","now"]) }
    ] }
  ] }

// → Core Runtime IR (at the lowering boundary)
{
  kind: "map",
  array: { kind: "get", path: "tasks" },
  mapper: {
    kind: "if",
    cond: {
      kind: "eq",
      left: { kind: "get", path: "$item.id" },
      right: { kind: "get", path: "id" }
    },
    then: {
      kind: "merge",
      objects: [
        { kind: "get", path: "$item" },
        {
          kind: "object",
          fields: {
            "status": { kind: "get", path: "newStatus" },
            "updatedAt": "<system lowered per FDR-MEL-051>"
          }
        }
      ]
    },
    else: { kind: "get", path: "$item" }
  }
}
```

### 5.2 `removeById`

```mel
removeById(collection, id)
```

**Semantics**: Returns a new collection with the item whose `.id == id` removed. If no item matches, the original collection is returned unchanged. **Requires** the `.id` uniqueness invariant (ENTITY-2b) — under this invariant, exactly one item is removed. If uniqueness is violated, the lowered `filter` + `not(eq)` removes all matching items (defined but degraded behavior; see §3.1.1).

```mel
action deleteTask(id: string) {
  onceIntent {
    patch tasks = removeById(tasks, id)
  }
}
```

**Lowering**:

```
// MEL surface
removeById(tasks, id)

// → MEL Canonical IR
{ kind: "call", fn: "removeById", args: [get("tasks"), get("id")] }

// → Core Runtime IR (at the lowering boundary)
{
  kind: "filter",
  array: { kind: "get", path: "tasks" },
  predicate: {
    kind: "not",
    arg: {
      kind: "eq",
      left: { kind: "get", path: "$item.id" },
      right: { kind: "get", path: "id" }
    }
  }
}
```

### 5.3 Transform Primitive Rules — Strong Conservatism

Unlike query primitives, transform primitives produce "a new collection reflecting a change to the current state." FDR-MEL-062 applied "fixed semantics, no composition, what not how" as strong constraints when permitting aggregation. The same conservatism applies here.

| Rule ID | Level | Description | Rationale |
|---------|-------|-------------|-----------|
| TRANSFORM-1 | MUST | **Patch RHS only**: `patch x = updateById(...)` ✅, `computed x = updateById(...)` ❌ | Transforms express mutation intent; "hypothetical transform" in computed is out of scope |
| TRANSFORM-2 | MUST | **No nesting**: `updateById(removeById(...), ...)` ❌ compile error | Prevents a secretly composable transform algebra |
| TRANSFORM-3 | MUST | **State-path collection only**: `updateById(tasks, ...)` ✅, `updateById(activeTasks, ...)` ❌ (computed), `updateById(filter(...), ...)` ❌ | Computed names can hide sub-collection extraction; state paths cannot |
| TRANSFORM-4 | MUST | **Forbidden in guard conditions**: `when eq(updateById(...), ...)` ❌ | Guards read current state; they do not transform it |
| TRANSFORM-5 | MUST | **Forbidden in available conditions** (A28 — available is pure; transform implies mutation intent) | Semantic consistency |

TRANSFORM-1 is especially important. If `updateById` were usable in arbitrary expression contexts, it would inevitably become a back-door replacement for `effect array.map`. Restricting it to patch RHS enforces the "update this collection like this" mutation intent at the grammar level.

#### 5.3.1 TRANSFORM-3 Precise Definition: "Direct Collection Reference"

A **direct collection reference** is a path that resolves to a **state root key** — with optional static property access (`.`). Computed names, function calls, index access, and sub-expressions are all forbidden as the collection argument of a transform primitive.

**Why computed names are excluded**: A `computed` in MEL is an arbitrary pure expression. It can hide index access, function calls, or sub-collection extraction behind a simple name:

```mel
computed firstProjectTasks = at(projects, 0).tasks

action markDone(id: string) {
  onceIntent {
    // ❌ This LOOKS like a direct reference but is actually
    //    a sub-collection extracted via index access
    patch tasks = updateById(firstProjectTasks, id, { done: true })
  }
}
```

If computed names were permitted, TRANSFORM-3's guard against sub-collection transforms would be defeated by indirection. Proving that a computed is a "safe alias" would require alias analysis, which is beyond v1 scope. The conservative rule is: **state paths only**.

```mel
// ✅ Direct: state root key
patch tasks = updateById(tasks, id, { done: true })

// ✅ Direct: state root key with static property path
patch project.tasks = updateById(project.tasks, id, { done: true })

// ❌ Forbidden: computed name (may hide arbitrary expression)
patch tasks = updateById(activeTasks, id, { done: true })

// ❌ Forbidden: function call result
patch tasks = updateById(filter(tasks, ...), id, { done: true })

// ❌ Forbidden: another transform primitive
patch tasks = updateById(removeById(tasks, oldId), newId, { title: "new" })

// ❌ Forbidden: index access
patch tasks = updateById(at(projects, 0).tasks, id, { done: true })
```

The compiler validates this by checking that the first argument's AST resolves to a state-declared path — not a computed reference, `call`, `if`, or other compound expression. Concretely: the path's root segment must exist in `StateSpec.fields`, not `ComputedSpec.fields`.

### 5.4 Transform + `$system.*` Interaction

```mel
patch tasks = updateById(tasks, id, { updatedAt: $system.time.now })
```

`$system.time.now` is lowered to a `system.get` effect by the compiler (FDR-MEL-051). In the expanded AST, `$system.time.now` is handled normally. `updateById` does not alter time semantics.

Within the same intent, identical `$system` keys are deduplicated per FDR-MEL-052. Using `updateById` twice in one action still results in a single `$system.time.now` value.

---

## 6. Compilation

### 6.1 Compiler Changes

| Component | Change Level |
|-----------|-------------|
| Builtin Function Registry | 4 functions registered as MEL builtins |
| Entity Primitive Structural Validation Pass (new) | Context restrictions, nesting, state-path-only, duplicate literal `.id` |
| Type Checker (existing, extended) | Builtin typing rules for 4 entity primitives: `.id` field existence, `.id` type, argument compatibility (E030, E030a) |
| MEL → Core Lowering Pass (existing) | 4 new lowering rules added: `call(findById,...)` → Core `find`, etc. |
| Diagnostics | Entity primitive related error messages (E030–E035) |

### 6.2 Compile Errors

```
E030: Collection element type does not have an 'id' field.
      findById(items, key) — type 'Item' has no field 'id'.

E030a: Collection element 'id' field is not a primitive type.
       findById(items, key) — 'id' is type '{ value: string }', expected string or number.

E030b: Duplicate '.id' values detected in state initializer.
       state { tasks: Array<Task> = [{ id: "t1", ... }, { id: "t1", ... }] }
       — entity primitives require unique '.id' values (ENTITY-2b).

E031: updateById/removeById not allowed in this context.
      Transform primitives can only be used in patch RHS.

E032: Nested transform primitive.
      updateById(removeById(tasks, id1), id2, ...) — nesting is forbidden.

E033: Transform primitive collection argument is not a state path.
      updateById(activeTasks, ...) — 'activeTasks' is a computed, not a state field.
      updateById(filter(tasks, ...), ...) — first argument must be a state-declared path
      (no computed names, function calls, index access, or sub-expressions).

E034: Transform primitive in guard condition.
      when eq(updateById(...), ...) — not allowed in guard.

E035: Transform primitive in available condition.
      available when updateById(...) — not allowed in available.
```

### 6.3 Pass Ordering

Entity primitives are processed across three layers: **structural validation, type checking, and lowering.**

The key architectural constraint is FDR-MEL-064 (A34): "Compiler is the single boundary between MEL IR and Core IR." MEL Canonical IR is call-based (`{ kind: 'call', fn: 'findById', args: [...] }`). Core Runtime IR uses named-head nodes (`{ kind: 'find', ... }`). These two representations MUST NOT be mixed. Entity primitives remain as MEL `call` nodes through validation and type checking, and are lowered to Core IR only at the existing lowering boundary.

```
MEL Source
    │
    ▼
[1] Parse → AST
    │
    ▼
[2] Flow Declaration Validation (ADR-013a)
    │
    ▼
[3] Flow Expansion (ADR-013a)
    │
    ▼
[4] Entity Primitive Structural Validation ← added by this ADR
    │  ├─ Context restriction validation (TRANSFORM-1~5)
    │  ├─ State-path-only collection validation (TRANSFORM-3, §5.3.1)
    │  ├─ Nesting detection (TRANSFORM-2)
    │  ├─ Duplicate literal .id in state initializers (ENTITY-2b static)
    │  └─ Primitives remain as MEL call nodes: call(findById, ...) etc.
    │
    ▼
[5] Type Check ← entity builtin typing rules integrated here
    │  ├─ Standard type inference for all expressions
    │  ├─ Entity builtin typing: collection element type has .id (ENTITY-2)
    │  ├─ Entity builtin typing: .id is string | number (ENTITY-2a)
    │  ├─ Entity builtin typing: id argument assignable to (.id type | null) — null is valid per ENTITY-8
    │  ├─ Entity builtin typing: updates argument fields assignable to element type
    │  └─ System Lowering ($system.* → effect)
    │
    ▼
[6] MEL → Core Lowering (existing boundary — FDR-MEL-064)
    │  ├─ call(findById, coll, id)
    │  │    → Core { kind: "find", predicate: { kind: "eq", ... "$item.id" ... } }
    │  ├─ call(existsById, coll, id)
    │  │    → Core { kind: "not", arg: { kind: "isNull", arg: { kind: "find", ... } } }
    │  ├─ call(updateById, coll, id, updates)
    │  │    → Core { kind: "map", mapper: { kind: "if", ... merge ... } }
    │  └─ call(removeById, coll, id)
    │       → Core { kind: "filter", predicate: { kind: "not", ... eq ... } }
    │
    ▼
Core IR (no trace of entity primitives; $item exists only in Core IR)
```

**Why this separation matters**:

- **Pass 4 (Structural Validation)** handles checks that require only AST structure and scope resolution — no type inference. Context restrictions (is this a patch RHS?), state-path validation (is the first argument a state root?), and nesting detection are all answerable from the AST alone. This pass does NOT check `.id` field existence or type, because the collection argument may be an arbitrary expression whose element type requires full type inference (e.g., `findById(cond(flag, archiveTasks, tasks), id)`).

- **Pass 5 (Type Check)** handles `.id` validation as **builtin typing rules** for the four entity primitives. The type checker already knows how to resolve the element type of any expression — including conditionals, computed references, and nested paths. `findById` is type-checked like any other builtin function: the type checker verifies that the first argument is ``Array<T>`` where `T` has a `.id: string | number` field (E030, E030a), and that the `id` argument is assignable to `.id`'s type **or null** (ENTITY-8).

- **Pass 6 (Lowering)** produces Core IR. `$item` is generated only here, never visible at MEL surface.

ADR-013a and this ADR are independently approvable. If 013a is not present, passes [2] and [3] are skipped and Entity Primitive Structural Validation runs directly after Parse.

---

## 7. Rules Summary

### 7.1 Shared

| Rule ID | Level | Description |
|---------|-------|-------------|
| ENTITY-1 | MUST | Key field is fixed to `.id` |
| ENTITY-2 | MUST | Element type MUST have an `.id` field — compile error otherwise |
| ENTITY-2a | MUST | `.id` field MUST be primitive (`string` or `number`) per FDR-MEL-042 |
| ENTITY-2b | MUST | `.id` values MUST be unique within the collection (domain invariant, §3.1.1) |
| ENTITY-3 | MUST | `$item` MUST NOT be exposed to the caller |
| ENTITY-4 | MUST | No new ExprNode kinds added to Core IR |
| ENTITY-5 | MUST | Lowering uses existing Core ExprNode kinds only |
| ENTITY-6 | MUST | Lowered IR MUST be semantically identical to hand-written equivalent |
| ENTITY-7 | MUST | NOT a general replacement for `effect array.*` |
| ENTITY-8 | MUST | `null` id argument behaves as "no match" |
| ENTITY-9 | MUST | Primitives remain as MEL `call` nodes until the MEL → Core lowering boundary (FDR-MEL-064) |

### 7.2 Query (013b-1)

| Rule ID | Level | Description |
|---------|-------|-------------|
| QUERY-1 | MUST | Allowed in all expression contexts |
| QUERY-2 | MUST | `$system.*` interaction follows existing rules |

### 7.3 Transform (013b-2)

| Rule ID | Level | Description |
|---------|-------|-------------|
| TRANSFORM-1 | MUST | Patch RHS only |
| TRANSFORM-2 | MUST | No nesting |
| TRANSFORM-3 | MUST | State-path collection only; computed names forbidden (§5.3.1) |
| TRANSFORM-4 | MUST | Forbidden in guard conditions |
| TRANSFORM-5 | MUST | Forbidden in available conditions |

---

## 8. Impact Assessment

### 8.1 Compiler Changes

| Component | Change Level |
|-----------|-------------|
| Builtin Function Registry | 4 functions added |
| Entity Primitive Structural Validation Pass (new) | Context restrictions, nesting, state-path-only, duplicate literal `.id` |
| Type Checker (existing, extended) | Builtin typing rules for `.id` existence + type |
| MEL → Core Lowering Pass (existing) | 4 new lowering rules |
| Diagnostics | Entity primitive error messages |

### 8.2 Core Changes: None

### 8.3 Host/World/SDK Changes: None

### 8.4 Documentation Changes

- Add Entity Collection Functions subsection to Compiler SPEC §9.1
- Add entity primitive context errors to §8.2 Semantically Forbidden
- Migration guide: refactoring id-based `effect array.map/filter` patterns to entity primitives
- Explicit note: "These are NOT replacements for `effect array.*`"

---

## 9. Before / After — TaskFlow Domain

### Before (current, effect pipeline)

```mel
action softDeleteTask(id: string) {
  onceIntent {
    effect array.map({
      source: tasks,
      select: cond(eq($item.id, id),
        merge($item, { deletedAt: $system.time.now, updatedAt: $system.time.now }),
        $item),
      into: tasks
    })
  }
}

action moveTask(taskId: string, newStatus: string) {
  onceIntent {
    effect array.map({
      source: tasks,
      select: cond(eq($item.id, taskId),
        merge($item, { status: newStatus, updatedAt: $system.time.now }),
        $item),
      into: tasks
    })
  }
}
```

### After (with entity primitives)

```mel
action softDeleteTask(id: string) {
  onceIntent {
    patch tasks = updateById(tasks, id, {
      deletedAt: $system.time.now,
      updatedAt: $system.time.now
    })
  }
}

action moveTask(taskId: string, newStatus: string) {
  onceIntent {
    patch tasks = updateById(tasks, taskId, {
      status: newStatus,
      updatedAt: $system.time.now
    })
  }
}
```

**Change**: Intent is expressed in one line. The mechanical `$item`/`cond`/`eq`/`merge` implementation disappears. The effect pipeline is replaced by a patch RHS expression.

### ADR-013a + 013b Combined (Full Picture)

```mel
flow requireTask(taskId: string) {
  when not(existsById(tasks, taskId)) {
    fail "NOT_FOUND" with concat("Task not found: ", taskId)
  }
}

action softDeleteTask(id: string) {
  include requireTask(id)
  onceIntent {
    patch tasks = updateById(tasks, id, {
      deletedAt: $system.time.now,
      updatedAt: $system.time.now
    })
  }
}

action restoreTask(id: string) {
  include requireTask(id)
  onceIntent {
    patch tasks = updateById(tasks, id, {
      deletedAt: null,
      updatedAt: $system.time.now
    })
  }
}

action moveTask(taskId: string, newStatus: string) {
  include requireTask(taskId)
  onceIntent {
    patch tasks = updateById(tasks, taskId, {
      status: newStatus,
      updatedAt: $system.time.now
    })
  }
}
```

---

## 10. Alternatives Considered

### 10.1 Do Nothing (Keep Effect Pipelines)

- Current `effect array.map` + `cond` + `eq` + `merge` works
- Explicit and traceable
- **Rejected**: Disproportionate ceremony for the intent. Same boilerplate across all `Array<Entity>` domains

### 10.2 Open General `map`/`filter` on Expression Surface

- `patch tasks = map(tasks, cond(eq($item.id, id), merge($item, updates), $item))`
- Maximum expressiveness
- **Rejected**: A6 violation (two syntaxes for one concept), `$item` expression exposure (FDR-MEL-068 breach), "expression divergence" creating cultural debt. Respects MEL's intentional closure of this surface

### 10.3 Parameterized Key Field (`updateBy(tasks, "sku", value, updates)`)

- Supports key fields other than `.id`
- **Rejected**: Effectively opens a `$item[keyField]` predicate, breaching FDR-MEL-068. Non-`.id` key searches are a different class of query better served by effect pipelines

### 10.4 Avoid via `Record<string, Entity>` State Modeling

- `at(taskRecord, id)` for lookup, `merge` patch for update
- If domains model as Record instead of Array, entity primitives are unnecessary
- **Rejected**: Array-based modeling is natural for many domains (ordering, iteration, indexing). Forcing Record unnecessarily constrains domain modeling freedom

### 10.5 Solve via `define` Macro (ADR-013c First)

- `define updateById(...) = map(...)` pattern
- **Rejected**: `define` requires expression-level `map`/`filter` to be open first. This is the path rejected in §1.2

---

## 11. Acceptance Criteria

### 11.1 Query Primitives (013b-1)

- [ ] `findById(collection, id)` works in all expression contexts
- [ ] `existsById(collection, id)` works in all expression contexts
- [ ] Element type without `.id` field → compile error (E030)
- [ ] Element type with non-primitive `.id` field → compile error (E030a)
- [ ] Lowered IR uses Core `find` ExprNode with exact `.id` matching
- [ ] No match: `findById` → `null`, `existsById` → `false`
- [ ] `null` id argument: `findById` → `null`, `existsById` → `false`

### 11.2 Transform Primitives (013b-2)

- [ ] `updateById(collection, id, updates)` works in patch RHS
- [ ] `removeById(collection, id)` works in patch RHS
- [ ] Usage in computed context → compile error (E031)
- [ ] Usage in guard condition → compile error (E034)
- [ ] Usage in available condition → compile error (E035)
- [ ] Nested usage → compile error (E032)
- [ ] Non-state-path collection reference (including computed names) → compile error (E033)
- [ ] Lowered IR uses Core `map` + `if` + `eq` + `merge` / `filter` + `not` + `eq`
- [ ] No matching id: `updateById` → original collection unchanged
- [ ] No matching id: `removeById` → original collection unchanged
- [ ] `null` id argument: both return original collection unchanged
- [ ] `$system.time.now` interaction follows existing system lowering/dedup rules
- [ ] Duplicate literal `.id` values in state initializer → compile error (ENTITY-2b static enforcement)
- [ ] Under `.id` uniqueness invariant, `updateById` modifies exactly one item and `removeById` removes exactly one item

---

## 12. Open Questions

1. **Is `updateById`'s `updates` argument a partial merge or full replace?** — This ADR adopts merge semantics (lowered as `merge($item, updates)`). If full replacement is needed, use `removeById` + collection append.

2. **Is `upsertById` (insert if absent, update if present) needed?** — Excluded from v1. Solvable with `existsById` + `when`/`else` branching. Will be added if real demand arises.

3. **What if `updateById` needs access to the current item's value?** — Example: `updateById(tasks, id, (item) => { count: add(item.count, 1) })`. This would expose `$item` and is forbidden in v1. The workaround is to read the current value with `findById`, then pass computed values to `updateById`.

---

## 13. References

- FDR-MEL-062 — Primitive Aggregation Functions ("sum is a fact, reduce is a procedure")
- FDR-MEL-064 — Compiler Owns Lowering Boundary (A34: single MEL → Core IR boundary)
- FDR-MEL-042 — Primitive-Only Equality
- FDR-MEL-034 — Equality Semantics
- FDR-MEL-068 — $item Scope Restriction
- FDR-MEL-018 — No Nested Effects
- FDR-MEL-051 — Compiler-Inserted System Lowering
- FDR-MEL-052 — System Value Deduplication
- FDR-MEL-054 — System Value Scope Restrictions
- Compiler SPEC v0.6.0 §8.2 — Semantically Forbidden (map/filter as expression)
- Compiler SPEC v0.6.0 §9.1.2 — Index Access Functions (at, first, last)
- Compiler SPEC v0.6.0 §9.2.1 — Array Effects
- Core SPEC v3.0.0 §7.2 — ExprNode Types (find, filter, map, if, eq, merge)
- ADR-002 — A6 (One pattern per concept)
- F-004 (FRICTION.md) — MEL map+cond boilerplate
- ADR-013 (Withdrawn) — Original mixed ADR
- ADR-013a — flow/include (separate approval gate)

---

*End of ADR-013b*
