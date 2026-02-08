# World Protocol Documentation Index

> **Package:** `@manifesto-ai/world`
> **Last Updated:** 2026-02-08

---

## Latest Version

### World Protocol
- **SPEC:** [v2.0.5](world-SPEC-v2.0.5-patch.md) (Patch, Base: v2.0.3)
- **FDR:** [v2.0.5](world-FDR-v2.0.5-addendum.md) (Addendum)

### World Event System (Extension)
- **Status:** Deprecated (governance events in World SPEC v2.0.1+)
- **SPEC:** — (merged into World SPEC v2.0.2)
- **FDR:** [v1.0.0](WORLD-EVENT-FDR-v1.0.0.md) (Historical)

---

## All Versions

### World Protocol

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v2.0.5 | [SPEC](world-SPEC-v2.0.5-patch.md) | [FDR](world-FDR-v2.0.5-addendum.md) | Patch (Base: v2.0.3) | Draft |
| v2.0.3 | [SPEC](world-SPEC-v2.0.3.md) | — | Full | Accepted |
| v2.0.3 | [SPEC](world-SPEC-v2.0.3-patch.md) | — | Patch (Base: v2.0.2) | Merged |
| v2.0.2 | [SPEC](world-SPEC-v2.0.2.md) | [FDR](world-FDR-v2.0.2.md) | Full | Accepted |
| v2.0.1 | [SPEC](world-SPEC-v2.0.1.md) | [FDR](world-FDR-v2.0.1.md) | Full | Superseded |
| v2.0.0 | [SPEC](world-SPEC-v2.0.0v.md) | [FDR](world-FDR-v2.0.0v.md) | Full | Superseded |
| v1.0.0 | — (archived) | — (archived) | Full | Superseded |

### World Event System

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v1.1.0 | — (deprecated; merged into World SPEC v2.0.1+) | — | Full | Superseded |
| v1.0.0 | — | [FDR](WORLD-EVENT-FDR-v1.0.0.md) | Full | Superseded |

---

## Reading Guide

- **v2.0.5**: Head Query API — Formal head definition (branch pointer), resume contract, branch state persistence. `getHeads()`, `getLatestHead()` added to World public interface. HEAD-1~8, RESUME-1~6, BRANCH-PERSIST-1~5, INV-W16~W19.
- **v2.0.3**: Platform namespace extension - `$mel` namespace hash exclusion (WORLD-HASH-4b), `stripPlatformNamespaces()` API, platform namespace policy rules (NS-PLAT-*).
- **v2.0.2**: Host-World Data Contract (`$host` namespace convention formalized as HOST-DATA-* rules), terminology unification (`'failed'` replaces `'error'` in TerminalStatusForHash).
- **v2.0.1**: ADR-001 Layer Separation - Event ownership clarification, "Does NOT Know" boundary definition, Host v2.0.2 compatibility.
- **v2.0.0**: Host v2.0.1 Integration - ExecutionKey mapping, HostExecutor abstraction, ScheduleContext for event handlers, strengthened EVT-C constraints, terminal snapshot validation.
- **v1.0.0**: Initial release defining core governance (Actor, Authority, Proposal, Decision, World, Lineage). (Archived docs)

---

## Notes

- World Protocol v1.0.0 SPEC/FDR are archived and not included in this repo.
- World Event System extension docs are deprecated; governance events are specified in `world-SPEC-v2.0.2.md`.
