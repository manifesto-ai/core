# Manifesto Architecture

> Source: `docs/architecture/layers.md`, `packages/core/docs/core-SPEC.md`, `packages/host/docs/host-SPEC.md`, `packages/sdk/docs/sdk-SPEC.md`, `packages/lineage/docs/lineage-SPEC.md`, `packages/governance/docs/governance-SPEC.md`
> Last synced: 2026-04-06

## Rules

> **R1**: Core computes, Host executes. These concerns never mix.
> **R2**: Snapshot is the only medium of communication. If it's not in Snapshot, it doesn't exist.
> **R3**: There is no suspended execution context. All continuity is expressed through Snapshot or sealed records, not hidden runtime state.
> **R4**: Effects are declarations, not executions. Core declares; Host fulfills.
> **R5**: Governed composition is explicit. Lineage and Governance decorate the SDK runtime; they do not replace Host/Core boundaries.

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
- **Total**: Business-logic failures are reported as values, not thrown.
- **Traceable**: Compute returns a trace graph for explainability.
- **Resumable via Snapshot**: Host applies `patches` + `systemDelta`, then re-enters `compute()` with the new snapshot.

## Current Runtime Paths

### Base runtime

```text
createManifesto(schema, effects)
  -> activate()
  -> SDK runtime
  -> Host
  -> Core
```

### Governed composition

```text
createManifesto(schema, effects)
  -> withLineage(...)
  -> withGovernance(...)
  -> activate()
  -> governed runtime
  -> SDK runtime
  -> Host
  -> Core
```

### Optional MEL frontend

```text
MEL source -> Compiler -> DomainSchema -> SDK / Host / Core
```

## Package Sovereignty

| Package | Responsibility | MUST NOT |
|---------|----------------|----------|
| **Core** | Pure computation, expression evaluation, flow interpretation, patch generation, validation, explanation | IO, wall-clock access, effect execution, runtime/governance policy |
| **Host** | Effect execution, patch application, compute loop orchestration, requirement fulfillment | Compute semantic meaning, suppress declared effects, make legitimacy decisions |
| **SDK** | Public direct-dispatch runtime, projected reads, availability queries, action metadata, projected introspection, telemetry | Invent semantics outside Core/Host contracts, own continuity/legitimacy policy |
| **Lineage** | Sealing continuity, restore, branch/head state, stored world snapshots | Host execution micro-steps, authority policy |
| **Governance** | Proposal lifecycle, authority evaluation, decision records, governed publication | Host execution micro-steps, implicit lineage creation |
| **Compiler** | MEL parsing, validation, lowering, schema derivation | Runtime execution, effect fulfillment, approval policy |

## Snapshot Boundary

At the current SDK boundary:

- `getSnapshot()` is the projected application-facing read
- `getCanonicalSnapshot()` is the explicit full substrate read
- `getSchemaGraph()` is projected static introspection
- `simulate()` is a non-committing projected dry-run

At the Core/Host boundary, the canonical snapshot remains the whole substrate.

## Current Governed Structure

- `@manifesto-ai/lineage` owns continuity and sealing
- `@manifesto-ai/governance` owns legitimacy and proposals
- `@manifesto-ai/sdk` remains the runtime substrate they compose over
- top-level `@manifesto-ai/world` is not part of the current maintained package story

## Platform Namespaces

- `$host` is Host-owned internal state
- `$mel` is compiler-owned guard state
- `$system.*` values are surfaced in MEL and lowered through platform mechanics
- domain schemas must not define `$`-prefixed fields

## Why

- **Determinism**: Core can be tested without mocks
- **Auditability**: governed composition records legitimacy and continuity explicitly
- **Portability**: Host remains the execution seam
- **Clarity**: SDK is the direct app-facing runtime; Lineage/Governance add continuity and legitimacy explicitly

## Cross-References

- MEL syntax: `@knowledge/mel-patterns.md`
- Effect handlers: `@knowledge/effect-patterns.md`
- Patch operations: `@knowledge/patch-rules.md`
- SDK package API: `@knowledge/packages/sdk.md`
- Lineage package API: `@knowledge/packages/lineage.md`
- Governance package API: `@knowledge/packages/governance.md`
