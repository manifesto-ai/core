# Specifications

This page serves as a hub linking to the authoritative specifications maintained in each package's `docs/` directory.

::: tip Single Source of Truth
Specifications are maintained in canonical package docs with version indexes. The current hard-cut surface is: `@manifesto-ai/sdk` v2.0.0, `@manifesto-ai/world` as the exact governed facade, and `@manifesto-ai/governance` / `@manifesto-ai/lineage` as the official split protocol packages.
:::

If you want the governing documentation rules, see [Documentation Governance](../documentation-governance.md).

## Reading Order

1. Read the current package README and VERSION-INDEX for the surface you want to use.
2. Use `docs/api/` for package selection and import guidance.
3. Use the package SPECs for normative behavior.
4. Use archived or historical ADR/SPEC/FDR material only for decision history.

## Current Normative Package Specifications

### Core Packages

| Package | SPEC | Status | Package Docs |
|---------|------|--------|--------------|
| **@manifesto-ai/core** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/core-SPEC.md) (v3.0.0) | Normative | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/VERSION-INDEX.md) |
| **@manifesto-ai/host** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC.md) (v3.0.0) | Normative | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/VERSION-INDEX.md) |
| **@manifesto-ai/world** | [Facade SPEC](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-facade-spec-v1.0.0.md) (v1.0.0) | Normative (exact governed facade) | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/VERSION-INDEX.md) |

### Split Protocol Packages

| Package | SPEC | Status | Package Docs |
|---------|------|--------|--------------|
| **@manifesto-ai/lineage** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC-1.0.1v.md) (v1.0.1) | Normative (continuity package) | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/VERSION-INDEX.md) |
| **@manifesto-ai/governance** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/governance-SPEC-1.0.0v.md) (v1.0.0) | Normative (legitimacy package) | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/VERSION-INDEX.md) |

> **Current World Authority:** `@manifesto-ai/world` is the exact governed facade. The current facade contract composes Governance v1.0.0 with Lineage v1.0.1. `world-SPEC.md` is historical reference only.

### Application Layer

| Package | Latest SPEC | Status | Package Docs |
|---------|-------------|--------|--------------|
| **@manifesto-ai/sdk** | v2.0.0 | Normative (direct-dispatch entry) | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/VERSION-INDEX.md) |
| **@manifesto-ai/runtime** | Retired | Superseded (ADR-010, no successor) — package removed from workspace | — |
| **App facade (retired)** | Removed (R2) | Historical reference only | [Retired Page](/internals/retired/app) |
| **@manifesto-ai/compiler** | v0.7.0 | Draft | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/VERSION-INDEX.md) |

## Projected Next-Major Drafts

These documents are repo-tracked drafts for the next shared epoch boundary. They are not current package contracts.

| Package | Draft SPEC | Status | Notes |
|---------|------------|--------|-------|
| **@manifesto-ai/core** | [core-SPEC-v4.0.0-draft.md](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/core-SPEC-v4.0.0-draft.md) | Draft | ADR-015 projected Core rewrite |
| **@manifesto-ai/host** | [host-SPEC-v4.0.0-draft.md](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC-v4.0.0-draft.md) | Draft | ADR-015 + proposed ADR-016 projected Host execution-side rewrite |
| **@manifesto-ai/lineage** | [lineage-SPEC-2.0.0v.md](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC-2.0.0v.md) | Draft | ADR-015 + proposed ADR-016 projected Lineage rewrite |
| **@manifesto-ai/governance** | [governance-SPEC-2.0.0v.md](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/governance-SPEC-2.0.0v.md) | Draft | ADR-015 + proposed ADR-016 projected Governance rewrite |
| **@manifesto-ai/world** | [world-facade-spec-v2.0.0.md](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-facade-spec-v2.0.0.md) | Draft | ADR-015 + proposed ADR-016 projected facade rewrite |

## Historical and Retired References

These references remain available for traceability, but they are not maintained onboarding entry points.

### SDK v2.0.0

`@manifesto-ai/sdk` remains a **thin composition layer** over the Manifesto protocol. The canonical public entrypoint is `createManifesto()` returning `ManifestoInstance` with 5 methods: `dispatch`, `subscribe`, `on`, `getSnapshot`, `dispose`.

The `@manifesto-ai/runtime` package is **retired** — its responsibilities are absorbed into `createManifesto()` internal wiring. Runtime SPEC v0.2.0 is superseded with no successor.

