# Manifesto LLM Knowledge Pack Index

Purpose: provide a stable map of sources that match the current repo layout and package ownership.

## Normative hierarchy

1. SPEC
2. FDR
3. ADR
4. Guides / README

When implementation and historical docs diverge, use the implemented current package surface for coding tasks.

## Current code-writing sources

### Core

- `packages/core/docs/core-SPEC.md`
- `packages/core/docs/VERSION-INDEX.md`
- `packages/core/src/index.ts`

### Host

- `packages/host/docs/host-SPEC.md`
- `packages/host/docs/VERSION-INDEX.md`
- `packages/host/src/index.ts`

### SDK

- `packages/sdk/docs/sdk-SPEC.md`
- `packages/sdk/docs/VERSION-INDEX.md`
- `packages/sdk/src/index.ts`
- `packages/sdk/src/types.ts`
- `packages/sdk/src/create-manifesto.ts`

### Lineage

- `packages/lineage/docs/lineage-SPEC.md`
- `packages/lineage/docs/VERSION-INDEX.md`
- `packages/lineage/src/index.ts`

### Governance

- `packages/governance/docs/governance-SPEC.md`
- `packages/governance/docs/VERSION-INDEX.md`
- `packages/governance/src/index.ts`

### Compiler

- `packages/compiler/docs/SPEC-v0.7.0.md`
- `packages/compiler/docs/SPEC-v0.8.0.md`
- `packages/compiler/docs/VERSION-INDEX.md`
- `packages/compiler/src/index.ts`

### Codegen

- `packages/codegen/docs/SPEC-v0.1.1.md`
- `packages/codegen/docs/VERSION-INDEX.md`
- `packages/codegen/src/index.ts`

## Current architecture references

- `docs/architecture/layers.md`
- `docs/internals/spec/index.md`
- `docs/concepts/world.md`
- `docs/internals/glossary.md`

## Current rationale / decision references

- `packages/sdk/docs/FDR-v3.1.0-draft.md`
- `docs/internals/adr/014-split-world-protocol.md`
- `docs/internals/adr/015-snapshot-ontological-purification.md`
- `docs/internals/adr/017-capability-decorator-pattern.md`
- `docs/internals/adr/018-public-snapshot-boundary.md`

## Historical references

These are not the default coding target unless a task explicitly targets migration or archaeology:

- retired `@manifesto-ai/world` docs
- versioned historical specs such as `*-v*.md`
- archive documents

## Legacy note

Older application-layer docs and world-facade notes may still exist for historical context. They are not part of the current routing baseline for new code changes.
