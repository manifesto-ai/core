# Manifesto Runtime Documentation Index

> **Package:** `@manifesto-ai/runtime`
> **Last Updated:** 2026-02-17
> **Visibility:** Internal — not intended for direct consumption

---

## Latest Version

- **Package:** v0.1.0
- **SPEC:** [v0.1.0](runtime-SPEC-v0.1.0.md) (Draft, kickoff-locked baseline)

**Note:** Runtime is an internal orchestration dependency consumed by SDK.

---

## All Versions

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v0.1.0 | [SPEC](runtime-SPEC-v0.1.0.md) | — | Internal orchestration baseline | Released |

---

## Reading Guide

1. Read [runtime-SPEC-v0.1.0.md](runtime-SPEC-v0.1.0.md).
2. For split/transition rationale, read [ADR-007](../../../docs/internals/adr/007-sdk-runtime-split-kickoff.md) and [ADR-008](../../../docs/internals/adr/008-sdk-first-transition-and-app-retirement.md).
3. For public API contract, see [SDK VERSION-INDEX](../../sdk/docs/VERSION-INDEX.md).

---

## Relationship to Other Packages

Runtime is the internal execution engine consumed by SDK.

```text
@manifesto-ai/sdk (public API)
  └── @manifesto-ai/runtime (internal orchestration)
        └── core, host, world, compiler
```
