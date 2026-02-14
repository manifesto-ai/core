# ADR-006 Evidence Matrix

> **Status:** Pre-alpha exit evidence snapshot (non-normative)
> **ADR status alignment:** ADR-006 remains `Proposed`
> **Normative source:** [ADR-006](./006-runtime-reframing)
> **Kickoff/pre-alpha policy source:** [ADR-007](./007-sdk-runtime-split-kickoff)

This document maps ADR-006 rules to implementation and tests.
It does not change normative statements in ADR-006.

## Rule Traceability Matrix

| Rule | ADR Basis | Implementation Evidence | Test Evidence | Status | Notes |
|------|-----------|-------------------------|---------------|--------|-------|
| `PUB-1` | `docs/internals/adr/006-runtime-reframing.md:65` | `packages/app/src/execution/pipeline/persist.ts:97`, `packages/app/src/execution/proposal/proposal-manager.ts:91` | `packages/app/src/__tests__/publish-boundary.test.ts:28` | Tracked | Proposal-tick single publish evidence exists and remains stable. |
| `PUB-2` | `docs/internals/adr/006-runtime-reframing.md:66` | `packages/app/src/execution/pipeline/persist.ts:102`, `packages/world/src/world.ts:840`, `packages/world/src/world.ts:862` | `packages/world/src/world.test.ts:423` | Tracked | Terminal snapshot basis is implemented and covered in existing tests. |
| `PUB-3` | `docs/internals/adr/006-runtime-reframing.md:67` | `packages/app/src/execution/pipeline/persist.ts:97`, `packages/app/src/execution/pipeline/persist.ts:117`, `packages/app/src/execution/proposal/proposal-manager.ts:116` | `packages/app/src/__tests__/publish-boundary-stress.test.ts`, `packages/app/src/__tests__/persist-stage.test.ts` | Closed | Multi-apply integration path and persist-stage boundary guard are both fixed by tests. |
| `CHAN-1` | `docs/internals/adr/006-runtime-reframing.md:74` | `packages/world/src/events/types.ts:41`, `packages/world/src/world.ts:903`, `packages/app/src/core/types/hooks.ts:192` | `packages/world/src/world.test.ts` (Event Surface Contracts), `packages/app/src/__tests__/timing-compliance.test.ts:60` | Closed | World event surface is validated as governance-only; telemetry event types are absent from runtime emission scenarios. |
| `CHAN-2` | `docs/internals/adr/006-runtime-reframing.md:77` | `packages/world/src/types/host-executor.ts:81`, `packages/world/src/world.ts:840` | `packages/world/src/world.test.ts:483`, `packages/world/src/world.test.ts:522` | Closed | Advisory outcome mismatch is covered in both mismatch directions. |
| `CAN-1` | `docs/internals/adr/006-runtime-reframing.md:92` | `packages/world/src/factories.ts:234`, `packages/world/src/factories.ts:281`, `packages/app/src/storage/world-store/delta-generator.ts:107` | `packages/world/src/__tests__/factories.test.ts:42`, `packages/app/src/__tests__/delta-generator.test.ts:299` | Tracked | Hash/delta scope is aligned; helper convergence remains monitored. |
| `CAN-2` | `docs/internals/adr/006-runtime-reframing.md:97` | `packages/world/src/world.ts:811`, `packages/world/src/world.ts:830` | `packages/world/src/world.test.ts:550` | Closed | Executor input is verified as raw base snapshot (no canonical projection). |
| `CAN-3` | `docs/internals/adr/006-runtime-reframing.md:102` | `packages/world/src/factories.ts:103`, `packages/app/src/storage/world-store/platform-namespaces.ts:31` | `packages/world/src/__tests__/factories.test.ts:162`, `packages/world/src/__tests__/factories.test.ts:179`, `packages/world/src/__tests__/factories.test.ts:198` | Closed | `$`-namespace exclusion behavior is covered for known and future namespaces. |
| `CAN-4` | `docs/internals/adr/006-runtime-reframing.md:105` | `packages/world/src/factories.ts:234`, `packages/world/src/factories.ts:273` | `packages/world/src/__tests__/factories.test.ts:160`, `packages/world/src/__tests__/factories.test.ts:173`, `packages/world/src/__tests__/factories.test.ts:188` | Closed | Hash invariance for `input`, `computed`, `meta.version/timestamp/randomSeed` is fixed by tests. |

## Kickoff Gate (A2)

Policy: `3/5 + mandatory(CAN-2, CHAN-2) + selected third(CAN-4)`

- [x] `CAN-2` (mandatory)
- [x] `CHAN-2` (mandatory)
- [x] `CAN-4` (selected third)

**Verdict:** Kickoff gate is closed under A2 policy.

## Pre-Alpha Exit Gate

Required for Phase 2 transition:

- [x] `PUB-3` stress coverage
- [x] `CHAN-1` event-surface separation contract coverage
- [x] Architecture review sign-off

**Verdict:** Pre-alpha exit gate is closed.

## Architecture Review Sign-Off (Role-Based)

| Role | Status | Date | Review Reference | Reviewer (Optional) |
|------|--------|------|------------------|---------------------|
| Docs Owner | Approved | 2026-02-14 | `docs/internals/adr/006-evidence-matrix.md`, `docs/internals/adr/006-split-readiness-pack.md` | - |
| Architecture Owner | Approved | 2026-02-14 | `docs/internals/adr/007-sdk-runtime-split-kickoff.md`, `docs/internals/adr/006-runtime-reframing.md` | - |
| Package Owners (App/World) | Approved | 2026-02-14 | `packages/app/src/__tests__/publish-boundary-stress.test.ts`, `packages/app/src/__tests__/persist-stage.test.ts`, `packages/world/src/world.test.ts` | - |

Reference baseline commit: `47f813b` (A2 kickoff lock).

