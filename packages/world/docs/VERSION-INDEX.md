# World Protocol Documentation Index

> **Package:** `@manifesto-ai/world`
> **Last Updated:** 2026-01-18

---

## Latest Version

### World Protocol
- **SPEC:** [v2.0.2](world-SPEC-v2.0.2.md) (Full)
- **FDR:** [v2.0.2](world-FDR-v2.0.2.md) (Full)

### World Event System (Extension)
- **Status:** Deprecated (governance events in World SPEC v2.0.1+)
- **SPEC:** — (merged into World SPEC v2.0.2)
- **FDR:** [v1.0.0](WORLD-EVENT-FDR-v1.0.0.md) (Historical)

---

## All Versions

### World Protocol

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
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

- **v2.0.2**: WorldId hash determinism (JCS, pendingDigest by requirement IDs, terminalStatus normalization), baseSnapshot responsibility clarification.
- **v2.0.1**: ADR-001 Layer Separation - Event ownership clarification, "Does NOT Know" boundary definition, Host v2.0.2 compatibility.
- **v2.0.0**: Host v2.0.1 Integration - ExecutionKey mapping, HostExecutor abstraction, ScheduleContext for event handlers, strengthened EVT-C constraints, terminal snapshot validation.
- **v1.0.0**: Initial release defining core governance (Actor, Authority, Proposal, Decision, World, Lineage). (Archived docs)

---

## Notes

- World Protocol v1.0.0 SPEC/FDR are archived and not included in this repo.
- World Event System extension docs are deprecated; governance events are specified in `world-SPEC-v2.0.2.md`.
