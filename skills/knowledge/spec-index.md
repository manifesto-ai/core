# SPEC Index

> Source: `./llm/LLM-INDEX.md`
> Last synced: 2026-04-06

## Normative Hierarchy

1. **SPEC**
2. **FDR**
3. **ADR**
4. **Code**
5. **README**

When documents conflict, prefer the higher-ranked source. When historical docs and living docs diverge, use the current maintained package surface for coding tasks unless the task explicitly targets history.

## Current Code-Writing Baseline

### Core

- `packages/core/docs/core-SPEC.md`
- `packages/core/docs/VERSION-INDEX.md`
- `packages/core/src/index.ts`

Use for: canonical snapshot shape, patch semantics, `SystemDelta`, compute/apply contract, validation, explainability, availability.

### Host

- `packages/host/docs/host-SPEC.md`
- `packages/host/docs/VERSION-INDEX.md`
- `packages/host/src/index.ts`

Use for: effect handler contract, requirement lifecycle, execution model, Host/Core boundary.

### SDK

- `packages/sdk/docs/sdk-SPEC.md`
- `packages/sdk/docs/VERSION-INDEX.md`
- `packages/sdk/src/index.ts`
- `packages/sdk/src/types.ts`
- `packages/sdk/src/create-manifesto.ts`

Use for: `createManifesto(schema, effects)`, activation boundary, typed refs, `createIntent`, `dispatchAsync`, projected reads, `getCanonicalSnapshot`, `getSchemaGraph`, `simulate`, and public runtime types.

### Lineage

- `packages/lineage/docs/lineage-SPEC.md`
- `packages/lineage/docs/VERSION-INDEX.md`
- `packages/lineage/src/index.ts`
- `packages/lineage/src/runtime-types.ts`

Use for: `withLineage()`, `commitAsync`, restore, branch/head queries, sealing continuity, stored world snapshots.

### Governance

- `packages/governance/docs/governance-SPEC.md`
- `packages/governance/docs/VERSION-INDEX.md`
- `packages/governance/src/index.ts`
- `packages/governance/src/runtime-types.ts`

Use for: `withGovernance()`, explicit lineage prerequisite, proposal lifecycle, authority evaluation, decision records, governed runtime surface.

### Compiler

- `packages/compiler/docs/SPEC-v0.7.0.md`
- `packages/compiler/docs/SPEC-v0.8.0.md`
- `packages/compiler/docs/VERSION-INDEX.md`
- `packages/compiler/src/index.ts`

Use for: MEL syntax, compiler public API, bundler integrations, compile diagnostics, and current `SchemaGraph` extraction addendum.

### Codegen

- `packages/codegen/docs/SPEC-v0.1.1.md`
- `packages/codegen/docs/VERSION-INDEX.md`
- `packages/codegen/src/index.ts`

Use for: code generation plugin contracts.

## Current FDR / ADR References Worth Loading

- `packages/sdk/docs/FDR-v3.1.0-draft.md` for accepted rationale behind `SchemaGraph` and `simulate()`
- `docs/internals/adr/014-split-world-protocol.md` for split history
- `docs/internals/adr/015-snapshot-ontological-purification.md` for current error-surface removal
- `docs/internals/adr/017-capability-decorator-pattern.md` for activation-first SDK and decorator composition
- `docs/internals/adr/018-public-snapshot-boundary.md` for projected vs canonical snapshot boundary

## Historical References

Use only when the task explicitly targets migration or archaeology:

- retired `@manifesto-ai/world` docs
- versioned `*-v*.md` historical specs
- archive documents under `archive/`

## Quick Lookup

| Need to understand... | Go to |
|----------------------|-------|
| Snapshot structure | `packages/core/docs/core-SPEC.md` |
| `patches` + `systemDelta` contract | `packages/core/docs/core-SPEC.md` |
| Effect handler contract | `packages/host/docs/host-SPEC.md`, `packages/sdk/src/types.ts` |
| SDK instance API | `packages/sdk/src/types.ts`, `packages/sdk/docs/sdk-SPEC.md` |
| `getCanonicalSnapshot()` | `packages/sdk/docs/sdk-SPEC.md`, `docs/internals/adr/018-public-snapshot-boundary.md` |
| `getSchemaGraph()` / `simulate()` | `packages/sdk/docs/sdk-SPEC.md`, `packages/sdk/docs/FDR-v3.1.0-draft.md` |
| `withLineage()` runtime | `packages/lineage/src/index.ts`, `packages/lineage/docs/lineage-SPEC.md` |
| `withGovernance()` runtime | `packages/governance/src/index.ts`, `packages/governance/docs/governance-SPEC.md` |
| MEL syntax | `packages/compiler/docs/SPEC-v0.7.0.md` |
| Compiler introspection addendum | `packages/compiler/docs/SPEC-v0.8.0.md` |
