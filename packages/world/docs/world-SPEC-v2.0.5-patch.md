# World SPEC v2.0.5 Patch Document

> **Patch Target:** World SPEC v2.0.3 → v2.0.5
> **Status:** Draft
> **Date:** 2026-02-08
> **Related:** Issue #109, ADR-003 (World Owns Persistence), ADR-004 (App Decomposition), FDR-APP-INTEGRATION-001 v0.4.1
> **Scope:** Head Query API, Resume Contract, Branch State Persistence
> **Breaking Change:** No (additive only)
> **Review History:**
> - rev.1: Initial draft — Head defined as lineage leaf
> - rev.2: Critical fix — Head redefined as branch pointer
> - rev.3: Critical fix — Sorting tie-breaker extended to branchId; Resume decoupled from getLatestHead()
> - **rev.3-final: GO — Field semantics clarified (createdAt=World, schemaHash=Branch); crash recovery detection conditions added**

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| Head Query API added to World public interface | API Addition | Non-breaking |
| Head formalized as branch pointer | Normative Clarification | Non-breaking |
| Resume contract defined | New Contract | Non-breaking |
| Branch state persistence rules | New Rules | Non-breaking |

---

## 1. Changelog Entry

```diff
> **Changelog:**
> - v1.0: Initial release
> - v2.0: Host v2.0.1 Integration, Event-Loop Execution Model alignment
> - v2.0.1: ADR-001 Layer Separation - Event ownership, "Does NOT Know" boundary
> - v2.0.2: Host-World Data Contract - `$host` namespace, deterministic hashing, baseSnapshot via WorldStore
> - v2.0.3: Platform Namespace Extension - `$mel` namespace for Compiler, unified platform namespace policy
+ > - **v2.0.5: Head Query API - Formal head definition (branch pointer), resume contract, branch state persistence**
```

---

## 2. Motivation

### 2.1 Problem

앱 재시작 시 "어느 World부터 이어서 시작하는가?"에 대한 공식 계약이 없다.

현재 상태:

| 컴포넌트 | 기능 | 문제 |
|----------|------|------|
| `WorldStore.getHeads()` | 내부적으로 head 집합을 반환 | World의 **public** query API에 노출되지 않음 |
| `BranchManager.current()` | 런타임 중 현재 브랜치 반환 | 재시작 시 BranchManager 재구성 방법 미정의 |
| `WorldStore.restore(worldId)` | 특정 World의 Snapshot 복원 | **어떤 worldId를 복원해야 하는지** 결정하는 계약 없음 |

결과적으로 각 앱이 ad-hoc 복원 로직을 구현하게 되며, 이는 ADR-003의 "World MUST expose read-only query APIs only; no raw store access leaks upward" 원칙에 위배된다.

### 2.2 Why Framework-Level Contract

1. **거버넌스 문제:** "head"의 정의가 앱마다 달라지면 안 됨. 기존 시스템 전체(App SPEC, ActiveHorizon, BranchManager)가 이미 head를 branch pointer로 사용 중.
2. **캡슐화 원칙:** App이 lineage DAG를 직접 탐색하여 head를 찾는 것은 World의 내부 구조 노출.
3. **누적형 상태의 UX 신뢰성:** history/patterns 같은 축적형 도메인에서 "마지막 상태 복원"은 핵심 UX 요구사항.

### 2.3 Head vs Leaf — Terminology Clarification

기존 Manifesto 문서에서 "head"는 일관되게 **branch pointer** 의미로 사용된다:

| 기존 사용처 | "head"의 의미 | 참조 |
|-------------|--------------|------|
| `Branch.head: WorldId` | 브랜치가 가리키는 현재 World | App SPEC §5.9 |
| `BranchManager.updateHead()` | 브랜치 포인터 전진 | App SPEC §12.2 |
| BRANCH-5 | completed 실행 후 head 전진 | App SPEC §12.3 |
| BRANCH-7 | failed World로 head 전진 금지 | App SPEC §12.3 |
| `ActiveHorizon.heads` | 현재 branch head들의 집합 | FDR-APP-INTEGRATION-001 §3.8 |
| `getCurrentHead(): WorldId` | 현재 브랜치의 head | App SPEC §6.2 |

