> **Addendum (2026-02-17):** Transition execution decisions moved to [ADR-008](./008-sdk-first-transition-and-app-retirement). This pack remains a pre-transition readiness snapshot.

# ADR-006 Split Readiness Pack

> **Status:** Working guidance (non-normative)
> **Source of truth:** [ADR-006](./006-runtime-reframing), [ADR-007](./007-sdk-runtime-split-kickoff), [ADR-004](./004-app-package-internal-decomposition), [ADR-001](./001-layer-separation), Manifesto Constitution (`CLAUDE.md`)

This document records split-readiness verdicts under locked owner decisions (`A2`, `B3`, `C1`, `D1`).

## 1. Locked Baseline

The following remain fixed until superseded by a new ADR:

1. `@manifesto-ai/app` remains canonical public entry throughout Phase 1.
2. Runtime/SDK specs remain `Draft`, with kickoff-lock profile and requirement ID stability.
3. Kickoff threshold remains `A2`: `3/5` with mandatory `CAN-2`, `CHAN-2`, selected third `CAN-4`.
4. Transition direction remains `B3` + `C1`: SDK-first is Phase 2 end-state after two-phase compatibility rollout.
5. Supersede scope remains `D1`: only kickoff-blocking clauses are superseded.

## 2. Owner Decision Record

Decision record locked on **2026-02-14**:

- [x] Decision A: `A2` (partial gate relaxation: `3/5` with mandatory `CAN-2`, `CHAN-2`, selected third `CAN-4`)
- [x] Decision B: `B3` (SDK-first is target end-state)
- [x] Decision C: `C1` (two-phase compatibility release)
- [x] Decision D: `D1` (minimal supersede)

## 3. Gate Status Summary

### Kickoff Gate (A2)

| Gate | Role in A2 policy | Current State | Verdict |
|------|-------------------|---------------|---------|
| `CAN-2` | Mandatory | Closed | Met |
| `CHAN-2` | Mandatory | Closed | Met |
| `CAN-4` | Selected third | Closed | Met |

**Kickoff Verdict:** **Allowed**.

### Pre-Alpha Exit Gate

| Gate | Exit Condition | Current State | Verdict |
|------|----------------|---------------|---------|
| `PUB-3` | publish boundary stress coverage | Closed | Met |
| `CHAN-1` | governance-vs-telemetry event-surface contract | Closed | Met |
| Architecture review | role-based sign-off | Approved | Met |

**Pre-Alpha Exit Verdict:** **Closed**.

## 4. Architecture Review Sign-Off (Role-Based)

| Role | Status | Date | Review Reference | Reviewer (Optional) |
|------|--------|------|------------------|---------------------|
| Docs Owner | Approved | 2026-02-14 | `docs/internals/adr/006-evidence-matrix.md`, `docs/internals/adr/006-split-readiness-pack.md` | - |
| Architecture Owner | Approved | 2026-02-14 | `docs/internals/adr/007-sdk-runtime-split-kickoff.md`, `docs/internals/adr/006-runtime-reframing.md` | - |
| Package Owners (App/World) | Approved | 2026-02-14 | `packages/app/src/__tests__/publish-boundary-stress.test.ts`, `packages/app/src/__tests__/persist-stage.test.ts`, `packages/world/src/world.test.ts` | - |

Reference baseline commit: `47f813b` (A2 kickoff lock).

## 5. Phase Boundary (B3/C1 Guardrails)

### Phase 1 (Current)

- Official entry point remains `@manifesto-ai/app`.
- Runtime/SDK remain development baseline and internal/preview context.
- Public SDK-first migration messaging is still withheld.

### Phase 2 (Transition)

- SDK-first public transition is allowed only after pre-alpha exit gate closure.
- This document now records those closure conditions as met.

## 6. Phase 2 Transition Verdict

### Decision Matrix

| Condition | Required | Current | Result |
|-----------|----------|---------|--------|
| `PUB-3` closed | Yes | Yes | Pass |
| `CHAN-1` closed | Yes | Yes | Pass |
| Architecture review approved | Yes | Yes | Pass |

### Verdict

**Go (Phase 2 transition planning unlocked).**

Notes:

1. This verdict fixes governance readiness only.
2. Actual SDK-first public documentation switch and package extraction execution remain out of current scope.

## 7. Minimal Supersede Scope (D1)

Superseded scope remains limited to kickoff timing blockers:

1. ADR-004 §7.4 kickoff-blocking interpretation
2. ADR-006 §5 strict kickoff deferral clauses tied to split start timing

Not superseded:

- ADR-001 layer principles
- PUB/CHAN/CAN normative rules in ADR-006

## 8. Operational Link

Detailed implementation and test traceability:

- [ADR-006 Evidence Matrix](./006-evidence-matrix)

