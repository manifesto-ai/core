# ADR-011: Host Boundary Reset Scope and ExecutionKey Serialization

> **Status:** Proposed
> **Date:** 2026-02-25
> **Deciders:** Manifesto Architecture Team
> **Scope:** Host, Runtime, World, SDK
> **Resolves:** [#198](https://github.com/manifesto-ai/core/issues/198)
> **Related ADRs:** [ADR-008](./008-sdk-first-transition-and-app-retirement), [ADR-010](./010-major-hard-cut)
> **Breaking:** Yes — Host execution contract and runtime scheduling semantics are tightened

---

## 1. Context

Issue [#198](https://github.com/manifesto-ai/core/issues/198) reports two connected regressions at the host execution boundary:

1. The reset path is treated inconsistently across flows, with some paths restoring only `snapshot.data` while execution continuity later expects `system` and `meta`.
2. Runtime execution can overlap on the same `executionKey` during timeout/abort windows, which breaks determinism and can leak in-flight work into the next execution.

Both problems are boundary-level and can appear even when individual packages appear correct in isolation.

## 2. Decision

### 2.1 Host reset payload must be explicit and unambiguous

`Host.reset` MUST be treated as a **boundary-normalized contract** rather than an implicit behavior.

- The default reset contract is `full-snapshot` restore.
- Data-only restore is allowed only as an explicit mode, never as an implicit side effect of passing partial inputs.
- A single call should never silently discard `system/meta` data needed by deterministic continuation.

### 2.1.1 Proposed contract

- Keep `reset()` as a first-class baseline operation:
  - `reset(snapshot: Snapshot, options?: { scope?: "full" | "data-only" })`
- `scope: "full"` (default):
  - Replace in-memory execution baseline with complete snapshot semantics.
  - Preserve `{ data, computed, system, input, meta }` according to snapshot contract.
- `scope: "data-only"`:
  - Allowed only for explicit bootstrap/bootstrap-style entry paths.
  - Must normalize/clear runtime-internal/system continuity fields before next execution.
  - Must be documented as non-continuation and may be used only when the caller does not expect action-local continuity.

### 2.2 executionKey must be strictly serialized per key

The host/runtime boundary MUST enforce one active execution at a time **per `executionKey`**.

- If `executionKey` is already active:
  - either queue deterministically, or
  - reject with explicit, deterministic contention code.
- Random or non-deterministic fallback behavior is disallowed.
- At minimum, overlap MUST be impossible for same-key in-flight executions.

For `@manifesto-ai/host` this ADR requires:

- Per-key execution slot tracking.
- Strict acquire/release lifecycle in `tryDispatch` / execute path.

### 2.3 Timeout and abort must be coupled to slot release

Timeout/cancel in host execution must not leave the key slot in a dirty in-flight state.

- Execution path MUST receive an abort signal or equivalent cancellation token.
- On timeout:
  - mark execution as failed deterministically,
  - close/abort internal handlers,
  - release the key slot in a `finally` path,
  - and make resulting snapshot continuation explicit (`system.currentAction`, `system.pendingRequirements`, `system.lastError`) under the same key gate.

## 3. Consequences

- Predictable execution replay: same `executionKey` + same baseline snapshot yields deterministic serialized behavior.
- Reduced cross-execution contamination on cancellation and timeout windows.
- Clear contract for bootstrap restore intent:
  - full continuity (`full`) vs bootstrap-only (`data-only`) paths are no longer ambiguous.

Trade-offs:
- Data-only restore now requires explicit use, which can break callers relying on previous implicit behavior.
- Same-key queueing may surface back-pressure where callers previously expected immediate parallel overlap.

## 4. Validation

Introduce test contracts for:

1. Full-snapshot restore
   - `reset(snapshot, { scope: "full" })` preserves baseline continuity fields.
2. Data-only restore
   - `reset(snapshot, { scope: "data-only" })` produces explicit continuity boundary behavior.
3. Same-key execution serialization
   - Concurrent dispatches with same `executionKey` are either queued deterministically or fail with explicit contention.
4. Timeout safety
   - Timeout path releases the key slot and prevents stale in-flight effects on subsequent executions.

## 5. Alternatives Considered

### 5.1 Keep implicit partial snapshot restore

Rejected because it couples call-site assumptions to hidden host behavior and blocks deterministic replay analysis.

### 5.2 Keep per-key parallelism

Rejected because same-key overlap directly enables nondeterministic interleaving and stale continuation during timeout/abort windows.

## 6. Open Questions

- Whether same-key contention should be implemented as strict queueing vs immediate contention error.
  - Initial decision for v1: deterministic queueing is preferred for predictability and less user-facing failure.
- Whether `executionKey` lifecycle should outlive process restart via persistence or be runtime-local only.
  - Initial decision for v1: runtime-local serialization is sufficient; persistence integration can be deferred to a protocol ADR.

