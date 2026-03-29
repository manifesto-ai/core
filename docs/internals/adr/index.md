# Architecture Decision Records

> **Purpose:** Document significant architectural decisions
> **Audience:** Contributors, maintainers, architects
> **Status:** Historical decision index

---

## What are ADRs?

**ADR** stands for **Architecture Decision Record** — documents that capture important architectural decisions along with their context and consequences.

ADRs are:
- **Immutable records** of decisions made at a point in time
- **Context-rich** explanations of why decisions were made
- **Historical artifacts** showing evolution of the architecture

ADRs are NOT:
- Specifications (see [Specifications](../spec/))
- Design rationale (see [FDR](../fdr/))
- Current architecture description (see [Architecture](/architecture/))

Use ADRs to understand why the architecture changed. Use package READMEs, API docs, and current specs to understand how the current system works.

---

## Global ADRs

These ADRs affect multiple packages across the monorepo:

| ID | Title | Status | Date | Affected Packages |
|----|-------|--------|------|-------------------|
| [ADR-001](./001-layer-separation) | Layer Separation after Host v2.0.1 | Accepted | 2025-01-17 | Core, Host, World |
| [ADR-002](./002-dx-improvement-mel-namespace-onceIntent) | DX improvement — auto `$mel` namespace injection + `onceIntent` syntax | Implemented | 2026-01-27 | App, Compiler, World, Core, Host |
| [ADR-003](./003-world-owns-persistence) | World Owns Persistence | Proposed | 2026-02-03 | App, World |
| [ADR-004](./004-app-package-internal-decomposition) | App Package Internal Decomposition | Proposed | 2026-02-07 | App |
| [ADR-005](./005-dx-improvement-snapshot-path-dsl) | DX improvement — Snapshot Path DSL (`${...}`) introduction | Withdrawn | 2026-02-10 | Core, Host, World, App, Compiler |
| [ADR-006](./006-runtime-reframing) | Publish Boundary, Canonicalization, and Channel Separation Rules | Proposed | 2026-02-10 | Core, Host, World, App |
| [ADR-007](./007-sdk-runtime-split-kickoff) | SDK/Runtime Split Kickoff Gate and Staged Locking | Superseded | 2026-02-14 | App, Runtime, SDK, World |
| [ADR-008](./008-sdk-first-transition-and-app-retirement) | SDK-First Public Entry and App Package Retirement | Deprecated | 2026-02-17 | SDK, Runtime, Docs, Release, CI |
| [ADR-009](./009-structured-patch-path) | Structured PatchPath (Segments) | Implemented | 2026-02-25 | Core, Compiler, Host, Runtime, World |
| [ADR-010](./010-major-hard-cut) | Protocol-First SDK Reconstruction | Implemented | 2026-02-27 | Core, Runtime, Host, World, SDK |
| [ADR-011](./011-host-boundary-reset-and-executionkey-serialization) | Host Boundary Reset Completeness Policy | Implemented | 2026-02-25 | Host, Runtime, World, SDK |
| [ADR-012](./012-remove-computed-prefix) | Remove `computed.` Prefix from Computed Snapshot Keys | Implemented | 2026-03-05 | Core, Compiler, Host, SDK, Docs |
| [ADR-013a](./013a-mel-statement-composition-flow-and-include) | MEL Statement Composition — `flow` and `include` | Proposed | 2026-03-24 | Compiler |
| [ADR-013b](./013b-entity-collection-primitives) | Entity Collection Primitives — `findById`, `existsById`, `updateById`, `removeById` | Proposed | 2026-03-24 | Compiler |
| [ADR-014](./014-split-world-protocol) | Split World Protocol into Governance and Lineage Packages | Implemented | 2026-03-28 | World, Governance, Lineage, SDK, Docs |
| [ADR-015](./015-snapshot-ontological-purification) | Snapshot Ontological Purification — Remove Accumulated History from Point-in-Time State | Accepted | 2026-03-29 | Core, Lineage, Host, World, SDK |
| [ADR-016](./016-merkle-tree-lineage) | Merkle Tree Lineage — Positional World Identity via Parent-Linked Hashing | Proposed | 2026-03-29 | Lineage, Governance |

### ADR-006 Companion Evidence (Non-Normative)

- [ADR-006 Evidence Matrix](./006-evidence-matrix) - Rule-to-implementation and test traceability while ADR-006 remains Proposed.
- [ADR-006 Split Readiness Pack](./006-split-readiness-pack) - Fixed baseline, current readiness verdict, and owner decision cards for package split planning.

