# Lineage Protocol Documentation Index

> **Package:** `@manifesto-ai/lineage`
> **Last Updated:** 2026-03-29

## Current Specification

- **SPEC (Living Document):** [lineage-SPEC-1.0.1v.md](lineage-SPEC-1.0.1v.md) - normative lineage protocol
- **README:** [../README.md](../README.md) - package landing page
- **Guide:** [GUIDE.md](GUIDE.md) - practical package usage

## Projected Next Major

- **Draft SPEC:** [lineage-SPEC-2.0.0v.md](lineage-SPEC-2.0.0v.md) - projected next-major rewrite
  - Draft only until the shared epoch boundary lands
  - Draft only until Governance / Host / World facade / SDK alignment lands

## Reading Order

1. Start with [../README.md](../README.md).
2. Read [GUIDE.md](GUIDE.md) for direct package usage.
3. Read [lineage-SPEC-1.0.1v.md](lineage-SPEC-1.0.1v.md) for normative behavior.

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v2.0.0 | [SPEC](lineage-SPEC-2.0.0v.md) | [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md), [ADR-016](../../../docs/internals/adr/016-merkle-tree-lineage.md) | Projected next-major draft | Draft |
| v1.0.1 | [SPEC](lineage-SPEC-1.0.1v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Patch release (`BranchInfo.epoch`, `getBranch()`, epoch-read contract) | Current |
| v1.0.0 | [SPEC](lineage-SPEC-1.0.0v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial protocol extraction | Superseded by v1.0.1 |

## Notes

- Lineage is a first-class public package in the hard-cut docs set.
- Lineage is the lower substrate for Governance and World.
- [lineage-SPEC-1.0.1v.md](lineage-SPEC-1.0.1v.md) remains the truthful current contract.
- [lineage-SPEC-2.0.0v.md](lineage-SPEC-2.0.0v.md) is draft only until the shared epoch boundary lands.
- Use `@manifesto-ai/world` when you want the composed governed facade instead of the raw lineage package.
