# Snapshot

> **Sources:** docs-original/GLOSSARY.md, docs-original/ARCHITECTURE.md, packages/core/docs/SPEC.md
> **Status:** Core Concept

---

## What is Snapshot?

**Definition:** The complete state of a system at a point in time. Snapshot is the single source of truth and the only communication channel between Core and Host.

**Canonical Principle:**

> **All communication happens through Snapshot. There is no other channel.**

**If it's not in Snapshot, it doesn't exist.**

---

## Structure

```typescript
type Snapshot<TData = unknown> = {
  /** Domain data (matches StateSpec) */
  readonly data: TData;

  /** Computed values (matches ComputedSpec) */
  readonly computed: Record<SemanticPath, unknown>;

  /** System state */
  readonly system: SystemState;

  /** Input for current action (if any) */
  readonly input: unknown;

  /** Snapshot metadata */
  readonly meta: SnapshotMeta;
};

type SystemState = {
  /** Current status */
  readonly status: 'idle' | 'computing' | 'pending' | 'error';

  /** Last error (null if none) */
  readonly lastError: ErrorValue | null;

  /** Error history */
  readonly errors: readonly ErrorValue[];

  /** Pending requirements waiting for Host */
  readonly pendingRequirements: readonly Requirement[];

  /** Current action being processed (if any) */
  readonly currentAction: string | null;
};

type SnapshotMeta = {
  /** Monotonically increasing version */
  readonly version: number;

  /** Timestamp of last modification */
  readonly timestamp: number;

  /** Deterministic random seed from Host context */
  readonly randomSeed: string;

  /** Hash of the schema this snapshot conforms to */
  readonly schemaHash: string;
};
```

---

## The Five Sections

### 1. data

- Contains all domain state
- Matches the structure defined in StateSpec
- Directly modified by patches
- The "business state" of your application

```typescript
snapshot.data = {
  todos: [
    { id: "1", title: "Buy milk", completed: false },
    { id: "2", title: "Write code", completed: true }
  ],
  filter: "all"
}
```

### 2. computed

- Derived values calculated from data
- **Never stored**, always recalculated
- Defined in ComputedSpec
- Form a Directed Acyclic Graph (DAG)

```typescript
snapshot.computed = {
  activeCount: 1,        // Computed from todos
  completedCount: 1,     // Computed from todos
  canClearCompleted: true // Computed from completedCount
}
```

### 3. system

- Runtime state managed by Core and Host
- Status of current computation
- Pending requirements (effects waiting to execute)
- Errors encountered during execution

```typescript
snapshot.system = {
  status: 'pending',
  lastError: null,
  errors: [],
  pendingRequirements: [
    { id: 'req-1', type: 'api:createTodo', params: {...} }
  ],
  currentAction: 'addTodo'
}
```

### 4. input

- Transient input for the current action
- Provided by the Intent
- Available to Flow via `expr.input()`

```typescript
snapshot.input = {
  title: "Buy groceries",
  priority: "high"
}
```

### 5. meta

- Metadata about the Snapshot itself
- Version (monotonically increasing)
- Timestamp (when last modified)
- SchemaHash (which schema this conforms to)

```typescript
snapshot.meta = {
  version: 42,
  timestamp: 1704067200000,
  randomSeed: "seed",
  schemaHash: "sha256:abc..."
}
```

---

## Core Invariants

### Immutability

Snapshots are **immutable after creation**. Any change creates a new Snapshot.

```typescript
// FORBIDDEN
snapshot.data.count = 5; // Direct mutation!

// REQUIRED
const context = { now: 0, randomSeed: "seed" };
const newSnapshot = core.apply(schema, snapshot, [
  { op: 'set', path: 'count', value: 5 }
], context);
```

### Version Monotonicity

Version MUST increase by exactly 1 per `apply()` call.

```typescript
// Initial snapshot
snapshot.meta.version = 0

// After one patch
newSnapshot.meta.version = 1

// After another patch
newerSnapshot.meta.version = 2
```

