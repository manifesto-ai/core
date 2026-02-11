# Architecture Decision Records

> **Purpose:** Document significant architectural decisions
> **Audience:** Contributors, maintainers, architects
> **Status:** Normative

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
- Current architecture description (see [Architecture](../architecture))

---

## Global ADRs

These ADRs affect multiple packages across the monorepo:

| ID | Title | Status | Date | Affected Packages |
|----|-------|--------|------|-------------------|
| [ADR-001](./001-layer-separation) | Layer Separation after Host v2.0.1 | Accepted | 2025-01-17 | Core, Host, World |
| [ADR-002](./002-dx-improvement-mel-namespace-onceIntent) | DX 개선 — `$mel` 네임스페이스 자동 주입 + `onceIntent` 문법 추가 | Proposed | 2026-01-27 | App, Compiler, World, Core, Host |
| [ADR-003](./003-world-owns-persistence) | World Owns Persistence | Proposed | 2026-02-03 | App, World |
| [ADR-004](./004-app-package-internal-decomposition) | App Package Internal Decomposition | Proposed | 2026-02-07 | App |
| [ADR-005](./005-dx-improvement-snapshot-path-dsl) | DX 개선 — Snapshot Path DSL (`${...}`) 도입 | Withdrawn | 2026-02-10 | Core, Host, World, App, Compiler |
| [ADR-006](./006-runtime-reframing) | Publish Boundary, Canonicalization, and Channel Separation Rules | Proposed | 2026-02-10 | Core, Host, World, App |

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
| **Accepted** | Approved and implemented |
| **Withdrawn** | Reviewed and explicitly retracted with documented rationale |
| **Deprecated** | No longer recommended but may still be in use |
| **Superseded** | Replaced by a newer ADR |

---

## SPEC Patches from ADRs

ADRs often result in SPEC patches. Here's the traceability:

### ADR-001: Layer Separation

| Package | SPEC Patch | Changes |
|---------|------------|---------|
| World | v2.0.1 | Event ownership, boundary definition |
| Host | v2.0.2 | Snapshot type alignment |

### ADR-002: DX Improvements

| Package | SPEC Patch | Changes |
|---------|------------|---------|
| Compiler | v0.5.0 | `$mel` namespace, `onceIntent` syntax |
| App | v2.1.0 | Platform namespace injection |
| World | v2.0.3 | `$mel` namespace hash exclusion |
| Core | v2.0.1 | Namespace alignment |
| Host | v2.0.2 | `$host` namespace |

### ADR-003: World Owns Persistence (+ Issue #109)

| Package | SPEC Patch | Changes |
|---------|------------|---------|
| World | v2.0.5 | Head Query API, resume contract, branch state persistence |
| App | v2.3.1 | Head Query delegation (`getHeads()`, `getLatestHead()`) |

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

> **Status:** Proposed | Accepted | Deprecated | Superseded
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

- [Architecture](../architecture) - Current architecture overview
- [Specifications](../spec/) - Normative contracts
- [Design Rationale](../fdr/) - Why decisions were made