### Supersede Notes

- ADR-007 partially supersedes ADR-004 §7.4 and ADR-006 §5 for split kickoff timing and gating policy.
- ADR-008 supersedes ADR-007 Phase 1 entrypoint guardrails by promoting SDK as canonical public entry and retiring App.
- ADR-007 does not supersede ADR-001 layer separation principles (package split is not a new layer).
- ADR-010 supersedes ADR-008. ADR-008 is deprecated as historical transition record; ADR-010 is the active boundary.
- ADR-010 accepts ADR-008 outcomes and converts App-retirement policy from migration guidance into canonical hard-cut.
- ADR-010 is the active boundary for submit/dispatch API simplification; public `createApp` surface is removed in v1+ implementation.
- ADR-010 supersedes SDK-SPEC v0.1.0/v0.2.0 via SDK-SPEC v1.0.0. Runtime-SPEC v0.1.0/v0.2.0 are retired (no successor).

### ADR-009 Companion Notes

- ADR-009 is an implemented cross-cutting decision that completed the path-representation rewrite for patching across Core/Compiler/Host/Runtime/World.
- The rule set is now reflected in Core/Compiler/Host/World normative docs and runtime/store code paths.
- [ADR-009 Week 1 Convergence Pack](./009-week1-convergence-pack) - Frozen gap matrix, decision-complete ticket set, and Week 2 PR wave plan.

### ADR-010 Companion Notes

- ADR-010 defines the protocol-first reconstruction of the SDK as a thin composition layer with `createManifesto()` as its sole owned concept.
- This ADR explicitly removes App-layer semantic coupling in product-facing APIs. ActionHandle, Session, Hook, Plugin, and 20+ binding-layer concepts are retired.
- ADR-010 lifts the old SDK SPEC v0.1.0 kickoff lock for `submitProposal`, `createApp`, and legacy `App` aliases.
- Public migration contract for v1 is `createManifesto()` returning `ManifestoInstance` with `dispatch()` as the single action entrypoint.
- ADR-010 supersedes SDK SPEC v0.1.0 and v0.2.0 via SDK SPEC v1.0.0.
- ADR-010 retires Runtime SPEC v0.1.0 and v0.2.0 (no successor — responsibilities absorbed into `createManifesto`).
- ADR-010 is now implemented in the current SDK/package layout; the remaining split-related work belongs to ADR-014 rather than this hard-cut.

### ADR-011 Companion Notes

- ADR-011 defines Host boundary baseline-completeness policy for reset/Bootstrap entry.
- It is the host-runtime contract companion to #198, scoped to full-canonical snapshot continuity at boundary entry.
- executionKey serialization and timeout-slot release remain Host SPEC v2.0.3 enforcement work, not architecture decisions in this ADR.
- 011 is implemented via Host SPEC v3.0.0 and boundary-entry hardening; §2.2/§2.3 remains enforced as Host SPEC behavior, not extra ADR text.

### ADR-013 Split Notes

- There is no standalone `ADR-013` file in the repository.
- The original mixed ADR-013 draft was withdrawn and split into `ADR-013a` (`flow`/`include`) and `ADR-013b` (entity collection primitives) for separate review and approval.

### ADR-014 Companion Notes

