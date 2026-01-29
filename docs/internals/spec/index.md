# Specifications

This page serves as a hub linking to the authoritative specifications maintained in each package's `docs/` directory.

::: tip Single Source of Truth
All specifications are maintained at the package level. This page provides navigation and version summaries.
:::

## Package Specifications

### Core Packages

| Package | Latest SPEC | Status | Package Docs |
|---------|-------------|--------|--------------|
| **@manifesto-ai/core** | v2.0.1-patch | Draft | [VERSION-INDEX](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/core/docs/VERSION-INDEX.md) |
| **@manifesto-ai/host** | v2.0.2 | Normative | [VERSION-INDEX](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/host/docs/VERSION-INDEX.md) |
| **@manifesto-ai/world** | v2.0.3-patch | Draft | [VERSION-INDEX](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/world/docs/VERSION-INDEX.md) |
| **@manifesto-ai/builder** | v1.0.0 | Final | [VERSION-INDEX](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/builder/docs/VERSION-INDEX.md) |

### Application Layer

| Package | Latest SPEC | Status | Package Docs |
|---------|-------------|--------|--------------|
| **@manifesto-ai/app** | v2.1.0-patch | Draft | [VERSION-INDEX](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/app/docs/VERSION-INDEX.md) |
| **@manifesto-ai/compiler** | v0.5.0-patch | Draft | [VERSION-INDEX](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/compiler/docs/VERSION-INDEX.md) |

### Intent & Translation

| Package | Latest SPEC | Status | Package Docs |
|---------|-------------|--------|--------------|
| **@manifesto-ai/intent-ir** | v0.1.0 | Final | [VERSION-INDEX](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/intent-ir/docs/VERSION-INDEX.md) |
| **@manifesto-ai/translator** | v1.0.3 | Normative | [Docs](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/translator/docs/) |

---

## Quick Links to Latest Specs

### Core

- **Core SPEC v2.0.1** (Patch)
  - Base: [SPEC-v2.0.0.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/core/docs/SPEC-v2.0.0.md)
  - Patch: [SPEC-v2.0.1-patch.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/core/docs/SPEC-v2.0.1-patch.md)

### Host

- **Host SPEC v2.0.2** (Full)
  - [host-SPEC-v2.0.2.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/host/docs/host-SPEC-v2.0.2.md)
  - Adds: Snapshot Type Alignment, `data.$host` namespace

### World

- **World SPEC v2.0.3** (Patch)
  - Base: [world-SPEC-v2.0.2.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/world/docs/world-SPEC-v2.0.2.md)
  - Patch: [world-SPEC-v2.0.3-patch.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/world/docs/world-SPEC-v2.0.3-patch.md)
  - Adds: ADR-002 DX improvements, `$mel` namespace

### App

- **App SPEC v2.1.0** (Patch)
  - Base: [APP-SPEC-v2.0.0.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/app/docs/APP-SPEC-v2.0.0.md)
  - Patch: [APP-SPEC-v2.1.0-patch.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/app/docs/APP-SPEC-v2.1.0-patch.md)
  - Adds: Platform namespace injection, `$mel` support

### Compiler (MEL)

- **Compiler SPEC v0.5.0** (Patch)
  - Base: [SPEC-v0.3.3.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/compiler/docs/SPEC-v0.3.3.md)
  - Patch v0.4.0: [SPEC-v0.4.0-patch.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/compiler/docs/SPEC-v0.4.0-patch.md)
  - Patch v0.5.0: [SPEC-v0.5.0-patch.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/compiler/docs/SPEC-v0.5.0-patch.md)
  - Adds: `$mel` namespace, `onceIntent` syntax

### Builder

- **Builder SPEC v1.0.0** (Final)
  - [SPEC-v1.0.0.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/builder/docs/SPEC-v1.0.0.md)

### Intent IR

- **Intent IR SPEC v0.1.0** (Final)
  - [SPEC-v0.1.0.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/intent-ir/docs/SPEC-v0.1.0.md)
  - Research docs: [Research](/internals/research/intent-ir/)

### Translator

- **Translator SPEC v1.0.3** (Normative)
  - [translator-SPEC-v1.0.3.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/translator/docs/translator-SPEC-v1.0.3.md)
  - Previous: [translator-SPEC-v0.11.md](https://github.com/anthropics/manifesto-ai/blob/main/workspaces/core/packages/translator/docs/translator-SPEC-v0.11.md)

---

## Version History Summary

### Recent Changes (2026-01)

| Date | Package | Version | Change |
|------|---------|---------|--------|
| 01-28 | Translator | v1.0.3 | Clean Architecture refactor |
| 01-27 | World | v2.0.3-patch | ADR-002 DX improvements |
| 01-27 | App | v2.1.0-patch | Platform namespace injection |
| 01-27 | Compiler | v0.5.0-patch | `$mel` namespace, `onceIntent` |
| 01-18 | Host | v2.0.2 | Snapshot Type Alignment, `$host` namespace |
| 01-18 | Core | v2.0.1-patch | ADR-002 alignment |

---

## Reading Patch Documents

Patch documents (e.g., `v2.0.1-patch`) contain only changes from a base version. To read:

1. Start with the **base version** (full document)
2. Apply **patch changes** in order

Example for World v2.0.3:
```
world-SPEC-v2.0.2.md (base)
  + world-SPEC-v2.0.3-patch.md (changes)
  = Complete v2.0.3 specification
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
