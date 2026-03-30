# Manifesto LLM Knowledge Pack Index

Purpose: provide a stable map of sources that match the current repo layout.

## Normative hierarchy
1) SPEC
2) FDR
3) ADR
4) Guides / README

When implementation and future-design docs diverge, use the implemented package surface for coding tasks.

## Current code-writing sources

### Core
- `packages/core/docs/core-SPEC.md`
- `packages/core/docs/VERSION-INDEX.md`
- `packages/core/src/index.ts`

### Host
- `packages/host/docs/host-SPEC.md`
- `packages/host/docs/VERSION-INDEX.md`
- `packages/host/src/index.ts`

### World
- `packages/world/docs/world-facade-spec-v1.0.0.md`
- `packages/world/docs/VERSION-INDEX.md`
- `packages/world/src/index.ts`
- `packages/world/src/facade/index.ts`

Note: top-level `@manifesto-ai/world` is the exact governed facade in the current repo.

### Governance
- `packages/governance/docs/governance-SPEC-1.0.0v.md`
- `packages/governance/docs/VERSION-INDEX.md`
- `packages/governance/src/index.ts`

### Lineage
- `packages/lineage/docs/lineage-SPEC-1.0.1v.md`
- `packages/lineage/docs/VERSION-INDEX.md`
- `packages/lineage/src/index.ts`

### SDK
- `packages/sdk/docs/sdk-SPEC-v2.0.0.md`
- `packages/sdk/docs/VERSION-INDEX.md`
- `packages/sdk/src/index.ts`
- `packages/sdk/src/types.ts`
- `packages/sdk/src/create-manifesto.ts`

### Compiler
- `packages/compiler/docs/SPEC-v0.7.0.md`
- `packages/compiler/docs/VERSION-INDEX.md`
- `packages/compiler/src/index.ts`

### Codegen
- `packages/codegen/docs/SPEC-v0.1.1.md`
- `packages/codegen/docs/VERSION-INDEX.md`

## Future-split / design-only references

These are useful next-major drafts, but they are not the default coding target unless a task explicitly targets them:

- `packages/sdk/docs/sdk-SPEC-v3.0.0-draft.md`
- `packages/governance/docs/governance-SPEC-2.0.0v.md`
- `packages/lineage/docs/lineage-SPEC-2.0.0v.md`
- `packages/world/docs/world-facade-spec-v2.0.0.md`

Use them for next-major direction, not as the primary basis for current code changes.

## ADRs

- ADR-002: `onceIntent` + `$mel` namespace
- ADR-010: protocol-first SDK reconstruction
- ADR-014: split world protocol

## Legacy note

Older application-layer docs and migration notes may still exist for historical context. They are not part of the current routing baseline for new code changes.

## Archives

Historical docs under `archive/` remain useful for archaeology, but they are not the primary source for new code unless a task explicitly targets historical behavior.
