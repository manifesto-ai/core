# Patch Rules

> Source: `packages/core/docs/core-SPEC.md`, `packages/core/src/schema/patch.ts`, `packages/core/src/core/apply.ts`
> Last synced: 2026-03-28

## Rules

> **R1**: Only three patch operations exist: `set`, `unset`, `merge`.
> **R2**: Patch targets use structured `PatchPath` segments rooted at `snapshot.data`.
> **R3**: All state changes go through `apply(schema, snapshot, patches, context)`.
> **R4**: `apply()` returns a new snapshot, recomputes computed values, and increments `meta.version`.
> **R5**: Dynamic keys are allowed only after they have been fixed into snapshot state or lowered by compiler/platform mechanics.

## Current Core Shape

```typescript
type PatchSegment =
  | { kind: "prop"; name: string }
  | { kind: "index"; index: number };

type PatchPath = PatchSegment[];

type Patch =
  | { op: "set"; path: PatchPath; value: unknown }
  | { op: "unset"; path: PatchPath }
  | { op: "merge"; path: PatchPath; value: Record<string, unknown> };
```

Paths are not string literals in the current Core API.

## The Three Operations

### `set`

```typescript
{
  op: "set",
  path: [{ kind: "prop", name: "count" }],
  value: 5,
}
{
  op: "set",
  path: [
    { kind: "prop", name: "todos" },
    { kind: "prop", name: "abc123" },
    { kind: "prop", name: "completed" },
  ],
  value: true,
}
```

### `unset`

```typescript
{
  op: "unset",
  path: [{ kind: "prop", name: "tempFlag" }],
}
{
  op: "unset",
  path: [
    { kind: "prop", name: "todos" },
    { kind: "prop", name: "abc123" },
  ],
}
```

### `merge`

```typescript
{
  op: "merge",
  path: [
    { kind: "prop", name: "user" },
  ],
  value: { lastSeen: "2026-03-28" },
}
```

`merge` is shallow only. Nested objects are replaced, not recursively merged.

If merge target is absent, Core treats it as `{}`. If target is non-object, `apply()` records a validation error.

## MEL Patch Syntax

```mel
// set
patch count = add(count, 1)
patch user.name = trim(newName)
patch items[$system.uuid] = { id: $system.uuid, title: title }

// unset
patch tasks[id] unset

// merge (only via effect results or explicit merge op)
```

MEL is lowered into structured `PatchPath` segments by the compiler/runtime pipeline.

## Dynamic Key Pattern

If a key is dynamic, fix it into snapshot state first and then patch through that stored value:

```mel
// Step 1: materialize the identifier
once(creating) {
  patch creating = $meta.intentId
  patch newItemId = $system.uuid
}

// Step 2: patch through the stored key
when isNotNull(newItemId) {
  patch items[newItemId] = { id: newItemId, title: title }
}
```

The important rule is that continuity lives in snapshot state, not in hidden runtime variables.

## Antipatterns

### Direct Mutation

```typescript
// FORBIDDEN
snapshot.data.count = 5;
snapshot.meta.version++;

// CORRECT
const newSnapshot = core.apply(
  schema,
  snapshot,
  [
    {
      op: "set",
      path: [{ kind: "prop", name: "count" }],
      value: 5,
    },
  ],
  context,
);
```

### Deep Merge Assumption

```typescript
// WRONG — merge is shallow, nested objects replaced entirely
{
  op: "merge",
  path: [{ kind: "prop", name: "user" }],
  value: { name: "X", settings: { theme: "dark" } },
}

// CORRECT — multiple set patches for nested paths
[
  {
    op: "set",
    path: [{ kind: "prop", name: "user" }, { kind: "prop", name: "name" }],
    value: "X",
  },
  {
    op: "set",
    path: [
      { kind: "prop", name: "user" },
      { kind: "prop", name: "settings" },
      { kind: "prop", name: "theme" },
    ],
    value: "dark",
  },
]
```

### Array Push/Pop/Splice

```typescript
// FORBIDDEN — mutates in place
snapshot.data.todos.push(newTodo);

// CORRECT — set entire new array
const newTodos = [...snapshot.data.todos, newTodo];
[
  {
    op: "set",
    path: [{ kind: "prop", name: "todos" }],
    value: newTodos,
  },
]
```

### String paths in current Core-facing code

```typescript
// Avoid this in current Core APIs
{ op: "set", path: "data.count", value: 1 }
```

### Unguarded Patch in MEL

```mel
// FORBIDDEN — runs every compute cycle
action broken() {
  patch count = add(count, 1)     // Increments forever!
}

// CORRECT — guarded
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}
```

## Why

- **Three operations are enough.** Complexity is composed, not built-in.
- **Immutability matters.** Snapshots are durable time-travel points.
- **Structured paths matter.** They preserve validation and typed lowering boundaries.

## Cross-References

- Snapshot structure: `@knowledge/architecture.md`
- Effect handlers return patches: `@knowledge/effect-patterns.md`
- MEL patch syntax: `@knowledge/mel-patterns.md`