| Document | Status | Notes |
|----------|--------|-------|
| [SDK SPEC v2.0.0](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC-v2.0.0.md) | Normative | Hard-cut SDK — `createManifesto()` as sole owned concept |
| [SDK SPEC v1.0.1](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC-v1.0.1.md) | Superseded | Historical hard-cut baseline |
| [SDK SPEC v0.2.0](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC-v0.2.0.md) | Superseded | Historical — pre-ADR-010 draft baseline |
| [Runtime SPEC v0.2.0](https://github.com/manifesto-ai/core/blob/main/packages/runtime/docs/runtime-SPEC-v0.2.0.md) | Superseded | Historical — Runtime retired per ADR-010 (no successor) |

---

## Quick Links to Latest Specs

### Core

- **Core SPEC** — [core-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/core-SPEC.md) (Living Document, current through v3.0.0)
  - Updated directly in the living document; FDR rationale inlined

### Host

- **Host SPEC** — [host-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC.md) (Living Document, current through v3.0.0)
  - Updated directly in the living document; FDR-H018~H025 inlined
  - Deprecated §9 (Compiler Integration) moved to Appendix D

### World

- **World Facade SPEC** — [world-facade-spec-v1.0.0.md](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-facade-spec-v1.0.0.md) (Normative, exact governed facade)
  - Defines composite store, atomic commit coordinator, `createWorld()`, and facade lifecycle
- **Legacy World Protocol SPEC** — [world-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-SPEC.md) (Historical reference)
  - Historical monolith reference only
  - Governance and lineage ownership live in their package specs

### Lineage

- **Lineage SPEC** — [lineage-SPEC-1.0.1v.md](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC-1.0.1v.md) (Living Document, current through v1.0.1)
  - Defines identity, seal, branch/head, persistence, replay, and resume rules

### Governance

- **Governance SPEC** — [governance-SPEC-1.0.0v.md](https://github.com/manifesto-ai/core/blob/main/packages/governance/docs/governance-SPEC-1.0.0v.md) (Living Document, current through v1.0.0)
  - Defines actor/authority, proposal lifecycle, single-writer gate, seal coordination, events, and governance persistence

### SDK

- **SDK SPEC v2.0.0** (Normative)
  - [sdk-SPEC-v2.0.0.md](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC-v2.0.0.md)
  - Hard-cut SDK — `createManifesto()` as sole owned concept, `ManifestoInstance` (5 methods)

### Compiler (MEL)

- **Compiler SPEC v0.7.0** (Full)
  - [SPEC-v0.7.0.md](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v0.7.0.md)
  - Adds: statement composition via `flow`/`include` (ADR-013a) and entity collection primitives `findById()` / `existsById()` / `updateById()` / `removeById()` (ADR-013b)

---

## Version History Summary

### Recent Changes (2026-03)

| Date | Package | Version | Change |
|------|---------|---------|--------|
| 03-29 | Core | Target v4.0.0 (draft) | ADR-015 accepted: next major removes accumulated `system.errors` and `appendErrors`; the living Core SPEC remains v3.0.0 until the co-deployed epoch lands |
| 03-29 | Lineage | Target v2.0.0 (draft) | Projected ADR-015 + ADR-016 epoch draft: current-error hash identity, parent-linked `WorldId`, `SealAttempt`, `tip`, `headAdvancedAt`, idempotent reuse, and restore normalization |
| 03-29 | Governance | Target v2.0.0 (draft) | Projected alignment with the co-deployed lineage epoch: remove `system.errors` assumptions, narrow `SealRejectionReason`, and remap provenance to `SealAttempt` |
| 03-29 | Host | Target v4.0.0 (draft) | Draft-only execution-side alignment: public Snapshot references lose `system.errors`, and `$host` boundary semantics align with restore normalization |
| 03-29 | World | Facade target v2.0.0 (draft) | Draft-only facade-major aligned to Lineage v2.0.0 and Governance v2.0.0; `commitSeal()` / `WriteSet` absorb `SealAttempt` persistence while the legacy monolith remains historical only |
| 03-29 | SDK | Target v3.0.0 | Planned SDK major driven by public `Snapshot<T>` surface changes (`ManifestoConfig.snapshot`, `getSnapshot()`, event payload snapshots), not by governed seal internals |
| 03-28 | World | Facade v1.0.0 | World facade SPEC added for exact governed composition: composite store, coordinator, `createWorld()`, and facade lifecycle |
| 03-28 | Governance | v1.0.0 | Governance living SPEC created; package version index added |
| 03-28 | Lineage | v1.0.1 | Lineage living SPEC patch release: adds `BranchInfo.epoch`, `LineageService.getBranch()`, and public-contract epoch reads |
| 03-28 | ADR/Docs | — | Living SPEC hub updated for the hard-cut surface: World facade is canonical, Governance and Lineage are split protocol packages |
| 03-24 | Compiler | v0.7.0 | Draft compiler SPEC refreshed for ADR-013a (`flow`/`include`) and ADR-013b entity collection primitives |
| 03-02 | SDK | v1.0.0 | ADR-010 hard cut: `createManifesto()` sole entrypoint, Runtime retired |

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

Core and Host are maintained as **Living Documents** when a package has entered the living-document model — single consolidated files that incorporate changes directly, with `Changelog` capturing history. World Facade, Governance, and Lineage are current versioned specs for their package scopes.

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
FDR (design rationale — now inlined in SPECs for Core/Host/World)
  ↓
ADR (architectural decisions — kept as separate immutable records)
  ↓
README / Guides (lowest authority)
```
