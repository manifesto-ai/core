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

Example:
- Base: `packages/core/docs/SPEC-v2.0.0.md`
- Patch: `packages/core/docs/SPEC-v2.0.1-patch.md`
- Effective spec: v2.0.1

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
- App v2.1.0 (base + patch)
  - `packages/app/docs/APP-SPEC-v2.0.0.md`
  - `packages/app/docs/APP-SPEC-v2.1.0-patch.md`
- Compiler (MEL) v0.5.0 (full)
  - `packages/compiler/docs/SPEC-v0.5.0.md`

Intent + translation:
- Intent IR v0.2.0 (full)
  - `packages/intent-ir/docs/SPEC-v0.2.0.md`
- Translator v1.0.3 (full)
  - `packages/translator/core/docs/translator-SPEC-v1.0.3.md`

## ADRs (authoritative decisions)
Global ADRs:
- ADR-002: onceIntent + $mel namespace
  - `docs/adr/adr-002-onceIntent-mel-namespace.md`

Translator ADRs:
- ADR-001 v1.0.8
  - `packages/translator/core/docs/translator-ADR-001-v1.0.8.md`
- ADR-001 v0.11 (historical reference)
  - `packages/translator/core/docs/translator-ADR-001-v0.11.md`
- ADR-002 v0.11
  - `packages/translator/core/docs/translator-ADR-002-v0.11.md`
- ADR-003 v0.11
  - `packages/translator/core/docs/translator-ADR-003-v0.11.md`

## FDRs (design rationale)
Core:
- Core FDR v2.0.0
  - `packages/core/docs/FDR-v2.0.0.md`

Host:
- Host FDR v2.0.2
  - `packages/host/docs/host-FDR-v2.0.2.md`

World:
- World FDR v2.0.2
  - `packages/world/docs/world-FDR-v2.0.2.md`
- World Event FDR v1.0.0
  - `packages/world/docs/WORLD-EVENT-FDR-v1.0.0.md`

App (all current app FDRs are additive):
- `packages/app/docs/FDR-APP-EXT-001-v0.4.0.md`
- `packages/app/docs/FDR-APP-INTEGRATION-001-v0.4.0.md`
- `packages/app/docs/FDR-APP-POLICY-001-v0.2.3.md`
- `packages/app/docs/FDR-APP-PUB-001-v0.3.0.md`
- `packages/app/docs/FDR-APP-RUNTIME-001-v0.2.0.md`

Compiler (MEL):
- FDR v0.5.0 (full)
  - `packages/compiler/docs/FDR-v0.5.0.md`

Intent IR:
- FDR v0.1.0
  - `packages/intent-ir/docs/FDR-v0.1.0.md`

Translator:
- FDR v0.11
  - `packages/translator/core/docs/translator-FDR-v0.11.md`

## Supporting indexes
- Global spec index: `docs/internals/spec/index.md`
- Package version indexes:
  - `packages/core/docs/VERSION-INDEX.md`
  - `packages/host/docs/VERSION-INDEX.md`
  - `packages/world/docs/VERSION-INDEX.md`
  - `packages/app/docs/VERSION-INDEX.md`
  - `packages/compiler/docs/VERSION-INDEX.md`
  - `packages/intent-ir/docs/VERSION-INDEX.md`

## Archives
Historical docs live under `archives/`. Treat these as non-authoritative unless explicitly requested.
