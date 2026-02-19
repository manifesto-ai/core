# SPEC Index

> Source: ./llm/LLM-INDEX.md
> Last synced: 2026-02-09

## Normative Hierarchy

1. **SPEC** — highest authority
2. **FDR** — design rationale; must not contradict SPEC
3. **ADR** — architectural decisions; must not contradict SPEC/FDR
4. **Code** — implementation
5. **README** — lowest authority

When documents conflict, prefer higher-ranked sources.

## How to Read Patch Documents

Some SPECs are published as base + patch. Read the base first, then apply the patch. The composed document is authoritative.

Example: Core v2.0.1 = `SPEC-v2.0.0.md` + `SPEC-v2.0.1-patch.md`

## Core Packages

### Core v2.0.1

- Base: `packages/core/docs/SPEC-v2.0.0.md`
- Patch: `packages/core/docs/SPEC-v2.0.1-patch.md`
- FDR: `packages/core/docs/FDR-v2.0.0.md`

Key sections: §3 Constitution, §8 FlowSpec, §13 Snapshot, §14 Validation, §16 Host Interface

### Host v2.0.2

- `packages/host/docs/host-SPEC-v2.0.2.md`
- FDR: `packages/host/docs/host-FDR-v2.0.2.md`

Key sections: §7 Effect Handler Contract, §8 Requirement Lifecycle, §10 Execution Model, §13 Error Handling

### World v2.0.3

- `packages/world/docs/world-SPEC-v2.0.3.md`
- Patches: `world-SPEC-v2.0.5-patch.md`
- FDR: `packages/world/docs/world-FDR-v2.0.2.md`

Key sections: Governance, Proposals, Authority, Head semantics, Branch persistence

## Application Layer

### App v2.3.1 (base + patches)

- Base: `packages/app/docs/APP-SPEC-v2.0.0.md`
- Patches: `APP-SPEC-v2.1.0-patch.md`, `APP-SPEC-v2.3.0.md`, `APP-SPEC-v2.3.1-patch.md`
- FDRs: Multiple (integration, policy, runtime, ext, pub)

Key sections: §8 Host Integration (effect registration)

### Compiler (MEL) v0.5.0

- `packages/compiler/docs/SPEC-v0.5.0.md`
- FDR: `packages/compiler/docs/FDR-v0.5.0.md`

Key sections: §2 Design Principles, §4 Syntax, §6 Semantic Rules, §8 Forbidden Constructs, §14 Examples, §21 $mel Namespace, Appendix (LLM 34-rule checklist)

## Intent + Translation

### Intent IR v0.2.0

- `packages/intent-ir/docs/SPEC-v0.2.0.md`
- FDR: `packages/intent-ir/docs/FDR-v0.1.0.md`

### Translator v1.0.3

- `packages/translator/core/docs/translator-SPEC-v1.0.3.md`
- FDR: `packages/translator/core/docs/translator-FDR-v0.11.md`

## Global ADRs

- ADR-002: onceIntent + $mel namespace → `docs/adr/adr-002-onceIntent-mel-namespace.md`

## Quick Lookup

| Need to understand... | Go to |
|----------------------|-------|
| Snapshot structure | Core SPEC §13 |
| Patch operations | Core SPEC §8.4.3, §14 |
| Effect handler contract | Host SPEC §7, §13 |
| MEL syntax | Compiler SPEC §4 |
| Flow guards (when/once/onceIntent) | Compiler SPEC §21 |
| Forbidden constructs | Compiler SPEC §8 |
| World governance | World SPEC §5-8 |
| App composition | App SPEC §8 |
| LLM code generation rules | Compiler SPEC Appendix |

## FDR Canonical Statements

| Statement | Source |
|-----------|--------|
| "Core computes. Host executes. These concerns never mix." | FDR-001 |
| "If it's not in Snapshot, it doesn't exist." | FDR-002 |
| "There is no suspended execution context." | FDR-003 |
| "Core declares requirements. Host fulfills them." | FDR-004 |
| "Errors are values. They live in Snapshot. They never throw." | FDR-005 |
| "Flows always terminate. Unbounded iteration is Host's responsibility." | FDR-006 |
| "If you need a value, read it from Snapshot. There is no other place." | FDR-007 |
| "Three operations are enough. Complexity is composed, not built-in." | FDR-012 |
