# Lineage Protocol Documentation Index

> **Package:** `@manifesto-ai/lineage`
> **Last Updated:** 2026-03-28

---

## Current Specification

- **SPEC (Living Document):** [lineage-SPEC-1.0.1v.md](lineage-SPEC-1.0.1v.md) — Normative, current through v1.0.1
  - Initial continuity-engine extraction from World SPEC per ADR-014
  - Patch clarifies public branch epoch reads and adds targeted branch lookup to `LineageService`
  - Defines deterministic identity, seal protocol, branch/head model, persistence, replay, and resume
  - Governance companion spec now exists in `@manifesto-ai/governance`

---

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v1.0.1 | [SPEC](lineage-SPEC-1.0.1v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Patch release (`BranchInfo.epoch`, `getBranch()`, epoch-read contract) | Current |
| v1.0.0 | [SPEC](lineage-SPEC-1.0.0v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial protocol extraction | Superseded by v1.0.1 |

---

## Reading Guide

1. Read [lineage-SPEC-1.0.1v.md](lineage-SPEC-1.0.1v.md).
2. For split rationale and package-boundary rules, read [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md).
3. For the staged compatibility-facade context during transition, see [World VERSION-INDEX](../../world/docs/VERSION-INDEX.md) and [World Facade SPEC v1.0.0](../../world/docs/world-facade-spec-v1.0.0.md).

---

## Notes

- There are no archived Lineage SPEC or FDR documents yet.
- During the staged ADR-014 transition, the active compatibility facade is defined by [../../world/docs/world-facade-spec-v1.0.0.md](../../world/docs/world-facade-spec-v1.0.0.md).
- Governance now has its own living SPEC in [../../governance/docs/VERSION-INDEX.md](../../governance/docs/VERSION-INDEX.md); World remains the facade anchor during transition.
