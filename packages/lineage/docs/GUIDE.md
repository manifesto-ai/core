# Lineage Guide

> Practical guide for using `@manifesto-ai/lineage` directly.

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

## 3. Seal a Genesis World

```typescript
const prepared = lineage.prepareSealGenesis({
  schemaHash: "todo-v1",
  terminalSnapshot,
  createdAt: Date.now(),
});

lineage.commitPrepared(prepared);
```

Genesis and branch advancement stay explicit. Lineage does not evaluate governance or authority.

## 4. Query Branch State

```typescript
const branch = lineage.getActiveBranch();
const heads = lineage.getHeads();
const restored = lineage.restoreSnapshot(branch.id);
```

Use lineage directly when you need deterministic history, replay, or branch inspection without the full governed facade.

## 5. Related Docs

- [Lineage README](../README.md)
- [Lineage Specification](lineage-SPEC-1.0.1v.md)
- [Lineage Version Index](VERSION-INDEX.md)
