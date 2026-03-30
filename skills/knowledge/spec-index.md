# SPEC Index

> Source: `./llm/LLM-INDEX.md`
> Last synced: 2026-03-31

## Normative Hierarchy

1. **SPEC**
2. **FDR**
3. **ADR**
4. **Code**
5. **README**

When documents conflict, prefer the higher-ranked source. When current and next-major docs diverge, use the current exported package surface for coding tasks unless the task explicitly targets a draft.

## Current Code-Writing Baseline

### Core

- `packages/core/docs/core-SPEC.md`
- `packages/core/docs/VERSION-INDEX.md`
- `packages/core/src/index.ts`

Use for: constitution, current Snapshot shape, patch semantics, validation, `SystemDelta`, and availability query API.

### Host

- `packages/host/docs/host-SPEC.md`
- `packages/host/docs/VERSION-INDEX.md`
- `packages/host/src/index.ts`

Use for: effect handler contract, requirement lifecycle, execution model, and Host/Core boundary.

### World

- `packages/world/docs/world-facade-spec-v1.0.0.md`
- `packages/world/docs/VERSION-INDEX.md`
- `packages/world/src/index.ts`
- `packages/world/src/facade/index.ts`

Use for: top-level governed composition, `createWorld()`, `WorldRuntime`, store contract, and the exact facade-owned execution boundary.

### Governance

- `packages/governance/docs/governance-SPEC-1.0.0v.md`
- `packages/governance/docs/VERSION-INDEX.md`
- `packages/governance/src/index.ts`

Use for: proposal lifecycle, authority evaluation, governance events, and proposal persistence semantics.

### Lineage

- `packages/lineage/docs/lineage-SPEC-1.0.1v.md`
- `packages/lineage/docs/VERSION-INDEX.md`
- `packages/lineage/src/index.ts`

Use for: world identity, seal attempts, branch/head/tip rules, restore, replay, and continuity persistence.

### SDK

- `packages/sdk/docs/sdk-SPEC-v2.0.0.md`
- `packages/sdk/docs/VERSION-INDEX.md`
- `packages/sdk/src/index.ts`
- `packages/sdk/src/types.ts`
- `packages/sdk/src/create-manifesto.ts`

Use for: `createManifesto()`, `ManifestoConfig`, `ManifestoInstance`, availability queries, `dispatchAsync`, typed events, and typed patch helpers.

### Compiler

- `packages/compiler/docs/SPEC-v0.7.0.md`
- `packages/compiler/docs/VERSION-INDEX.md`
- `packages/compiler/src/index.ts`

Use for: MEL syntax, compiler public API, bundler integrations, compile diagnostics, patch compilation.

### Codegen

- `packages/codegen/docs/SPEC-v0.1.1.md`
- `packages/codegen/docs/VERSION-INDEX.md`

Use for: code generation plugin contracts.

## Next-Major Draft References

These docs are real, but they are not the current code-writing target unless the task explicitly targets a draft:

- `packages/sdk/docs/sdk-SPEC-v3.0.0-draft.md`
- `packages/governance/docs/governance-SPEC-2.0.0v.md`
- `packages/lineage/docs/lineage-SPEC-2.0.0v.md`
- `packages/world/docs/world-facade-spec-v2.0.0.md`

Use them to understand projected next-major changes. Do not let them override current package exports unless the task is explicitly about the draft.

## Global ADRs Worth Loading

- ADR-002: `onceIntent` + `$mel` namespace
- ADR-010: protocol-first SDK reconstruction
- ADR-014: split world protocol design direction
- ADR-015: current Snapshot error-history removal
- ADR-016: next-major lineage/governance/world epoch direction

## Quick Lookup

| Need to understand... | Go to |
|----------------------|-------|
| Snapshot structure | `packages/core/docs/core-SPEC.md` |
| `patches` + `systemDelta` contract | `packages/core/docs/core-SPEC.md`, `packages/core/src/schema/result.ts` |
| Availability query API | `packages/core/docs/core-SPEC.md`, `packages/core/src/core/action-availability.ts`, `packages/sdk/src/create-manifesto.ts` |
| Effect handler contract | `packages/host/docs/host-SPEC.md`, `packages/sdk/src/types.ts` |
| SDK instance API | `packages/sdk/src/types.ts`, `packages/sdk/src/create-manifesto.ts` |
| `dispatchAsync` | `packages/sdk/src/dispatch-async.ts` |
| Current governed facade surface | `packages/world/src/index.ts`, `packages/world/src/facade/index.ts`, `packages/world/docs/world-facade-spec-v1.0.0.md` |
| Governance package surface | `packages/governance/src/index.ts`, `packages/governance/docs/VERSION-INDEX.md` |
| Lineage package surface | `packages/lineage/src/index.ts`, `packages/lineage/docs/VERSION-INDEX.md` |
| MEL syntax | `packages/compiler/docs/SPEC-v0.7.0.md` |
| Compiler public API | `packages/compiler/src/index.ts` |
