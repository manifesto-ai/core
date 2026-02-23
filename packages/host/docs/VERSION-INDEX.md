# Host Documentation Index

> **Package:** `@manifesto-ai/host`
> **Last Updated:** 2026-01-18

---

## Latest Version

- **SPEC:** [v2.0.2](host-SPEC-v2.0.2.md) (Full)
- **FDR:** [v2.0.2](host-FDR-v2.0.2.md) (Addendum)

---

## All Versions

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v2.0.2 | [SPEC](host-SPEC-v2.0.2.md) | [FDR](host-FDR-v2.0.2.md) | Full + Addendum | Normative |
| v2.0.1 | [SPEC](host-SPEC-v2.0.1.md) | [FDR](host-FDR-v2.0.1.md) | Full | Superseded |
| v2.0.0 | — (superseded) | — (superseded) | Full | Superseded |
| v1.1.0 | — (archived) | — (archived) | Patch (Base: v1.0) | Superseded |
| v1.0.0 | — (archived) | — (archived) | Full | Superseded |

---

## Reading Guide

- **v2.0.2**: Snapshot Type Alignment - Host references Core's canonical Snapshot type (HOST-SNAP-1~4), introduces `data.$host` namespace for Host-owned state (HOST-NS-1~4), adds INV-SNAP-1~7 invariants. FDR addendum formalizes snapshot ownership.
- **v2.0.1**: Adds Context Determinism (FDR-H023) - HostContext frozen per job for `f(snapshot) = snapshot'` preservation.
- **v2.0.0**: Major update introducing concurrency control via Event-Loop Execution Model (Mailbox, Single-runner).
- **v1.1.0**: Patch documents requiring base v1.0 (archived).

---

## Notes

- Host v1.0.0 and v1.1.0 SPEC/FDR documents predate the v2.0 rewrite and are not included in this repo.
