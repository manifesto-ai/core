# @manifesto-ai/world

> Exact facade for governed Manifesto composition.

## Overview

Top-level `@manifesto-ai/world` is the canonical governed composition surface.

It exposes:

- lineage types and services
- governance types and services
- facade-owned store and coordinator types
- `createWorld()`
- `createInMemoryWorldStore()`
- intent-instance helpers

`@manifesto-ai/world/facade` currently exists as an exact alias for the same surface.

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

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/core](./core.md) | Pure computation |
| [@manifesto-ai/host](./host.md) | Effect execution |
| [@manifesto-ai/sdk](./sdk.md) | Thin public SDK that re-exports selected world facade types and factories |
