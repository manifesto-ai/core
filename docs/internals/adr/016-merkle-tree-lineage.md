# ADR-016: Merkle Tree Lineage — Positional World Identity via Parent-Linked Hashing

> **Status:** Implemented
> **Date:** 2026-03-29
> **Deciders:** 정성우, Manifesto Architecture Team
> **Scope:** Lineage, Governance (overlay only)
> **Mitigates:** ADR-015 §2.4.1 (per-attempt domain failure chronology gap — see §1.7 for scope of mitigation)
> **Supersedes:** LIN-ID-1 (WorldId computation), LIN-COLLISION-1~4 (collision policy), LIN-HEAD-7 (WorldHead.createdAt source)
> **Related:** ADR-014 (World → Lineage + Governance split), ADR-015 (Snapshot Ontological Purification — co-deployed, same epoch)
> **Breaking:** Yes — Lineage SPEC (WorldId computation, collision rules, branch model, World/WorldEdge types, PreparedLineageCommit, head query timestamp semantics, restore normalization)

---

## Revision History

| Version | Date | Change |
|---------|------|--------|
| v1 | 2026-03-29 | Initial draft |
| v2 | 2026-03-29 | Cross-branch same-parent same-snapshot duplicate addressed via idempotent reuse semantics |
| v3 | 2026-03-29 | Commit/Attempt substrate separation (`SealAttempt`); `baseWorldId` first-class; delta key contract |
| v4 | 2026-03-29 | Restore substrate aliasing (first-write-wins); head query timestamp (`headAdvancedAt`) |
| v5 | 2026-03-29 | **Blocker (v4):** First-write-wins safety proof replaced with **restore normalization** — `restore()` explicitly resets non-hash fields (`$host`, `$mel`, `input`, `meta.timestamp`, `meta.randomSeed`). Safety derived from normalization contract, not from field-by-field preservation claim. Non-hash field enumeration corrected to match current spec |
| v5.1 | 2026-03-29 | **Blocker (v5):** `system.currentAction` reclassified from preserved to reset. Not in `SnapshotHashInput`; execution-scoped control residue that causes re-entry false positives if preserved across resume |

---

## 1. Context

### 1.1 The Identity Model Problem

Current WorldId is content-addressable:

```
worldId = computeHash({ schemaHash, snapshotHash })
```

This means: **same content = same World.** Two execution attempts that produce identical terminal snapshots yield the same WorldId, regardless of when, why, or from where they executed. This produces three structural problems.

### 1.2 Problem 1: Repeated Identical Failures Cannot Be Distinguished

When a long-running host (e.g., Coin Sapiens) repeatedly produces the same failed terminal snapshot from the same completed head, every attempt computes the same WorldId. The first attempt seals successfully; subsequent attempts are rejected by LIN-COLLISION-1.

ADR-015 removes `system.errors` (accumulated history) from Snapshot and identifies this as a known gap: **protocol-level per-attempt chronology for repeated identical domain semantic failures has no durable substrate.** ADR-016 provides the mechanism.

### 1.3 Problem 2: Self-Loop Requires Explicit Rejection Rules

When an execution produces no semantic change (terminal snapshot has the same hash-relevant content as the base), the computed WorldId equals `baseWorldId`. This creates a self-loop (`from == to` in the DAG), which LIN-COLLISION-2 must explicitly reject. This is a structural defect in the identity model — the model produces invalid states that the rules must catch.

### 1.4 Problem 3: Diamond Convergence Requires Explicit Rejection Rules

When two different parents produce terminal snapshots with identical hash-relevant content, the second seal produces a WorldId that already exists with a different parent. LIN-COLLISION-1 rejects this. Again, the identity model produces invalid states that the rules must catch.

### 1.5 The Root Cause

All three problems share a root cause: **WorldId conflates content identity with lineage identity.**

- Content identity ("what is this state?") = `snapshotHash`
- Lineage identity ("where does this World sit in history?") = currently also derived from `snapshotHash`

In Git terms, the current model is as if `commitHash = treeHash` — which would make rebasing impossible and make identical trees on different branches the "same commit." Git avoids this by including `parent` in the commit hash. Manifesto should do the same.

### 1.6 Philosophical Alignment

Manifesto's core philosophy states that identity is **continuity of memory + context + choices** — not content alone. The Phineas Gage principle: a being can change its model and remain "the same changed being" as long as memory persists. Conversely, two beings with identical current state but different histories are different beings.

Content-addressable identity contradicts this. If WorldId is purely content-derived, then history is not part of identity — two Worlds with identical `data` and `lastError` are the "same World" regardless of their lineage path. Positional identity corrects this by making **position in the lineage DAG** part of World identity.

### 1.7 Scope of Mitigation (ADR-015 §2.4.1)

ADR-015 §2.4.1 identified the gap: "protocol-level per-attempt chronology for repeated identical domain semantic failures has no durable substrate."

ADR-016 provides **per-position commit identity**, not per-attempt identity. On a single branch, this is equivalent: each seal attempt advances `tip`, producing a new position and thus a new WorldId. Across branches that share the same tip, two attempts producing the same content from the same position yield the same WorldId — they are the same commit (§2.3.3).

This means ADR-016 **mitigates** the gap for the primary use case (single-branch repeated failures, e.g., Coin Sapiens tick loop) but does not **resolve** it globally. Full per-attempt chronology is provided by the `SealAttempt` record (§2.4), which captures every seal operation regardless of commit-level identity.

---

## 2. Decision

### 2.1 WorldId Computation: Include parentWorldId

WorldId computation changes from content-addressable to positional:

**Before (Lineage SPEC v1.x):**

```typescript
worldId = computeHash({ schemaHash, snapshotHash })
```

**After (ADR-016):**

```typescript
worldId = computeHash({ schemaHash, snapshotHash, parentWorldId })
```

Where `parentWorldId` is:
- For genesis: `null`
- For next: the **branch tip** at seal time (see §2.2)

```typescript
// Genesis
worldId = computeHash({ schemaHash, snapshotHash, parentWorldId: null })

// Next
worldId = computeHash({ schemaHash, snapshotHash, parentWorldId: branch.tip })
```

**Consequence:** Every execution attempt from a different position in the DAG produces a unique WorldId, even if the terminal snapshot content is identical. Two attempts from the **same** position with the **same** content produce the same WorldId — this is correct and intentional (see §2.3.3).

### 2.2 Branch Model: Separate Head from Tip

The branch model gains two new fields:

**Before:**

```typescript
type BranchInfo = {
  readonly id: BranchId;
  readonly name: string;
  readonly head: WorldId;        // latest completed World
  readonly epoch: number;
  readonly schemaHash: string;
  readonly createdAt: number;
};
```

**After:**

```typescript
type BranchInfo = {
  readonly id: BranchId;
  readonly name: string;
  readonly head: WorldId;           // latest completed World (unchanged)
  readonly tip: WorldId;            // latest sealed World (any status) — NEW
  readonly headAdvancedAt: number;  // timestamp of last head advance — NEW (§2.12)
  readonly epoch: number;
  readonly schemaHash: string;
  readonly createdAt: number;
};
```

