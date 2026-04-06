# Specifications

This page serves as a hub linking to the authoritative specifications maintained in each package's `docs/` directory, plus draft specification work that has not yet become a landed package surface.

::: tip Single Source of Truth
Specifications are maintained in canonical package docs with version indexes. The current hard-cut surface is: `@manifesto-ai/core` v4.0.0, `@manifesto-ai/host` v4.0.0, `@manifesto-ai/sdk` v3 activation-first, and `@manifesto-ai/lineage` / `@manifesto-ai/governance` as the governed decorator packages. Draft package work that is not yet implemented is listed separately below.
:::

If you want the governing documentation rules, see [Documentation Governance](../documentation-governance.md).

If an older ADR conflicts with a current package SPEC on runtime surface details, the current package SPEC wins.

## Reading Order

1. Read the current package README and VERSION-INDEX for the surface you want to use.
2. Use `docs/api/` for package selection and import guidance.
3. Use the package SPECs for normative behavior.
4. Use archived or historical ADR/SPEC/FDR material only for decision history.

## Current Normative Package Specifications

### Core Runtime

| Package | SPEC | Status | Package Docs |
|---------|------|--------|--------------|
| **@manifesto-ai/core** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/core-SPEC.md) (v4.0.0) | Normative | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/VERSION-INDEX.md) |
| **@manifesto-ai/host** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC.md) (v4.0.0) | Normative | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/VERSION-INDEX.md) |

### Application and Decorator Packages

| Package | SPEC | Status | Package Docs |
|---------|------|--------|--------------|
| **@manifesto-ai/sdk** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC.md) (v3.1.0 surface) | Normative (activation-first entry + introspection) | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/VERSION-INDEX.md) |
| **@manifesto-ai/lineage** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC.md) (v3.0.0 surface) | Normative (decorator continuity package) | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/VERSION-INDEX.md) |
| **@manifesto-ai/governance** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/governance-SPEC.md) (v3.0.0 surface) | Normative (decorator legitimacy package) | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/VERSION-INDEX.md) |
| **@manifesto-ai/runtime** | Retired | Superseded (ADR-010, no successor) — package removed from workspace | — |
| **App facade (retired)** | Removed (R2) | Historical reference only | [Retired Page](/internals/retired/app) |
| **@manifesto-ai/compiler** | v0.7.0 base + v0.8.0 addendum | Normative base + companion addendum | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/VERSION-INDEX.md) |

> **Current Governed Direction:** `createManifesto() -> withLineage() -> withGovernance() -> activate()`

## Draft and Pending Package Specifications

These specs are design-level normative drafts for surfaces that are not yet landed in the active workspace. They are not current public package contracts.

| Package | SPEC | Status | Package Docs |
|---------|------|--------|--------------|
| **@manifesto-ai/planner** | [Draft v1.2.0](./planner-SPEC-v1.2.0-draft) | Normative (Draft, blocked on SDK provider simulation seam) | — |

> **Draft Planned Extension:** `createManifesto() -> withLineage() -> withGovernance() -> withPlanner() -> activate()`

## Historical and Removed References

These references remain available for traceability, but they are not maintained onboarding entry points.

### World Facade Package

`@manifesto-ai/world` was removed from the active workspace in ADR-017 Phase 4. It is no longer a normative package and no longer defines the public governed bootstrap story.

### Historical SDK Surfaces

Historical SDK v0-v2 package specs were removed from the working tree after the activation-first cut. Use Git history when you need archaeology for the ready-instance/runtime-helper era.

The `@manifesto-ai/runtime` package is **retired**. Its responsibilities are absorbed into `createManifesto()` internal wiring.

---

## Quick Links to Latest Specs

### Core

- **Core SPEC** — [core-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/core-SPEC.md) (Living Document, current through v4.0.0)
  - Updated directly in the living document; FDR rationale inlined

### Host

- **Host SPEC** — [host-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC.md) (Living Document, current through v4.0.0)
  - Updated directly in the living document; FDR-H018~H025 inlined
  - Deprecated §9 (Compiler Integration) moved to Appendix D

### Lineage

- **Lineage SPEC** — [lineage-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC.md) (Living Document, current v3.0.0 surface)
  - Defines `withLineage()`, `commitAsync`, `getWorldSnapshot()` stored sealed canonical snapshot lookup, restore, and branch/head runtime queries

### Governance

- **Governance SPEC** — [governance-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/governance-SPEC.md) (Living Document, current v3.0.0 surface)
  - Defines `withGovernance()`, explicit lineage prerequisite, governed `proposeAsync()` flow, pending resolution, and post-seal governance visibility

### SDK

- **SDK SPEC** (Living Document)
  - [sdk-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC.md)
  - Activation-first SDK — `createManifesto()` returns a composable manifesto, runtime verbs appear only after `activate()`, and the current surface includes projected `SchemaGraph` plus `simulate()`

### Planner (Draft)

- **Planner SPEC v1.2.0 (Draft)**
  - [planner-SPEC-v1.2.0-draft.md](./planner-SPEC-v1.2.0-draft)
  - Defines a proposed `withPlanner()` decorator, `createPlanner()` builder, separate strategy/enumerator seams, and the blocking SDK `RuntimeKernel` simulation seam required before implementation

### Compiler (MEL)

