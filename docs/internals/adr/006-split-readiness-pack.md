# ADR-006 Split Readiness Pack

> **Status:** Working guidance (non-normative)
> **Source of truth:** [ADR-006](./006-runtime-reframing), [ADR-007](./007-sdk-runtime-split-kickoff), [ADR-004](./004-app-package-internal-decomposition), [ADR-001](./001-layer-separation), Manifesto Constitution (`CLAUDE.md`)

This document records the current split-readiness verdict under the locked owner decisions (`A2`, `B3`, `C1`, `D1`).

## 1. Locked Baseline

The following are fixed until a new ADR supersedes them:

1. `@manifesto-ai/app` remains the current canonical public entry for Phase 1.
2. Runtime/SDK specs remain `Draft`, but kickoff lock applies to requirement IDs.
3. Split kickoff policy is `A2`: `3/5` gates with mandatory `CAN-2`, `CHAN-2`, and selected third `CAN-4`.
4. Transition direction is `B3` + `C1`: SDK-first is Phase 2 end-state with a two-phase compatibility rollout.
5. Supersede scope is `D1`: only blocking clauses on kickoff timing are superseded.

## 2. Owner Decision Record

Decision record locked on **2026-02-14**:

- [x] Decision A: `A2` (partial gate relaxation: `3/5` with mandatory `CAN-2`, `CHAN-2`, selected third `CAN-4`)
- [x] Decision B: `B3` (SDK-first is target end-state)
- [x] Decision C: `C1` (two-phase compatibility release)
- [x] Decision D: `D1` (minimal supersede)

## 3. Readiness Verdict (Current)

### Verdict

**Kickoff Allowed (A2 policy).**

Kickoff is allowed because mandatory gates (`CAN-2`, `CHAN-2`) and the selected third gate (`CAN-4`) are closed, satisfying the `3/5` threshold.

### Gate Status

| Gate | Role in A2 policy | Current State | Verdict |
|------|-------------------|---------------|---------|
| `CAN-2` | Mandatory | Closed | Met |
| `CHAN-2` | Mandatory | Closed | Met |
| `CAN-4` | Selected third | Closed | Met |
| `PUB-3` | Remaining gate | Open | Deferred to pre-alpha exit |
| `CHAN-1` | Remaining gate | Open | Deferred to pre-alpha exit |

## 4. Phase Boundary (B3/C1 Guardrails)

### Phase 1: Kickoff

- Official entry point remains `@manifesto-ai/app`.
- Runtime/SDK are development baseline documents and internal/preview context.
- No public SDK-first migration messaging yet.

### Phase 2: Public Transition (separate gate)

SDK-first public transition is allowed only after pre-alpha exit gate closure:

1. `PUB-3` closed
2. `CHAN-1` closed
3. Architecture review sign-off

## 5. Minimal Supersede Scope (D1)

The current lock supersedes only:

1. ADR-004 §7.4 kickoff-blocking interpretation for package split start timing
2. ADR-006 §5 strict kickoff deferral clauses tied to split start timing

Not superseded:

- ADR-001 layer principles
- PUB/CHAN/CAN normative rules in ADR-006

## 6. Operational Link

Detailed implementation/test traceability remains in:

- [ADR-006 Evidence Matrix](./006-evidence-matrix)