**Tip semantics:**

| Pointer | Advances on | Used for | Invariant |
|---------|-------------|----------|-----------|
| `head` | Completed seal only | Base snapshot for next execution | Always points to a `completed` World |
| `tip` | Every seal | `parentWorldId` in next WorldId computation | Always points to the most recently sealed World |

**Advance rules:**

| Seal outcome | head | tip | headAdvancedAt | epoch |
|-------------|------|-----|----------------|-------|
| Completed | → new WorldId | → new WorldId | → seal's `createdAt` | +1 |
| Failed | unchanged | → new WorldId | unchanged | unchanged |

For genesis, `head = tip = genesisWorldId`, `headAdvancedAt = genesis seal's createdAt`.

**Why tip solves repeated identical failures (single branch):**

```
H0 (completed) → head=H0, tip=H0
F1 (failed, parent=tip=H0) → head=H0, tip=F1
F2 (failed, parent=tip=F1) → head=H0, tip=F2
```

F1 and F2 have different `parentWorldId` (H0 vs F1), so they produce different WorldIds — even with identical `snapshotHash`. Each failure attempt creates a distinct, immutable World record.

### 2.3 Collision Taxonomy Under Positional Identity

Positional WorldId (`hash(schemaHash, snapshotHash, parentWorldId)`) structurally eliminates two of the three collision scenarios from v1.x and redefines the third as idempotent reuse.

#### 2.3.1 Structurally Eliminated: Self-Loop

For a self-loop, the new WorldId would need to equal `parentWorldId`. But:

```
parentWorldId = branch.tip (existing World)
newWorldId = hash(schemaHash, snapshotHash, parentWorldId)
```

For `newWorldId == parentWorldId` to hold, `hash(schemaHash, snapshotHash, parentWorldId) == parentWorldId` — a hash fixed point. This is computationally infeasible with SHA-256.

**Eliminated:** LIN-COLLISION-2 (self-loop detection).

#### 2.3.2 Structurally Eliminated: Different-Parent Diamond Convergence

Two parents producing identical content:

```
Parent A → hash(schema, snapshot, A) = X
Parent B → hash(schema, snapshot, B) = Y
X ≠ Y (different parentWorldId → different hash)
```

No collision. Each converging path produces a distinct World.

**Eliminated:** LIN-COLLISION-1 as applied to diamond convergence (different parent, same content).

#### 2.3.3 Residual Case: Same-Parent Same-Snapshot — Idempotent Reuse

Two branches can share the same tip. This is an established property of the current Lineage model — branches can be created pointing to the same World.

When two branches share the same tip and both seal the same terminal snapshot:

```
main.tip    = H0
experiment.tip = H0

main       seals snapshot S → hash(schema, snapshotHash(S), H0) = W
experiment seals snapshot S → hash(schema, snapshotHash(S), H0) = W  (same!)
```

This is **not** a diamond convergence (same parent, not different parents). It is a natural consequence of positional identity: **same position + same content = same identity.** This mirrors Git's object model where identical (tree, parent, metadata) produces the same commit hash, and if that object already exists, the ref simply moves to it.

**Idempotent reuse semantics:**

When `commitPrepared()` encounters a WorldId that already exists in the store with the same `parentWorldId`:
1. The existing World record is NOT duplicated
2. The existing WorldEdge is NOT duplicated
3. The stored snapshot is NOT overwritten (first-write-wins). This is safe because `restore()` normalizes non-hash fields (§2.11)
4. A new `SealAttempt` IS created (§2.4) — the attempt happened and its provenance/trace must be recorded
5. The branch's `tip` (and `head`/`headAdvancedAt`, if completed) is advanced to the existing WorldId via CAS
6. The seal **succeeds** — it is NOT rejected

| Rule ID | Level | Description |
|---------|-------|-------------|
| MRKL-REUSE-1 | MUST | When `commitPrepared()` encounters an existing World with matching `worldId` and `parentWorldId`, the commit MUST succeed by advancing the branch ref without creating a duplicate World, WorldEdge, or stored snapshot |
| MRKL-REUSE-2 | MUST | Idempotent reuse MUST still create a `SealAttempt` record (§2.4). Provenance, trace, and delta are per-attempt, not per-commit |
| MRKL-REUSE-3 | MUST | Idempotent reuse MUST still CAS-verify `(expectedHead, expectedTip, expectedEpoch)` — branch ref advance is not exempt from concurrency control |

#### 2.3.4 Rules Disposition

| Rule ID | Disposition |
|---------|-------------|
| LIN-COLLISION-1 | **Eliminated** — different-parent: structurally impossible; same-parent: idempotent reuse, not collision |
| LIN-COLLISION-2 | **Eliminated** — self-loop computationally infeasible (hash fixed point) |
| LIN-COLLISION-3 | **Eliminated** — genesis same-content is idempotent reuse for World object. Bootstrap uniqueness (LIN-GENESIS-3) preserved separately |
| LIN-COLLISION-4 | **Eliminated** — no collision to report |
| LIN-STORE-9 | **Reframed** — idempotent reuse detection + SealAttempt persistence + restore normalization safety (MRKL-REUSE-1, MRKL-REUSE-2, MRKL-RESTORE-1~5) |

### 2.4 Three-Layer Record Model: World, WorldEdge, SealAttempt

The current Lineage model conflates commit identity with attempt provenance in a single `World` record. Under idempotent reuse (§2.3.3), this conflation becomes untenable — when a second branch seals the same commit, the attempt's `createdAt`, `traceRef`, `proposalRef`, and `patchDelta` have no home in the reused World record.

ADR-016 separates these concerns into three layers:

| Layer | Record | Identity of... | Mutability | Created per... |
|-------|--------|----------------|------------|----------------|
| State | `snapshotHash` (StateRoot) | Content — what the state IS | N/A (derived) | unique content |
| Commit | `World` + `WorldEdge` | Position — where this commit sits in lineage | Immutable after creation | unique (schemaHash, snapshotHash, parentWorldId) |
| Attempt | `SealAttempt` | Chronology — when, by whom, from what base, with what trace | Immutable after creation | **every seal operation** |

#### 2.4.1 Revised World Record

`World` is purified to commit identity. Attempt-specific metadata is removed.

```typescript
type World = {
  readonly worldId: WorldId;

  // Identity fields (included in worldId computation)
  readonly schemaHash: string;
  readonly snapshotHash: string;           // StateRoot
  readonly parentWorldId: WorldId | null;  // lineage predecessor (self-descriptive)

  // Derived (not part of hash, but structurally determined by snapshot)
  readonly terminalStatus: TerminalStatus;
};
```

**Changes from Lineage SPEC v1.x `World`:**
- `parentWorldId` **added** — self-descriptive lineage chain (Git includes parent in commit object)
- `createdAt` **removed** — chronology belongs in `SealAttempt` (per-attempt) and `BranchInfo.headAdvancedAt` (per-branch head query)
- `createdBy` **removed** — moved to `SealAttempt.proposalRef` (per-attempt provenance)
- `executionTraceRef` **removed** — moved to `SealAttempt.traceRef` (per-attempt trace)

