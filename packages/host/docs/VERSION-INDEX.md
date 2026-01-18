# Host Documentation Index

> **Package:** `@manifesto-ai/host`
> **Last Updated:** 2026-01-18

---

## Latest Version

- **SPEC:** [v2.0.2](host-SPEC-v2.0.2.md) (Full)
- **FDR:** [v2.0.1](host-FDR-v2.0.1.md) (Full)

---

## All Versions

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v2.0.2 | [SPEC](host-SPEC-v2.0.2.md) | — (uses v2.0.1 FDR) | Full | Draft |
| v2.0.1 | [SPEC](host-SPEC-v2.0.1.md) | [FDR](host-FDR-v2.0.1.md) | Full | Superseded |
| v2.0.0 | — (superseded) | — (superseded) | Full | Superseded |
| v1.1.0 | [SPEC](SPEC-v1.1.0-patch.md) | [FDR](FDR-v1.1.0-patch.md) | Patch (Base: v1.0) | Superseded |
| v1.0.0 | — (not in archive) | — (not in archive) | Full | Missing |

---

## Reading Guide

- **v2.0.2**: Snapshot Type Alignment - Host references Core's canonical Snapshot type (HOST-SNAP-1~4), introduces `data.$host` namespace for Host-owned state (HOST-NS-1~4), adds INV-SNAP-1~7 invariants.
- **v2.0.1**: Adds Context Determinism (FDR-H023) - HostContext frozen per job for `f(snapshot) = snapshot'` preservation.
- **v2.0.0**: Major update introducing concurrency control via Event-Loop Execution Model (Mailbox, Single-runner).
- **v1.1.0**: Patch documents requiring base v1.0 (not in archive).
