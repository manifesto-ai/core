# Foundational Design Rationale (FDR)

This page serves as a hub linking to the authoritative FDR documents maintained in each package's `docs/` directory.

::: tip What is FDR?
FDR documents explain **why** design decisions were made. They complement SPECs (which define **what**) by providing rationale, alternatives considered, and consequences.
:::

## Package FDRs

### Core Packages

| Package | Latest FDR | Scope | Package Docs |
|---------|------------|-------|--------------|
| **@manifesto-ai/core** | v2.0.0 | Compute equation, purity, patches | [FDR-v2.0.0.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/core/docs/FDR-v2.0.0.md) |
| **@manifesto-ai/host** | v2.0.2 | Event-loop, snapshot ownership | [host-FDR-v2.0.2.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/host/docs/host-FDR-v2.0.2.md) |
| **@manifesto-ai/world** | v2.0.2 | Governance, lineage, namespaces | [world-FDR-v2.0.2.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/world/docs/world-FDR-v2.0.2.md) |
| **@manifesto-ai/builder** | v1.0.0 | DSL design, type safety | [FDR-v1.0.0.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/builder/docs/FDR-v1.0.0.md) |

### Application Layer

| Package | Latest FDR | Scope | Package Docs |
|---------|------------|-------|--------------|
| **@manifesto-ai/app** | Multiple | See below | [VERSION-INDEX](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/app/docs/VERSION-INDEX.md) |
| **@manifesto-ai/compiler** | v0.5.0-patch | MEL syntax, IR design | [FDR-v0.5.0-patch.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/compiler/docs/FDR-v0.5.0-patch.md) |

### Intent & Translation

| Package | Latest FDR | Scope | Package Docs |
|---------|------------|-------|--------------|
| **@manifesto-ai/intent-ir** | v0.1.0 | Chomskyan LF, canonicalization | [FDR-v0.1.0.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/intent-ir/docs/FDR-v0.1.0.md) |
| **@manifesto-ai/translator** | v0.11 | Translation pipeline | [translator-FDR-v0.11.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/translator/core/docs/translator-FDR-v0.11.md) |

---

## App Package FDRs

The App package has multiple focused FDR documents:

| FDR | Version | Scope |
|-----|---------|-------|
| [FDR-APP-PUB-001](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/app/docs/FDR-APP-PUB-001-v0.3.0.md) | v0.3.0 | Tick definition, publish boundary |
| [FDR-APP-RUNTIME-001](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/app/docs/FDR-APP-RUNTIME-001-v0.2.0.md) | v0.2.0 | Lifecycle, hooks, plugins |
| [FDR-APP-INTEGRATION-001](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/app/docs/FDR-APP-INTEGRATION-001-v0.4.0.md) | v0.4.0 | HostExecutor, WorldStore |
| [FDR-APP-POLICY-001](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/app/docs/FDR-APP-POLICY-001-v0.2.3.md) | v0.2.3 | ExecutionKey, authority |
| [FDR-APP-EXT-001](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/app/docs/FDR-APP-EXT-001-v0.4.0.md) | v0.4.0 | MemoryStore, context freezing |

---

## Quick Links to Key FDRs

### Core FDR Highlights

**Core v2.0.0** - Foundational compute model
- FDR-C001: Pure compute equation
- FDR-C002: Snapshot immutability
- FDR-C003: Patch-only mutation

**Host v2.0.2** - Execution model
- FDR-H001~H022: Event-loop, concurrency
- FDR-H023: Context determinism
- FDR-H024~H027: Snapshot type alignment

**World v2.0.2** - Governance model
- FDR-W001~W020: Proposal, Authority, Decision
- FDR-W021+: Host-World data contract

### Intent IR Research

For academic-depth FDR content on Intent IR, see:
- [Theoretical Foundations](/internals/research/intent-ir/theory)
- [Formal Definitions](/internals/research/intent-ir/formal)

---

## FDR Document Structure

Each FDR typically contains:

```markdown
## FDR-XXX: Decision Title

### Decision
What was decided.

### Context
Why the decision was needed.

### Rationale
Why this option was chosen.

### Alternatives Rejected
What other options were considered.

### Consequences
What follows from this decision.
```

---

## Reading Guide

1. **Start with SPEC** - Understand what the system does
2. **Read FDR for "why"** - Understand design rationale
3. **Check ADRs** - For cross-cutting architectural decisions

FDR versions typically align with SPEC versions. When reading a SPEC patch, check if there's a corresponding FDR patch.
