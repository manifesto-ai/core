# World FDR v2.0.5 Addendum: Head Query & Resume Contract

> **Status:** Draft
> **Date:** 2026-02-08
> **Related:** Issue #109, World SPEC v2.0.5 Patch
> **Scope:** FDR-W036, FDR-W037, FDR-W038
> **Review History:**
> - rev.1: Head as lineage leaf — **rejected** (conflicts with BRANCH-7, ActiveHorizon)
> - rev.2: Head as branch pointer — adopted
> - rev.3: Sorting tie-breaker extended to branchId; Resume decoupled from getLatestHead()
> - **rev.3-final: GO — Field semantics clarified; crash recovery conditions added**

---

## Part VI: Head Query & Resume Contract (v2.0.5)

> These decisions formalize the Head concept and resume semantics,
> closing the gap between WorldStore's internal head tracking and
> World's public query API.

---

### FDR-W036: Head as Branch Pointer, Not Lineage Leaf

#### Decision

**Head is defined as a World referenced by `Branch.head`. World MUST expose Head query as part of its public read-only API.**

#### Context

`WorldStore.getHeads(): Set<WorldId>` already existed in FDR-APP-INTEGRATION-001 §3.8 for maintenance cycle's active horizon calculation. However, this was an **internal** WorldStore method, not part of World's public query API.

ADR-003 §5 established: "World MUST expose read-only query APIs only; no raw store access leaks upward." The listed queries were `getSnapshot`, `getWorld`, `getLineage`, `getProposal` — but no Head query.

This forced App implementations to either:
1. Traverse lineage DAG manually to find heads (exposes World internals)
2. Maintain separate head tracking outside World (duplicates responsibility)
3. Access WorldStore directly (violates ADR-003 encapsulation)

#### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Head = lineage leaf (no children)** | Graph-theoretic definition | **Rejected (rev.1 critical):** Conflicts with BRANCH-7 — failed Worlds become leaves but branch heads don't advance. Fork heads disappear when parent gains children. Breaks Active Horizon. |
| App tracks head separately | App stores last worldId in its own persistence | Duplicates World's responsibility; divergence risk |
| WorldStore.getHeads() made public | Expose WorldStore method directly | Violates "no raw store access" (ADR-003 §5) |
| **Head = Branch pointer** | World referenced by `Branch.head` | **Adopted**: Consistent with all existing usage |

#### Rationale: Why Not Leaf?

The initial draft (rev.1) defined Head as "lineage DAG leaf node." Review identified two critical conflicts:

**Conflict A — Failed World eclipses good state:**
```
W1 (completed) → W2 (failed)

Branch head (pointer): W1  ← BRANCH-7: doesn't advance on failure
Lineage leaf:           W2  ← Only node with no children

"Leaf = head" → resume from W2 (failed) → UX broken
"Pointer = head" → resume from W1 (last good state) → Correct
```

**Conflict B — Fork head vanishes:**
```
main:       W1 → W2 (completed)
experiment: → W1 (fork point)

Branch heads: {W1, W2}  ← Both branches represented
Lineage leaves: {W2}    ← W1 has child, so not a leaf

"Leaf = head" → experiment's head missing → Active Horizon broken
"Pointer = head" → both branches' heads preserved → Correct
```

The term "head" was already used consistently as "branch pointer" across 6+ locations in existing specs (Branch.head, updateHead, getCurrentHead, BRANCH-5/7, ActiveHorizon.heads). Redefining it as a graph property would create semantic confusion across the entire document set.

#### Consequences

- HEAD-1: Head = World referenced by `Branch.head`
- HEAD-3: All Heads are completed (follows from BRANCH-7 — no separate preference logic needed)
- HEAD-5: Tie-breaking by `worldId`, then `branchId` for fully deterministic ordering (covers fork-without-advance case where multiple branches share the same World)
- `WorldHead` includes `branchId` — Head is inherently tied to a Branch
- `WorldHead.createdAt` = head World's creation time (not Branch creation time) — for temporal ordering
- `WorldHead.schemaHash` = Branch's current schemaHash (not head World's original schema) — for resume migration checks; in schema-changing fork, these may differ
- Lineage leaf remains a distinct, unnamed concept (available via lineage traversal if needed for audit)
- Active Horizon's `heads` set is exactly the set of branch head pointers — perfect alignment

---

### FDR-W037: No Completed/Failed Preference — BRANCH-7 Suffices

#### Decision

**`getLatestHead()` returns the most recent Head by `createdAt`, with no completed/failed preference logic. BRANCH-7 already guarantees all branch heads are completed.**

#### Context

The initial draft (rev.1) included:
- HEAD-3 (MUST): `getLatestHead()` returns max by `createdAt`
- HEAD-5 (SHOULD): prefer completed over failed

These rules were normatively contradictory (MUST vs SHOULD on the same operation) and operationally unnecessary.

#### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| Completed preference (SHOULD) | Filter completed first, fallback to all | **Rejected:** Creates MUST/SHOULD conflict; unnecessary when BRANCH-7 prevents failed heads |
| Completed filter (MUST) | Only return completed Heads | **Rejected:** Redundant — all Heads are already completed |
| **No preference, rely on BRANCH-7** | Simple createdAt max | **Adopted**: Eliminates normative conflict; leverages existing invariant |

#### Rationale