### Computed Values Are Never Stored

Computed values are recalculated every time Snapshot is accessed. They are not persisted.

```typescript
// When Snapshot is loaded from storage:
const loaded = JSON.parse(storage);
// loaded.computed is empty or stale

// Recompute computed values when needed:
import { evaluateComputed } from "@manifesto-ai/core";
const result = evaluateComputed(schema, loaded);
if (result.ok) {
  const fresh = { ...loaded, computed: result.value };
  // fresh.computed is now up-to-date
}
```

---

## Why Snapshot is the Only Medium

### Problem: Hidden State Channels

Traditional systems have multiple communication channels:

```typescript
// Traditional (multiple channels)
const result = await executeEffect(); // Value channel
core.resume(result);                  // Hidden continuation
context.set('temp', result);          // Context channel
eventBus.emit('done', result);        // Event channel
```

Problems:
- Hard to trace where values come from
- Non-deterministic (order-dependent)
- Cannot serialize complete state
- Cannot reproduce computation

### Solution: Single Channel

Manifesto has **one and only one** channel:

```typescript
// Manifesto (single channel)
const patches = await executeEffect();
const context = { now: 0, randomSeed: "seed" };
snapshot = core.apply(schema, snapshot, patches, context);
await core.compute(schema, snapshot, intent, context);
```

Benefits:
- Complete state visibility
- Deterministic (same input → same output)
- Serializable (entire world can be saved)
- Reproducible (replay by re-applying patches)

---

## Common Misconceptions

### Misconception 1: "Computed is cached"

**Wrong:** Computed values might be cached for performance.

**Right:** Computed values are **always** recalculated. There is no caching guarantee.

If you need caching, store the result in `data`.

### Misconception 2: "Snapshot is just state"

**Wrong:** Snapshot is like Redux state.

**Right:** Snapshot includes:
- Domain state (data)
- Derived values (computed)
- Runtime state (system)
- Transient input (input)
- Metadata (meta)

It's the **complete picture**, not just business state.

### Misconception 3: "I can pass values outside Snapshot"

**Wrong:** Effect handlers can return values to Flows.

**Right:** Effect handlers return **patches**. The next compute() reads the result from Snapshot.

```typescript
// WRONG
async function handler() {
  const result = await api.call();
  return result; // Where does this go?
}

// RIGHT
async function handler() {
  const result = await api.call();
  return [{
    op: 'set',
    path: 'apiResult',
    value: result
  }];
}
```

---

## Snapshot in the Computation Cycle

```
┌─────────────────────────────────────────┐
│ Snapshot₀ (initial)                     │
│   data: { count: 0 }                    │
└────────────────┬────────────────────────┘
                 │ Intent: "increment"
                 ▼
       ┌─────────────────────┐
       │  Core.compute()     │
       └─────────┬───────────┘
                 │ Returns: patches
                 ▼
┌─────────────────────────────────────────┐
│ Snapshot₁ (after apply)                 │
│   data: { count: 1 }                    │
│   meta.version: 1                       │
└─────────────────────────────────────────┘
```

---

## Requirements

From SPEC.md:

- Snapshots MUST be immutable
- `version` MUST be incremented on every change
- `computed` MUST be consistent with `data` (no stale values)
- All communication between Host and Core happens through Snapshot

---

## Related Concepts

- **Patch** - Atomic mutation instruction
- **World** - Immutable record wrapping Snapshot with governance metadata
- **Requirement** - Effect declaration stored in `system.pendingRequirements`
- **ComputedSpec** - Defines how computed values are derived

---

## See Also

- [Schema Specification](/specifications/schema-spec) - Normative specification
- [Core FDR](/rationale/core-fdr) - Design rationale including Snapshot as Only Medium
- [Data Flow](/architecture/data-flow) - How Snapshot moves through layers
- [Effect](./effect) - How effects modify Snapshot
