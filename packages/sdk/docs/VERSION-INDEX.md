# Manifesto SDK Documentation Index

> **Package:** `@manifesto-ai/sdk`
> **Last Updated:** 2026-03-29

---

## Latest Version

- **Package:** v1.0.1 (additive world/facade alignment per ADR-014 Phase 5)
- **SPEC:** [v1.0.1](sdk-SPEC-v1.0.1.md) (Normative)

**Note:** SDK remains a thin composition layer. `createManifesto()` is the sole SDK-owned concept. Additive World re-exports now include the governed composition surface while direct dispatch remains unchanged.

**Transition Note:** SDK SPEC v1.0.1 aligns with [World Facade SPEC v1.0.0](../../world/docs/world-facade-spec-v1.0.0.md) and preserves `createMemoryWorldStore()` while adding `createInMemoryWorldStore()` and `createWorld()`.

---

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v1.0.1 | [SPEC](sdk-SPEC-v1.0.1.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Additive World alignment | Released |
| v1.0.0 | [SPEC](sdk-SPEC-v1.0.0.md) | [ADR-010](../../../docs/internals/adr/010-major-hard-cut.md) | Protocol-first hard cut | Released |
| v0.2.0 | [SPEC](sdk-SPEC-v0.2.0.md) | [ADR-009](../../../docs/internals/adr/009-structured-patch-path.md) | ADR-009 alignment baseline | Superseded by v1.0.0 |
| v0.1.0 | [SPEC](sdk-SPEC-v0.1.0.md) | [ADR-007](../../../docs/internals/adr/007-sdk-runtime-split-kickoff.md) | Kickoff baseline | Superseded by v1.0.0 |

---

## Reading Guide

1. Read [sdk-SPEC-v1.0.1.md](sdk-SPEC-v1.0.1.md).
2. For additive World alignment rationale, read [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md).
3. For reconstruction rationale, read [ADR-010](../../../docs/internals/adr/010-major-hard-cut.md).
4. For historical context, see superseded [sdk-SPEC-v0.2.0.md](sdk-SPEC-v0.2.0.md) and [sdk-SPEC-v0.1.0.md](sdk-SPEC-v0.1.0.md).

---

## Legacy Note

`@manifesto-ai/app` is retired from active release. Legacy API reference is kept at [/api/app](../../../docs/api/app.md).

`@manifesto-ai/runtime` is retired per ADR-010. Runtime responsibilities are absorbed into `createManifesto()`. The runtime package has been removed from the workspace.
