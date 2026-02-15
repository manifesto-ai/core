# Manifesto Runtime Documentation Index

> **Package:** `@manifesto-ai/runtime`
> **Last Updated:** 2026-02-15
> **Visibility:** Internal — not intended for direct consumption

---

## Latest Version

- **SPEC:** [v0.1.0](runtime-SPEC-v0.1.0.md) (Draft — kickoff-locked baseline per ADR-007)

**Note:** v0.1.0 is the initial Runtime specification extracted from `@manifesto-ai/app` v2.3.0. Requirement IDs (`RT-*`) are locked and cannot be renamed or removed. Additive clarification is allowed.

---

## All Versions

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v0.1.0 | [SPEC](runtime-SPEC-v0.1.0.md) | — | Full | Draft (kickoff-locked) |

---

## Reading Guide

### For v0.1.0

1. Read [runtime-SPEC-v0.1.0.md](runtime-SPEC-v0.1.0.md) (complete specification)
2. For split rationale: [ADR-007](../../../docs/internals/adr/007-sdk-runtime-split-kickoff.md)
3. For the SDK public API that depends on Runtime: [SDK VERSION-INDEX](../../sdk/docs/VERSION-INDEX.md)
4. For the App facade that re-exports Runtime types: [App VERSION-INDEX](../../app/docs/VERSION-INDEX.md)

---

## Relationship to Other Packages

Runtime is the internal execution engine consumed by SDK, never directly by end users.

```
@manifesto-ai/app (facade)
  └── @manifesto-ai/sdk (public API)
        └── @manifesto-ai/runtime (internal orchestration) ← you are here
              └── core, host, world, compiler
```

See [ADR-007](../../../docs/internals/adr/007-sdk-runtime-split-kickoff.md) for architectural rationale.
