# Specifications

This page serves as a hub linking to the authoritative specifications maintained in each package's `docs/` directory.

::: tip Single Source of Truth
All specifications are maintained as one living document per package. This page provides navigation and version summaries.
:::

If you want the governing documentation rules, see [Documentation Governance](../documentation-governance.md).

## Package Specifications

### Core Packages

| Package | SPEC | Status | Package Docs |
|---------|------|--------|--------------|
| **@manifesto-ai/core** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/core-SPEC.md) (v3.0.0) | Normative | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/VERSION-INDEX.md) |
| **@manifesto-ai/host** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC.md) (v3.0.0) | Normative | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/VERSION-INDEX.md) |
| **@manifesto-ai/world** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-SPEC.md) (v3.0.0) | Normative | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/VERSION-INDEX.md) |

### Application Layer

| Package | Latest SPEC | Status | Package Docs |
|---------|-------------|--------|--------------|
| **@manifesto-ai/sdk** | v1.0.0 | Normative (ADR-010) | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/VERSION-INDEX.md) |
| **@manifesto-ai/runtime** | Retired | Superseded (ADR-010, no successor) — package removed from workspace | — |
| **App facade (retired)** | Removed (R2) | Legacy reference only | [API Page](/api/app) |
| **@manifesto-ai/compiler** | v0.6.0 | Draft | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/VERSION-INDEX.md) |

### SDK v1.0.0 (ADR-010 Hard Cut)

ADR-010 reconstructed the SDK as a **thin composition layer** over the Manifesto protocol. The canonical public entrypoint is `createManifesto()` returning `ManifestoInstance` with 5 methods: `dispatch`, `subscribe`, `on`, `getSnapshot`, `dispose`.

The `@manifesto-ai/runtime` package is **retired** — its responsibilities are absorbed into `createManifesto()` internal wiring. Runtime SPEC v0.2.0 is superseded with no successor.

| Document | Status | Notes |
|----------|--------|-------|
| [SDK SPEC v1.0.0](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC-v1.0.0.md) | Normative | Protocol-first SDK — `createManifesto()` as sole owned concept |
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

- **World SPEC** — [world-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-SPEC.md) (Living Document, current through v3.0.0)
  - Updated directly in the living document
  - FDR rationale inlined; Head, Resume, Branch Persistence sections added

### SDK

- **SDK SPEC v1.0.0** (Normative)
  - [sdk-SPEC-v1.0.0.md](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC-v1.0.0.md)
  - Protocol-first SDK — `createManifesto()` as sole owned concept, `ManifestoInstance` (5 methods)

### Compiler (MEL)

- **Compiler SPEC v0.7.0** (Full)
  - [SPEC-v0.7.0.md](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v0.7.0.md)
  - Adds: §9.1.10 Object Functions — `merge()`, `keys()`, `values()`, `entries()` expression documentation (#241)

---

## Version History Summary

### Recent Changes (2026-03)

| Date | Package | Version | Change |
|------|---------|---------|--------|
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

Core, Host, and World SPECs are maintained as **Living Documents** — single consolidated files that incorporate changes directly, with `Changelog` capturing history. Previous versioned or patch documents are preserved in `archive/` subdirectories within each package's `docs/` folder.

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
