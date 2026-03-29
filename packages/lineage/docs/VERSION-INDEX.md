# Lineage Protocol Documentation Index

> **Package:** `@manifesto-ai/lineage`
> **Last Updated:** 2026-03-29

## Current Specification

- **SPEC (Living Document):** [lineage-SPEC-1.0.1v.md](lineage-SPEC-1.0.1v.md) - normative lineage protocol
- **README:** [../README.md](../README.md) - package landing page
- **Guide:** [GUIDE.md](GUIDE.md) - practical package usage

## Reading Order

1. Start with [../README.md](../README.md).
2. Read [GUIDE.md](GUIDE.md) for direct package usage.
3. Read [lineage-SPEC-1.0.1v.md](lineage-SPEC-1.0.1v.md) for normative behavior.

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v1.0.1 | [SPEC](lineage-SPEC-1.0.1v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Patch release (`BranchInfo.epoch`, `getBranch()`, epoch-read contract) | Current |
| v1.0.0 | [SPEC](lineage-SPEC-1.0.0v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial protocol extraction | Superseded by v1.0.1 |

## Notes

- Lineage is a first-class public package in the hard-cut docs set.
- Lineage is the lower substrate for Governance and World.
- The co-deployed ADR-015 + ADR-016 epoch is currently projected as Lineage v2.0.0. ADR-015 is accepted; ADR-016 is currently proposed. If accepted together, the next major will replace accumulated error-history hashing with current-error identity and move `WorldId` to parent-linked positional hashing with `tip`, `headAdvancedAt`, idempotent reuse, and `SealAttempt`.
- Use `@manifesto-ai/world` when you want the composed governed facade instead of the raw lineage package.
