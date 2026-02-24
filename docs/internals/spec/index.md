# Specifications

This page serves as a hub linking to the authoritative specifications maintained in each package's `docs/` directory.

::: tip Single Source of Truth
All specifications are maintained at the package level. This page provides navigation and version summaries.
:::

## Package Specifications

### Core Packages

| Package | SPEC | Status | Package Docs |
|---------|------|--------|--------------|
| **@manifesto-ai/core** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/core-SPEC.md) (v2.0.3) | Normative | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/VERSION-INDEX.md) |
| **@manifesto-ai/host** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC.md) (v2.0.2) | Normative | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/VERSION-INDEX.md) |
| **@manifesto-ai/world** | [Living Document](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-SPEC.md) (v2.0.5) | Normative | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/VERSION-INDEX.md) |

### Application Layer

| Package | Latest SPEC | Status | Package Docs |
|---------|-------------|--------|--------------|
| **@manifesto-ai/sdk** | v0.1.0 | Draft | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/VERSION-INDEX.md) |
| **App facade (retired)** | Removed (R2) | Legacy reference only | [API Page](/api/app) |
| **@manifesto-ai/compiler** | v0.5.0 | Draft | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/VERSION-INDEX.md) |

### Intent & Translation

| Package | Latest SPEC | Status | Package Docs |
|---------|-------------|--------|--------------|
| **@manifesto-ai/intent-ir** | v0.2.0 | Draft | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/VERSION-INDEX.md) |
| **@manifesto-ai/translator** | v1.0.3 | Normative | [Docs](https://github.com/manifesto-ai/core/blob/main/packages/translator/core/docs/) |

### Runtime/SDK Draft Baselines

The Runtime and SDK documents below remain **Draft but kickoff-locked baseline** specs extracted from APP-SPEC v2.3.0.
With ADR-008, SDK is now the canonical public entry package. Draft status here reflects spec-governance maturity, not package availability.
Requirement IDs remain locked (`RT-*`, `SDK-*`) while additive clarifications and examples are allowed.

| Document | Status | Notes |
|----------|--------|-------|
| [Runtime SPEC v0.1.0](https://github.com/manifesto-ai/core/blob/main/packages/runtime/docs/runtime-SPEC-v0.1.0.md) | Draft (Kickoff-Locked) | Internal execution orchestration contract decomposed from App SPEC |
| [SDK SPEC v0.1.0](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC-v0.1.0.md) | Draft (Kickoff-Locked) | Canonical public API contract |

---

## Quick Links to Latest Specs

### Core

- **Core SPEC** — [core-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/core-SPEC.md) (Living Document, current through v2.0.3)
  - Consolidated from v2.0.0 base + v2.0.1/v2.0.2/v2.0.3 patches
  - FDR rationale inlined; previous versioned files archived

### Host

- **Host SPEC** — [host-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC.md) (Living Document, current through v2.0.2)
  - Consolidated from v2.0.2 full document + FDR-H018~H025 inlined
  - Deprecated §9 (Compiler Integration) moved to Appendix D

### World

- **World SPEC** — [world-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-SPEC.md) (Living Document, current through v2.0.5)
  - Consolidated from v2.0.3 base + v2.0.4/v2.0.5 patches
  - FDR rationale inlined; Head, Resume, Branch Persistence sections added

### SDK

- **SDK SPEC v0.1.0** (Draft)
  - [sdk-SPEC-v0.1.0.md](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC-v0.1.0.md)
  - Canonical public entrypoint contract (`createApp`, `App`, hooks)

### Compiler (MEL)

- **Compiler SPEC v0.5.0** (Full)
  - [SPEC-v0.5.0.md](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/SPEC-v0.5.0.md)
  - Adds: `$mel` namespace, `onceIntent` syntax

### Intent IR

- **Intent IR SPEC v0.2.0** (Draft)
  - [SPEC-v0.2.0.md](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/SPEC-v0.2.0.md)
  - Research docs: [Research](/internals/research/intent-ir/)

### Translator

- **Translator SPEC v1.0.3** (Normative)
  - [translator-SPEC-v1.0.3.md](https://github.com/manifesto-ai/core/blob/main/packages/translator/core/docs/translator-SPEC-v1.0.3.md)
  - Previous (v0.1.1): [translator-SPEC-v0.11.md](https://github.com/manifesto-ai/core/blob/main/packages/translator/core/docs/translator-SPEC-v0.11.md)

---

## Version History Summary

### Recent Changes (2026-02)

| Date | Package | Version | Change |
|------|---------|---------|--------|
| 02-24 | Core, Host, World | — | SPEC consolidation: Living Documents, FDR inlined, old files archived |
| 02-08 | World | v2.0.5-patch | Head Query API, resume contract, branch persistence |
| 02-08 | App | v2.3.1-patch | Head Query delegation (`getHeads()`, `getLatestHead()`) |

### Recent Changes (2026-01)

| Date | Package | Version | Change |
|------|---------|---------|--------|
| 01-30 | Translator | v1.0.3 | Intent IR v0.2 alignment and spec refinements |
| 01-27 | World | v2.0.3-patch | ADR-002 DX improvements |
| 01-27 | App | v2.1.0-patch | Platform namespace injection |
| 01-27 | Compiler | v0.5.0 | `$mel` namespace, `onceIntent` |
| 01-18 | Host | v2.0.2 | Snapshot Type Alignment, `$host` namespace |
| 01-18 | Core | v2.0.1-patch | ADR-002 alignment |

---

## Living Documents

Core, Host, and World SPECs are now maintained as **Living Documents** — single consolidated files that incorporate all patch content and FDR rationale inline. Previous versioned SPEC and FDR files are preserved in `archive/` subdirectories within each package's `docs/` folder.

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
