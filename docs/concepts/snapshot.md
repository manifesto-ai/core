# Snapshot

> The complete state of a system at a point in time.

## What is Snapshot?

Snapshot is the single source of truth in Manifesto. It captures everything about your application's state: domain data, derived values, runtime status, and metadata.

**If it's not in Snapshot, it doesn't exist.** All communication between layers happens through Snapshot. There are no hidden channels, no side-band data, no implicit context.

This design enables complete state visibility, deterministic computation, and full reproducibility. You can serialize a Snapshot, replay it later, and get identical results.

## Structure

```typescript
type Snapshot<TData = unknown> = {
  /** Domain data (your business state) */
  readonly data: TData;

  /** Computed values (derived, never stored) */
  readonly computed: Record<string, unknown>;

  /** System state (runtime status, errors, pending effects) */
  readonly system: {
    status: 'idle' | 'computing' | 'pending' | 'error';
    lastError: ErrorValue | null;
    errors: readonly ErrorValue[];
    pendingRequirements: readonly Requirement[];
    currentAction: string | null;
  };

  /** Transient input for current action */
  readonly input: unknown;

  /** Metadata */
  readonly meta: {
    version: number;      // Monotonically increasing
    timestamp: number;    // When last modified
    randomSeed: string;   // Deterministic randomness
    schemaHash: string;   // Schema this conforms to
  };
};
```

## Key Properties

- **Immutable**: Snapshots never change after creation. Any modification produces a new Snapshot.
- **Complete**: Contains all state needed to understand the system.
- **Versioned**: `meta.version` increments by exactly 1 per change.
- **Content-addressable**: Can be hashed for identity comparison.

## Example

```typescript
const snapshot: Snapshot = {
  data: {
    todos: [
      { id: "1", title: "Buy milk", completed: false },
      { id: "2", title: "Write code", completed: true }
    ],
    filter: "all"
  },
  computed: {
    activeCount: 1,
    completedCount: 1
  },
  system: {
    status: 'idle',
    lastError: null,
    errors: [],
    pendingRequirements: [],
    currentAction: null
  },
  input: null,
  meta: {
    version: 42,
    timestamp: 1704067200000,
    randomSeed: "seed-abc",
    schemaHash: "sha256:..."
  }
};
```

## Common Patterns

### Reading State

```typescript
// Domain data
const todos = snapshot.data.todos;

// Computed values (recalculated, not stored)
const activeCount = snapshot.computed.activeCount;

// Check for errors
if (snapshot.system.lastError) {
  console.log(snapshot.system.lastError.message);
}
```

### Modifying State (via Patches)

```typescript
// NEVER do this
snapshot.data.count = 5; // FORBIDDEN

// Always use patches through Core
const newSnapshot = core.apply(schema, snapshot, [
  { op: 'set', path: 'data.count', value: 5 }
], context);
```

### Persistence

```typescript
// Serialize
const json = JSON.stringify(snapshot);

// Deserialize (computed values need recalculation)
const loaded = JSON.parse(json);
const fresh = core.rehydrate(schema, loaded);
```

## See Also

- [Intent](./intent.md) - How changes are requested
- [Effect](./effect.md) - How external operations work
- [Flow](./flow.md) - How computations modify Snapshot
