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
- ADR-015 was accepted on 2026-03-29 and reserves the next breaking Lineage update for current-error snapshot hashing (`CurrentErrorSignature`) in place of accumulated error-history hashing; the current normative document remains v1.0.1 until that update lands.
- Use `@manifesto-ai/world` when you want the composed governed facade instead of the raw lineage package.
