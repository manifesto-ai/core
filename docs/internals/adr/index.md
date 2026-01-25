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

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001](./001-layer-separation) | Layer Separation after Host v2.0.1 | Accepted | 2025-01-17 |

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
