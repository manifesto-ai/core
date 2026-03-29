# @manifesto-ai/world

> Exact facade for governed Manifesto composition.

## Overview

Top-level `@manifesto-ai/world` is the canonical governed composition package.

It exposes:

- lineage types and services
- governance types and services
- facade-owned store and coordinator types
- `createWorld()`
- `createInMemoryWorldStore()`
- intent-instance helpers

## Canonical Composition

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryWorldStore,
  createLineageService,
  createWorld,
} from "@manifesto-ai/world";

const store = createInMemoryWorldStore();
const lineage = createLineageService(store);
const governance = createGovernanceService(store, {
  lineageService: lineage,
});
const world = createWorld({
  store,
  lineage,
  governance,
  eventDispatcher: createGovernanceEventDispatcher({ service: governance }),
});
```

## Package Layers Inside the Facade

`@manifesto-ai/world` combines three categories of exports:

1. Re-exported lineage APIs from `@manifesto-ai/lineage`
2. Re-exported governance APIs from `@manifesto-ai/governance`
3. Facade-owned runtime assembly APIs

## Facade-Owned Types

```typescript
type CommitCapableWorldStore
type WriteSet
type GovernanceEventDispatcher
type WorldCoordinator
type WorldConfig
type WorldInstance
type CoordinatorSealNextParams
type CoordinatorSealGenesisParams
type SealResult
```

## Split-Native Re-exports

Top-level `@manifesto-ai/world` also re-exports:

- governance proposal and authority types
- lineage world/head/branch types
- `createIntentInstance()`, `createIntentInstanceSync()`, `computeIntentKey()`
- `createGovernanceService()`, `createGovernanceEventDispatcher()`
- `createLineageService()`

Use top-level `@manifesto-ai/world` when you want the full governed runtime surface from one package. Use `@manifesto-ai/governance` or `@manifesto-ai/lineage` directly when you want only one protocol layer.

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/core](./core.md) | Pure computation |
| [@manifesto-ai/host](./host.md) | Effect execution |
| [@manifesto-ai/sdk](./sdk.md) | Thin public SDK that re-exports selected world facade types and factories |
| [@manifesto-ai/governance](./governance.md) | Direct governance protocol API |
| [@manifesto-ai/lineage](./lineage.md) | Direct lineage protocol API |

## Learn The Runtime

- [Governed Composition](/tutorial/05-governed-composition)
- [Governed Sealing and History](/tutorial/06-governed-sealing-and-history)
- [World Concept](/concepts/world)
