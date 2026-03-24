# SPEC Index

> Source: ./llm/LLM-INDEX.md
> Last synced: 2026-03-02

## Normative Hierarchy

1. **SPEC** — highest authority
2. **FDR** — design rationale; must not contradict SPEC
3. **ADR** — architectural decisions; must not contradict SPEC/FDR
4. **Code** — implementation
5. **README** — lowest authority

When documents conflict, prefer higher-ranked sources.

## How to Read SPECs

Core, Host, and World SPECs are **Living Documents** — single consolidated files with inline changelogs and FDR rationale. Previous versioned files are archived.

Other package SPECs use versioned files (e.g., `SPEC-v0.6.0.md`).

## Core Packages

### Core v3.0.0 (Living Document)

- `packages/core/docs/core-SPEC.md`
- FDR: Inlined in the living document

Key sections: §3 Constitution, §8 FlowSpec (structured PatchPath), §13 Snapshot, §14 Validation, §16 Host Interface

### Host v3.0.0 (Living Document)

- `packages/host/docs/host-SPEC.md`
- FDR: Inlined in the living document (FDR-H018~H027)

Key sections: §4 Core-Host Boundary, §7 Effect Handler Contract, §8 Requirement Lifecycle, §9 Execution Model, §10 Context Determinism

### World v3.0.0 (Living Document)

- `packages/world/docs/world-SPEC.md`
- FDR: Inlined in the living document (FDR-W001~W038)

Key sections: §5 Core Entities, §6 Proposal Lifecycle, §7 Host Integration, §8 Event System, §9 Persistence

## Application Layer

### SDK v1.0.0 (ADR-010)

- `packages/sdk/docs/sdk-SPEC-v1.0.0.md`
- Implements: ADR-010 (Protocol-First SDK Reconstruction)

Key sections: §5 createManifesto() Factory, §6 ManifestoInstance Interface, §8 Event Channel, §11 Invariants (INV-1~6)

**Note:** SDK owns exactly one concept — `createManifesto()`. All other exports are re-exports from protocol packages.

### Runtime (Retired)

- `@manifesto-ai/runtime` is retired per ADR-010. Responsibilities absorbed into `createManifesto()`.
- Historical SPEC: `packages/runtime/docs/runtime-SPEC-v0.2.0.md` (Superseded, no successor)

### Compiler (MEL) v0.7.0

- `packages/compiler/docs/SPEC-v0.7.0.md`
- FDR: `packages/compiler/docs/FDR-v0.5.0-patch.md`

Key sections: §2 Design Principles, §4 Syntax, §6 Semantic Rules, §8 Forbidden Constructs, §9.1.10 Object Functions, §14 Examples, §21 $mel Namespace, Appendix (LLM 34-rule checklist)

## Global ADRs

- ADR-002: onceIntent + $mel namespace → `docs/internals/adr/002-dx-improvement-mel-namespace-onceIntent.md`
- ADR-010: Protocol-First SDK Reconstruction → `docs/internals/adr/010-major-hard-cut.md`

## Quick Lookup

| Need to understand... | Go to |
|----------------------|-------|
| Snapshot structure | Core SPEC §13 |
| Patch operations (structured PatchPath) | Core SPEC §8.4.3, §14 |
| Effect handler contract | Host SPEC §7, §9 |
| MEL syntax | Compiler SPEC §4 |
| Flow guards (when/once/onceIntent) | Compiler SPEC §21 |
| Forbidden constructs | Compiler SPEC §8 |
| World governance | World SPEC §5-8 |
| SDK composition (createManifesto) | SDK SPEC v1.0.0 §5 |
| ManifestoInstance API | SDK SPEC v1.0.0 §6 |
| Event channel (dispatch lifecycle) | SDK SPEC v1.0.0 §8 |
| SDK invariants (INV-1~6) | SDK SPEC v1.0.0 §11 |
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
| "Same meaning, same hash. Always." | FDR-010 |
| "Computed values flow downward. They never cycle back." | FDR-011 |
| "Three operations are enough. Complexity is composed, not built-in." | FDR-012 |
| "Manifesto is a protocol. createManifesto() assembles it." | ADR-010 |
