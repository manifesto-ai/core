# Foundational Design Rationale (FDR)

This page serves as a hub linking to the authoritative FDR documents maintained in each package's `docs/` directory.

> **Status:** Historical and rationale index

::: tip What is FDR?
FDR documents explain **why** design decisions were made. They complement SPECs (which define **what**) by providing rationale, alternatives considered, and consequences.
:::

## Package FDRs

### Core Packages

| Package | Latest FDR | Scope | Package Docs |
|---------|------------|-------|--------------|
| **@manifesto-ai/core** | v2.0.0 (historical) | Compute equation, purity, patches | [archive/FDR-v2.0.0.md](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/archive/FDR-v2.0.0.md) |
| **@manifesto-ai/host** | v2.0.2 (inlined in host-SPEC) | Event-loop, snapshot ownership | [host-FDR-v2.0.2.md](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/archive/host-FDR-v2.0.2.md) |
| **@manifesto-ai/world (retired)** | v2.0.5 (historical) | Former unified governance/lineage rationale before the protocol split | [world-FDR-v2.0.5-addendum.md](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/archive/world-FDR-v2.0.5-addendum.md) |

### Application Layer

| Package | Latest FDR | Scope | Package Docs |
|---------|------------|-------|--------------|
| **App facade (retired)** | Removed (R2) | Legacy compatibility rationale | [Retired Page](/internals/retired/app) |
| **@manifesto-ai/compiler** | v0.5.0 | MEL syntax, IR design | [FDR-v0.5.0.md](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/FDR-v0.5.0.md) |
| **@manifesto-ai/sdk** | v3.1.0 (draft) | Projected schema graph, full-transition dry-run simulation, and introspection rationale staged into the living SDK spec | [FDR-v3.1.0-draft.md](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/FDR-v3.1.0-draft.md) |

> Core/Host rationale is primarily available in each package SPEC `Rationale` block. The former `@manifesto-ai/world` rationale is retained only as historical split context. SDK currently has a draft additive rationale track for projected introspection APIs; its accepted contract now also appears in the living SDK spec.

---

## App Transition Note

The former app compatibility facade has been removed in R2.
App-era rationale remains part of project history and ADR context (see ADR-007, ADR-008).

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

**SDK v3.1.0 (draft)** - Introspection expansion
- FDR-SDK-001: Projected SchemaGraph influence graph
- FDR-SDK-002: Full-transition `simulate()` dry-run

**Historical World v2.0.5** - Pre-split governance model
- FDR-W001~W020: Proposal, Authority, Decision
- FDR-W021+: Host-World data contract
- FDR-W036~W038: Head query, resume contract (v2.0.5 addendum)

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

Active product and package onboarding should start with maintained docs, not with the FDR hub.

FDR versions typically align with SPEC versions. Prefer reading the SPEC first, then the relevant FDR rationale when needed.
