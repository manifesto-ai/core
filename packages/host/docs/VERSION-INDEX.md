# Host Documentation Index

> **Package:** `@manifesto-ai/host`
> **Last Updated:** 2026-04-08

---

## Current Specification

- **SPEC (Living Document):** [host-SPEC.md](host-SPEC.md) — Normative, current through v4.0.0
  - Consolidated from v2.x living document + ADR-009 hard-cut updates
  - ADR-015 hard cut landed: Host-facing Snapshot references no longer include accumulated `system.errors`
  - Compatible with current Core living spec through v4.1.0; Core intent-dispatchability additions do not change Host's contract
  - Deprecated Compiler Integration moved to Appendix D
  - See Appendix C in the SPEC for FDR cross-reference table
- **README:** [../README.md](../README.md) — package landing page
- **Guide:** [GUIDE.md](GUIDE.md) — practical package usage

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

- [host-SPEC.md](host-SPEC.md) is the current living contract.
- Host current Snapshot references now follow Core v4 current shape: `lastError` remains, accumulated `system.errors` is removed.
- The retained host v4 draft file is historical drafting context for the landed alignment and restore-boundary wording.
- Host v1.0.0 and v1.1.0 SPEC/FDR documents predate the v2.0 rewrite and are not included in this repo.
