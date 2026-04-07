# Core Documentation Index

> **Package:** `@manifesto-ai/core`
> **Last Updated:** 2026-04-07

---

## Current Specification

- **SPEC (Living Document):** [core-SPEC.md](core-SPEC.md) — Normative, current through v4.1.0
  - Consolidated from v2.x living document with ADR-009 hard-cut updates
  - Includes additive availability query API: `isActionAvailable()` and `getAvailableActions()`
  - Includes additive intent dispatchability query API: `isIntentDispatchable()`
  - ADR-015 hard cut landed: accumulated `system.errors` and `appendErrors` are removed
  - FDR rationale inlined as `> **Rationale (FDR-XXX):**` blocks
  - See Appendix D in the SPEC for FDR cross-reference table

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
- v3.1.0 additively exposes the R-002 availability check as `isActionAvailable()` and `getAvailableActions()` without changing the compute/apply loop.
- v4.1.0 additively exposes intent-level dispatchability as `isIntentDispatchable(schema, snapshot, intent)` while preserving the existing `available` contract unchanged.
- v4.0.0 lands ADR-015 in the current Core contract: `system.errors` and `appendErrors` are removed, and `lastError` is the sole current error surface.
- v1.0.0 SPEC/FDR predate the v2.0 rewrite and are not included in this repo.