**따라서 이 SPEC에서 Head는 "하나 이상의 Branch가 `head`로 참조하는 World"로 정의한다.**

Lineage DAG의 leaf node(자식 없는 노드)는 별도 개념이며, Head와 반드시 일치하지 않는다:

```
W1 (completed) → W2 (failed)

Branch head: W1   ← BRANCH-7로 advance 안 함
Lineage leaf: W2  ← child 없는 노드

Head ≠ Leaf
```

---

## 3. New Section: §9.7 Head (v2.0.5)

### 3.1 Head Definition

**Definition:** A **Head** is a World that is referenced as `head` by one or more Branches.

```typescript
type WorldHead = {
  readonly worldId: WorldId;
  readonly branchId: BranchId;
  readonly branchName: string;
  /** Timestamp of the head World's creation (NOT the Branch's creation time). */
  readonly createdAt: number;
  /** Schema hash of the Branch (NOT the head World's original schema). Used for resume migration checks. */
  readonly schemaHash: string;
};
```

**Properties:**

| Property | Description |
|----------|-------------|
| Pointer semantics | Head is where a Branch currently points, not a graph property |
| Always completed | BRANCH-7 guarantees branch heads are always completed Worlds |
| One head per branch | Each Branch has exactly one head (App SPEC §5.9) |
| Shared World possible | Multiple Branches may point to the same WorldId (fork without advance) |
| Genesis is initial head | The default 'main' branch starts with genesis as its head |

### 3.2 Head Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| HEAD-1 | MUST | A Head is defined as a World referenced by `Branch.head` |
| HEAD-2 | MUST | `getHeads()` MUST return one entry per Branch |
| HEAD-3 | MUST | Head Worlds MUST have outcome `completed` (follows from BRANCH-7) |
| HEAD-4 | MUST | `getLatestHead()` MUST return the Head with the most recent `createdAt` among all Heads |
| HEAD-5 | MUST | When multiple Heads share the same `createdAt`, tie-break by `worldId` ascending, then `branchId` ascending |
| HEAD-6 | MUST | Head query results MUST be consistent with current branch state |
| HEAD-7 | MUST | `WorldHead.createdAt` MUST be the head World's creation timestamp, NOT the Branch's creation timestamp |
| HEAD-8 | MUST | `WorldHead.schemaHash` MUST be the Branch's current schemaHash (for schema-changing fork, branch schemaHash may differ from head World's original schema) |

### 3.3 Why Not Leaf?

Defining Head as "lineage leaf (no children)" causes two critical conflicts:

**Conflict A — Failed World becomes the only "head":**

```
W1 (completed) → W2 (failed)

Leaf definition: Only W2 is a leaf (W1 has child W2)
Branch pointer:  W1 is the head (BRANCH-7: head doesn't advance on failure)

Resume from leaf: Gets failed state → UX broken
Resume from pointer: Gets last good state → Correct
```

**Conflict B — Fork head disappears from "heads" set:**

```
main:       W1 → W2 (completed)
experiment: → W1 (fork point, no action yet)

Leaf definition: Only W2 is a leaf (W1 has child W2)
Branch pointers: main→W2, experiment→W1

getHeads() with leaf: Returns [W2] — experiment's head (W1) is missing
getHeads() with pointer: Returns [W2, W1] — both branches represented
```

Both conflicts break the Active Horizon invariant (STORE-BASE-1) which depends on heads for preservation scope.

---

## 4. Head Query API

### 4.1 World Read-Only Query API Extension

Add to World's public query interface (ref: ADR-003 §5):

```typescript
// Existing (ADR-003)
world.getSnapshot(worldId: WorldId): Promise<Snapshot>;
world.getWorld(worldId: WorldId): Promise<World>;
world.getLineage(): Promise<WorldLineage>;
world.getProposal(proposalId: ProposalId): Promise<Proposal>;

// Added (v2.0.5)
world.getHeads(): Promise<WorldHead[]>;
world.getLatestHead(): Promise<WorldHead | null>;
```

### 4.2 API Semantics

#### `getHeads(): Promise<WorldHead[]>`

Returns all current Heads (one per Branch), ordered by `createdAt` descending, tie-broken by `worldId` ascending, then `branchId` ascending.

