# ADR-015: Snapshot Ontological Purification — Remove Accumulated History from Point-in-Time State

> **Status:** Implemented
> **Date:** 2026-03-29
> **Deciders:** 정성우, Manifesto Architecture Team
> **Scope:** Core, Lineage, Host, World, SDK
> **Resolves:** [#318](https://github.com/manifesto-ai/core/issues/318) (Unbounded growth of `snapshot.system.errors`)
> **Supersedes:** None
> **Related:** ADR-009 (SystemDelta separation), ADR-014 (World → Lineage + Governance split), ADR-016 (Merkle Tree Lineage — co-deployed, same epoch)
> **Breaking:** Yes — Core SPEC, Lineage SPEC (same epoch boundary as ADR-016)

---

## 1. Context

### 1.1 The Ontological Contradiction

Snapshot's canonical statement is unambiguous:

> "Snapshot is the **immutable, point-in-time representation** of world state."
> — Core SPEC §13.1

Yet `system.errors` is defined as:

> "`system.errors` is HISTORY (accumulated)"
> — SNAP-TYPE-5, World SPEC / Lineage SPEC

**A point-in-time representation cannot contain accumulated history.** These two statements contradict each other. One must yield.

### 1.2 Issue #318 — The Symptom

In long-running hosts (e.g., Coin Sapiens tick loop), repeatedly dispatching unavailable actions or invalid inputs causes `snapshot.system.errors` to grow without bound. Each failure appends to the array indefinitely, producing:

- Unbounded memory growth in Snapshot
- Linear degradation of Lineage hash computation (ErrorSignature normalization + sort)
- Snapshot bloat across Host ↔ World boundary and SDK `subscribe()` propagation
- Noisy diagnostics that obscure meaningful failures

### 1.3 The Root Cause Is Architectural, Not Implementation

Issue #318 could be "fixed" with a ring buffer or coalescing strategy. But that treats the symptom while preserving the contradiction. The real question is: **why is accumulated history in a point-in-time state representation at all?**

### 1.4 Lineage Now Exists

`system.errors` was introduced before Lineage existed as a formal protocol. At that time, Snapshot was the only place to record error history — there was no chain of immutable World records to traverse.

ADR-014 established Lineage as the **Continuity Engine** — an append-only, acyclic DAG of immutable World records, each containing a sealed terminal Snapshot. With Lineage in place, accumulated error history no longer needs to live inside each individual Snapshot.

However, Lineage's role is **continuity of current state**, not detailed failure chronology. Failed worlds do not advance the branch head (Lineage SPEC `PreparedNextCommit.headAdvanced = false` for failed outcomes). This means error history is not straightforwardly recoverable from the head path alone.

The proper home for guard rejection and infrastructure failure chronology is the **telemetry channel** — `on('dispatch:rejected', ...)` and `on('dispatch:failed', ...)` events (ADR-006 CHAN-1 channel separation). Domain semantic failure chronology requires a Lineage-level solution (deferred to ADR-016). Trace artifacts (`executionTraceRef` in World records) provide additional forensic depth when needed.

The accumulated `system.errors` array in Snapshot is therefore **redundant in purpose** (current error state is fully captured by `lastError`) **and unbounded in growth** (no retention policy). It should be removed.

### 1.5 Evidence: The Spec Already Knows

Multiple normative rules already treat `system.errors` as non-essential:

| Rule | What it says | Implication |
|------|-------------|-------------|
| SNAP-TYPE-5 | "errors is HISTORY; lastError is CURRENT state" | The Spec itself distinguishes current from accumulated |
| LIN-OUTCOME-5 | "MUST NOT use errors.length for failure determination" | errors has no semantic role in terminal status |
| LIN-SNAP-4 | Same as SNAP-TYPE-5, re-stated in Lineage | Lineage explicitly avoids depending on errors for decisions |
| WORLD-TERM-STATUS-2 (now LIN) | "determines error state via lastError != null, NOT errors.length" | All decision logic uses lastError exclusively |

No normative rule in Core, Host, Lineage, or Governance uses `system.errors` for any decision. It exists solely as a convenience read surface — a convenience that causes unbounded growth.

---

## 2. Decision

### 2.1 Remove `system.errors` from Snapshot

`system.errors` is removed from `SystemState`. Error recording via `appendErrors` in `SystemDelta` is removed. The `lastError` field remains as the sole error surface in Snapshot.

**Before (Core SPEC v2.x / v3.x):**

```typescript
type SystemState = {
  readonly status: 'idle' | 'computing' | 'pending' | 'error';
  readonly lastError: ErrorValue | null;
  readonly errors: readonly ErrorValue[];           // ← REMOVED
  readonly pendingRequirements: readonly Requirement[];
  readonly currentAction: string | null;
};

type SystemDelta = {
  readonly status?: SystemState['status'];
  readonly currentAction?: string | null;
  readonly lastError?: ErrorValue | null;
  readonly appendErrors?: readonly ErrorValue[];    // ← REMOVED
  readonly addRequirements?: readonly Requirement[];
  readonly removeRequirementIds?: readonly string[];
};
```

**After (ADR-015):**

```typescript
type SystemState = {
  readonly status: 'idle' | 'computing' | 'pending' | 'error';
  readonly lastError: ErrorValue | null;
  readonly pendingRequirements: readonly Requirement[];
  readonly currentAction: string | null;
};

type SystemDelta = {
  readonly status?: SystemState['status'];
  readonly currentAction?: string | null;
  readonly lastError?: ErrorValue | null;
  readonly addRequirements?: readonly Requirement[];
  readonly removeRequirementIds?: readonly string[];
};
```

### 2.2 Replace Error History with Current Error Identity in Lineage Hash

`SnapshotHashInput` replaces accumulated `ErrorSignature[]` (full history) with a single `CurrentErrorSignature` (current state only). The bulk error normalization/sort logic is removed. The `ErrorSignature` type used for history is removed; a new `CurrentErrorSignature` type captures the deterministic subset of the current error.

**Before (Lineage SPEC v1.0.x):**

```typescript
type SnapshotHashInput = {
  readonly data: Record<string, unknown>;
  readonly system: {
    readonly terminalStatus: TerminalStatus;
    readonly errors: readonly ErrorSignature[];  // ← accumulated history, REMOVED
    readonly pendingDigest: string;
  };
};
```

**After (ADR-015):**

```typescript
/**
 * Deterministic subset of the current error for hash identity.
 *
 * Excludes:
 *   - `message`: human-readable, locale-dependent, non-deterministic
 *   - `timestamp`: environment-dependent
 *   - `context`: Record<string, unknown> with no schema — impossible to
 *     guarantee determinism. May contain runtime-variable values (timestamps,
 *     memory addresses, locale strings) or non-serializable values (BigInt,
 *     functions). No normalization strategy can reliably distinguish
 *     deterministic from non-deterministic entries in an untyped record.
 *
 * `code + source` is sufficient for error identity:
 *   - `code` identifies WHAT failed (e.g., VALIDATION_ERROR vs PERMISSION_DENIED)
 *   - `source` identifies WHERE it failed (actionId + nodePath)
 *   - Together they uniquely identify the failure mode within a schema.
 */
type CurrentErrorSignature = {
  readonly code: string;
  readonly source: {
    readonly actionId: string;
    readonly nodePath: string;
  };
} | null;

type SnapshotHashInput = {
  readonly data: Record<string, unknown>;
  readonly system: {
    readonly terminalStatus: TerminalStatus;
    readonly currentError: CurrentErrorSignature;  // current state, NOT history
    readonly pendingDigest: string;
  };
};
```

```typescript
function toCurrentErrorSignature(
  lastError: ErrorValue | null
): CurrentErrorSignature {
  if (lastError == null) return null;
  return {
    code: lastError.code,
    source: lastError.source,
  };
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| LIN-HASH-3c | MUST | `CurrentErrorSignature` MUST include only `code` and `source`. `message`, `timestamp`, and `context` MUST be excluded. |
| LIN-HASH-3d | MUST NOT | `ErrorValue.context` MUST NOT be included in hash computation. Context is an untyped record with no determinism guarantee. |

**Why context is excluded (not normalized):** The prior `ErrorSignature` attempted to normalize context via a deterministic filter. But `context` is `Record<string, unknown>` — an untyped bag. Any normalization strategy (JSON roundtrip, key whitelist, deep filtering) is inherently incomplete: it cannot distinguish a deterministic `{ retryCount: 3 }` from a non-deterministic `{ serverTimestamp: 1711684800 }` without schema-level metadata that does not exist. Excluding context entirely eliminates this class of non-determinism. `code + source` provides sufficient identity granularity — two errors with the same code at the same source location are the same failure mode, regardless of runtime context.

**Why this matters:** Two failed snapshots with the same `data` but different `lastError.code` (e.g., `VALIDATION_ERROR` vs `PERMISSION_DENIED`) represent different current states and MUST produce different `snapshotHash` / `worldId` values. Without `currentError` in the hash, these would collide — triggering Lineage's self-loop or collision rejection (LIN-DAG-1, LIN-COLLISION-1) on what are genuinely distinct worlds.

**What changed from v1.0.x:** The hash no longer includes the **history** of all errors encountered during execution. Two executions reaching the same final `data` and same final `lastError` produce the same `snapshotHash`, regardless of how many intermediate errors occurred. The path is not part of identity — only the destination is.

### 2.3 Error Recording Changes in Core

When a `fail` node is executed, Core emits:

**Before:**

```typescript
{
  lastError: errorValue,
  appendErrors: [errorValue],  // ← REMOVED
  status: 'error'
} satisfies SystemDelta;
```

**After:**

```typescript
{
  lastError: errorValue,
  status: 'error'
} satisfies SystemDelta;
```

### 2.4 Error Chronology After `system.errors` Removal

With `system.errors` removed, each category of failure has a specific observation path. Manifesto has three distinct failure modes:

| Failure category | What it is | Observation path |
|-----------------|-----------|------------------|
| **Guard rejection** | Action unavailable or invalid input | `dispatch:rejected` telemetry event |
| **Infrastructure failure** | Effect handler crash, Host-level error | `dispatch:failed` telemetry event |
| **Domain semantic failure** | `fail` node in Flow (e.g., validation error) | Protocol-level: deferred to ADR-016; interim: application-level logging (§2.4.1) |

Guard rejections and infrastructure failures are straightforward — they map directly to existing SDK telemetry events:

```typescript
manifesto.on('dispatch:rejected', ({ intentId, reason }) => {
  errorLog.append({ intentId, category: 'guard', reason, timestamp: Date.now() });
});

manifesto.on('dispatch:failed', ({ intentId, error }) => {
  errorLog.append({ intentId, category: 'infra', error, timestamp: Date.now() });
});
```

#### 2.4.1 Domain Semantic Failure: Known Gap and Resolution Path

Domain semantic failures (Flow `fail` nodes) present a unique challenge. `lastError` is **current state**, not an event — it persists until explicitly cleared. Observing `lastError != null` on `dispatch:completed` produces stale re-observations, not chronology.

More critically, under the current content-addressable WorldId scheme (`worldId = hash(schemaHash, snapshotHash)`), **repeated identical failures produce the same WorldId**, triggering collision rejection (LIN-COLLISION-1). This means repeated identical `fail` outcomes cannot create distinct World records. Additionally, failed worlds do not advance the branch head, so repeated failures from the same completed head share the same base — even with `parentWorldId` in the hash, the inputs would be identical.

**This ADR acknowledges a capability downgrade.** The removed `system.errors` provided (inefficient, unbounded) per-attempt accumulation of all failures. With its removal, **protocol-level durable chronology for repeated identical domain semantic failures is not guaranteed by ADR-015 alone.** This is an honest trade-off: Snapshot ontological purity is more important than preserving a convenience feature that caused unbounded growth.

**ADR-016 (Merkle Tree Lineage) is scoped to resolve this gap.** The specific mechanism — whether through separated StateRoot vs CommitId, a dedicated attempt ledger, or another approach — is ADR-016's design decision, not ADR-015's. ADR-015 establishes the requirement; ADR-016 provides the mechanism.

**Interim pattern (deployments without ADR-016, or governance-free deployments without Lineage):** Consumers that need per-attempt domain semantic failure logging SHOULD use application-level logging at the dispatch site:

```typescript
// Application-level: log every dispatch outcome at the call site
// Note: This uses the HostExecutor result contract, not Host public API directly.
const result: HostExecutionResult = await hostExecutor.execute(
  executionKey, baseSnapshot, intent
);
if (result.terminalSnapshot.system.lastError != null) {
  appLog.append({
    intentId: intent.intentId,
    category: 'domain',
    error: result.terminalSnapshot.system.lastError,
    timestamp: Date.now(),
  });
}
```

This is per-attempt by construction (one log entry per execution call) and does not suffer from the `lastError` stickiness problem because it runs at the execution site, not via state observation. However, it is application-level — not protocol-level durable history.

### 2.5 Ontological Classification of Snapshot Fields (Normative)

This ADR establishes a normative ontological classification for all Snapshot fields. This classification governs what belongs in Snapshot and what does not.

| Field | Classification | Definition | In Snapshot | In Hash |
|-------|---------------|------------|-------------|---------|
| `data` | **Essence** | The domain state itself | ✅ MUST | ✅ (excl. `$*`) |
| `computed` | **Projection** | Deterministically derivable from `data + schema` | ✅ MUST | ❌ |
| `system.lastError` | **Essence** | Current error state of this snapshot | ✅ MUST | ✅ (as `currentError` signature) |
| `system.status` | **Process** | Compute loop phase indicator | ✅ (see §2.6) | ❌ |
| `system.pendingRequirements` | **Process** | Compute loop intermediate state | ✅ (see §2.6) | ⚠️ `pendingDigest` |
| `system.currentAction` | **Process** | Compute loop intermediate state | ✅ (see §2.6) | ❌ |
| `input` | **Transient** | Intent's input, scoped to compute cycle | ✅ (see §2.6) | ❌ |
| `meta.version` | **Envelope** | Monotonic counter for change detection | ✅ (see §2.6) | ❌ |
| `meta.timestamp` | **Envelope** | Host-provided logical time | ✅ (see §2.6) | ❌ |
| `meta.randomSeed` | **Envelope** | Host-provided deterministic seed | ✅ (see §2.6) | ❌ |
| `meta.schemaHash` | **Binding** | Schema identity this snapshot conforms to | ✅ MUST | ❌ (in WorldId) |

**Classification definitions:**

- **Essence**: Core to the snapshot's identity. Removing it changes what the snapshot IS.
- **Projection**: Derivable from Essence + Schema. Present for consumer convenience and self-containedness.
- **Process**: Meaningful only during Host's compute loop. Always has fixed values in terminal snapshots.
- **Transient**: Scoped to a single compute cycle. Not part of the snapshot's identity.
- **Envelope**: Metadata about how/when the snapshot was produced. Not part of semantic identity.
- **Binding**: Links the snapshot to an external identity (schema). Part of WorldId computation but not snapshotHash.

### 2.6 Process/Transient/Envelope Fields — Why They Stay (For Now)

The **"If it's not in Snapshot, it doesn't exist"** principle (FDR-002) requires that compute loop state live inside Snapshot, because Snapshot is the sole communication medium between Core and Host. Relocating process fields requires changing the Core equation itself — a different scope than this ADR.

This ADR records these fields as **Process/Transient/Envelope** (not Essence) to establish the architectural direction without forcing the immediate API disruption. Future work MAY relocate them:

| Field | Potential relocation | Prerequisite |
|-------|---------------------|--------------|
| `status`, `pendingRequirements`, `currentAction` | `ComputeResult` (Host-internal) | Core equation redesign |
| `input` | `compute()` parameter (already is) | Remove from Snapshot type |
| `meta.version` | Lineage depth or Host-local counter | Consumer migration |
| `meta.timestamp`, `meta.randomSeed` | `HostContext` (already is) | Remove from Snapshot type |

**This ADR does NOT mandate these relocations.** It establishes the ontological classification as the normative basis for future decisions.

---

## 3. Impact Analysis

### 3.1 Changed Specifications

| Document | Change | Severity |
|----------|--------|----------|
| Core SPEC §11.3 | Remove `appendErrors` from SystemDelta and error recording | Breaking |
| Core SPEC §13.2 | Remove `errors` from SystemState type | Breaking |
| Lineage SPEC §6.3 | Replace `ErrorSignature[]` with `CurrentErrorSignature` in SnapshotHashInput | Breaking |
| Lineage SPEC §6.3.3 | Replace LIN-HASH-3 (error history → current error identity) | Breaking |
| Lineage SPEC §6.4 | Remove bulk error normalization; replace with `toCurrentErrorSignature()` | Breaking |
| Host SPEC | Update canonical Snapshot definition, field ownership table, INV-SNAP-4 to remove `errors` | Minor (type-only) |
| World SPEC | See note below | Minor (doc-only) |
| Governance SPEC | No changes — Governance uses `deriveOutcome()` via `lastError` | None |

**World SPEC document governance note:** Per ADR-014, the World SPEC is now a **non-authoritative facade** — normative content lives in Lineage SPEC and Governance SPEC respectively. Rules affected by this ADR (SNAP-TYPE-5, error hash inclusion) are already re-homed in Lineage SPEC. The World SPEC's residual references to `system.errors` and `ErrorSignature[]` SHOULD be updated for consistency, but the authoritative changes are in Lineage SPEC alone.
| Compiler SPEC | No changes — Compiler does not reference `system.errors` | None |
| SDK SPEC | No changes — `subscribe()` delivers whatever Snapshot contains | None |

### 3.2 Removed Rules

| Rule ID | Document | Disposition |
|---------|----------|-------------|
| SNAP-TYPE-5 | World SPEC / Lineage | **Removed** — no longer applicable |
| LIN-SNAP-4 | Lineage SPEC | **Removed** — `system.errors` no longer exists |
| LIN-HASH-3 | Lineage SPEC | **Replaced** — error history inclusion → current error identity (see §3.4) |
| LIN-OUTCOME-5 | Lineage SPEC | **Removed** — `system.errors` no longer exists to misuse |

### 3.3 New Rules

| Rule ID | Document | Description |
|---------|----------|-------------|
| LIN-HASH-3a | Lineage SPEC | snapshotHash MUST include `currentError` (normalized from `lastError`) |
| LIN-HASH-3b | Lineage SPEC | `currentError` MUST include only `code` and `source` |
| LIN-HASH-3c | Lineage SPEC | `message`, `timestamp`, and `context` MUST be excluded from `currentError` |
| LIN-HASH-3d | Lineage SPEC | `ErrorValue.context` MUST NOT be included in hash — untyped record with no determinism guarantee |

### 3.4 Changed Types

| Type | Package | Disposition |
|------|---------|-------------|
| `ErrorSignature` | Lineage | **Replaced** by `CurrentErrorSignature` (single value, not array) |
| `toErrorSignature()` | Lineage | **Replaced** by `toCurrentErrorSignature()` |
| `normalizeErrors()` | Lineage | **Removed** — no array to normalize/sort |

### 3.5 Lineage Hash Compatibility

This is a **breaking change to snapshotHash computation**. Existing World records sealed under the previous hash scheme are NOT compatible with the new scheme. Deployments MUST treat this as a new epoch (Lineage SPEC §15).

| Scenario | Handling |
|----------|----------|
| New deployment | No migration needed |
| Existing lineage chain | Epoch boundary — new genesis from active branch head snapshot (see §8.2) |
| Mixed-version systems | MUST NOT seal with different hash schemes on same branch |

### 3.6 Consumer Migration

Code that reads `snapshot.system.errors` needs to change:

| Pattern | Before | After |
|---------|--------|-------|
| Check current error | `snapshot.system.lastError` | `snapshot.system.lastError` (unchanged) |
| Display error count | `snapshot.system.errors.length` | Host-level counter via telemetry |
| Show error history | `snapshot.system.errors` | Telemetry event log or trace artifacts |
| Log guard rejections | Subscribe + read `system.errors` | `on('dispatch:rejected', ...)` |
| Log infra failures | Subscribe + read `system.errors` | `on('dispatch:failed', ...)` |
| Log domain failures | Subscribe + read `system.errors` | Application-level logging at execution site (§2.4.1); protocol-level solution deferred to ADR-016 |

**Note on failure categories:** The previous `system.errors` array conflated three distinct failure types into one list. The replacement approach uses the appropriate channel for each: telemetry events for guard/infra failures, application-level logging for domain semantic failures (interim), with protocol-level per-attempt chronology deferred to ADR-016. See §2.4 for the complete taxonomy.

---

## 4. Design Rationale

### 4.1 Why Not a Ring Buffer or Coalescing?

Both alternatives preserve the ontological contradiction — accumulated history inside a point-in-time state:

| Alternative | Problem |
|-------------|---------|
| Ring buffer (cap at N errors) | Arbitrary N. Which errors to discard? "History" with holes is worse than no history. |
| Coalesce identical errors | Changes ErrorValue type (add `count`). "Same error" definition is ambiguous. Still grows with unique errors. |
| TTL-based eviction | Introduces time-dependency into Snapshot — violates determinism. |

All three treat the symptom (unbounded growth) while preserving the disease (history in Snapshot). Removing `system.errors` treats the disease.

### 4.2 Why `lastError` Stays

`lastError` is **current state**, not history. It answers "is this snapshot in an error state right now?" — a point-in-time question. It is null when there is no active error, non-null when there is. It does not accumulate.

`lastError` participates in terminal status derivation (LIN-OUTCOME-2) and is the mechanism by which Flow logic reacts to errors (Core SPEC §11.4). Removing it would break the error-handling model entirely.

### 4.3 Why Error History in Hash Was Wrong (But Current Error Is Right)

Lineage SPEC v1.0.1 LIN-HASH-3 rationale states:

> "Two executions reaching the same final data but encountering different errors represent different lineages."

This confuses **identity** with **provenance**. The World's identity should be what it IS (data + current error state), not the path it took to get there. Intermediate errors encountered during execution are provenance — they describe the journey, not the destination.

However, the **current error** is part of identity. A snapshot with `lastError: VALIDATION_ERROR` and one with `lastError: PERMISSION_DENIED` are genuinely different current states, even if their `data` is identical. Collapsing both to `terminalStatus: 'failed'` would lose this distinction and cause WorldId collisions on what are meaningfully different worlds.

The correction is precise: **remove accumulated history from hash, keep current error identity in hash.** `ErrorSignature[]` (unbounded, path-dependent) becomes `CurrentErrorSignature` (single value, destination-only).

### 4.4 Crash Recovery Without `system.errors`

Manifesto's recovery model does not depend on `system.errors`:

1. **No suspended execution context** — Core SPEC, FDR-003
2. **Recovery = last terminal snapshot + re-dispatch intent** — Host SPEC §16.5
3. **onceIntent guards prevent duplicate execution** — Compiler SPEC §9.3
4. **Effect idempotency is Host's responsibility** — Host SPEC §16.3

None of these mechanisms reference `system.errors`. Crash recovery capability is unchanged by this ADR.

---

## 5. Implementation Plan

### Phase 1: Core Changes (Breaking)

1. Remove `errors` from `SystemState` type
2. Remove `appendErrors` from `SystemDelta` type
3. Remove append logic from `applySystemDelta()`
4. Update Core SPEC §11.3 (error recording) and §13.2 (Snapshot structure)
5. Update `normalizeSnapshot()` to not inject empty `errors` array

### Phase 2: Lineage Changes (Breaking)

1. Replace `ErrorSignature[]` with `CurrentErrorSignature` in `SnapshotHashInput`
2. Replace `ErrorSignature` type with `CurrentErrorSignature` type (`code` + `source` only, no `context`)
3. Replace `toErrorSignature()` with `toCurrentErrorSignature()` (single value, no array, no context)
4. Remove `normalizeErrors()` (no array to sort, context excluded from signature)
5. Replace LIN-HASH-3 with LIN-HASH-3a/3b/3c/3d (current error identity, context excluded)
6. Simplify `computeSnapshotHash()` — trivial error projection, no sort or normalization pass
7. Update Lineage SPEC §6.3, §6.4

### Phase 3: Documentation Alignment

1. Update Core SPEC — remove `system.errors` references, add §13.X Ontological Classification
2. Update Lineage SPEC — replace error history hash rules with current error identity rules
3. Update Host SPEC — remove `errors` from canonical Snapshot definition and field ownership table
4. Update `failure-model.md` — remove error history patterns, add telemetry-based error logging pattern
5. Update `CLAUDE.md` and `AGENTS.md` — remove `errors` from Snapshot structure
6. Update `determinism.md` — remove `errors` from Snapshot structure example

### Phase 4: Consumer Migration Guide

1. Document Host-level per-attempt logging pattern for domain semantic failures (§2.4.1)
2. Document `dispatch:rejected` + `dispatch:failed` for guard/infra failure chronology
3. Provide Host-level error counter pattern for consumers that need error counts
4. Update TaskFlow / Coin Sapiens if they read `system.errors`

---

## 6. Invariants

| ID | Level | Description |
|----|-------|-------------|
| INV-015-1 | MUST | Snapshot MUST NOT contain accumulated history. Each field MUST represent point-in-time state or a deterministic projection thereof. |
| INV-015-2 | MUST NOT | Snapshot MUST NOT accumulate error history. Protocol-level per-attempt chronology for repeated identical domain semantic failures is deferred to ADR-016 (Merkle Tree Lineage). Application-level logging at the execution site (§2.4.1) serves as an interim pattern. |
| INV-015-3 | MUST | `snapshotHash` MUST include all Essence-class fields: `data` (excl. `$*`), `terminalStatus`, `currentError` (`code` + `source` only, normalized from `lastError`), and `pendingDigest`. |
| INV-015-4 | MUST | The ontological classification (Essence / Projection / Process / Transient / Envelope / Binding) is normative. New Snapshot fields MUST declare their classification. |
| INV-015-5 | MUST NOT | Future Snapshot changes MUST NOT introduce Accumulation-class fields. History belongs outside Snapshot. |

**Note on `pendingDigest` in INV-015-3:** `pendingRequirements` is classified as Process (§2.5), but its digest is included in hash as a **collision prevention safety net** for WORLD-TERM violation cases (Lineage SPEC rationale). This is a pragmatic exception — `pendingDigest` is `'empty'` for all well-formed terminal snapshots and only becomes non-trivial in violation cases. The Process classification of the source field is accurate; the hash inclusion of its digest is a safety measure, not an ontological claim.

---

## 7. Test Plan

### 7.1 Core Tests

```typescript
describe('ADR-015: system.errors removal', () => {
  it('SystemState no longer has errors field', () => {
    const snapshot = core.createSnapshot(schema);
    expect(snapshot.system).not.toHaveProperty('errors');
    expect(snapshot.system).toHaveProperty('lastError', null);
  });

  it('fail node sets lastError without accumulating', () => {
    const result = core.compute(schema, snapshot, failingIntent, context);
    const updated = core.applySystemDelta(snapshot, result.systemDelta);
    expect(updated.system.lastError).not.toBeNull();
    expect(updated.system).not.toHaveProperty('errors');
  });

  it('repeated failures do not cause unbounded growth', () => {
    let current = snapshot;
    for (let i = 0; i < 1000; i++) {
      const result = core.compute(schema, current, failingIntent, context);
      current = core.applySystemDelta(current, result.systemDelta);
    }
    // Snapshot size is bounded — no errors array to grow
    const serialized = JSON.stringify(current);
    expect(serialized.length).toBeLessThan(MAX_REASONABLE_SNAPSHOT_SIZE);
  });

  it('SystemDelta no longer has appendErrors', () => {
    const result = core.compute(schema, snapshot, failingIntent, context);
    expect(result.systemDelta).not.toHaveProperty('appendErrors');
    expect(result.systemDelta.lastError).not.toBeNull();
  });
});
```

### 7.2 Lineage Tests

```typescript
describe('ADR-015: current error identity in snapshotHash', () => {
  it('same data + same lastError = same hash regardless of error path', () => {
    // Execution A: 0 intermediate errors → terminal with VALIDATION_ERROR
    // Execution B: 50 intermediate errors → same terminal with VALIDATION_ERROR
    // Both should produce identical snapshotHash
    const hashA = computeSnapshotHash(terminalSnapshotA, schemaForHash);
    const hashB = computeSnapshotHash(terminalSnapshotB, schemaForHash);
    expect(hashA).toBe(hashB);
  });

  it('same data + different lastError = different hash', () => {
    const snapshotA = { ...base, system: { ...base.system, lastError: validationError } };
    const snapshotB = { ...base, system: { ...base.system, lastError: permissionError } };
    const hashA = computeSnapshotHash(snapshotA, schemaForHash);
    const hashB = computeSnapshotHash(snapshotB, schemaForHash);
    expect(hashA).not.toBe(hashB);
  });

  it('SnapshotHashInput includes currentError, not errors array', () => {
    const input = buildSnapshotHashInput(snapshot);
    expect(input.system).not.toHaveProperty('errors');
    expect(input.system).toHaveProperty('currentError');
    expect(input.system).toHaveProperty('terminalStatus');
    expect(input.system).toHaveProperty('pendingDigest');
  });

  it('currentError excludes message, timestamp, AND context', () => {
    const error: ErrorValue = {
      code: 'TEST',
      message: 'test message',
      source: { actionId: 'a', nodePath: 'root.validate' },
      timestamp: 123,
      context: { retryCount: 3, serverTimestamp: 1711684800 },
    };
    const sig = toCurrentErrorSignature(error);
    expect(sig).toEqual({
      code: 'TEST',
      source: { actionId: 'a', nodePath: 'root.validate' },
    });
    expect(sig).not.toHaveProperty('message');
    expect(sig).not.toHaveProperty('timestamp');
    expect(sig).not.toHaveProperty('context');
  });

  it('null lastError produces null currentError', () => {
    const sig = toCurrentErrorSignature(null);
    expect(sig).toBeNull();
  });

  it('same code+source with different message/context produces same signature', () => {
    const errorA: ErrorValue = {
      code: 'X', message: 'English', source: { actionId: 'a', nodePath: '' },
      timestamp: 1, context: { env: 'prod' },
    };
    const errorB: ErrorValue = {
      code: 'X', message: '한국어', source: { actionId: 'a', nodePath: '' },
      timestamp: 2, context: { env: 'staging', extra: true },
    };
    expect(toCurrentErrorSignature(errorA)).toEqual(toCurrentErrorSignature(errorB));
  });

  it('different code produces different signature', () => {
    const errorA: ErrorValue = {
      code: 'VALIDATION', message: '', source: { actionId: 'a', nodePath: '' }, timestamp: 0,
    };
    const errorB: ErrorValue = {
      code: 'PERMISSION', message: '', source: { actionId: 'a', nodePath: '' }, timestamp: 0,
    };
    expect(toCurrentErrorSignature(errorA)).not.toEqual(toCurrentErrorSignature(errorB));
  });
});
```

### 7.3 Error Chronology Tests

```typescript
describe('ADR-015: error chronology without system.errors', () => {
  it('guard rejection is observable via dispatch:rejected', () => {
    const events: any[] = [];
    manifesto.on('dispatch:rejected', ({ intentId, reason }) => {
      events.push({ intentId, reason });
    });

    manifesto.dispatch(createIntent('publish', 'i1'));  // canPublish = false
    expect(events).toHaveLength(1);
  });

  it('infrastructure failure is observable via dispatch:failed', () => {
    const events: any[] = [];
    manifesto.on('dispatch:failed', ({ intentId, error }) => {
      events.push({ intentId, error });
    });

    manifesto.dispatch(createIntent('syncExternal', {}, 'i2'));  // handler throws
    expect(events).toHaveLength(1);
  });

  it('Application-level logging captures domain semantic failure per-attempt', () => {
    // Interim pattern (§2.4.1): log at execution site, not via state observation
    // Uses HostExecutor result contract, not Host public API
    const domainErrors: any[] = [];

    const result1 = hostExecutor.execute(executionKey, baseSnapshot, failingIntent);
    if (result1.terminalSnapshot.system.lastError != null) {
      domainErrors.push({ error: result1.terminalSnapshot.system.lastError });
    }

    // Second identical failure — still logged because it's per-execute call
    const result2 = hostExecutor.execute(executionKey, baseSnapshot, failingIntent);
    if (result2.terminalSnapshot.system.lastError != null) {
      domainErrors.push({ error: result2.terminalSnapshot.system.lastError });
    }

    expect(domainErrors).toHaveLength(2);  // both attempts captured
  });
});
```

---

## 8. Migration

### 8.1 Breaking Change Summary

| Change | Who is affected | Action required |
|--------|----------------|-----------------|
| `system.errors` removed | Code reading `snapshot.system.errors` | Use telemetry events or Host-level counters |
| `appendErrors` removed | Custom SystemDelta constructors | Remove `appendErrors` field |
| snapshotHash changed | Existing lineage chains | New epoch (genesis from branch head, see §8.2) |

### 8.2 Epoch Boundary

ADR-015 and ADR-016 (Merkle Tree Lineage) share a **single epoch boundary**. Both change the `snapshotHash` / `worldId` computation, so co-deploying them avoids two separate migration events.

Per Lineage SPEC §15, a hash-algorithm change creates an epoch boundary. Deployments with existing lineage chains:

1. Read the **active branch head** snapshot — this is always a `completed` world (Lineage head invariant: head points to completed worlds only)
2. Create a new genesis World with that snapshot under the new hash scheme (both ADR-015 and ADR-016 rules applied)
3. Continue appending to the new chain

**Critical:** The genesis snapshot MUST come from the branch head (completed), NOT from an arbitrary "latest terminal snapshot" which could be a failed world. Lineage prohibits failed genesis (PreparedGenesisCommit requires completed status).

Prior lineage history remains accessible in the old chain but is not connected to the new one.

---

## 9. Co-Deployed: ADR-016 Merkle Tree Lineage

ADR-015 and ADR-016 are **independent decisions targeting the same epoch boundary**.

ADR-015 removes accumulated history from Snapshot. This is independently valid — `system.errors` is ontologically wrong regardless of WorldId scheme. ADR-016 redesigns Lineage identity to enable per-attempt World records, resolving the chronology gap that ADR-015 identifies but does not close.

| Concern | ADR-015 | ADR-016 |
|---------|---------|---------|
| Snapshot purity | ✅ Removes accumulated history | — |
| Per-attempt chronology | Identifies gap, provides interim application-level pattern (§2.4.1) | Resolves — mechanism TBD (StateRoot/CommitId separation, attempt ledger, or other) |
| Collision/self-loop rules | — | Likely simplified or eliminated |
| Hash computation | Replaces `ErrorSignature[]` with `CurrentErrorSignature` | Redesigns WorldId computation |

**ADR-015 does NOT prescribe ADR-016's mechanism.** Whether ADR-016 separates StateRoot from CommitId, introduces a dedicated attempt ledger, or uses another approach is ADR-016's design decision. ADR-015 only establishes that (a) Snapshot must not accumulate history, and (b) per-attempt chronology for repeated identical domain failures requires a Lineage-level solution.

**Neither ADR depends on the other architecturally**, but co-deployment in a single epoch avoids two separate migration boundaries.

---

## 10. Related Future Work (Non-Normative)

This ADR establishes the ontological classification as a foundation. The following items are recorded as architectural direction, NOT as commitments:

| Item | Classification basis | Status |
|------|---------------------|--------|
| Relocate `status`, `pendingRequirements`, `currentAction` to `ComputeResult` | Process → Host-internal | Future ADR (requires Core equation change) |
| Relocate `input` out of Snapshot | Transient → `compute()` parameter only | Future ADR |
| Deprecate `meta.version` in favor of Lineage depth | Envelope → Lineage metadata | Future ADR (consumer migration needed) |
| Relocate `meta.timestamp`, `meta.randomSeed` | Envelope → `HostContext` only | Future ADR |

**Guiding principle for future decisions:** If the Lineage hash excludes it, question whether it belongs in Snapshot's type. The hash inclusion/exclusion table is an implicit ontological filter — this ADR makes it explicit.

---

*End of ADR-015*
