# Manifesto SDK Documentation Index

> **Package:** `@manifesto-ai/sdk`
> **Last Updated:** 2026-04-01

## Latest Version

- **Package Release:** v3.1.1
- **Contract Surface:** v3.0 activation-first entry/runtime model
- **SPEC:** [v3.0.0](sdk-SPEC-v3.0.0-draft.md) (Current truthful contract; unchanged through package release v3.1.1)
- **ADR:** [ADR-017 v3.1](../../../docs/internals/adr/017-capability-decorator-pattern.md)

SDK now follows the activation boundary. `createManifesto()` returns a composable manifesto, runtime verbs appear only after `activate()`, and the governed direction is the Lineage/Governance decorator path.

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v3.0.0 | [SPEC](sdk-SPEC-v3.0.0-draft.md) | [ADR-017 v3.1](../../../docs/internals/adr/017-capability-decorator-pattern.md) | Capability decorator rewrite | Current |
| v2.0.0 | [SPEC](sdk-SPEC-v2.0.0.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Hard-cut world alignment | Superseded |
| v1.0.1 | [SPEC](sdk-SPEC-v1.0.1.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Additive world alignment | Superseded |
| v1.0.0 | [SPEC](sdk-SPEC-v1.0.0.md) | [ADR-010](../../../docs/internals/adr/010-major-hard-cut.md) | Protocol-first hard cut | Superseded |
| v0.2.0 | [SPEC](sdk-SPEC-v0.2.0.md) | [ADR-009](../../../docs/internals/adr/009-structured-patch-path.md) | ADR-009 alignment baseline | Superseded |
| v0.1.0 | [SPEC](sdk-SPEC-v0.1.0.md) | [ADR-007](../../../docs/internals/adr/007-sdk-runtime-split-kickoff.md) | Kickoff baseline | Superseded |

## Reading Guide

1. Read [sdk-SPEC-v3.0.0-draft.md](sdk-SPEC-v3.0.0-draft.md).
2. For the activation/decorator rationale, read [ADR-017 v3.1](../../../docs/internals/adr/017-capability-decorator-pattern.md).
3. Read [sdk-SPEC-v2.0.0.md](sdk-SPEC-v2.0.0.md) only when comparing against the superseded ready-instance/runtime-helper surface.
4. For the original SDK hard cut, read [ADR-010](../../../docs/internals/adr/010-major-hard-cut.md).

## Notes

- The current package release is `3.1.1`; the current contract surface remains the v3.0 activation-first model documented in [sdk-SPEC-v3.0.0-draft.md](sdk-SPEC-v3.0.0-draft.md).
- [sdk-SPEC-v3.0.0-draft.md](sdk-SPEC-v3.0.0-draft.md) is the truthful current SDK contract even though the filename still retains `draft`.
- [sdk-SPEC-v2.0.0.md](sdk-SPEC-v2.0.0.md) is preserved as the superseded pre-activation contract.
- The current SDK Snapshot surface now follows Core's current contract: accumulated `system.errors` is removed, `lastError` remains, and no compatibility field is reintroduced.
