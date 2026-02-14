# Specifications

This page serves as a hub linking to the authoritative specifications maintained in each package's `docs/` directory.

::: tip Single Source of Truth
All specifications are maintained at the package level. This page provides navigation and version summaries.
:::

## Package Specifications

### Core Packages

| Package | Latest SPEC | Status | Package Docs |
|---------|-------------|--------|--------------|
| **@manifesto-ai/core** | v2.0.1-patch | Draft | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/VERSION-INDEX.md) |
| **@manifesto-ai/host** | v2.0.2 | Normative | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/VERSION-INDEX.md) |
| **@manifesto-ai/world** | v2.0.5-patch | Draft | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/VERSION-INDEX.md) |

### Application Layer

| Package | Latest SPEC | Status | Package Docs |
|---------|-------------|--------|--------------|
| **@manifesto-ai/app** | v2.3.1-patch | Draft | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/app/docs/VERSION-INDEX.md) |
| **@manifesto-ai/compiler** | v0.5.0 | Draft | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/compiler/docs/VERSION-INDEX.md) |

### Intent & Translation

| Package | Latest SPEC | Status | Package Docs |
|---------|-------------|--------|--------------|
| **@manifesto-ai/intent-ir** | v0.2.0 | Draft | [VERSION-INDEX](https://github.com/manifesto-ai/core/blob/main/packages/intent-ir/docs/VERSION-INDEX.md) |
| **@manifesto-ai/translator** | v1.0.3 | Normative | [Docs](https://github.com/manifesto-ai/core/blob/main/packages/translator/core/docs/) |

### Runtime/SDK Decomposition Drafts

The Runtime and SDK documents below are **Draft but kickoff-locked baseline** specs extracted from APP-SPEC v2.3.0.
They are architecture documents for split kickoff planning, not finalized package split/install guidance.
Requirement IDs remain locked for kickoff (`RT-*`, `SDK-*`), while additive clarifications and examples are allowed.

| Document | Status | Notes |
|----------|--------|-------|
| [Runtime SPEC v0.1.0](https://github.com/manifesto-ai/core/blob/main/packages/runtime/docs/runtime-SPEC-v0.1.0.md) | Draft (Kickoff-Locked) | Internal execution orchestration contract decomposed from App SPEC |
| [SDK SPEC v0.1.0](https://github.com/manifesto-ai/core/blob/main/packages/sdk/docs/sdk-SPEC-v0.1.0.md) | Draft (Kickoff-Locked) | Public API contract decomposed from App SPEC; SDK-first is a Phase 2 target |

---

## Quick Links to Latest Specs

### Core

- **Core SPEC v2.0.1** (Patch)
  - Base: [SPEC-v2.0.0.md](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/SPEC-v2.0.0.md)
  - Patch: [SPEC-v2.0.1-patch.md](https://github.com/manifesto-ai/core/blob/main/packages/core/docs/SPEC-v2.0.1-patch.md)

### Host

- **Host SPEC v2.0.2** (Full)
  - [host-SPEC-v2.0.2.md](https://github.com/manifesto-ai/core/blob/main/packages/host/docs/host-SPEC-v2.0.2.md)
  - Adds: Snapshot Type Alignment, `data.$host` namespace

### World

- **World SPEC v2.0.5** (Patch)
  - Base: [world-SPEC-v2.0.3.md](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-SPEC-v2.0.3.md)
  - Patch: [world-SPEC-v2.0.5-patch.md](https://github.com/manifesto-ai/core/blob/main/packages/world/docs/world-SPEC-v2.0.5-patch.md)
  - Adds: Head Query API, resume contract, branch state persistence

### App

- **App SPEC v2.3.1** (Patch)
  - Base: [APP-SPEC-v2.3.0.md](https://github.com/manifesto-ai/core/blob/main/packages/app/docs/APP-SPEC-v2.3.0.md)
  - Patch: [APP-SPEC-v2.3.1-patch.md](https://github.com/manifesto-ai/core/blob/main/packages/app/docs/APP-SPEC-v2.3.1-patch.md)
  - Adds: Head Query API delegation (`getHeads()`, `getLatestHead()`)

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

## Reading Patch Documents

Patch documents (e.g., `v2.0.1-patch`) contain only changes from a base version. To read:

1. Start with the **base version** (full document)
2. Apply **patch changes** in order

Example for Core v2.0.1:
```
SPEC-v2.0.0.md (base)
  + SPEC-v2.0.1-patch.md (changes)
  = Complete v2.0.1 specification
```

---

## Normative Hierarchy

When documents conflict:

```
SPEC (highest authority)
  ↓
FDR (design rationale)
  ↓
ADR (architectural decisions)
  ↓
README / Guides (lowest authority)
```
