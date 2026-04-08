# Lineage Guide

> Practical guide for the current ADR-017 lineage runtime.

> **Current Contract Note:** This guide follows the current v3 lineage decorator model. The canonical app-facing path is `withLineage(createManifesto(...), config).activate()`.

## 1. Compose Lineage Before Activation

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";

const manifesto = createManifesto<CounterDomain>(schema, effects);

const lineage = withLineage(manifesto, {
  store: createInMemoryLineageStore(),
}).activate();
```

Lineage does not decorate a running instance. It decorates the composable manifesto and participates in the activation pipeline.

## 2. Commit Means Execute And Seal

```ts
await lineage.commitAsync(
  lineage.createIntent(lineage.MEL.actions.increment),
);
```

On a lineage runtime, `commitAsync()` means:

1. execute the intent
2. prepare and commit a lineage seal
3. only then publish the new visible snapshot

If seal commit fails, the Promise rejects and the new snapshot does not become visible.

## 3. Read Heads, Branches, Worlds, And Lineage

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

These APIs project the backing continuity truth through the activated runtime.
`getSnapshot()` remains the projected runtime read. `getCanonicalSnapshot()` reads the current visible canonical substrate. `getWorldSnapshot(worldId)` reads the stored sealed canonical snapshot substrate. `restore(worldId)` remains the normalized runtime resume path.
The activated lineage runtime also keeps the inherited SDK legality queries: `getAvailableActions()`, `isActionAvailable()`, `isIntentDispatchable()`, and `getIntentBlockers()`.
Those inherited legality queries keep the same ordering as the base SDK: availability short-circuits dispatchability, and `getIntentBlockers()` returns the first failing layer instead of stacking coarse and fine blockers together.

## 4. Restore A Sealed World

```ts
const head = await lineage.getLatestHead();
if (head) {
  await lineage.restore(head.worldId);
}

console.log(lineage.getSnapshot().data);
```

`restore()` updates the visible runtime snapshot and resets Host execution state to the restored lineage snapshot.

## 5. Branch Deliberately

```ts
const featureBranchId = await lineage.createBranch("feature-a");
await lineage.switchActiveBranch(featureBranchId);
```

Switching branches also restores that branch head into the visible runtime state.

## 6. Low-Level Lineage Still Exists

Use `@manifesto-ai/lineage/provider` when you need `LineageService`, `LineageStore`, prepared commits, or persistence tooling without the activated runtime wrapper.

## 7. Related Docs

- [Lineage README](../README.md)
- [Lineage Specification](lineage-SPEC.md)
- [Version Index](VERSION-INDEX.md)
- [SDK API](../../../docs/api/sdk.md)
- [Lineage API](../../../docs/api/lineage.md)
