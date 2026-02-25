# ADR-011: Host Boundary Reset Completeness Policy

> **Status:** Proposed
> **Date:** 2026-02-25
> **Deciders:** Manifesto Architecture Team
> **Scope:** Host, Runtime, World, SDK
> **Resolves:** [#198](https://github.com/manifesto-ai/core/issues/198)
> **Related ADRs:** [ADR-008](./008-sdk-first-transition-and-app-retirement), [ADR-010](./010-major-hard-cut)
> **Breaking:** Yes — Host boundary input contract is tightened

---

## 1. Context

Issue [#198](https://github.com/manifesto-ai/core/issues/198) identifies execution instability when baseline restoration enters Host with partial state shape.

- Some paths only pass `snapshot.data` while Host execution expects continuity fields (`system`, `meta`) for deterministic continuation.
- `executionKey`/timeout overlap concerns are also in scope, but those behaviors are already claimed by Host SPEC v2.0.2 (`RUN-*`, `INV-EX-*`) and should be closed via SPEC enforcement, not by introducing a new ADR decision.

This ADR therefore resolves only the Host boundary contract for baseline completeness and explicitly delegates overlap/timeout enforcement to Host SPEC clarification.

## 2. Decision

### 2.1 Host baseline snapshots MUST be full-canonical at boundary entry

Host MUST receive a full-canonical snapshot when a new execution baseline is started.

- Baseline continuity fields required by Host are:
  - `data`
  - `computed`
  - `system`
  - `meta`
- `input` is not part of Host baseline continuity for this policy.

#### 2.1.1 Rule

- A snapshot missing any required continuity field is **not implicitly normalized** by Host.
- Host MUST either:
  - reject non-canonical baseline payloads explicitly, or
  - accept only after Runtime/SDK has transformed it to canonical form upstream.

#### 2.1.2 Delivery shape

- Baseline bootstrap/reset follows existing boundary channels (`Mailbox`/queue-like execution messages).
- No new explicit `reset(snapshot, { scope: "data-only" | "full" })` semantic is introduced in ADR scope.
- `data-only` bootstrap intent is an upstream (Runtime/SDK) responsibility; Host boundary remains strict and explicit about required shape.

### 2.2 Deferred (Non-ADR) work: `executionKey` and timeout slot release

`executionKey` single-run semantics and timeout/abort slot-release obligations are moved to a Host SPEC v2.0.3 patch:

- `RUN-*` and `LIVE-*` enforcement for in-flight overlap under timeout/abort.
- `ORD-*` deterministic ordering and final slot release requirements.
- Host-side error/ordering behavior should be fully clarified without weakening the execution model.

## 3. Consequences

- Removes hidden interpretation at the Host boundary.
- Keeps Host aligned with the "Core computes, Host executes" separation by preventing Host-level canonicalization policy.
- Makes bootstrap determinism explicit: continuity is decided and prepared before entering Host boundary.

Trade-off:
- Runtime/SDK must perform canonicalization before dispatch, so callers passing partial state must migrate.

## 4. Validation

1. Baseline full-shape acceptance
   - Host boundary accepts only snapshots containing `data`, `computed`, `system`, `meta`.
2. Baseline partial rejection
   - Non-canonical payload is rejected unless upstream has normalized it.
3. Baseline migration tests
   - Runtime/SDK path explicitly constructs a full-canonical baseline from partial input before host enqueue.
4. SPEC enforcement follow-up (separate)
   - executionKey overlap / timeout cleanup is validated in Host SPEC v2.0.3.

## 5. Alternatives Considered

### 5.1 Keep implicit partial snapshot restore in Host

Rejected: hidden inference in Host boundary creates nondeterministic continuation assumptions.

### 5.2 Keep Host-aware `data-only` normalization

Rejected: Host would start owning continuity-normalization behavior that belongs to execution preparation layer.

## 6. Open Questions

- None. This ADR is intentionally narrowed to full-canonical baseline shape only.