```typescript
// Example: two branches
//   main:       genesis → W1 → W2 (completed)  ← main.head = W2
//   experiment: genesis → W1                    ← experiment.head = W1
//
// getHeads() returns:
// [
//   { worldId: 'W2', branchId: 'main', branchName: 'main', createdAt: T2, schemaHash: '...' },
//   { worldId: 'W1', branchId: 'experiment', branchName: 'experiment', createdAt: T1, schemaHash: '...' },
// ]
```

**Note:** If multiple Branches point to the same WorldId, each Branch produces a separate entry. This ensures every Branch is represented in the result.

```typescript
// Example: fork without advance
//   main:    genesis → W1  ← main.head = W1
//   fork-a:  genesis → W1  ← fork-a.head = W1 (same World)
//
// getHeads() returns TWO entries (one per branch), both with worldId='W1'
```

#### `getLatestHead(): Promise<WorldHead | null>`

Returns the Head with the most recent `createdAt`. Tie-broken by `worldId` ascending, then `branchId` ascending. Returns null only if no Branches exist (corrupted/empty state).

```typescript
const latest = await world.getLatestHead();
if (latest) {
  const snapshot = await world.getSnapshot(latest.worldId);
  // Resume from this snapshot
}
```

Since BRANCH-7 guarantees all branch heads are completed, **no completed/failed preference logic is needed**. The latest Head is always a completed World.

### 4.3 Relationship to Existing APIs

| API | Scope | Returns | Consumer |
|-----|-------|---------|----------|
| `WorldStore.getHeads()` | Internal | `Set<WorldId>` (bare IDs) | Maintenance cycle |
| `World.getHeads()` | Public | `WorldHead[]` (enriched, ordered) | App, Extension, Projection |
| `App.getCurrentHead()` | Public | `WorldId` (current branch only) | Quick access to active head |
| `App.getHeads()` | Public | `WorldHead[]` (delegates to World) | Resume, branch overview |

**`getCurrentHead()` vs `getLatestHead()`:**

| | `getCurrentHead()` | `getLatestHead()` |
|---|---|---|
| Scope | Current active branch only | All branches |
| Use case | Runtime state access | UI ("most recent branch"), alternative resume |
| Return | `WorldId` (sync) | `Promise<WorldHead \| null>` (async) |
| Branch context | Implicit (active branch) | Explicit (`branchId` in result) |
| Resume role | **Default** (via persisted active branch) | **Optional** (alternative strategy) |

---

## 5. New Section: §9.8 Resume Semantics (v2.0.5)

Resume is the process of reconstructing App runtime state from persisted World lineage after a restart.

**World's responsibility:** Provide query primitives (`getHeads`, `getLatestHead`, `getSnapshot`).

**App's responsibility:** Use World's queries to determine which Snapshot to restore and initialize runtime.

```
Restart Flow:

  App.ready()
    │
    ├─ World initialized (WorldStore loaded, branch state restored)
    │
    ├─ activeBranch = persisted activeBranchId (BRANCH-PERSIST-3)
    │
    ├─ head = activeBranch.head
    │
    ├─ snapshot = await world.getSnapshot(head)
    │    → Initialize runtime with snapshot on activeBranch
    │
    └─ if no persisted branch state (first launch):
         → Initialize with genesis snapshot on 'main' branch
```

**Note:** `getLatestHead()` is a query primitive for external consumers (e.g., "show most recently updated branch in UI"), NOT the default resume policy. Default resume restores the **persisted active branch**, preserving the user's branch context across restarts.

### 5.1 Resume Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| RESUME-1 | MUST | World MUST support `getLatestHead()` query after initialization |
| RESUME-2 | MUST | Returned Head's Snapshot MUST be restorable via `getSnapshot()` |
| RESUME-3 | MUST | Resume MUST NOT create new Worlds or Proposals (read-only operation) |
| RESUME-4 | SHOULD | App SHOULD resume from persisted active branch's head as default strategy |
| RESUME-5 | MAY | App MAY implement alternative resume strategies (e.g., `getLatestHead()` for "most recent across all branches") |
| RESUME-6 | MUST | If active branch's schemaHash differs from current App schema, App MUST handle schema migration or reject resume |

### 5.2 Schema Migration on Resume

