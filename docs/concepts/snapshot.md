# Snapshot

> The default application-facing read model in Manifesto.

## What Snapshot Means Now

In current SDK runtimes, `snapshot()` returns the app-facing Snapshot for
ordinary application code.

Use it for rendering, selectors, agent context, server responses, and tests that
assert visible domain behavior:

```typescript
const snapshot = app.snapshot();

console.log(snapshot.state.todos);
console.log(snapshot.computed.activeCount);
```

That Snapshot is intentionally smaller than the full internal runtime state:

- it includes domain `state`
- it includes public `computed` values
- it includes a small `system` area for runtime status and errors
- it includes `meta.schemaHash`
- it excludes infrastructure residue such as `namespaces.host`,
  `namespaces.mel`, `system.pendingRequirements`, `system.currentAction`,
  `input`, and internal runtime counters

You only need the full internal state for persistence, restore, history-aware
tooling, or deep runtime debugging.

## Snapshot vs Full Internal Snapshot

Skip this section while learning app development. App code should stay on
`snapshot()` and the `result.after` Snapshot returned from `submit()`. The SDK
also exposes `inspect.canonicalSnapshot()` for advanced tooling; the name is
part of the API, not something most app code needs to use.

```typescript
type Snapshot<TState = unknown> = {
  readonly state: TState;
  readonly computed: Record<string, unknown>;
  readonly system: {
    status: "idle" | "computing" | "pending" | "error";
    lastError: ErrorValue | null;
  };
  readonly meta: {
    schemaHash: string;
  };
};

type CanonicalSnapshot<TState = unknown> = {
  readonly state: TState;
  readonly computed: Record<string, unknown>;
  readonly system: {
    status: "idle" | "computing" | "pending" | "error";
    lastError: ErrorValue | null;
    pendingRequirements: readonly Requirement[];
    currentAction: string | null;
  };
  readonly input: unknown;
  readonly meta: {
    version: number;
    timestamp: number;
    randomSeed: string;
    schemaHash: string;
  };
  readonly namespaces: {
    host?: Record<string, unknown>;
    mel?: Record<string, unknown>;
    [namespace: string]: unknown;
  };
};
```

The distinction is by layer:

- Core and Host operate on the full internal snapshot
- SDK and application code default to the app-facing Snapshot
- history persistence and restore operate on full internal snapshots

## Reading State

Escalate to the full internal snapshot only when you need infrastructure
detail:

```typescript
const canonical = app.inspect.canonicalSnapshot();

console.log(canonical.namespaces.host);
console.log(canonical.system.pendingRequirements);
console.log(canonical.meta.version);
```

## Persistence and Restore

The app-facing Snapshot is not the persistence record.

- use `snapshot()` for rendering, selectors, and public application reads
- use full internal snapshots for hashing, sealing, restore, and forensic inspection

In practice, history APIs work with full internal snapshots, while the active
SDK runtime keeps `snapshot()` as the safe default read.

## Key Properties

- **Immutable**: both default and full snapshot reads are mutation-safe
- **App-facing by default**: ordinary app code does not see namespaces or orchestration residue unless it asks for the full internal snapshot
- **Full state underneath**: the full internal snapshot still exists and remains the Core/Host communication medium
- **Schema-aware**: `meta.schemaHash` stays visible in the app-facing Snapshot because it identifies the read model's schema without leaking runtime residue

## See Also

- [Intent](./intent.md) - How changes are requested
- [Effect](./effect.md) - How external operations work
- [When You Need Approval or History](/guides/approval-and-history) - When history becomes a product need
- [Flow](./flow.md) - How computations modify state
