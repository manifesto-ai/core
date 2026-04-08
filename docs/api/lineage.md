# @manifesto-ai/lineage

> Continuity package for the ADR-017 decorator runtime.

## Overview

`@manifesto-ai/lineage` adds time, sealing, history, and restore to a composable manifesto.

> **Current Contract Note:** This page describes the current Lineage v3 decorator surface, unchanged through package release v3.5.0. The package contract is [packages/lineage/docs/lineage-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC.md).

Use this package when you want:

- `withLineage(createManifesto(...), config).activate()`
- seal-aware `commitAsync`
- head, branch, world, and restore APIs on the activated runtime
- `getWorldSnapshot(worldId)` for stored sealed canonical snapshot inspection by world id
- `getLineage()` for DAG inspection
- direct access to `@manifesto-ai/lineage/provider` for low-level persistence and tooling

## Canonical Runtime Surface

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";

const lineage = withLineage(
  createManifesto<CounterDomain>(domainSchema, effects),
  { store: createInMemoryLineageStore() },
).activate();
```

## What This Package Owns

- `withLineage()` and `LineageConfig`
- activated `LineageInstance<T>`
- lineage-aware `commitAsync` that seals before publication
- inherited legality queries such as `isActionAvailable()`, `isIntentDispatchable()`, and `getIntentBlockers()`
- `restore`, `getWorld`, `getWorldSnapshot`, `getLineage`, `getLatestHead`, `getHeads`, `getBranches`, `getActiveBranch`, `switchActiveBranch`, `createBranch`
- continuity ownership plus the provider surface

Those inherited legality queries keep the base SDK meaning:

- availability is checked before dispatchability
- `getIntentBlockers()` returns the first failing layer, so an unavailable action yields an `available` blocker and does not evaluate `dispatchable`

## Runtime Meaning

`commitAsync()` on a lineage runtime is not the base SDK verb anymore.

It means:

1. execute the intent
2. seal the resulting terminal snapshot into lineage
3. publish only the snapshot that legitimately becomes the new visible head

If seal commit fails, the commit rejects and the new snapshot does not become visible.

## Relationship to SDK

```text
@manifesto-ai/sdk
  -> createManifesto(...)
  -> withLineage(...)
  -> activate()
```

SDK owns the base activation boundary. Lineage owns continuity once that boundary is decorated.

On a lineage runtime:

- `getSnapshot()` is the projected runtime read
- `getCanonicalSnapshot()` is the current visible canonical substrate
- `getWorldSnapshot(worldId)` is the stored sealed canonical snapshot

## Related Docs

- [SDK API](./sdk.md)
- [Governance API](./governance.md)
- [Advanced Runtime Assembly](/guides/governed-composition)
