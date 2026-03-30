# Lineage Protocol Documentation Index

> **Package:** `@manifesto-ai/lineage`
> **Last Updated:** 2026-03-31

## Current Specification

- **SPEC (Living Document):** [lineage-SPEC-2.0.0v.md](lineage-SPEC-2.0.0v.md) - normative lineage protocol
- **README:** [../README.md](../README.md) - package landing page
- **Guide:** [GUIDE.md](GUIDE.md) - practical package usage

## Reading Order

1. Start with [../README.md](../README.md).
2. Read [GUIDE.md](GUIDE.md) for direct package usage.
3. Read [lineage-SPEC-2.0.0v.md](lineage-SPEC-2.0.0v.md) for normative behavior.

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v2.0.0 | [SPEC](lineage-SPEC-2.0.0v.md) | [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md), [ADR-016](../../../docs/internals/adr/016-merkle-tree-lineage.md) | ADR-015/ADR-016 hard-cut lineage contract | Current |
| v1.0.1 | [SPEC](lineage-SPEC-1.0.1v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Split-native baseline patch release | Superseded |
| v1.0.0 | [SPEC](lineage-SPEC-1.0.0v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial protocol extraction | Superseded |

## Notes

- Lineage is a first-class public package in the current hard-cut docs set.
- [lineage-SPEC-2.0.0v.md](lineage-SPEC-2.0.0v.md) is the truthful current contract.
- The v1.x lineage specs are retained as historical split-era references.
- Use `@manifesto-ai/world` when you want the composed governed facade instead of the raw lineage package.
