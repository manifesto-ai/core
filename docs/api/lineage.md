# @manifesto-ai/lineage

> History and restore package for the runtime.

## Overview

`@manifesto-ai/lineage` adds time, sealing, history, and restore to a Manifesto
app definition.

> **Current Contract Note:** This page describes the Lineage v5 action handle surface. The package contract is [packages/lineage/docs/lineage-SPEC.md](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC.md).

Use this package when you want:

- `withLineage(createManifesto(...), config).activate()`
- seal-aware `action.<name>.submit(...args)`
- lineage `LineageSubmissionResult` values with `world` and `report`
- head, branch, world, and restore APIs on the activated runtime
- `getWorldSnapshot(worldId)` for stored snapshot inspection by history id
- `getLineage()` for DAG inspection
- direct access to `@manifesto-ai/lineage/provider` for low-level persistence and tooling

## Runtime Surface

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import TodoMel from "./domain/todo.mel";
import type { TodoDomain } from "./domain/todo.domain";

const lineage = withLineage(
  createManifesto<TodoDomain>(TodoMel, effects),
  { store: createInMemoryLineageStore() },
).activate();
```

## What This Package Owns

- `withLineage()` and `LineageConfig`
- activated `LineageInstance<T>`
- lineage-aware `action.<name>.submit(...args)` that seals before publication
- lineage-owned `LineageSubmissionResult` reports
- inherited action handle reads such as `available()`, `check()`, and `preview()`
- `restore`, `getWorld`, `getWorldSnapshot`, `getLineage`, `getLatestHead`, `getHeads`, `getBranches`, `getActiveBranch`, `switchActiveBranch`, `createBranch`
- history ownership plus the provider surface

Those inherited legality queries keep the base SDK meaning:

- availability is checked before dispatchability
- `check()` returns the first failing layer, so an unavailable action yields an availability failure and does not evaluate `dispatchable`

## Runtime Meaning

`action.<name>.submit(...args)` on a lineage runtime is not the base SDK write path.

It means:

1. admit the typed action submission
2. execute the intent through Host/Core
3. seal the resulting terminal snapshot into lineage
4. publish only the snapshot that becomes the new visible head

If seal commit fails, submit rejects with `SubmissionFailedError` and the new snapshot does not become visible.

Settled lineage results include `before`, `after`, `world`, `outcome`, and an optional `report`. Failed domain outcomes can still settle and seal a failed world; settlement failures reject instead of fabricating a lineage result.

## Relationship to SDK

```text
@manifesto-ai/sdk
  -> createManifesto(...)
  -> withLineage(...)
  -> activate()
```

SDK owns the base activation boundary. Lineage owns history once that boundary is decorated.

On a lineage runtime:

- `snapshot()` is the app-facing runtime read
- `inspect.canonicalSnapshot()` is the current visible full internal snapshot
- `getWorldSnapshot(worldId)` is the stored sealed full snapshot
- base dispatch verbs and historical lineage commit verbs are no longer part of the runtime surface

## Lineage-Backed Inspection

Use `getWorldSnapshot(worldId)` when a tool needs to inspect a stored world without changing the live visible runtime. Pair that stored full snapshot with `@manifesto-ai/sdk/extensions` for app-facing projection, explanation, and read-only simulation.

Replay tooling should also read the seal attempt's `computeEnvelope`. The
envelope stores the exact submitted `intent` and full Core `Context` used for
the transition. It is replay/accountability metadata and does not participate
in world identity hashes.

Use `restore(worldId)` only when the product is intentionally resuming the visible runtime from that world.

The full Studio/tooling recipe is in [Runtime Tooling Surface](/guides/runtime-tooling-surface).

## Related Docs

- [SDK API](./sdk.md)
- [Governance API](./governance.md)
- [Runtime Tooling Surface](/guides/runtime-tooling-surface)
- [Advanced Runtime Assembly](/guides/governed-composition)
