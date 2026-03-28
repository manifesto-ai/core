# SPEC Index

> Source: `./llm/LLM-INDEX.md`
> Last synced: 2026-03-28

## Normative Hierarchy

1. **SPEC**
2. **FDR**
3. **ADR**
4. **Code**
5. **README**

When documents conflict, prefer the higher-ranked source. When docs describe future package splits that are not implemented in code yet, use current package exports and source layout for coding tasks.

## Current Code-Writing Baseline

### Core

- `packages/core/docs/core-SPEC.md`
- `packages/core/docs/VERSION-INDEX.md`

Use for: constitution, snapshot structure, patch semantics, validation, `SystemDelta`.

### Host

- `packages/host/docs/host-SPEC.md`
- `packages/host/docs/VERSION-INDEX.md`

Use for: effect handler contract, requirement lifecycle, execution model, Host/Core boundary.

### World

- `packages/world/src/index.ts`
- `packages/world/src/world.ts`
- `packages/world/docs/VERSION-INDEX.md`
- `packages/world/docs/world-SPEC.md`

Use for: actual implemented `@manifesto-ai/world` API, proposal flow, authority evaluation, persistence, event emission, lineage helpers.

Important: current repo code still targets monolithic `@manifesto-ai/world`. Treat governance/lineage split docs as design context unless you are explicitly editing docs.

### SDK

- `packages/sdk/docs/sdk-SPEC-v1.0.0.md`
- `packages/sdk/docs/VERSION-INDEX.md`
- `packages/sdk/src/index.ts`
- `packages/sdk/src/types.ts`
- `packages/sdk/src/create-manifesto.ts`

Use for: `createManifesto()`, `ManifestoConfig`, `ManifestoInstance`, `dispatchAsync`, typed events, typed patch helpers.

### Compiler

- `packages/compiler/docs/SPEC-v0.7.0.md`
- `packages/compiler/docs/VERSION-INDEX.md`
- `packages/compiler/src/index.ts`

Use for: MEL syntax, compiler public API, bundler integrations, compile diagnostics, patch compilation.

### Codegen

- `packages/codegen/docs/SPEC-v0.1.1.md`
- `packages/codegen/docs/VERSION-INDEX.md`

Use for: code generation plugin contracts.

## Design / Future-Split References

These docs are real, but they are not the current code-writing target for implementation work in this repo:

- `packages/governance/docs/VERSION-INDEX.md`
- `packages/governance/docs/governance-SPEC-1.0.0v.md`
- `packages/lineage/docs/VERSION-INDEX.md`
- `packages/lineage/docs/lineage-SPEC-1.0.1v.md`
- `packages/world/docs/world-facade-spec-v1.0.0.md`

Use them to understand ADR-014 direction and package split intent. Do not treat them as proof that separate `@manifesto-ai/governance` or `@manifesto-ai/lineage` code packages are implemented here.

## Global ADRs Worth Loading

- ADR-002: `onceIntent` + `$mel` namespace
- ADR-010: protocol-first SDK reconstruction
- ADR-014: split world protocol design direction

## Quick Lookup

| Need to understand... | Go to |
|----------------------|-------|
| Snapshot structure | `packages/core/docs/core-SPEC.md` |
| `patches` + `systemDelta` contract | `packages/core/docs/core-SPEC.md`, `packages/core/src/schema/result.ts` |
| Effect handler contract | `packages/host/docs/host-SPEC.md`, `packages/sdk/src/types.ts` |
| SDK instance API | `packages/sdk/src/types.ts`, `packages/sdk/src/create-manifesto.ts` |
| `dispatchAsync` | `packages/sdk/src/dispatch-async.ts` |
| Current World implementation surface | `packages/world/src/index.ts`, `packages/world/src/world.ts` |
| World docs and transition context | `packages/world/docs/VERSION-INDEX.md` |
| Governance / lineage split direction | `packages/governance/docs/VERSION-INDEX.md`, `packages/lineage/docs/VERSION-INDEX.md` |
| MEL syntax | `packages/compiler/docs/SPEC-v0.7.0.md` |
| Compiler public API | `packages/compiler/src/index.ts` |
