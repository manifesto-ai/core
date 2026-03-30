# Lineage Guide

> Practical guide for using `@manifesto-ai/lineage` directly.

> **Current Contract Note:** This guide describes the current v2.0.0 lineage surface.

## 1. Assemble Lineage

```typescript
import {
  createInMemoryLineageStore,
  createLineageService,
} from "@manifesto-ai/lineage";

const store = createInMemoryLineageStore();
const lineage = createLineageService(store);
```

`LineageService` owns identity, branch, and seal operations. `LineageStore` owns persistence.

---

## 2. Compute Identity

Assume `terminalSnapshot` is the current `Snapshot` value from your runtime.

```typescript
import { computeSnapshotHash, computeWorldId } from "@manifesto-ai/lineage";

const snapshotHash = computeSnapshotHash({
  schemaHash: "todo-v1",
  snapshot: terminalSnapshot,
});
const worldId = computeWorldId({
  schemaHash: "todo-v1",
  snapshotHash,
});
```

Identity is deterministic. The same inputs produce the same hash and world id.

---

## 3. Prepare Genesis And Next Seals

```typescript
const genesis = lineage.prepareSealGenesis({
  schemaHash: "todo-v1",
  terminalSnapshot,
  createdAt: Date.now(),
});

lineage.commitPrepared(genesis);

const branch = lineage.getActiveBranch();

const next = lineage.prepareSealNext({
  baseWorldId: genesis.worldId,
  branchId: branch.id,
  schemaHash: "todo-v1",
  terminalSnapshot: nextSnapshot,
  createdAt: Date.now(),
});

lineage.commitPrepared(next);
```

Genesis and branch advancement stay explicit. Lineage does not evaluate governance or authority.

---

## 4. Switch Branches And Inspect State

```typescript
const activeBranch = lineage.getActiveBranch();
const featureBranchId = lineage.createBranch("feature-a", activeBranch.head);
lineage.switchActiveBranch(featureBranchId);

const branch = lineage.getActiveBranch();
const heads = lineage.getHeads();
const restored = lineage.restore(branch.head);
```

Branch switching should read like a deliberate change in continuity, not an invisible side effect.

---

## 5. Replay And Restore

Use lineage directly when you need deterministic history, replay, or branch inspection without the full governed facade.

Typical queries are:

- `getActiveBranch()` for the current branch
- `getHeads()` for current heads
- `restore(worldId)` for a world-based restore
- `commitPrepared()` for writing a prepared seal

---

## 6. Related Docs

- [Lineage README](../README.md)
- [Lineage Specification](lineage-SPEC-2.0.0v.md)
- [Lineage Version Index](VERSION-INDEX.md)
- [World](../../../docs/concepts/world)
- [Governed Composition](../../../docs/tutorial/05-governed-composition)