```
BRANCH-7: "Branch head MUST NOT advance to Failed World"

Therefore:
  Every Branch.head → completed World
  getHeads() → all completed
  getLatestHead() → max(createdAt) → guaranteed completed

No preference logic needed. The invariant is structural, not algorithmic.
```

The rev.1 approach tried to solve at the query layer what was already solved at the governance layer. This is a violation of the Manifesto principle that **structural constraints are more reliable than behavioral ones**.

#### Consequences

- HEAD-4 (MUST): `getLatestHead()` returns max by `createdAt` — single, unambiguous rule
- HEAD-5 (MUST): Tie-break by `worldId` ascending, then `branchId` ascending — fully deterministic even for fork-without-advance
- No SHOULD-level preference — normatively clean
- Failed Worlds exist in lineage (FDR-W012) but are never Heads — accessible via `getLineage()` for audit

---

### FDR-W038: Resume is World Query, Not App Configuration

#### Decision

**Resume is implemented as composition of World's existing query primitives, not as a new App configuration option.**

#### Context

Issue #109 proposed two approaches:

```typescript
// Candidate A: App configuration
createApp({
  schema, effects, world,
  resume: { mode: 'latest' }
});

// Candidate B: World query primitive
const latest = await world.getLatestHead();
```

#### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **App resume option** | `createApp({ resume: { mode: 'latest' } })` | Hides logic in App internals; conflicts with "App is thin facade" (ADR-004) |
| **Dedicated Resume API** | `app.resume(): Promise<Snapshot>` | Creates new abstraction when primitives suffice |
| **World query primitives** | `getLatestHead()` + `getSnapshot()` | **Adopted**: Composable, transparent, consistent with existing API |

#### Rationale

```
PRINCIPLE (ADR-003 + ADR-004):
  World provides queries.
  App composes queries into workflows.
  App does NOT hide governance decisions behind convenience APIs.

DEFAULT RESUME (persisted active branch):
  const branch = persistedState.activeBranch;
  const snapshot = await world.getSnapshot(branch.head);
  // Restores exactly where the user left off — same branch, same state

ALTERNATIVE RESUME (getLatestHead — for specific use cases):
  const latest = await world.getLatestHead();
  const snapshot = await world.getSnapshot(latest.worldId);
  // Switches to whichever branch was most recently updated
```

Default resume uses persisted active branch because:
1. **Branch context is user intent** — if the user switched to "experiment", restart should stay on "experiment"
2. **Read-only guarantee** — restoring persisted branch state doesn't mutate anything
3. **Consistency with BRANCH-PERSIST-3** — "activeBranchId MUST persist" exists precisely for this

`getLatestHead()` remains valuable as a query primitive for:
- UI: "show which branch was most recently active"
- Alternative resume: apps that prefer "always resume from latest activity"
- Dashboards: cross-branch overview

#### Consequences

- World SPEC adds `getHeads()` and `getLatestHead()` (query primitives)
- **App SPEC adds `getHeads()` and `getLatestHead()` (delegation — thin facade)**
- **Default resume uses persisted active branch head, NOT `getLatestHead()`**
- `getLatestHead()` is positioned as query primitive, not resume policy
- App SPEC does NOT add `resume` option
- Apps implement resume via persisted branch state (read-only, no branch switching)
- AppRef is NOT changed (async incompatible with Hook's sync observation model)

---

## Summary Table (v2.0.5)

| FDR | Decision | Key Principle | Reference |
|-----|----------|---------------|-----------|
| W036 | Head = branch pointer (not leaf) | Terminology consistency | HEAD-1~6 |
| W037 | No preference logic — BRANCH-7 suffices | Structural > behavioral constraint | HEAD-3, HEAD-4 |
| W038 | Resume uses persisted active branch; getLatestHead() is query primitive | Primitives + branch context | RESUME-1~6 |

---

## Rejected Design Record: Head as Lineage Leaf (rev.1)

> Preserved for future reference — explains why the seemingly intuitive
> graph-theoretic definition was rejected.

| Aspect | Leaf Definition (rev.1) | Pointer Definition (rev.2) |
|--------|------------------------|---------------------------|
| Head of `W1→W2(failed)` | W2 (leaf) | W1 (branch pointer) |
| Fork head without advance | Missing (not a leaf) | Present (pointer exists) |
| Alignment with BRANCH-7 | Conflicts | Consistent |
| Alignment with ActiveHorizon | Conflicts | Consistent |
| Completed/failed preference | Needed (HEAD-5 SHOULD) | Unnecessary (structural guarantee) |
| Normative cleanliness | MUST/SHOULD conflict | All MUST, no ambiguity |

**Lesson:** When an existing system has 6+ consistent usages of a term, redefining it based on theoretical elegance creates more problems than it solves. Align with established semantics.

---

## Cross-Reference

| Document | Relationship |
|----------|--------------|
| Issue #109 | Source of this decision |
| ADR-003 | "World MUST expose read-only query APIs" — Head query completes the API |
| ADR-004 | "App is thin facade" — Resume is not App configuration; App delegates Head query |
| App SPEC v2.3.1 | `getHeads()`, `getLatestHead()` added to App Public API (delegation to World) |
| FDR-APP-INTEGRATION-001 §3.8 | `WorldStore.getHeads()` — internal method; uses same pointer semantics |
| App SPEC §12 | BranchManager — source of truth for branch heads; consumed by Head query |

---

*End of World FDR v2.0.5 Addendum (rev.3-final)*
