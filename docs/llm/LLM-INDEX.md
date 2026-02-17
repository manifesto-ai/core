# Manifesto LLM Knowledge Pack Index

Purpose: Provide a stable map of authoritative sources (SPEC, FDR, ADR) for LLM consumption.

## Normative hierarchy
1) SPEC (highest authority)
2) FDR (design rationale; must not contradict SPEC)
3) ADR (architectural decisions; must not contradict SPEC/FDR)
4) Guides/README (lowest authority)

## How to read patch documents
If a SPEC/FDR is published as a patch:
- Read the base document first
- Apply the patch document in order
- The composed document is the authoritative version

## Latest SPECs (authoritative)
Core packages:
- Core v2.0.1 (base + patch)
  - `packages/core/docs/SPEC-v2.0.0.md`
  - `packages/core/docs/SPEC-v2.0.1-patch.md`
- Host v2.0.2 (full)
  - `packages/host/docs/host-SPEC-v2.0.2.md`
- World v2.0.3 (full)
  - `packages/world/docs/world-SPEC-v2.0.3.md`

Application layer:
- SDK v0.1.0 (kickoff-locked spec baseline)
  - `packages/sdk/docs/sdk-SPEC-v0.1.0.md`
- Runtime v0.1.0 (kickoff-locked spec baseline)
  - `packages/runtime/docs/runtime-SPEC-v0.1.0.md`
- Compiler (MEL) v0.5.0 (full)
  - `packages/compiler/docs/SPEC-v0.5.0.md`

Intent + translation:
- Intent IR v0.2.0 (full)
  - `packages/intent-ir/docs/SPEC-v0.2.0.md`
- Translator v1.0.3 (full)
  - `packages/translator/core/docs/translator-SPEC-v1.0.3.md`

## ADRs (authoritative decisions)
Global ADRs:
- ADR-006: Runtime reframing
  - `docs/internals/adr/006-runtime-reframing.md`
- ADR-007: SDK/Runtime split kickoff
  - `docs/internals/adr/007-sdk-runtime-split-kickoff.md`
- ADR-008: SDK-first entry + app retirement
  - `docs/internals/adr/008-sdk-first-transition-and-app-retirement.md`

Translator ADRs:
- ADR-001 v1.0.8
  - `packages/translator/core/docs/translator-ADR-001-v1.0.8.md`
- ADR-002 v0.11
  - `packages/translator/core/docs/translator-ADR-002-v0.11.md`
- ADR-003 v0.11
  - `packages/translator/core/docs/translator-ADR-003-v0.11.md`

## FDRs (design rationale)
Core:
- `packages/core/docs/FDR-v2.0.0.md`

Host:
- `packages/host/docs/host-FDR-v2.0.2.md`

World:
- `packages/world/docs/world-FDR-v2.0.2.md`
- `packages/world/docs/WORLD-EVENT-FDR-v1.0.0.md`

Compiler:
- `packages/compiler/docs/FDR-v0.5.0.md`

Intent IR:
- `packages/intent-ir/docs/FDR-v0.1.0.md`

Translator:
- `packages/translator/core/docs/translator-FDR-v0.11.md`

## Supporting indexes
- Global spec index: `docs/internals/spec/index.md`
- Package version indexes:
  - `packages/core/docs/VERSION-INDEX.md`
  - `packages/host/docs/VERSION-INDEX.md`
  - `packages/world/docs/VERSION-INDEX.md`
  - `packages/sdk/docs/VERSION-INDEX.md`
  - `packages/runtime/docs/VERSION-INDEX.md`
  - `packages/compiler/docs/VERSION-INDEX.md`
  - `packages/intent-ir/docs/VERSION-INDEX.md`

## Legacy note
The former app compatibility facade was removed in R2. Retirement record:
- `docs/api/app.md`

## Archives
Historical docs live under `archives/`. Treat these as non-authoritative unless explicitly requested.