```typescript
const activeBranch = persistedState.activeBranch;

if (activeBranch.schemaHash !== currentSchema.hash) {
  // Option A: Schema-changing fork
  await app.fork({ domain: currentSchema });

  // Option B: Reject and start fresh
  // (App-specific decision)
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| RESUME-SCHEMA-1 | MUST | App MUST detect schemaHash mismatch on resume |
| RESUME-SCHEMA-2 | MUST NOT | App MUST NOT silently ignore schema mismatch |
| RESUME-SCHEMA-3 | MAY | App MAY use schema-changing fork to migrate |

---

## 6. New Section: §9.9 Branch Persistence (v2.0.5)

Branch state (name, head pointer, schemaHash) must survive restart for BranchManager reconstruction.

```typescript
type PersistedBranchState = {
  readonly branches: ReadonlyArray<{
    readonly id: BranchId;
    readonly name: string;
    readonly head: WorldId;
    readonly schemaHash: SchemaHash;
    readonly createdAt: number;
    readonly parentBranch?: BranchId;
  }>;
  readonly activeBranchId: BranchId;
};
```

### 6.1 Branch Persistence Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| BRANCH-PERSIST-1 | MUST | WorldStore MUST persist branch state sufficient to reconstruct BranchManager |
| BRANCH-PERSIST-2 | MUST | Persisted branch head MUST reference a valid, restorable WorldId |
| BRANCH-PERSIST-3 | MUST | Active branch ID MUST be persisted |
| BRANCH-PERSIST-4 | SHOULD | Branch state update SHOULD be atomic with World creation (crash-consistency) |
| BRANCH-PERSIST-5 | SHOULD | Branch state SHOULD be stored alongside WorldStore index (co-located for atomic update) |

### 6.2 Crash Recovery

If branch state is lost or corrupted (e.g., crash between World creation and branch update):

| Rule ID | Level | Description |
|---------|-------|-------------|
| BRANCH-RECOVER-1 | SHOULD | WorldStore SHOULD detect branch state inconsistency on load |
| BRANCH-RECOVER-2 | MAY | WorldStore MAY reconstruct branch state from lineage DAG as fallback (walk from genesis, identify leaf completed Worlds as candidate heads) |
| BRANCH-RECOVER-3 | MUST | If reconstruction is impossible, WorldStore MUST report error rather than silently use stale state |

**Inconsistency detection (BRANCH-RECOVER-1 guidance):**

A branch state is inconsistent if any of the following hold:
- A branch's `head` references a WorldId that does not exist in the WorldStore
- A completed World exists in the lineage as a child of a branch's current head, but the branch was not updated to point to it (crash window between World persist and branch head advance)
- The `activeBranchId` references a BranchId not present in the branches list

```typescript
// Crash recovery fallback: reconstruct from lineage
function reconstructBranchState(lineage: WorldLineage): PersistedBranchState {
  // 1. Find all completed leaf Worlds (no completed children)
  // 2. Create a 'main' branch pointing to the most recent one
  // 3. Log warning: "Branch state reconstructed from lineage"
  // NOTE: Branch names and multi-branch structure are lost
  //       This is a best-effort recovery, not lossless
}
```

---

## 7. Section §10.3: World Invariant Additions (v2.0.5)

Add to §10.3 World Invariants:

```diff
 | INV-W15 | Error state determination uses `lastError`, not `errors.length` |