**Why `parentWorldId` in the record, not just in edges.** Git stores parent hashes inside the commit object, not only in a separate edge table. This makes each World **self-descriptive** — you can verify a World's identity from its own fields alone, without querying edges.

#### 2.4.2 Revised WorldEdge Record

`WorldEdge` is purified to DAG structure. Attempt-specific metadata is removed.

```typescript
type WorldEdge = {
  readonly edgeId: string;          // hash({ from, to }) — unchanged
  readonly from: WorldId;           // parentWorldId (was: baseWorldId)
  readonly to: WorldId;
};
```

**Changes from Lineage SPEC v1.x `WorldEdge`:**
- `from` semantics **changed** — now `parentWorldId` (tip), not `baseWorldId` (head)
- `proposalRef` **removed** — moved to `SealAttempt`
- `decisionRef` **removed** — moved to `SealAttempt`
- `createdAt` **removed** — moved to `SealAttempt`

#### 2.4.3 SealAttempt Record (NEW)

`SealAttempt` captures the chronological, provenance, and computation context of each seal operation. One `SealAttempt` is created for **every** seal, including idempotent reuse cases.

```typescript
type SealAttempt = {
  // Identity
  readonly attemptId: string;             // unique per attempt (see §2.4.4)

  // Commit reference
  readonly worldId: WorldId;              // the commit this attempt produced (or reused)

  // Branch context
  readonly branchId: BranchId;            // which branch this attempt was on

  // Computation context
  readonly baseWorldId: WorldId;          // computation predecessor (head at execution time)
  readonly parentWorldId: WorldId | null; // lineage predecessor (tip at prepare time)

  // Provenance — opaque references, governance interprets
  readonly proposalRef?: ProvenanceRef;
  readonly decisionRef?: ProvenanceRef;

  // Chronology
  readonly createdAt: number;             // caller-provided (LIN-SEAL-PURE-1)

  // Trace
  readonly traceRef?: ArtifactRef;

  // Delta — transformation from baseSnapshot to terminalSnapshot
  readonly patchDelta?: PersistedPatchDeltaV2;

  // Reuse flag
  readonly reused: boolean;               // true if World/Edge already existed
};
```

#### 2.4.4 AttemptId Computation

```typescript
attemptId = computeHash({ worldId, branchId, createdAt })
```

**Rationale:** The combination of commit identity + branch + timestamp uniquely identifies an attempt. Two concurrent attempts on the same branch are serialized by CAS (only one succeeds per tip value), so `createdAt` granularity is sufficient.

**Alternative considered:** Random UUID. Rejected — violates LIN-SEAL-PURE-1 (prepare must be deterministic given same inputs).

| Rule ID | Level | Description |
|---------|-------|-------------|
| MRKL-ATTEMPT-1 | MUST | Every `prepareSealNext()` and `prepareSealGenesis()` invocation MUST produce a `SealAttempt` record in the `PreparedLineageCommit` |
| MRKL-ATTEMPT-2 | MUST | `SealAttempt` MUST be persisted by `commitPrepared()` regardless of whether the World/Edge records are new or reused |
| MRKL-ATTEMPT-3 | MUST | `SealAttempt.baseWorldId` MUST equal the `baseWorldId` from the seal input (the computation predecessor) |
| MRKL-ATTEMPT-4 | MUST | `SealAttempt.parentWorldId` MUST equal the branch's `tip` at prepare time (the lineage predecessor) |
| MRKL-ATTEMPT-5 | MUST NOT | `SealAttempt.attemptId`, `SealAttempt.createdAt`, `SealAttempt.traceRef`, `SealAttempt.patchDelta` MUST NOT be included in `worldId` or `snapshotHash` computation |
| MRKL-ATTEMPT-6 | MUST | `SealAttempt.reused` MUST be `false` when prepare creates a new World record, and MUST be set to `true` at commit time if the World already exists (MRKL-REUSE-1) |

### 2.5 PreparedLineageCommit — Revised

```typescript
type PreparedBranchMutation = {
  readonly kind: 'advance';
  readonly branchId: BranchId;
  readonly expectedHead: WorldId;
  readonly nextHead: WorldId;
  readonly headAdvanced: boolean;
  readonly expectedTip: WorldId;          // NEW
  readonly nextTip: WorldId;              // NEW
  readonly headAdvancedAt: number | null; // NEW — seal's createdAt when headAdvanced, else null
  readonly expectedEpoch: number;
  readonly nextEpoch: number;
};

type PreparedLineageRecords = {
  readonly worldId: WorldId;
  readonly world: World;               // purified — no attempt metadata
  readonly terminalSnapshot: Snapshot;
  readonly hashInput: SnapshotHashInput;
  readonly attempt: SealAttempt;       // NEW — always present
};

type PreparedGenesisCommit = PreparedLineageRecords & {
  readonly kind: 'genesis';
  readonly branchId: BranchId;
  readonly terminalStatus: 'completed';
  readonly edge: null;
  readonly branchChange: PreparedBranchBootstrap;
};

type PreparedNextCommit = PreparedLineageRecords & {
  readonly kind: 'next';
  readonly branchId: BranchId;
  readonly terminalStatus: TerminalStatus;
  readonly edge: WorldEdge;
  readonly branchChange: PreparedBranchMutation;
};

type PreparedLineageCommit = PreparedGenesisCommit | PreparedNextCommit;
```

**Prepare/commit contract integrity.** `prepareSealNext()` always produces a complete `PreparedLineageCommit`. At commit time, if the World/Edge already exist (idempotent reuse), World/Edge/snapshot writes are skipped; only SealAttempt is persisted. The prepared records remain a truthful representation of what would be persisted for a new commit. LIN-SEAL-PURE-1 is preserved.

### 2.6 Conceptual Separation: StateRoot / CommitId / AttemptId

| Concept | Identity of... | Computation | Can repeat? |
|---------|---------------|-------------|-------------|
| **snapshotHash** (StateRoot) | Content — what the state IS | `hash(data, system.terminalStatus, system.currentError, system.pendingDigest)` | Yes — same content = same hash |
| **worldId** (CommitId) | Position — where this commit sits in lineage | `hash(schemaHash, snapshotHash, parentWorldId)` | Yes — same position + same content = same commit (idempotent) |
| **attemptId** | Chronology — when, by whom, from where | `hash(worldId, branchId, createdAt)` | No — each attempt is unique |

### 2.7 Seal Input Changes

`SealNextInput` is unchanged externally. `parentWorldId` is derived from `branch.tip` during prepare.

```typescript
// SealNextInput — UNCHANGED externally
type SealNextInput = {
  readonly schemaHash: string;
  readonly baseWorldId: WorldId;
  readonly branchId: BranchId;
  readonly terminalSnapshot: Snapshot;
  readonly createdAt: number;
  readonly patchDelta?: PersistedPatchDeltaV2;
  readonly proposalRef?: ProvenanceRef;
  readonly decisionRef?: ProvenanceRef;
  readonly traceRef?: ArtifactRef;
};
```

