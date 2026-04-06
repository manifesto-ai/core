# Snapshot

> The default application-facing read model in Manifesto.

## What Snapshot Means Now

In current SDK runtimes, `getSnapshot()` returns a **projected Snapshot** for ordinary application code.

That projected Snapshot is intentionally smaller than the full runtime substrate:

- it includes domain `data`
- it includes public `computed` values
- it includes `system.status` and `system.lastError`
- it includes `meta.schemaHash`
- it excludes infrastructure residue such as `data.$host`, `data.$mel`, `system.pendingRequirements`, `system.currentAction`, `input`, and canonical runtime counters

If you need the full substrate, use `getCanonicalSnapshot()`.

## Snapshot vs CanonicalSnapshot

```typescript
type Snapshot<TData = unknown> = {
  readonly data: TData;
  readonly computed: Record<string, unknown>;
  readonly system: {
    status: "idle" | "computing" | "pending" | "error";
    lastError: ErrorValue | null;
  };
  readonly meta: {
    schemaHash: string;
  };
};

type CanonicalSnapshot<TData = unknown> = {
  readonly data: TData & CanonicalPlatformNamespaces;
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
};
```

The distinction is by layer:

- Core and Host operate on the canonical full substrate
- SDK and application code default to the projected Snapshot
- Lineage persistence and restore operate on canonical snapshots

## Reading State

Use the projected Snapshot for normal UI and application logic:

```typescript
const snapshot = instance.getSnapshot();

console.log(snapshot.data.todos);
console.log(snapshot.computed.activeCount);
console.log(snapshot.system.lastError);
```

Escalate to the canonical substrate only when you need infrastructure detail:

```typescript
const canonical = instance.getCanonicalSnapshot();

console.log(canonical.data.$host);
console.log(canonical.system.pendingRequirements);
console.log(canonical.meta.version);
```

## Persistence and Restore

Projected Snapshot is not a persistence substrate.

- use `getSnapshot()` for rendering, selectors, and public application reads
- use canonical snapshots for hashing, sealing, restore, and forensic inspection

In practice, that means lineage storage and governed-history APIs work with canonical snapshots, while the active SDK runtime keeps `getSnapshot()` as the safe default read.

## Key Properties

- **Immutable**: both projected and canonical snapshot reads are mutation-safe
- **Projected by default**: ordinary app code does not see `$*` namespaces or orchestration residue unless it asks for canonical state
- **Canonical underneath**: the full substrate still exists and remains the only Core/Host communication medium
- **Schema-aware**: `meta.schemaHash` stays visible in the projected Snapshot because it identifies the read model's schema without leaking runtime residue

## See Also

- [Intent](./intent.md) - How changes are requested
- [Effect](./effect.md) - How external operations work
- [World](./world) - How sealed history and governance wrap canonical snapshots
- [Flow](./flow.md) - How computations modify canonical state