+| INV-W16 | A Head is a World referenced by `Branch.head` (pointer semantics, not graph leaf) |
+| INV-W17 | All Heads have outcome `completed` (follows from BRANCH-7) |
+| INV-W18 | `getLatestHead()` returns a World whose Snapshot is restorable |
+| INV-W19 | Resume is a read-only operation; it MUST NOT mutate lineage |
```

---

## 8. Cross-Reference Updates

| Document | Section | Change |
|----------|---------|--------|
| ADR-003 | §5 Read-Only Query API | Add `getHeads()`, `getLatestHead()` to allowed queries |
| **App SPEC** | **§6.2 App Public API** | **Add `getHeads()`, `getLatestHead()` delegation** |
| **App SPEC** | **§6.3 API Rules** | **Add QUERY-HEAD-1~3** |
| App SPEC | §12 Branch Management | Reference BRANCH-PERSIST-* rules |
| FDR-APP-INTEGRATION-001 | §3.8 | Clarify: `WorldStore.getHeads()` returns branch head IDs (same pointer semantics) |

---

## 9. Test Cases

### 9.1 Head Query — Pointer Semantics

```typescript
describe('World SPEC v2.0.5: Head Query (branch pointer)', () => {
  it('genesis is the main branch head initially', async () => {
    const world = await createWorldWithGenesis(schema);
    const heads = await world.getHeads();

    expect(heads).toHaveLength(1);
    expect(heads[0].worldId).toBe(genesisWorldId);
    expect(heads[0].branchId).toBe('main');
  });

  it('head advances on completed execution', async () => {
    const world = await createWorldWithGenesis(schema);
    await executeAction(world, 'some_action'); // completed → W1

    const heads = await world.getHeads();
    expect(heads).toHaveLength(1);
    expect(heads[0].worldId).not.toBe(genesisWorldId); // W1
  });

  it('head does NOT advance on failed execution (BRANCH-7)', async () => {
    const world = await createWorldWithGenesis(schema);
    const w1 = await executeAction(world, 'good_action');   // completed → W1
    const w1Head = (await world.getHeads())[0].worldId;

    await executeFailingAction(world, 'bad_action');          // failed → W2

    const heads = await world.getHeads();
    expect(heads).toHaveLength(1);
    expect(heads[0].worldId).toBe(w1Head); // Still W1, not W2
  });

  it('fork creates a second head', async () => {
    const world = await createWorldWithGenesis(schema);
    await executeAction(world, 'action_a'); // main → W1
    await app.fork({ from: genesisWorldId, name: 'experiment' });

    const heads = await world.getHeads();
    expect(heads).toHaveLength(2);

    const branchNames = heads.map(h => h.branchName);
    expect(branchNames).toContain('main');
    expect(branchNames).toContain('experiment');
  });

  it('fork without advance — same WorldId, different branches', async () => {
    const world = await createWorldWithGenesis(schema);
    const w1 = await executeAction(world, 'action_a'); // main → W1
    await app.fork({ from: w1.worldId, name: 'fork-a' });

    const heads = await world.getHeads();
    expect(heads).toHaveLength(2);

    expect(heads[0].worldId).toBe(heads[1].worldId);
    expect(heads[0].branchId).not.toBe(heads[1].branchId);
  });

  it('getLatestHead returns most recent head', async () => {
    const world = await createWorldWithGenesis(schema);
    await executeAction(world, 'action_a'); // main → W1 at T1
    await app.fork({ from: genesisWorldId, name: 'experiment' });

    const latest = await world.getLatestHead();
    expect(latest?.branchId).toBe('main'); // W1 is more recent
  });

  it('getHeads ordering: createdAt desc, worldId asc, branchId asc tiebreak', async () => {
    const heads = await world.getHeads();

    for (let i = 1; i < heads.length; i++) {
      const prev = heads[i - 1];
      const curr = heads[i];

      if (prev.createdAt !== curr.createdAt) {
        expect(prev.createdAt).toBeGreaterThan(curr.createdAt);
      } else if (prev.worldId !== curr.worldId) {
        expect(prev.worldId < curr.worldId).toBe(true);
      } else {
        expect(prev.branchId < curr.branchId).toBe(true);
      }
    }
  });

  it('all heads are completed (INV-W17)', async () => {
    await executeAction(world, 'good_action');
    await executeFailingAction(world, 'bad_action');
    await executeAction(world, 'another_good');

    const heads = await world.getHeads();
    for (const head of heads) {
      const w = await world.getWorld(head.worldId);
      // All heads must be from completed executions
    }
  });

  it('getLatestHead returns null for empty state', async () => {
    const world = await createEmptyWorld();
    const latest = await world.getLatestHead();
    expect(latest).toBeNull();
  });
});
```

### 9.2 Resume

```typescript
describe('World SPEC v2.0.5: Resume', () => {
  it('resumes from persisted active branch head on restart', async () => {
    const app1 = await createApp({ schema, effects, world: world1 });
    await app1.act('add_item', { title: 'test' });
    const stateBeforeRestart = app1.getState();
    const branchBefore = app1.currentBranch();
    await app1.dispose();

    const app2 = await createApp({ schema, effects, world: world2 /* same store */ });

    expect(app2.currentBranch().id).toBe(branchBefore.id);
    expect(app2.getState()).toEqual(stateBeforeRestart);
  });

  it('resume survives failed actions (head stays at last completed)', async () => {
    const app1 = await createApp(config);
    await app1.act('good_action');
    const goodState = app1.getState();

    try { await app1.act('bad_action'); } catch {}
    await app1.dispose();

    const app2 = await createApp(config);
    expect(app2.getState()).toEqual(goodState);
  });

  it('resume preserves active branch even if another branch is more recent', async () => {
    const app1 = await createApp(config);
    await app1.act('action_on_main');
    await app1.fork({ name: 'experiment', switchTo: true });
    expect(app1.currentBranch().name).toBe('experiment');
    await app1.dispose();

    const app2 = await createApp(config);
    expect(app2.currentBranch().name).toBe('experiment');
  });

  it('resume is read-only (no new Worlds created)', async () => {
    const lineageBefore = await world.getLineage();

    const branch = app.currentBranch();
    const snapshot = await world.getSnapshot(branch.head);

    const lineageAfter = await world.getLineage();
    expect(lineageAfter.worlds.size).toBe(lineageBefore.worlds.size);
  });

  it('detects schema mismatch on resume', async () => {
    const branch = app.currentBranch();
    const newSchema = await compileMelDomain(updatedMelText);

    expect(branch.schemaHash).not.toBe(newSchema.hash);
  });
});
```

### 9.3 Branch Persistence

```typescript
describe('World SPEC v2.0.5: Branch Persistence', () => {
  it('branch state survives restart', async () => {
    const app1 = await createApp(config);
    await app1.act('action_a');
    const branchBefore = app1.currentBranch();
    await app1.dispose();

    const app2 = await createApp(config);
    const branchAfter = app2.currentBranch();

    expect(branchAfter.id).toBe(branchBefore.id);
    expect(branchAfter.head).toBe(branchBefore.head);
  });

  it('multiple branches survive restart', async () => {
    const app1 = await createApp(config);
    await app1.act('action_a');
    await app1.fork({ name: 'experiment' });
    const branchesBefore = app1.listBranches();
    await app1.dispose();

    const app2 = await createApp(config);
    const branchesAfter = app2.listBranches();

    expect(branchesAfter.length).toBe(branchesBefore.length);
    for (const before of branchesBefore) {
      const after = branchesAfter.find(b => b.id === before.id);
      expect(after).toBeDefined();
      expect(after!.head).toBe(before.head);
    }
  });

  it('active branch ID survives restart', async () => {
    const app1 = await createApp(config);
    await app1.fork({ name: 'experiment', switchTo: true });
    expect(app1.currentBranch().name).toBe('experiment');
    await app1.dispose();

    const app2 = await createApp(config);
    expect(app2.currentBranch().name).toBe('experiment');
  });

  it('all branch heads reference restorable Worlds', async () => {
    const heads = await app.getHeads();

    for (const head of heads) {
      const snapshot = await app.getSnapshot(head.worldId);
      expect(snapshot).toBeDefined();
    }
  });
});
```

---

## 10. Migration Guide

### For World Implementers

1. Implement `getHeads()` — iterate branches, enrich with World metadata, sort (createdAt desc → worldId asc → branchId asc)
2. Implement `getLatestHead()` — delegate to `getHeads()[0]`
3. Add branch state to WorldStore persistence (§9.9)
4. Implement crash recovery (BRANCH-RECOVER-1~3) — at minimum, detect and report

### For App Implementers

1. Add `getHeads()` and `getLatestHead()` to App public interface (delegates to World)
2. Default resume: restore persisted active branch's head snapshot
3. `getLatestHead()` is available for alternative resume strategies or UI
4. Handle first-launch case (no persisted branch state — use genesis on 'main')
5. Handle schemaHash mismatch (RESUME-SCHEMA-1)

### For Existing Apps

No breaking changes. Existing apps continue to work. Resume contract is additive — apps that don't use it are unaffected.

---

*End of World SPEC v2.0.5 Patch Document (rev.3-final)*