- **Compiler SPEC v0.7.0** (Full Base)
  - [SPEC-v0.7.0.md](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v0.7.0.md)
  - Adds: statement composition via `flow`/`include` (ADR-013a) and entity collection primitives `findById()` / `existsById()` / `updateById()` / `removeById()` (ADR-013b)
- **Compiler SPEC v0.8.0** (Companion Addendum)
  - [SPEC-v0.8.0.md](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v0.8.0.md)
  - Defines projected `SchemaGraph` extraction consumed by the current SDK v3.1.0 introspection surface

---

## Version History Summary

### Recent Changes (2026-03)

| Date | Package | Version | Change |
|------|---------|---------|--------|
| 03-31 | Core | v4.0.0 | ADR-015 current hard cut landed: accumulated `system.errors` and `appendErrors` are removed from the current Core contract |
| 03-31 | Lineage | v2.0.0 | ADR-015 + ADR-016 lineage contract landed: current-error hash identity, parent-linked `WorldId`, `SealAttempt`, `tip`, `headAdvancedAt`, idempotent reuse, and restore normalization |
| 03-31 | Governance | v2.0.0 | Governance v2 landed: remove accumulated-error assumptions, remap provenance to `SealAttempt`, and align governance/world seam to the current typed surface |
| 03-31 | Host | v4.0.0 | Current Host alignment follows the Core v4 Snapshot contract and removes `system.errors` from Host-facing Snapshot references |
| 03-31 | SDK | v2.0.0 | Historical pre-ADR-017 SDK surface aligned to the Core v4 Snapshot contract before the activation-first hard cut |
| 03-28 | Governance | v1.0.0 | Governance living SPEC created; package version index added |
| 03-28 | Lineage | v1.0.1 | Lineage living SPEC patch release: adds `BranchInfo.epoch`, `LineageService.getBranch()`, and public-contract epoch reads |
| 03-24 | Compiler | v0.7.0 | Draft compiler SPEC refreshed for ADR-013a (`flow`/`include`) and ADR-013b entity collection primitives |
| 03-02 | SDK | v1.0.0 | ADR-010 hard cut: `createManifesto()` sole entrypoint, Runtime retired |

### Recent Changes (2026-04)

| Date | Package | Version | Change |
|------|---------|---------|--------|
| 04-06 | SDK | v3.1.0 | Living SDK spec promoted the projected introspection surface to current status: `getSchemaGraph()` and `simulate()` are now part of the current package contract |
| 04-07 | Planner | v1.2.0 | Draft planner spec tightened the public contract: `enumerator-first` DX retained, `strategy` split preserved, runtime term-key generics propagated, and `createCoreEnumerator()` defined as intentionally conservative |
| 04-06 | Compiler | v0.8.0 | Companion `SchemaGraph` addendum documented for the current SDK introspection surface |
| 04-01 | SDK | v3.0.0 | ADR-017 landed: activation-first SDK, composable manifesto return, one-shot `activate()`, and instance-owned intent/dispatch flow |
| 04-01 | Lineage | v3.0.0 | `withLineage(...).activate()` landed as the current seal-aware continuity runtime |
| 04-01 | Governance | v3.0.0 | `withGovernance(...).activate()` landed as the current governed proposal runtime with an explicit lineage prerequisite |
| 04-01 | World | Removed | `@manifesto-ai/world` removed from the active workspace and downgraded to historical tombstone status |

### Recent Changes (2026-02)

| Date | Package | Version | Change |
|------|---------|---------|--------|
| 02-27 | Core/Host/World/Compiler/Runtime/SDK | Core/Host/World v3.0.0, Compiler v0.6.0, Runtime/SDK v0.2.0 | ADR-009 hard cut reflected in normative specs and API docs |
| 02-25 | ADR/Docs | v1.0 | ADR-010/011 accepted; living spec index updated for hard-cut and baseline rules |
| 02-24 | Core, Host, World | — | SPEC consolidation: Living Documents, FDR inlined, old files archived |
| 02-08 | World | v2.0.5-patch | Head Query API, resume contract, branch persistence |
| 02-08 | App | v2.3.1-patch | Head Query delegation (`getHeads()`, `getLatestHead()`) |

### Recent Changes (2026-01)

| Date | Package | Version | Change |
|------|---------|---------|--------|
| 01-27 | World | v2.0.3-patch | ADR-002 DX improvements |
| 01-27 | App | v2.1.0-patch | Platform namespace injection |
| 01-27 | Compiler | v0.5.0 | `$mel` namespace, `onceIntent` |
| 01-18 | Host | v2.0.2 | Snapshot Type Alignment, `$host` namespace |
| 01-18 | Core | v2.0.1-patch | ADR-002 alignment |

---

## Living Documents

Core, Host, SDK, Governance, and Lineage are maintained as **Living Documents** for their active package scopes. Compiler remains versioned full specs with companion addenda when a narrower extension is sufficient.

Each Living Document includes:
- A **Changelog** table in the header tracking all version history
- **Rationale blocks** (`> **Rationale (FDR-XXX):**`) inlined at relevant sections
- **Appendixes** for cross-references, migration notes, and deprecated content

---

## Normative Hierarchy

When documents conflict:

```
SPEC (highest authority)
  ↓
FDR (design rationale — now inlined in SPECs for Core/Host)
  ↓
ADR (architectural decisions — kept as separate immutable records)
  ↓
README / Guides (lowest authority)
```
