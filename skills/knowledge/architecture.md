# Manifesto Architecture

> Source: `packages/core/docs/core-SPEC.md`, `packages/host/docs/host-SPEC.md`, `packages/sdk/docs/sdk-SPEC-v1.0.0.md`, current `packages/world/src/*`
> Last synced: 2026-03-28

## Rules

> **R1**: Core computes, Host executes. These concerns never mix.
> **R2**: Snapshot is the only medium of communication. If it's not in Snapshot, it doesn't exist.
> **R3**: There is no suspended execution context. All continuity is expressed through Snapshot.
> **R4**: Effects are declarations, not executions. Core declares; Host fulfills.
> **R5**: If you need a value, read it from Snapshot. There is no other place.

## The Fundamental Equation

```typescript
compute(schema, snapshot, intent, context) -> {
  patches,
  systemDelta,
  trace,
  status,
}
```

- **Pure**: Same input must produce the same result.
- **Total**: Business logic failures are reported as values, not thrown.
- **Traceable**: Compute returns a trace graph for explainability.
- **Resumable via Snapshot**: Host applies `patches` + `systemDelta`, then re-enters `compute()` with the new snapshot.

## Runtime Paths

Two practical paths exist in the current repo:

```text
SDK-style app
  createManifesto()
    -> Host
    -> Core
```

```text
Governed path
  Actor submits IntentInstance
    -> World
    -> HostExecutor
    -> Host
    -> Core
    -> new World state + lineage records
```

The separate `@manifesto-ai/governance` and `@manifesto-ai/lineage` packages are not implemented code targets in this repo yet. They currently exist as split-design documentation only.

## Package Sovereignty

| Package | Responsibility | MUST NOT |
|---------|---------------|----------|
| **Core** | Pure computation, expression evaluation, flow interpretation, patch generation, validation, explanation | IO, wall-clock access, effect execution, Host/World policy |
| **Host** | Effect execution, patch application, compute loop orchestration, requirement fulfillment | Compute semantic meaning, suppress declared effects, make governance decisions |
| **World** | Proposal lifecycle, authority evaluation, lineage DAG, persistence, governance event emission | Import `@manifesto-ai/host` directly, compute semantic meaning, apply Core patches itself |
| **SDK** | Public app entrypoint (`createManifesto`), typed effect registration, `dispatchAsync`, typed patch helpers, selected re-exports | Invent semantics outside Core/Host/World public contracts |

## Current `world` Note

In this repo's implementation, `@manifesto-ai/world` is still the active monolithic package for:

- actor registry
- proposal queue and state machine
- authority handlers and evaluation
- lineage DAG helpers
- persistence interfaces and in-memory store
- governance event emission
- `HostExecutor` boundary

ADR-014 split docs are useful for future direction, but not the current implementation baseline for code changes.

## Snapshot Structure

```typescript
type Snapshot = {
  data: unknown;
  computed: Record<string, unknown>;
  system: {
    status: "idle" | "computing" | "pending" | "error";
    lastError: ErrorValue | null;
    errors: ErrorValue[];
    pendingRequirements: Requirement[];
    currentAction: string | null;
  };
  input: unknown;
  meta: {
    version: number;
    timestamp: number;
    randomSeed: string;
    schemaHash: string;
  };
};
```

## Compute / Apply Cycle

```text
Host calls compute(schema, snapshot, intent, context)
  -> Core returns patches + systemDelta + trace + status
  -> Host applies patches
  -> Host applies systemDelta
  -> If status is pending, Host fulfills requirements and calls compute() again
```

Each `compute()` call is complete and independent. Continuity lives in the snapshot, not in hidden runtime state.

## Platform Namespaces

- `$host` is Host-owned internal state.
- `$mel` is compiler-owned guard state.
- `$system.*` values are surfaced in MEL and lowered through platform mechanics.
- Domain schemas must not define `$`-prefixed fields.

## Why

- **Determinism**: Core can be tested without mocks.
- **Auditability**: World records proposal and decision lineage.
- **Portability**: Host remains the execution seam.
- **Clarity**: SDK is the public app-facing layer, while World is optional governance/orchestration around Host.

## Cross-References

- MEL syntax: `@knowledge/mel-patterns.md`
- Effect handlers: `@knowledge/effect-patterns.md`
- Patch operations: `@knowledge/patch-rules.md`
- World package API: `@knowledge/packages/world.md`
