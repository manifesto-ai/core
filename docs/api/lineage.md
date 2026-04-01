# @manifesto-ai/lineage

> Continuity package for the ADR-017 decorator runtime.

## Overview

`@manifesto-ai/lineage` adds time, sealing, history, and restore to a composable manifesto.

> **Current Contract Note:** This page describes the current Lineage v3.0.0 surface. The truthful package contract is [packages/lineage/docs/lineage-SPEC-v3.0.0-draft.md](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC-v3.0.0-draft.md).

Use this package when you want:

- `withLineage(createManifesto(...), config).activate()`
- seal-aware `dispatchAsync`
- head, branch, world, and restore APIs on the activated runtime
- direct access to `LineageService` / `LineageStore` for low-level persistence and tooling

## Canonical Runtime Surface

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";

const world = withLineage(
  createManifesto<CounterDomain>(domainSchema, effects),
  { store: createInMemoryLineageStore() },
).activate();
```

## What This Package Owns

- `withLineage()` and `LineageConfig`
- activated `LineageInstance<T>`
- lineage-aware `dispatchAsync` that seals before publication
- `restore`, `getLatestHead`, `getHeads`, `getBranches`, `getActiveBranch`, `switchActiveBranch`, `createBranch`
- `LineageStore`, `LineageService`, hashing, prepared commits, and restore normalization

## Runtime Meaning

`dispatchAsync()` on a lineage runtime is not the base SDK verb anymore.

It means:

1. execute the intent
2. seal the resulting terminal snapshot into lineage
3. publish only the snapshot that legitimately becomes the new visible head

If seal commit fails, the dispatch rejects and the new snapshot does not become visible.

## Relationship to SDK

```text
@manifesto-ai/sdk
  -> createManifesto(...)
  -> withLineage(...)
  -> activate()
```

SDK owns the base activation boundary. Lineage owns continuity once that boundary is decorated.

## Related Docs

- [SDK API](./sdk.md)
- [Governance API](./governance.md)
- [World API](./world.md)
- [Governed Composition Guide](/guides/governed-composition)
