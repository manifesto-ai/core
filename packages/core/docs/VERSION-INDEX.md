# Core Documentation Index

> **Package:** `@manifesto-ai/core`
> **Last Updated:** 2026-03-29

---

## Current Specification

- **SPEC (Living Document):** [core-SPEC.md](core-SPEC.md) — Normative, current through v3.0.0
  - Consolidated from v2.x living document with ADR-009 hard-cut updates
  - FDR rationale inlined as `> **Rationale (FDR-XXX):**` blocks
  - See Appendix D in the SPEC for FDR cross-reference table

## Projected Next Major

- **Draft SPEC:** [core-SPEC-v4.0.0-draft.md](core-SPEC-v4.0.0-draft.md) — Draft, projected next major
  - Reserved by ADR-015 for the shared epoch boundary
  - Not current until the wider Core/Lineage/Governance/Host/World/SDK alignment lands

---

## Archived Versions

Previous versioned SPEC and FDR files are preserved in the [`archive/`](archive/) subdirectory.

| File | Type | Notes |
|------|------|-------|
| [SPEC-v2.0.0.md](archive/SPEC-v2.0.0.md) | Full SPEC | Base document for v2.0.x series |
| [SPEC-v2.0.1-patch.md](archive/SPEC-v2.0.1-patch.md) | Patch | Reserved-key prefixes (SCHEMA-RESERVED-*) |
| [SPEC-v2.0.2-patch.md](archive/SPEC-v2.0.2-patch.md) | Patch | `data` vs "state" normative note |
| [SPEC-v2.0.3-patch.md](archive/SPEC-v2.0.3-patch.md) | Patch | Expression extensions (string, collection, object, coercion) |
| [FDR-v2.0.0.md](archive/FDR-v2.0.0.md) | FDR | FDR-001~016 (now inlined in Living Document) |

---

## Notes

- The Living Document replaces the patch-chain reading model. All content is in one file.
- v3.0.0 introduces ADR-009 structured patch paths (`PatchPath`) and `SystemDelta` system transition channel.
- ADR-015 was accepted on 2026-03-29 and fixes the next Core target at v4.0.0: remove accumulated `system.errors`, remove `appendErrors`, keep `lastError` as the sole current error surface, and align the living SPEC at the shared epoch boundary.
- Until that epoch lands, [core-SPEC.md](core-SPEC.md) remains the truthful current contract and [core-SPEC-v4.0.0-draft.md](core-SPEC-v4.0.0-draft.md) remains draft only.
- v1.0.0 SPEC/FDR predate the v2.0 rewrite and are not included in this repo.
