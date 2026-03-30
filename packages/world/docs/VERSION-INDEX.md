# World Package Documentation Index

> **Package:** `@manifesto-ai/world`
> **Last Updated:** 2026-03-31

---

## Current Specifications

### World Facade
- **SPEC:** [world-facade-spec-v2.0.0.md](world-facade-spec-v2.0.0.md) — Normative, canonical governed composition contract
  - Defines `GovernedWorldStore`, `runInSealTransaction()`, `WorldRuntime`, async persistence, adapter subpaths, and the hard-cut top-level facade
  - Composes [Lineage SPEC v2.0.0](../../lineage/docs/lineage-SPEC-2.0.0v.md) and [Governance SPEC v2.0.0](../../governance/docs/governance-SPEC-2.0.0v.md)

### Legacy World Protocol
- **SPEC (Living Document):** [world-SPEC.md](world-SPEC.md) — Legacy monolith reference, current through v3.0.0
  - Historical monolith reference only; active ownership now lives in the split packages and facade spec above

---

## Facade Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v2.0.0 | [SPEC](world-facade-spec-v2.0.0.md) | [ADR-015](../../../docs/internals/adr/015-snapshot-ontological-purification.md), [ADR-016](../../../docs/internals/adr/016-merkle-tree-lineage.md) | Hard-cut governed facade | Current |
| v1.0.0 | [SPEC](world-facade-spec-v1.0.0.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial split-facade baseline | Superseded |

---

## Legacy Protocol Archive

Previous versioned SPEC and FDR files are preserved in the [`archive/`](archive/) subdirectory.

| File | Type | Notes |
|------|------|-------|
| [world-SPEC-v2.0.3.md](archive/world-SPEC-v2.0.3.md) | Full SPEC | Base document for v2.0.3+ series |
| [world-SPEC-v2.0.4-patch.md](archive/world-SPEC-v2.0.4-patch.md) | Patch | Platform namespace `$`-prefix pattern |
| [world-SPEC-v2.0.5-patch.md](archive/world-SPEC-v2.0.5-patch.md) | Patch | Head query, resume, branch persistence |
| [world-FDR-v2.0.2.md](archive/world-FDR-v2.0.2.md) | FDR | FDR-W001~W035 (historical rationale) |
| [world-FDR-v2.0.5-addendum.md](archive/world-FDR-v2.0.5-addendum.md) | FDR Addendum | FDR-W036~W038 (historical rationale) |
| [WORLD-EVENT-FDR-v1.0.0.md](archive/WORLD-EVENT-FDR-v1.0.0.md) | FDR | Historical v1.x event-system rationale |

---

## Reading Guide

- **Facade v2.0.0**: current canonical world contract — `GovernedWorldStore`, `WorldRuntime`, async persistence, adapter subpaths, and world-owned execution boundary.
- **Facade v1.0.0**: historical pre-hard-cut baseline.
- **Legacy Protocol v3.0.0**: historical monolith reference only.

---

## Notes

- [world-facade-spec-v2.0.0.md](world-facade-spec-v2.0.0.md) is the canonical spec for `@manifesto-ai/world`.
- [world-facade-spec-v1.0.0.md](world-facade-spec-v1.0.0.md) is retained as a superseded historical contract.
- [world-SPEC.md](world-SPEC.md) is historical reference only.
- Governance and Lineage are the official split protocol packages and own their current v2 specs.
