# Host Documentation Index

> **Package:** `@manifesto-ai/host`
> **Last Updated:** 2026-03-29

---

## Current Specification

- **SPEC (Living Document):** [host-SPEC.md](host-SPEC.md) — Normative, current through v3.0.0
  - Consolidated from v2.x living document + ADR-009 hard-cut updates
  - Deprecated Compiler Integration moved to Appendix D
  - See Appendix C in the SPEC for FDR cross-reference table

---

## Archived Versions

Previous versioned SPEC and FDR files are preserved in the [`archive/`](archive/) subdirectory.

| File | Type | Notes |
|------|------|-------|
| [host-SPEC-v2.0.2.md](archive/host-SPEC-v2.0.2.md) | Full SPEC | Snapshot Type Alignment, `$host` namespace |
| [host-SPEC-v2.0.1.md](archive/host-SPEC-v2.0.1.md) | Full SPEC | Superseded by v2.0.2 |
| [host-FDR-v2.0.2.md](archive/host-FDR-v2.0.2.md) | FDR Addendum | FDR-H025 (now inlined) |
| [host-FDR-v2.0.1.md](archive/host-FDR-v2.0.1.md) | FDR | FDR-H018~H024 (now inlined) |

---

## Reading Guide

- **v3.0.0**: ADR-009 alignment - Host interlock explicitly applies `patches` then `systemDelta`; requirement clearing uses `applySystemDelta({ removeRequirementIds })`; `system.*` is structurally non-patchable.
- **v2.0.2**: Snapshot Type Alignment - Host references Core's canonical Snapshot type (HOST-SNAP-1~4), introduces `data.$host` namespace for Host-owned state (HOST-NS-1~4), adds INV-SNAP-1~7 invariants. FDR addendum formalizes snapshot ownership.
- **v2.0.1**: Adds Context Determinism (FDR-H023) - HostContext frozen per job for `f(snapshot) = snapshot'` preservation.
- **v2.0.0**: Major update introducing concurrency control via Event-Loop Execution Model (Mailbox, Single-runner).

---

## Notes

- ADR-015 reserves Host v3.1.0 as the projected doc-alignment release for the simplified Core Snapshot surface (`system.errors` removal). Host remains contractually tied to Core's imported Snapshot types; no new execution contract is introduced by the ADR set.
- Host v1.0.0 and v1.1.0 SPEC/FDR documents predate the v2.0 rewrite and are not included in this repo.
