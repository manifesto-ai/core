# Manifesto SDK Documentation Index

> **Package:** `@manifesto-ai/sdk`
> **Last Updated:** 2026-02-15

---

## Latest Version

- **SPEC:** [v0.1.0](sdk-SPEC-v0.1.0.md) (Draft — kickoff-locked baseline per ADR-007)

**Note:** v0.1.0 is the initial SDK specification extracted from `@manifesto-ai/app` v2.3.0. Requirement IDs (`SDK-*`) are locked and cannot be renamed or removed. Additive clarification is allowed.

---

## All Versions

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v0.1.0 | [SPEC](sdk-SPEC-v0.1.0.md) | — | Full | Draft (kickoff-locked) |

---

## Reading Guide

### For v0.1.0

1. Read [sdk-SPEC-v0.1.0.md](sdk-SPEC-v0.1.0.md) (complete specification)
2. For split rationale: [ADR-007](../../../docs/internals/adr/007-sdk-runtime-split-kickoff.md)
3. For the App facade that re-exports SDK: [App VERSION-INDEX](../../app/docs/VERSION-INDEX.md)

---

## Relationship to App Package

During **Phase 1 (Kickoff)**, `@manifesto-ai/app` remains the canonical entry point. SDK is an internal/preview package.

| Phase | Entry Point | SDK Status |
|-------|-------------|------------|
| Phase 1 (current) | `@manifesto-ai/app` | Internal/Preview |
| Phase 2 (transition) | `@manifesto-ai/sdk` | Public |

See [ADR-007](../../../docs/internals/adr/007-sdk-runtime-split-kickoff.md) for the two-phase release strategy.
