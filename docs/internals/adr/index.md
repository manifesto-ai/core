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

---

## Package-Specific ADRs

### Translator ADRs

The translator package maintains its own ADRs for translation-specific decisions:

| ID | Title | Version | Status |
|----|-------|---------|--------|
| [ADR-001](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/translator/docs/translator-ADR-001-v1.0.8.md) | Clean Architecture | v1.0.8 | Accepted |
| [ADR-002](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/translator/docs/translator-ADR-002-v0.11.md) | Decompose Layer Design | v0.11 | Accepted |
| [ADR-003](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/translator/docs/translator-ADR-003-v0.11.md) | Decompose Layer Compliance | v0.11 | Accepted |

::: info Translator ADR Versions
Translator ADRs are versioned with SPEC versions. ADR-001 has two versions:
- v0.11: Initial Clean Architecture proposal
- v1.0.8: Updated after SPEC v1.0.3 implementation
:::

---

## ADR Status Definitions

| Status | Meaning |
|--------|---------|
| **Proposed** | Under discussion, not yet implemented |
| **Accepted** | Approved and implemented |
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
