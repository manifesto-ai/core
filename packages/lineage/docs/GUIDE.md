# Lineage Guide

> Practical guide for the current ADR-017 lineage runtime.

> **Current Contract Note:** This guide follows the current v5 lineage decorator model. The canonical app-facing path is `withLineage(createManifesto(...), config).activate()`, with `action.<name>.submit(...)` as the write verb.

## 1. Compose Lineage Before Activation

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

const manifesto = createManifesto<TodoDomain>(TodoMel, effects);

const lineage = withLineage(manifesto, {
  store: createInMemoryLineageStore(),
}).activate();
```

Lineage does not decorate a running instance. It decorates the app definition
and participates in the activation pipeline.

## 2. Submit Means Execute And Seal

```ts
await lineage.action.addTodo.submit("Review docs");
```

On a lineage runtime, `submit()` means:

1. execute the intent
2. prepare and commit a lineage seal
3. only then publish the new visible snapshot

If seal commit fails, the Promise rejects and the new snapshot does not become visible.

## 3. Use The Additive Report Companion When Tooling Needs More Context

```ts
const result = await lineage.with({ report: "full" }).action.addTodo.submit("Review docs");
```

Execution view report settings keep the same seal/publication law and package additive result detail as data.

- successful lineage submissions include `outcome`, `world`, `before`, and `after`
- rejected submissions include the first failing admission layer
- `report: "none"` suppresses the additive report payload

Failed lineage outcomes are derived from the sealed terminal Snapshot's
`system.lastError` and pending requirements. Canonical
`namespaces.host.lastError` is Host-owned diagnostic state and is not, by
itself, the lineage terminal outcome.

## 4. Read Heads, Branches, Worlds, And Lineage

```ts
const latestHead = await lineage.getLatestHead();
const branches = await lineage.getBranches();
const activeBranch = await lineage.getActiveBranch();
const history = await lineage.getLineage();

if (latestHead) {
  const record = await lineage.getWorld(latestHead.worldId);
  const sealedSnapshot = await lineage.getWorldSnapshot(latestHead.worldId);
}
```

These APIs project the stored history state through the activated runtime.
`snapshot()` remains the projected runtime read. `inspect.canonicalSnapshot()`
reads the current visible full internal snapshot. `getWorldSnapshot(worldId)`
reads the stored full snapshot for a committed history record.
`restore(worldId)` remains the normalized runtime resume path.
The activated lineage runtime also keeps the inherited SDK legality queries: `action.x.available()` and `action.x.check(...)`.

## 5. Restore A Sealed Lineage Record

```ts
const head = await lineage.getLatestHead();
if (head) {
  await lineage.restore(head.worldId);
}

console.log(lineage.snapshot().state);
```

`restore()` updates the visible runtime snapshot and resets Host execution state to the restored lineage snapshot.

## 6. Branch Deliberately

```ts
const featureBranchId = await lineage.createBranch("feature-a");
await lineage.switchActiveBranch(featureBranchId);
```

Switching branches also restores that branch head into the visible runtime state.

## 7. Low-Level Lineage Still Exists

Use `@manifesto-ai/lineage/provider` when you need `LineageService`, `LineageStore`, prepared commits, or persistence tooling without the activated runtime wrapper.

Low-level replay/audit tools read the recorded `computeEnvelope` from seal
attempt metadata. Normal application code does not pass this envelope manually;
the lineage runtime captures it from the submitted intent and ADR-027 context.

## 8. Related Docs

- [Lineage README](../README.md)
- [Lineage Specification](lineage-SPEC.md)
- [Version Index](VERSION-INDEX.md)
- [SDK API](../../../docs/api/sdk.md)
- [Lineage API](../../../docs/api/lineage.md)
