# Lineage Documentation Index

> **Package:** `@manifesto-ai/lineage`
> **Last Updated:** 2026-04-01

## Current Specification

- **Package Release:** v3.1.1
- **Contract Surface:** v3.0 decorator runtime + continuity substrate
- **SPEC (Living Draft):** [lineage-SPEC-v3.0.0-draft.md](lineage-SPEC-v3.0.0-draft.md) - truthful current contract, unchanged through package release v3.1.1
- **README:** [../README.md](../README.md) - package landing page
- **Guide:** [GUIDE.md](GUIDE.md) - practical activated runtime usage

## Reading Order

1. Start with [../README.md](../README.md).
2. Read [GUIDE.md](GUIDE.md) for the app-facing `withLineage(...).activate()` flow.
3. Read [lineage-SPEC-v3.0.0-draft.md](lineage-SPEC-v3.0.0-draft.md) for normative behavior.

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v3.0.0 | [SPEC](lineage-SPEC-v3.0.0-draft.md) | [ADR-017 v3.1](../../../docs/internals/adr/017-capability-decorator-pattern.md), [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md), [ADR-016](../../../docs/internals/adr/016-merkle-tree-lineage.md) | Decorator runtime + lineage substrate | Current |
| v2.0.0 | [SPEC](lineage-SPEC-2.0.0v.md) | [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md), [ADR-016](../../../docs/internals/adr/016-merkle-tree-lineage.md) | Service-first hard-cut lineage contract | Superseded |
| v1.0.1 | [SPEC](lineage-SPEC-1.0.1v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Split-native baseline patch release | Historical |
| v1.0.0 | [SPEC](lineage-SPEC-1.0.0v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial protocol extraction | Historical |

## Notes

- The current package release is `3.1.1`; the current contract surface remains the v3.0 lineage decorator model documented in [lineage-SPEC-v3.0.0-draft.md](lineage-SPEC-v3.0.0-draft.md).
- `@manifesto-ai/lineage` is now part of the canonical decorator path, not just a raw substrate package.
- [lineage-SPEC-v3.0.0-draft.md](lineage-SPEC-v3.0.0-draft.md) is the truthful current contract.
- `@manifesto-ai/world` is no longer the recommended reason to avoid using Lineage directly.
