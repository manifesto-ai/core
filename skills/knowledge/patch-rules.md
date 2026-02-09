# Patch Rules

> Source: Core SPEC v2.0.1 §13.3-14, Core FDR v2.0.0 FDR-012
> Last synced: 2026-02-09

## Rules

> **R1**: Only three patch operations exist: `set`, `unset`, `merge`. [Core SPEC §8.4.3]
> **R2**: All state changes MUST go through `apply(schema, snapshot, patches)`. [Core SPEC §13.3]
> **R3**: Patches create a new Snapshot. The old Snapshot is unchanged (immutable). [Core SPEC §13.3]
> **R4**: `version` MUST be incremented on every change. [Core SPEC §13.3]
> **R5**: Patch paths MUST be statically resolvable. Dynamic paths require two-step pattern. [Core SPEC §8.4.3]

## The Three Operations

### `set` — Replace value at path (create if missing)

```typescript
{ op: 'set', path: 'data.count', value: 5 }
{ op: 'set', path: 'data.todos.abc123.completed', value: true }
{ op: 'set', path: 'data.items', value: [1, 2, 3] }
```

### `unset` — Remove property at path

```typescript
{ op: 'unset', path: 'data.tempFlag' }
{ op: 'unset', path: 'data.todos.abc123' }
```

### `merge` — Shallow merge object at path

```typescript
{ op: 'merge', path: 'data.user', value: { lastSeen: '2026-02-09' } }
```

**Warning: Shallow only.** Nested objects are replaced, not recursively merged. For nested updates, use multiple `set` patches.

If merge target is absent, treated as `{}`. If merge target is non-object, runtime validation failure.

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

## Dynamic Path Pattern

Patch paths must be static at apply-time. For dynamic keys:

```mel
// Step 1: Fix the dynamic value to Snapshot
once(creating) {
  patch creating = $meta.intentId
  patch newItemId = $system.uuid    // UUID now in Snapshot
}

// Step 2: Use the fixed value
when isNotNull(newItemId) {
  patch items[newItemId] = { id: newItemId, title: title }
}
```

Compiler handles the lowering. `$system.uuid` becomes an effect that writes the value to a state slot.

## Antipatterns

### Direct Mutation

```typescript
// FORBIDDEN
snapshot.data.count = 5;
snapshot.meta.version++;

// CORRECT
const newSnapshot = core.apply(schema, snapshot, [
  { op: 'set', path: 'data.count', value: 5 }
]);
```

### Deep Merge Assumption

```typescript
// WRONG — merge is shallow, nested objects replaced entirely
{ op: 'merge', path: 'data', value: { user: { name: 'X', settings: { theme: 'dark' } } } }

// CORRECT — multiple set patches for nested paths
[
  { op: 'set', path: 'data.user.name', value: 'X' },
  { op: 'set', path: 'data.user.settings.theme', value: 'dark' }
]
```

### Array Push/Pop/Splice

```typescript
// FORBIDDEN — mutates in place
snapshot.data.todos.push(newTodo);

// CORRECT — set entire new array
const newTodos = [...snapshot.data.todos, newTodo];
[{ op: 'set', path: 'data.todos', value: newTodos }]
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

**Three operations are enough.** Complexity is composed, not built-in. [FDR-012]

**Immutability.** Snapshots are time-travel points. Mutation breaks determinism and reproducibility.

**Version tracking.** Monotonic version enables conflict detection and audit trails.

## Cross-References

- Snapshot structure: @knowledge/architecture.md
- Effect handlers return patches: @knowledge/effect-patterns.md
- MEL patch syntax: @knowledge/mel-patterns.md
