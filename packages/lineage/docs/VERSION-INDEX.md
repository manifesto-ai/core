# Lineage Protocol Documentation Index

> **Package:** `@manifesto-ai/lineage`
> **Last Updated:** 2026-03-28

---

## Current Specification

- **SPEC (Living Document):** [lineage-SPEC-1.0.0v.md](lineage-SPEC-1.0.0v.md) — Normative, current through v1.0.0
  - Initial continuity-engine extraction from World SPEC per ADR-014
  - Defines deterministic identity, seal protocol, branch/head model, persistence, replay, and resume
  - Governance split companion spec is still pending

---

## All Versions

| Version | SPEC | ADR | Type | Status |
|---------|------|-----|------|--------|
| v1.0.0 | [SPEC](lineage-SPEC-1.0.0v.md) | [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md) | Initial protocol extraction | Current |

---

## Reading Guide

1. Read [lineage-SPEC-1.0.0v.md](lineage-SPEC-1.0.0v.md).
2. For split rationale and package-boundary rules, read [ADR-014](../../../docs/internals/adr/014-split-world-protocol.md).
3. For the staged compatibility-facade context during transition, see [World VERSION-INDEX](../../world/docs/VERSION-INDEX.md).

---

## Notes

- There are no archived Lineage SPEC or FDR documents yet.
- During the staged ADR-014 transition, `@manifesto-ai/world` remains the active compatibility facade.
- Governance rules remain anchored in World documentation until a separate Governance living SPEC is published.
