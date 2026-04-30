# @manifesto-ai/lineage

> Continuity package for the ADR-026 v5 lineage runtime.

## Overview

`@manifesto-ai/lineage` adds time, sealing, history, and restore to a composable manifesto.

> **Current Contract Note:** This page describes the Lineage v5 action-candidate surface. The package contract is [packages/lineage/docs/lineage-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC.md).

Use this package when you want:

- `withLineage(createManifesto(...), config).activate()`
- seal-aware `actions.<name>.submit(...args)`
- lineage `LineageSubmissionResult` values with `world` and `report`
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
- lineage-aware `actions.<name>.submit(...args)` that seals before publication
- lineage-owned `LineageSubmissionResult` reports
- inherited v5 action-candidate reads such as `available()`, `check()`, and `preview()`
- `restore`, `getWorld`, `getWorldSnapshot`, `getLineage`, `getLatestHead`, `getHeads`, `getBranches`, `getActiveBranch`, `switchActiveBranch`, `createBranch`
- continuity ownership plus the provider surface

Those inherited action-candidate legality queries keep the base SDK meaning:

- availability is checked before dispatchability
- `check()` returns the first failing layer, so an unavailable action yields an availability failure and does not evaluate `dispatchable`

## Runtime Meaning

`actions.<name>.submit(...args)` on a lineage runtime is not the base SDK write path.

It means:

1. admit the typed action candidate
2. execute the intent through Host/Core
3. seal the resulting terminal snapshot into lineage
4. publish only the snapshot that legitimately becomes the new visible head

If seal commit fails, submit rejects with `SubmissionFailedError` and the new snapshot does not become visible.

Settled lineage results include `before`, `after`, `world`, `outcome`, and an optional `report`. Failed domain outcomes can still settle and seal a failed world; settlement failures reject instead of fabricating a lineage result.

## Relationship to SDK

```text
@manifesto-ai/sdk
  -> createManifesto(...)
  -> withLineage(...)
  -> activate()
```

SDK owns the base activation boundary. Lineage owns continuity once that boundary is decorated.

On a lineage runtime:

- `snapshot()` is the projected runtime read
- `inspect.canonicalSnapshot()` is the current visible canonical substrate
- `getWorldSnapshot(worldId)` is the stored sealed canonical snapshot
- base dispatch verbs and historical lineage commit verbs are no longer part of the canonical runtime surface

## Lineage-Backed Inspection

Use `getWorldSnapshot(worldId)` when a tool needs to inspect a stored world without changing the live visible runtime. Pair that stored canonical snapshot with `@manifesto-ai/sdk/extensions` for projection, explanation, and read-only simulation.

Use `restore(worldId)` only when the product is intentionally resuming the visible runtime from that world.

The full Studio/tooling recipe is in [Runtime Tooling Surface](/guides/runtime-tooling-surface).

## Related Docs

- [SDK API](./sdk.md)
- [Governance API](./governance.md)
- [Runtime Tooling Surface](/guides/runtime-tooling-surface)
- [Advanced Runtime Assembly](/guides/governed-composition)
