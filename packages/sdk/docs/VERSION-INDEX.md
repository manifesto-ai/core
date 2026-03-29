# Manifesto SDK Documentation Index

> **Package:** `@manifesto-ai/sdk`
> **Last Updated:** 2026-03-29

## Latest Version

- **Package:** v2.0.0 hard-cut alignment release
- **SPEC:** [v2.0.0](sdk-SPEC-v2.0.0.md) (Normative)

SDK remains a thin composition layer. `createManifesto()` is the sole SDK-owned concept. Governed composition now lives on the hard-cut top-level `@manifesto-ai/world` surface.

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v2.0.0 | [SPEC](sdk-SPEC-v2.0.0.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Hard-cut world alignment | Current |
| v1.0.1 | [SPEC](sdk-SPEC-v1.0.1.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Additive world alignment | Superseded |
| v1.0.0 | [SPEC](sdk-SPEC-v1.0.0.md) | [ADR-010](../../../docs/internals/adr/010-major-hard-cut.md) | Protocol-first hard cut | Superseded |
| v0.2.0 | [SPEC](sdk-SPEC-v0.2.0.md) | [ADR-009](../../../docs/internals/adr/009-structured-patch-path.md) | ADR-009 alignment baseline | Superseded |
| v0.1.0 | [SPEC](sdk-SPEC-v0.1.0.md) | [ADR-007](../../../docs/internals/adr/007-sdk-runtime-split-kickoff.md) | Kickoff baseline | Superseded |

## Reading Guide

1. Read [sdk-SPEC-v2.0.0.md](sdk-SPEC-v2.0.0.md).
2. For the hard-cut rationale, read [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md).
3. For the original SDK hard cut, read [ADR-010](../../../docs/internals/adr/010-major-hard-cut.md).

## Notes

- The ADR-015 + ADR-016 epoch is currently projected to drive SDK v3.0.0. The breaking surface is the SDK's own public `Snapshot<T>` contract and every API that exposes it (`ManifestoConfig.snapshot`, `getSnapshot()`, and event payload snapshots), not direct participation in lineage/governance sealing.
