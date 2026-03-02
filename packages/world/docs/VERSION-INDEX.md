# World Protocol Documentation Index

> **Package:** `@manifesto-ai/world`
> **Last Updated:** 2026-02-27

---

## Current Specification

### World Protocol
- **SPEC (Living Document):** [world-SPEC.md](world-SPEC.md) — Normative, current through v3.0.0
  - Consolidated from v2.x living document + ADR-009 persistence hard-cut updates
  - FDR rationale inlined as `> **Rationale (FDR-XXX):**` blocks
  - See Appendix B in the SPEC for FDR cross-reference tables

### World Event System (Extension)
- **Status:** Deprecated (governance events in World SPEC v2.0.1+)
- **FDR:** [v1.0.0](archive/WORLD-EVENT-FDR-v1.0.0.md) (Historical, archived)

---

## Archived Versions

Previous versioned SPEC and FDR files are preserved in the [`archive/`](archive/) subdirectory.

| File | Type | Notes |
|------|------|-------|
| [world-SPEC-v2.0.3.md](archive/world-SPEC-v2.0.3.md) | Full SPEC | Base document for v2.0.3+ series |
| [world-SPEC-v2.0.4-patch.md](archive/world-SPEC-v2.0.4-patch.md) | Patch | Platform namespace `$`-prefix pattern |
| [world-SPEC-v2.0.5-patch.md](archive/world-SPEC-v2.0.5-patch.md) | Patch | Head, Resume, Branch Persistence |
| [world-FDR-v2.0.2.md](archive/world-FDR-v2.0.2.md) | FDR | FDR-W001~W035 (key items inlined) |
| [world-FDR-v2.0.5-addendum.md](archive/world-FDR-v2.0.5-addendum.md) | FDR Addendum | FDR-W036~W038 (now inlined) |
| [WORLD-EVENT-FDR-v1.0.0.md](archive/WORLD-EVENT-FDR-v1.0.0.md) | FDR | Historical v1.x event system rationale |

---

## Reading Guide

- **v3.0.0**: ADR-009 persistence alignment — serialized patch envelopes require `_patchFormat: 2`; restore boundary hard-rejects legacy format and requires genesis reset on incompatibility.
- **v2.0.5**: Head Query API — Formal head definition (branch pointer), resume contract, branch state persistence. `getHeads()`, `getLatestHead()` added to World public interface. HEAD-1~8, RESUME-1~6, BRANCH-PERSIST-1~5, INV-W16~W19.
- **v2.0.4**: Platform namespace prefix — `stripPlatformNamespaces()` uses `$`-prefix pattern, `isPlatformNamespace()` API.
- **v2.0.3**: Platform namespace extension - `$mel` namespace hash exclusion (WORLD-HASH-4b), `stripPlatformNamespaces()` API, platform namespace policy rules (NS-PLAT-*).
- **v2.0.2**: Host-World Data Contract (`$host` namespace convention formalized as HOST-DATA-* rules), terminology unification.
- **v2.0.1**: ADR-001 Layer Separation - Event ownership clarification, "Does NOT Know" boundary definition.
- **v2.0.0**: Host v2.0.1 Integration - ExecutionKey mapping, HostExecutor abstraction, ScheduleContext.
- **v1.0.0**: Initial release defining core governance. (Archived docs)

---

## Notes

- The Living Document replaces the patch-chain reading model. All content is in one file.
- World Protocol v1.0.0 SPEC/FDR are archived and not included in this repo.
- World Event System extension docs are deprecated; governance events are specified in the Living Document.