### 2.8 Base Validation: Unchanged

| Rule | Status |
|------|--------|
| LIN-BRANCH-SEAL-2 (head must equal baseWorldId) | **Preserved** |
| LIN-BASE-1 (baseWorldId must exist) | **Preserved** |
| LIN-BASE-2 (baseWorldId must be completed) | **Preserved** |
| LIN-BASE-3 (failed world cannot be base) | **Preserved** |

### 2.9 Patch Delta: Attempt-Scoped with Explicit Key

| | Before (v1.x) | After (ADR-016) |
|---|---|---|
| Delta lives on | `PreparedNextCommit.patchDelta` | `SealAttempt.patchDelta` |
| Delta describes | `baseWorldId` → `terminalSnapshot` | same (unchanged) |
| Delta key | Implicit — worldId | Explicit — `attemptId` |
| Edge predecessor | `WorldEdge.from = baseWorldId` | `WorldEdge.from = parentWorldId` |

| Rule ID | Level | Description |
|---------|-------|-------------|
| MRKL-DELTA-1 | MUST NOT | `patchDelta` MUST NOT be included in `worldId` or `snapshotHash` computation |
| MRKL-DELTA-2 | MUST | `patchDelta`, when present, MUST describe the transformation from `SealAttempt.baseWorldId`'s snapshot to `terminalSnapshot` |
| MRKL-DELTA-3 | MUST | `patchDelta` MUST be stored as part of `SealAttempt`, not as part of `World` |
| MRKL-DELTA-4 | MUST | Replay from patches MUST use `SealAttempt.baseWorldId` as the starting snapshot, not `World.parentWorldId` |

### 2.10 No-Op Semantics

Under positional identity, a no-op produces a **valid, distinct World** — same `snapshotHash` as parent, but different `worldId`.

| Rule ID | Level | Description |
|---------|-------|-------------|
| MRKL-NOOP-1 | MUST | Lineage MUST accept no-op seals. No special handling required — they produce unique WorldIds naturally |

### 2.11 Restore Normalization Under Idempotent Reuse

#### 2.11.1 The Problem

`snapshotHash` is computed from `SnapshotHashInput`, which excludes several non-deterministic fields. The full set of excluded fields, per current specs:

| Excluded field | Spec reference | Nature |
|----------------|---------------|--------|
| `data.$host` (all contents) | LIN-HASH-4a, LIN-NS-1, HOST-DATA-3 | Host-owned execution artifacts (intentSlots, execution context) |
| `data.$mel` (all contents) | LIN-HASH-4b, LIN-NS-2 | Compiler-owned guard state (onceIntent tracking) |
| All `data.$*` (future) | LIN-NS-3 | Reserved platform namespaces |
| `input` | Not in `SnapshotHashInput` | Current action input (transient) |
| `meta.timestamp` | Not in `SnapshotHashInput` | Last modification timestamp |
| `meta.randomSeed` | Not in `SnapshotHashInput` | Deterministic seed from HostContext |
| `meta.version` | Not in `SnapshotHashInput` | Monotonic version counter |
| `computed` (all contents) | Not in `SnapshotHashInput` | Derived values (deterministic from `data`) |

Under idempotent reuse, two seal attempts from different branches may produce the same `WorldId` from the same `snapshotHash`. Their hash-relevant fields are identical by construction, but their **full** terminal snapshots may differ in any of the excluded fields above. With first-write-wins, the stored snapshot belongs to the first committer. Subsequent branches restoring via `getSnapshot(worldId)` would receive a snapshot containing another branch's `$host.intentSlots`, `$mel.guards`, and other execution-scoped artifacts.

#### 2.11.2 The Deeper Problem: Stale Artifacts on Resume

This problem is not unique to idempotent reuse. Even on a **single branch**, the stored full snapshot contains execution artifacts from the **previous** execution:

- `data.$host.intentSlots` records slots for intents that have already completed. On resume, no intent is in-flight — these slots are stale
- `data.$mel.guards.intent` maps guard markers to intentIds from completed intents. On resume, new intents receive new intentIds (SDK INV-6), so old guard entries will never match — they are stale
- `input` holds the action input from the last computation. On resume, no action is being processed
- `meta.timestamp` and `meta.randomSeed` were frozen by HostContext during the last execution (CTX-3, CTX-4). The next execution will freeze fresh values