- ADR-014 is an accepted protocol split of `@manifesto-ai/world` into `@manifesto-ai/governance` and `@manifesto-ai/lineage`.
- [Lineage SPEC v1.0.1](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC-1.0.1v.md) now exists as the canonical continuity-engine document.
- [Governance SPEC v1.0.0](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/governance-SPEC-1.0.0v.md) now exists as the canonical legitimacy-engine document.
- [World Facade SPEC v1.0.0](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-facade-spec-v1.0.0.md) now exists as the canonical compatibility-facade document.
- [World SPEC](../spec/#world) remains the legacy monolith reference during staged transition.

### ADR-015 Companion Notes

- ADR-015 is accepted and removes accumulated `system.errors` history from Snapshot while keeping `lastError` as the sole current error surface.
- The decision reserves the next breaking Core/Lineage epoch; current published specs remain Core v3.0.0 and Lineage v1.0.1 until the living docs are updated.
- ADR-015 now pairs with [ADR-016](./016-merkle-tree-lineage), the proposed lineage-side companion for the same co-deployed epoch boundary.

### ADR-016 Companion Notes

- ADR-016 is currently proposed as the lineage identity rewrite companion to ADR-015: WorldId becomes parent-linked positional identity instead of content-only identity.
- The draft introduces `tip` / `headAdvancedAt`, idempotent reuse for same-parent same-snapshot seals, and `SealAttempt` as the per-attempt chronology substrate.
- If the draft is accepted as written, the projected version impact is Lineage v2.0.0, Governance v1.1.0, Host v3.1.0, and World v3.1.0 for the shared epoch boundary.

---

## Package-Specific ADRs

### Translator ADRs

The translator package maintains its own ADRs for translation-specific decisions:

| ID | Title | Version | Status |
|----|-------|---------|--------|
| [ADR-001](https://github.com/manifesto-ai/core/blob/main/packages/translator/core/docs/translator-ADR-001-v1.0.8.md) | Clean Architecture | v1.0.8 | Accepted |
| [ADR-002](https://github.com/manifesto-ai/core/blob/main/packages/translator/core/docs/translator-ADR-002-v0.11.md) | Decompose Layer Design | v0.1.1 | Accepted |
| [ADR-003](https://github.com/manifesto-ai/core/blob/main/packages/translator/core/docs/translator-ADR-003-v0.11.md) | Decompose Layer Compliance | v0.1.1 | Accepted |

::: info Translator ADR Versions
Translator ADRs are versioned with SPEC versions. ADR-001 has two versions:
- v0.1.1: Initial Clean Architecture proposal
- v1.0.8: Updated after SPEC v1.0.3 implementation
:::

### Codegen ADRs

The codegen package maintains its own ADRs for code generation decisions:

| ID | Title | Version | Status |
|----|-------|---------|--------|
| [ADR-CODEGEN-001](https://github.com/manifesto-ai/core/blob/main/packages/codegen/docs/ADR-CODEGEN-001.md) | Plugin-Based Codegen Targets for Manifesto Domains | v0.3.1 | Accepted |

---

## ADR Status Definitions

| Status | Meaning |
|--------|---------|
| **Proposed** | Under discussion, not yet implemented |
| **Accepted** | Approved, implementation started or pending |
| **Implemented** | Approved and fully reflected in SPEC/Changelog |
| **Withdrawn** | Reviewed and explicitly retracted with documented rationale |
| **Deprecated** | No longer recommended but may still be in use |
| **Superseded** | Replaced by a newer ADR |

---

## SPEC Changes from ADRs

ADRs often result in SPEC changes. Here's the traceability:

### ADR-001: Layer Separation

| Package | SPEC Version | Changes |
|---------|------------|---------|
| World | v2.0.1 | Event ownership, boundary definition |
| Host | v2.0.2 | Snapshot type alignment |

### ADR-002: DX Improvements

| Package | SPEC Version | Changes |
|---------|------------|---------|
| Compiler | v0.5.0 | `$mel` namespace, `onceIntent` syntax |
| App | v2.1.0 | Platform namespace injection |
| World | v2.0.3 | `$mel` namespace hash exclusion |
| Core | v2.0.1 | Namespace alignment |
| Host | v2.0.2 | `$host` namespace |

### ADR-003: World Owns Persistence (+ Issue #109)

| Package | SPEC Version | Changes |
|---------|------------|---------|
| World | v2.0.5 | Head Query API, resume contract, branch state persistence |
| App | v2.3.1 | Head Query delegation (`getHeads()`, `getLatestHead()`) |

### ADR-010: Protocol-First SDK Reconstruction

| Package | SPEC Version | Changes |
|---------|------------|---------|
| SDK | v1.0.0 | Complete reconstruction: `createManifesto()`, `ManifestoInstance` (5 methods), Runtime absorbed |
| Runtime | (retired) | Superseded — no successor SPEC. Responsibilities absorbed into `createManifesto()` |

---

## ADR Process

### When to Write an ADR

Write an ADR when:
- Making a significant architectural change
- Resolving ambiguity in layer boundaries
- Introducing new patterns or conventions
- Making decisions that affect multiple packages

### ADR Template

```markdown
# ADR-XXX: [Title]

> **Status:** Proposed | Accepted | Implemented | Deprecated | Superseded
> **Date:** YYYY-MM-DD
> **Deciders:** [List of decision makers]
> **Scope:** [Affected packages/layers]

## Context
[What is the issue that we're seeing that is motivating this decision?]

## Decision
[What is the change that we're proposing and/or doing?]

## Consequences
[What becomes easier or more difficult as a result of this change?]
```

---

## Related Documents

- [Architecture](/architecture/) - Current architecture overview
- [Specifications](../spec/) - Normative contracts
- [Design Rationale](../fdr/) - Why decisions were made
