# Governance Protocol Documentation Index

> **Package:** `@manifesto-ai/governance`
> **Last Updated:** 2026-03-28

---

## Current Specification

- **SPEC (Living Document):** [governance-SPEC-1.0.0v.md](governance-SPEC-1.0.0v.md) — Normative, current through v1.0.0
  - Initial legitimacy-engine extraction from World SPEC per ADR-014
  - Defines actor/authority model, proposal lifecycle, ingress gate, seal coordination, event ownership, and governance persistence
  - Depends on Lineage as the continuity substrate for world identity, sealing, and branch/epoch reads

---

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v1.0.0 | [SPEC](governance-SPEC-1.0.0v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial protocol extraction | Current |

---

## Reading Guide

1. Read [governance-SPEC-1.0.0v.md](governance-SPEC-1.0.0v.md).
2. For the package split rationale and boundary rules, read [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md).
3. For the continuity substrate referenced by Governance, read [Lineage VERSION-INDEX](../../lineage/docs/VERSION-INDEX.md).
4. For staged compatibility-facade context during transition, see [World VERSION-INDEX](../../world/docs/VERSION-INDEX.md).

---

## Notes

- There are no archived Governance SPEC or FDR documents yet.
- Governance depends on Lineage; Lineage remains the lower substrate in the ADR-014 split.
- During the staged ADR-014 transition, `@manifesto-ai/world` remains the active compatibility facade.