The current `normalizeSnapshot` behavior (ADR-002, SDK-FACTORY-3) **ensures structural presence** ("add if missing, preserve if present") but does not clear stale values. This means even without reuse, resume currently inherits stale execution artifacts from the previous run. The artifacts are harmless in practice (Host re-initializes on next execution, old guard entries don't match new intentIds), but the stored snapshot does not reflect a clean resume-ready state.

#### 2.11.3 Solution: Restore Normalization

`restore(worldId)` MUST apply a normalization step that resets all non-hash fields to clean defaults. The stored full snapshot is the **persistence substrate**; the normalized snapshot is the **resume contract**.

**Normalization table:**

| Field | Stored value | Normalized value | Rationale |
|-------|-------------|-----------------|-----------|
| `data` (domain, non-`$`) | Preserved | **Preserved** | Hash-relevant, semantically meaningful |
| `data.$host` | Previous execution's artifacts | **Reset to `{}`** | Host re-initializes on next `processIntent()`. Stale intentSlots from a completed execution are meaningless |
| `data.$mel` | Previous execution's guard state | **Reset to `{ guards: { intent: {} } }`** | Guard entries map to old intentIds. New intents get new intentIds (INV-6), so old entries never match. Clearing removes stale data without behavioral impact |
| All `data.$*` (future, if present) | Previous execution's artifacts | **Reset to `{}`** | Deterministic generic fallback for unknown future platform namespaces |
| `computed` | Derived values from last computation | **Preserved** | Deterministically derived from `data` — not in `SnapshotHashInput`, but preserving avoids unnecessary recomputation on resume. Will be recomputed on next `compute()` if data changes |
| `system.status` | Terminal status | **Preserved** | Not directly in `SnapshotHashInput` — `terminalStatus` is derived by `deriveTerminalStatus()` from `lastError` and `pendingRequirements`. However, `status` reflects the being's semantic state at seal time and is preserved for continuity |
| `system.lastError` | Last error from terminal snapshot | **Preserved** | Part of `SnapshotHashInput` (as `currentError`). Semantically meaningful |
| `system.pendingRequirements` | Pending requirements | **Preserved** | Part of `SnapshotHashInput` (as `pendingDigest`). Semantically meaningful |
| `system.currentAction` | Action from last computation | **Reset to `null`** | Not in `SnapshotHashInput`. Execution-scoped control residue — Host uses `currentAction === intent.type` for re-entry detection (Core SPEC §9.4). Preserving across resume would cause new dispatches of the same action type to be misclassified as re-entry, skipping `available` evaluation. No intent is in-flight after restore |
| `input` | Last action's input | **Reset to `null`** | No action is being processed on resume |
| `meta.version` | Monotonic counter | **Preserved** | Structural metadata, not execution-scoped |
| `meta.schemaHash` | Schema identity | **Preserved** | Structural metadata |
| `meta.timestamp` | Last execution's frozen timestamp | **Reset to `0`** | Will be set by HostContext (CTX-3) on next execution |
| `meta.randomSeed` | Last execution's frozen seed | **Reset to `''`** | Will be set by HostContext (CTX-4) on next execution |

**Pseudocode:**

```typescript
function normalizeForRestore(stored: Snapshot): Snapshot {
  return {
    data: resetPlatformNamespaces(stored.data),
    computed: stored.computed,                    // preserved (derived from data)
    system: {
      ...stored.system,                          // preserve hash-relevant fields
      currentAction: null,                       // reset (execution-scoped, not in hash)
    },
    input: null,                                 // no active action on resume
    meta: {
      version: stored.meta.version,              // preserved (structural)
      schemaHash: stored.meta.schemaHash,        // preserved (structural)
      timestamp: 0,                              // reset (execution-scoped)
      randomSeed: '',                            // reset (execution-scoped)
    },
  };
}

function resetPlatformNamespaces(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith('$')) {
      result[key] = value;                       // domain data preserved
    } else if (key !== '$host' && key !== '$mel') {
      result[key] = {};                          // unknown future platform namespace → deterministic empty object
    }
  }
  // Re-inject clean platform namespace structure
  result.$host = {};
  result.$mel = { guards: { intent: {} } };
  return result;
}
```

#### 2.11.4 Why This Makes First-Write-Wins Safe

Under restore normalization, the snapshot that `restore(worldId)` returns is identical regardless of which attempt's full snapshot was stored:

1. **Hash-relevant fields** (`data` domain state, `system.terminalStatus`/`currentError`/`pendingDigest`) are identical across all full snapshots sharing the same `snapshotHash` — by construction
2. **Non-hash fields** (`$host`, `$mel`, `system.currentAction`, `input`, `meta.timestamp`, `meta.randomSeed`) are reset to the same clean defaults regardless of which attempt's values were stored

Therefore: which attempt's full snapshot is the canonical stored one is irrelevant to resume correctness. First-write-wins is safe because normalization eliminates the aliasing surface entirely.

#### 2.11.5 Why This Is Correct Even Without Reuse

Restore normalization improves single-branch resume correctness:

- **Before ADR-016:** `restore(worldId)` returns the raw stored snapshot, including stale `$host.intentSlots` and `$mel.guards.intent` from the previous execution. These are harmless but represent leaked execution artifacts
- **After ADR-016:** `restore(worldId)` returns a normalized snapshot with clean platform namespaces. The being resumes with only its semantic state — no ghosts from past executions

This aligns with the Manifesto principle that Snapshot is the being's state, not the platform's bookkeeping. Platform namespaces are explicitly excluded from identity (`snapshotHash`) for this reason — they should also be excluded from resume.

#### 2.11.6 Interaction with SDK `normalizeSnapshot` (ADR-002)

The current SDK `normalizeSnapshot` (ADR-002, SDK-FACTORY-3) ensures structural presence: "add `$mel.guards.intent` if missing, preserve if present." ADR-016's restore normalization is a **superset** — it resets non-hash fields to clean defaults, not merely ensures structural presence.

The two are applied at different points:

| Step | Function | When | What it does |
|------|----------|------|-------------|
| 1. Lineage restore | `normalizeForRestore()` | At `restore(worldId)` return | Resets all non-hash fields to clean defaults |
| 2. SDK factory | `normalizeSnapshot()` | At `createManifesto()` / SDK initialization | Ensures platform namespace structure exists (already satisfied after step 1) |

After ADR-016, step 2 becomes a no-op for restored snapshots (step 1 already guarantees the required structure). Step 2 remains necessary for user-provided initial snapshots that have never been through lineage.

#### 2.11.7 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| MRKL-RESTORE-1 | MUST | `restore(worldId)` MUST apply normalization before returning: reset `data.$host` to `{}`, `data.$mel` to `{ guards: { intent: {} } }`, and any other stored `data.$*` root to `{}` |
| MRKL-RESTORE-2 | MUST | `restore(worldId)` MUST reset `input` to `null` |
| MRKL-RESTORE-3 | MUST | `restore(worldId)` MUST reset `meta.timestamp` to `0` and `meta.randomSeed` to `''` |
| MRKL-RESTORE-3a | MUST | `restore(worldId)` MUST reset `system.currentAction` to `null`. `currentAction` is not in `SnapshotHashInput` and is execution-scoped — preserving it causes re-entry false positives (Core SPEC §9.4, Host SPEC §6.3) |
| MRKL-RESTORE-4 | MUST | `restore(worldId)` MUST preserve hash-relevant fields: domain `data` (non-`$`-prefixed keys), `computed`, `system.status`, `system.lastError`, `system.pendingRequirements`, `meta.version`, `meta.schemaHash` |
| MRKL-RESTORE-5 | MUST NOT | Under idempotent reuse, `commitPrepared()` MUST NOT overwrite the stored snapshot for an existing WorldId. The first-written snapshot is the persistence substrate; restore normalization ensures resume correctness regardless of which attempt's snapshot is stored |

**MRKL-RESTORE-5 rationale.** The stored snapshot serves two purposes: (1) resume via `restore()` — normalization guarantees correctness, (2) audit/debugging via `getSnapshot()` — the raw stored snapshot may be exposed via a separate `getRawSnapshot()` API for debugging, but `restore()` always normalizes. Per-attempt exact snapshot preservation is available via `SealAttempt.traceRef` or external artifact storage.

### 2.12 Head Query Timestamp: Branch-Local `headAdvancedAt`

#### 2.12.1 The Problem

The current Lineage SPEC defines:
- LIN-HEAD-7: `WorldHead.createdAt` MUST be the head World's creation timestamp
- LIN-HEAD-4: `getLatestHead()` MUST return the Head with the most recent `createdAt`

ADR-016 removes `World.createdAt`. Under idempotent reuse, a World created at T1 may be adopted as head by another branch at T2. The question "which branch was most recently updated?" needs a branch-local timestamp.

#### 2.12.2 Solution: `BranchInfo.headAdvancedAt`

`headAdvancedAt` records when this branch's head pointer last moved. Set to the seal's `createdAt` on completed seals.

```typescript
type WorldHead = {
  readonly worldId: WorldId;
  readonly branchId: BranchId;
  readonly branchName: string;
  readonly createdAt: number;        // NOW: branch.headAdvancedAt
  readonly schemaHash: string;
};
```

| | Before (v1.x) | After (ADR-016) |
|---|---|---|
| `WorldHead.createdAt` source | `World.createdAt` | `BranchInfo.headAdvancedAt` |
| `getLatestHead()` answers | "Which head World was created most recently?" | "Which branch's head was updated most recently?" |

#### 2.12.3 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| MRKL-HEAD-1 | MUST | `BranchInfo` MUST include `headAdvancedAt: number` |
| MRKL-HEAD-2 | MUST | `headAdvancedAt` MUST be set to the seal's `createdAt` when a completed seal advances head |
| MRKL-HEAD-3 | MUST | `headAdvancedAt` MUST NOT change on failed seals |
| MRKL-HEAD-4 | MUST | For genesis, `headAdvancedAt` MUST be the genesis seal's `createdAt` |
| MRKL-HEAD-5 | MUST | `WorldHead.createdAt` MUST be sourced from `BranchInfo.headAdvancedAt` |
| MRKL-HEAD-6 | MUST | `headAdvancedAt` MUST be updated atomically in the same branch mutation guarded by CAS on `head`, `tip`, and `epoch` |

---

## 3. Impact Analysis

### 3.1 Changed Specifications

| Document | Change | Severity |
|----------|--------|----------|
| Lineage SPEC §5.2 | `World` purified; add `parentWorldId` | Breaking |
| Lineage SPEC §5.3 | `WorldEdge` purified; `from` = `parentWorldId` | Breaking |
| Lineage SPEC §5 (new) | `SealAttempt` type | Breaking (additive) |
| Lineage SPEC §6.1 | WorldId includes `parentWorldId` | Breaking |
| Lineage SPEC §7.2 | `PreparedLineageCommit` gains `attempt`; `PreparedBranchMutation` gains `tip`, `headAdvancedAt` | Breaking |
| Lineage SPEC §8 | Collision → idempotent reuse + restore normalization | Breaking |
| Lineage SPEC §10.1 | `BranchInfo` gains `tip`, `headAdvancedAt` | Breaking |
| Lineage SPEC §10.2 | `WorldHead.createdAt` = `headAdvancedAt` | Breaking (semantic) |
| Lineage SPEC §11 | `LineageStore` gains `putAttempt()`, `getAttempts()` | Breaking (additive) |
| Lineage SPEC §11.2 | LIN-STORE-9 reframed | Breaking (semantic) |
| Lineage SPEC §14 | `restore()` gains normalization step (MRKL-RESTORE-*) | Breaking (behavioral) |
| Governance SPEC §9.3 | Seal rejection simplified | Minor |
| Governance SPEC §9.5 | Provenance → `SealAttempt` | Minor |
| World SPEC §9.7.1 | HEAD-7 superseded | Breaking (semantic) |

### 3.2 Superseded Rules

| Rule ID | Document | Disposition |
|---------|----------|-------------|
| LIN-ID-1 | Lineage SPEC | **Superseded** — WorldId includes `parentWorldId` |
| LIN-COLLISION-1~4 | Lineage SPEC | **Eliminated** |
| LIN-STORE-9 | Lineage SPEC | **Reframed** — idempotent reuse + restore normalization |
| LIN-EDGE-2 | Lineage SPEC | **Eliminated** — `WorldEdge.createdAt` removed |
| LIN-HEAD-7 / HEAD-7 | Lineage/World SPEC | **Superseded** — `WorldHead.createdAt` = `headAdvancedAt` |

### 3.3 Preserved Rules and Invariants

| Rule / Invariant | Status |
|-----------------|--------|
| LIN-DAG-1 (single parent) | **Preserved** — in `World.parentWorldId` |
| LIN-DAG-2 (acyclic) | **Preserved** — hash fixed point infeasible |
| LIN-HEAD-ADV-1~2 | **Preserved** |
| LIN-HEAD-4 (getLatestHead = max createdAt) | **Preserved** — source changed to `headAdvancedAt` |
| LIN-BASE-* | **Preserved** |
| LIN-GENESIS-1, LIN-GENESIS-3 | **Preserved** |
| LIN-PERSIST-SNAP-2 (snapshot keyed by WorldId) | **Preserved** — first-write-wins under reuse |
| LIN-RESUME-* | **Extended** — restore now normalizes non-hash fields |
| Branch CAS | **Extended** — includes tip in the compare-set and carries `headAdvancedAt` as part of the same atomic branch mutation |
| Prepare/commit separation | **Preserved** |

### 3.4 Governance Impact

| Concern | Impact |
|---------|--------|
| `PreparedLineageCommit.worldId` | Type unchanged |
| Provenance mapping | `SealAttempt`, not `World`/`WorldEdge` |
| `SealRejectionReason` | Collision variants eliminated. Retain for future |
| `finalizeOnSealRejection()` | Retain |
| Epoch, proposal lifecycle, GOV-SEAL-1 | Unchanged |

---

## 4. Design Rationale

### 4.1 Why parentWorldId Instead of intentId?

`intentId` couples Lineage to execution semantics, is unavailable in governance paths, provides no lineage traversal, and doesn't eliminate self-loops structurally.

### 4.2 Why tip Instead of a Counter?

Counters require coordination, aren't content-verifiable, and add a new concept. `tip` is already resolved by CAS.

### 4.3 Why Separate head and tip?

`head` = latest known-good state for computation. `tip` = latest event in history. Conflating them either allows building on failures or prevents failures from being lineage predecessors.

### 4.4 Why Idempotent Reuse + SealAttempt?

| Alternative | Why rejected |
|-------------|-------------|
| Rejection (v1.x) | Same position + same content = same commit; rejection is artificial |
| branchId in hash | Branches can never share a World — contradicts existing model |
| Reuse without SealAttempt (v2) | Second attempt's provenance/trace has no storage |
| Reuse with SealAttempt + restore normalization (v5) | **Chosen** — World = commit, SealAttempt = attempt, normalization = resume safety |

### 4.5 Why Restore Normalization Instead of Alternatives?

| Alternative | Why rejected |
|-------------|-------------|
| Move snapshot to SealAttempt | Breaks `getSnapshot(worldId)` contract; storage multiplication for 99% non-reuse case |
| Strengthen reuse to require same full snapshot | Kills reuse in practice — `$host` state always differs between branches |
| Canonical persisted projection | New abstraction layer with no precedent in current spec |
| Field-by-field safety proof (v4) | Incorrect — current restore preserves `$host`/`$mel`, doesn't discard them |

Restore normalization is the minimal intervention that:
1. Makes first-write-wins safe under reuse (aliasing surface eliminated)
2. Improves single-branch resume correctness (stale artifacts removed)
3. Aligns with existing design intent (non-hash fields = non-semantic = not part of identity = should not persist across resume boundaries)

---

## 5. Boundary Conditions

### 5.1 Genesis parentWorldId

`null`. Base case of the Merkle chain. Bootstrap uniqueness (LIN-GENESIS-3) preserved independently of World-level reuse.

### 5.2 Epoch Boundary Genesis

New Merkle tree root with `parentWorldId: null`. See ADR-015 §8.2.

### 5.3 Branch CAS Protocol Extension

`PreparedBranchMutation` gains `expectedTip`, `nextTip`, `headAdvancedAt`. The CAS compare-set is `(expectedHead, expectedTip, expectedEpoch)`; `headAdvancedAt` is updated atomically in that same branch mutation.

### 5.4 DAG Edge Semantics

`WorldEdge.from` = `parentWorldId`. Computation predecessor preserved in `SealAttempt.baseWorldId`.

### 5.5 Concurrent Seal Ordering

Same-branch concurrent prepares: one succeeds CAS, other re-prepares. Identical to current `expectedHead` CAS.

### 5.6 Cross-Branch Idempotent Reuse Sequence

```
Branch A: tip=H0, seals S at createdAt=100
  → World W created, Edge E(H0→W), snapshot stored, SealAttempt A1(reused:false)
  → BranchA: tip=W, head=W, headAdvancedAt=100

Branch B: tip=H0, seals S at createdAt=200
  → W exists (skip), E exists (skip), snapshot not overwritten
  → SealAttempt A2(reused:true) persisted
  → BranchB: tip=W, head=W, headAdvancedAt=200

Resume Branch B:
  → restore(W) → normalizeForRestore(stored) → clean snapshot
  → $host={}, $mel={guards:{intent:{}}}, input=null
  → Same result as if Branch B's full snapshot had been stored
```

### 5.7 LineageStore Extensions

```typescript
interface LineageStore {
  // ... existing methods ...
  putAttempt(attempt: SealAttempt): void;
  getAttempts(worldId: WorldId): readonly SealAttempt[];
  getAttemptsByBranch(branchId: BranchId): readonly SealAttempt[];
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| MRKL-STORE-1 | MUST | `LineageStore` MUST persist `SealAttempt` records |
| MRKL-STORE-2 | MUST | `commitPrepared()` MUST persist `SealAttempt` in every case |
| MRKL-STORE-3 | MUST | `commitPrepared()` MUST skip World/Edge/snapshot writes on reuse |
| MRKL-STORE-4 | MUST | `commitPrepared()` MUST set `attempt.reused = true` on reuse |

---

## 6. Invariants

| ID | Level | Description |
|----|-------|-------------|
| INV-016-1 | MUST | `worldId = computeHash({ schemaHash, snapshotHash, parentWorldId })` |
| INV-016-2 | MUST | Genesis `parentWorldId` is `null` |
| INV-016-3 | MUST | Next `parentWorldId` is branch's `tip` at prepare time |
| INV-016-4 | MUST | `tip` advances on every seal |
| INV-016-5 | MUST | `head` advances only on completed seals |
| INV-016-6 | MUST | `head`, `tip`, and `epoch` are CAS-verified together; `headAdvancedAt` is updated atomically in the same mutation |
| INV-016-7 | MUST NOT | `baseWorldId` and `parentWorldId` MUST NOT be conflated |
| INV-016-8 | MUST | Same `worldId` + same `parentWorldId` = idempotent reuse |
| INV-016-9 | MUST | Same `(schemaHash, snapshotHash, parentWorldId)` = same `worldId` |
| INV-016-10 | MUST | Every seal = exactly one `SealAttempt` |
| INV-016-11 | MUST | `World.parentWorldId` = hash input's `parentWorldId` |
| INV-016-12 | MUST NOT | Stored snapshot not overwritten on reuse |
| INV-016-13 | MUST | `WorldHead.createdAt` from `BranchInfo.headAdvancedAt` |
| INV-016-14 | MUST | `restore()` normalizes non-hash fields before returning |

---

## 7. Test Plan

```typescript
describe('ADR-016: Positional WorldId with SealAttempt and Restore Normalization', () => {
  // --- Core positional identity ---

  it('same content + different parent = different WorldId', () => {
    const worldA = seal(branchId, snapshotX);
    const worldB = seal(branchId, snapshotX);
    expect(worldA.snapshotHash).toBe(worldB.snapshotHash);
    expect(worldA.worldId).not.toBe(worldB.worldId);
  });

  it('genesis includes null parentWorldId', () => {
    const genesis = sealGenesis(schemaHash, snapshot);
    const expected = computeHash({ schemaHash, snapshotHash, parentWorldId: null });
    expect(genesis.worldId).toBe(expected);
  });

  it('World record contains parentWorldId', () => {
    const genesis = sealGenesis(schemaHash, snapshot);
    expect(getWorld(genesis.worldId).parentWorldId).toBeNull();
    const next = seal(branchId, nextSnapshot);
    expect(getWorld(next.worldId).parentWorldId).toBe(genesis.worldId);
  });

  it('self-loop is structurally impossible', () => {
    const world = seal(branchId, anySnapshot);
    expect(world.worldId).not.toBe(branch.tip);
  });

  // --- Head/tip/headAdvancedAt ---

  it('failed seal advances tip only', () => {
    const before = getBranch(branchId);
    seal(branchId, failedSnapshot, { createdAt: 999 });
    const after = getBranch(branchId);
    expect(after.head).toBe(before.head);
    expect(after.tip).not.toBe(before.tip);
    expect(after.headAdvancedAt).toBe(before.headAdvancedAt);
  });

  it('completed seal advances head, tip, headAdvancedAt, epoch', () => {
    seal(branchId, completedSnapshot, { createdAt: 500 });
    const after = getBranch(branchId);
    expect(after.headAdvancedAt).toBe(500);
    expect(after.epoch).toBe(before.epoch + 1);
  });

  it('getLatestHead uses headAdvancedAt', () => {
    const branchA = createBranch({ headWorldId: H0 });
    const branchB = createBranch({ headWorldId: H0 });
    seal(branchA, snapshotX, { createdAt: 100 });
    seal(branchB, snapshotY, { createdAt: 200 });
    expect(getLatestHead().branchId).toBe(branchB);
    expect(getLatestHead().createdAt).toBe(200);
  });

  // --- SealAttempt ---

  it('every seal creates a SealAttempt', () => {
    const result = seal(branchId, anySnapshot);
    const attempts = getAttempts(result.worldId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].reused).toBe(false);
  });

  it('SealAttempt preserves baseWorldId and parentWorldId separately', () => {
    const head = getBranch(branchId).head;
    seal(branchId, failedSnapshot);
    const tip = getBranch(branchId).tip;
    const result = seal(branchId, nextSnapshot);
    const attempt = getAttempts(result.worldId)[0];
    expect(attempt.baseWorldId).toBe(head);
    expect(attempt.parentWorldId).toBe(tip);
    expect(attempt.baseWorldId).not.toBe(attempt.parentWorldId);
  });

  // --- Repeated identical failures ---

  it('repeated identical failures create distinct Worlds', () => {
    const f1 = seal(branchId, validationErrorSnapshot);
    const f2 = seal(branchId, validationErrorSnapshot);
    expect(f1.snapshotHash).toBe(f2.snapshotHash);
    expect(f1.worldId).not.toBe(f2.worldId);
  });

  // --- Cross-branch idempotent reuse ---

  it('cross-branch same-parent same-snapshot = reuse', () => {
    const branchA = createBranch({ headWorldId: H0 });
    const branchB = createBranch({ headWorldId: H0 });
    seal(branchA, snapshotS);
    seal(branchB, snapshotS);
    const worldId = getBranch(branchA).tip;
    expect(getBranch(branchB).tip).toBe(worldId);
    expect(getAllWorlds().filter(w => w.worldId === worldId)).toHaveLength(1);
    expect(getEdges(worldId)).toHaveLength(1);
  });

  it('reuse creates separate SealAttempts', () => {
    const branchA = createBranch({ headWorldId: H0 });
    const branchB = createBranch({ headWorldId: H0 });
    seal(branchA, snapshotS, { proposalRef: 'P1', traceRef: T1 });
    seal(branchB, snapshotS, { proposalRef: 'P2', traceRef: T2 });
    const attempts = getAttempts(getBranch(branchA).tip);
    expect(attempts).toHaveLength(2);
    expect(attempts[0].reused).toBe(false);
    expect(attempts[0].proposalRef).toBe('P1');
    expect(attempts[1].reused).toBe(true);
    expect(attempts[1].proposalRef).toBe('P2');
  });

  it('reuse with different headAdvancedAt per branch', () => {
    const branchA = createBranch({ headWorldId: H0 });
    const branchB = createBranch({ headWorldId: H0 });
    seal(branchA, snapshotS, { createdAt: 100 });
    seal(branchB, snapshotS, { createdAt: 200 });
    expect(getBranch(branchA).headAdvancedAt).toBe(100);
    expect(getBranch(branchB).headAdvancedAt).toBe(200);
    expect(getLatestHead().createdAt).toBe(200);
  });

  // --- Restore normalization ---

  it('restore normalizes $host to empty', () => {
    const snapshot = { ...snapshotS, data: { ...snapshotS.data, $host: { intentSlots: { x: 'active' } } } };
    seal(branchId, snapshot);
    const restored = restore(getBranch(branchId).head);
    expect(restored.data.$host).toEqual({});
  });

  it('restore normalizes $mel to clean defaults', () => {
    const snapshot = { ...snapshotS, data: { ...snapshotS.data, $mel: { guards: { intent: { g1: 'old-intent-id' } } } } };
    seal(branchId, snapshot);
    const restored = restore(getBranch(branchId).head);
    expect(restored.data.$mel).toEqual({ guards: { intent: {} } });
  });

  it('restore resets input to null', () => {
    const snapshot = { ...snapshotS, input: { type: 'increment', payload: 42 } };
    seal(branchId, snapshot);
    const restored = restore(getBranch(branchId).head);
    expect(restored.input).toBeNull();
  });

  it('restore resets meta.timestamp and meta.randomSeed', () => {
    const snapshot = { ...snapshotS, meta: { ...snapshotS.meta, timestamp: 999, randomSeed: 'old-seed' } };
    seal(branchId, snapshot);
    const restored = restore(getBranch(branchId).head);
    expect(restored.meta.timestamp).toBe(0);
    expect(restored.meta.randomSeed).toBe('');
  });

  it('restore preserves hash-relevant fields, resets currentAction', () => {
    const snapshotWithAction = {
      ...snapshotS,
      system: { ...snapshotS.system, currentAction: 'increment' },
    };
    seal(branchId, snapshotWithAction);
    const restored = restore(getBranch(branchId).head);
    expect(restored.data.count).toBe(snapshotS.data.count);       // domain preserved
    expect(restored.computed).toEqual(snapshotS.computed);         // computed preserved
    expect(restored.system.status).toBe(snapshotS.system.status); // hash-relevant preserved
    expect(restored.system.lastError).toBe(snapshotS.system.lastError);
    expect(restored.system.pendingRequirements).toEqual(snapshotS.system.pendingRequirements);
    expect(restored.system.currentAction).toBeNull();              // execution-scoped → reset
    expect(restored.meta.version).toBe(snapshotS.meta.version);   // structural meta preserved
    expect(restored.meta.schemaHash).toBe(snapshotS.meta.schemaHash);
  });

  it('restore under reuse gives identical result regardless of stored snapshot', () => {
    const branchA = createBranch({ headWorldId: H0 });
    const branchB = createBranch({ headWorldId: H0 });

    // Same domain data, different $host
    const snapshotA = { ...snapshotS, data: { ...snapshotS.data, $host: { ctx: 'A' } } };
    const snapshotB = { ...snapshotS, data: { ...snapshotS.data, $host: { ctx: 'B' } } };

    seal(branchA, snapshotA);  // first-write-wins: A's snapshot stored
    seal(branchB, snapshotB);  // reuse: B's snapshot NOT stored

    const worldId = getBranch(branchA).tip;
    const restored = restore(worldId);

    // Normalization makes it irrelevant which was stored
    expect(restored.data.$host).toEqual({});  // neither A nor B — clean
    expect(restored.data.count).toBe(snapshotS.data.count);  // domain data identical
  });

  // --- CAS ---

  it('CAS rejects stale tip', () => {
    const prep1 = prepareSealNext({ ...input, branchId });
    const prep2 = prepareSealNext({ ...input2, branchId });
    commitPrepared(prep1);
    expect(() => commitPrepared(prep2)).toThrow(/CAS/);
  });

  // --- World/Edge purification ---

  it('World has no attempt metadata', () => {
    const world = getWorld(seal(branchId, anySnapshot).worldId);
    expect((world as any).createdAt).toBeUndefined();
    expect((world as any).createdBy).toBeUndefined();
    expect((world as any).executionTraceRef).toBeUndefined();
  });

  it('WorldEdge has no attempt metadata', () => {
    const edges = getEdges(seal(branchId, anySnapshot).worldId);
    expect((edges[0] as any).proposalRef).toBeUndefined();
    expect((edges[0] as any).createdAt).toBeUndefined();
  });
});
```

---

## 8. Migration

See ADR-015 §8.2. Both ADRs share a single epoch boundary:

1. Read active branch head snapshot
2. New genesis with `parentWorldId: null`, new hash scheme
3. `head = tip = genesisWorldId`, `headAdvancedAt = genesis createdAt`
4. Initial `SealAttempt` for genesis
5. Continue from new chain

**SealAttempt migration.** Pre-epoch Worlds have no `SealAttempt` records. Post-migration attempt queries return empty for pre-epoch Worlds.

**headAdvancedAt migration.** Set to genesis `createdAt` on epoch boundary.

**Restore normalization migration.** Applies immediately — any `restore()` call after migration returns normalized snapshots. Pre-epoch stored snapshots with stale `$host`/`$mel` are normalized on read.

---

## 9. Related Future Work (Non-Normative)

| Item | Status |
|------|--------|
| Remove `finalizeOnSealRejection()` if no rejection scenarios remain | Future SPEC patch |
| SealAttempt retention policy | Future SPEC — unbounded growth concern |
| `getRawSnapshot(worldId)` for debugging (pre-normalization) | Future SPEC — audit convenience |
| Multi-parent merge | Out of scope |
| Branch-scoped World query | Future SPEC |

---

*End of ADR-016 v5*
