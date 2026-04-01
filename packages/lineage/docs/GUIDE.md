# Lineage Guide

> Practical guide for the current ADR-017 lineage runtime.

> **Current Contract Note:** This guide follows the current v3 lineage decorator model. The canonical app-facing path is `withLineage(createManifesto(...), config).activate()`.

## 1. Compose Lineage Before Activation

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";

const manifesto = createManifesto<CounterDomain>(schema, effects);

const world = withLineage(manifesto, {
  store: createInMemoryLineageStore(),
}).activate();
```

Lineage does not decorate a running instance. It decorates the composable manifesto and participates in the activation pipeline.

## 2. Dispatch Means Execute And Seal

```ts
await world.dispatchAsync(
  world.createIntent(world.MEL.actions.increment),
);
```

On a lineage runtime, `dispatchAsync()` means:

1. execute the intent
2. prepare and commit a lineage seal
3. only then publish the new visible snapshot

If seal commit fails, the Promise rejects and the new snapshot does not become visible.

## 3. Read Heads, Branches, And Worlds

```ts
const latestHead = await world.getLatestHead();
const branches = await world.getBranches();
const activeBranch = await world.getActiveBranch();

if (latestHead) {
  const record = await world.getWorld(latestHead.worldId);
}
```

These APIs project the backing `LineageService` through the activated runtime.

## 4. Restore A Sealed World

```ts
const head = await world.getLatestHead();
if (head) {
  await world.restore(head.worldId);
}

console.log(world.getSnapshot().data);
```

`restore()` updates the visible runtime snapshot and resets Host execution state to the restored lineage snapshot.

## 5. Branch Deliberately

```ts
const featureBranchId = await world.createBranch("feature-a");
await world.switchActiveBranch(featureBranchId);
```

Switching branches also restores that branch head into the visible runtime state.

## 6. Low-Level Lineage Still Exists

Use `LineageService` and `LineageStore` directly when you need prepared commits, hashing utilities, or persistence tooling without the activated runtime wrapper.

## 7. Related Docs

- [Lineage README](../README.md)
- [Lineage Specification](lineage-SPEC-v3.0.0-draft.md)
- [Version Index](VERSION-INDEX.md)
- [SDK API](../../../docs/api/sdk.md)
- [Lineage API](../../../docs/api/lineage.md)
