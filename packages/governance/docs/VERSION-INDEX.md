# Governance Protocol Documentation Index

> **Package:** `@manifesto-ai/governance`
> **Last Updated:** 2026-03-29

## Current Specification

- **SPEC (Living Document):** [governance-SPEC-1.0.0v.md](governance-SPEC-1.0.0v.md) - normative governance protocol
- **README:** [../README.md](../README.md) - package landing page
- **Guide:** [GUIDE.md](GUIDE.md) - practical package usage

## Reading Order

1. Start with [../README.md](../README.md).
2. Read [GUIDE.md](GUIDE.md) for direct package usage.
3. Read [governance-SPEC-1.0.0v.md](governance-SPEC-1.0.0v.md) for normative behavior.

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v1.0.0 | [SPEC](governance-SPEC-1.0.0v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial protocol extraction | Current |

## Notes

- Governance is a first-class public package in the hard-cut docs set.
- Governance depends on Lineage for identity and branch reads.
- Use `@manifesto-ai/world` when you want the composed governed facade instead of the raw governance package.

