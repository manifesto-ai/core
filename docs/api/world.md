# @manifesto-ai/world

> Canonical governed composition surface for Manifesto.

## Overview

Top-level `@manifesto-ai/world` is the package you use when you want:

- lineage services and query APIs
- governance services and proposal lifecycle APIs
- a facade-owned runtime assembly surface
- explicit governed execution and sealing

It is the full consumer-facing governed package. You do not need to mix direct imports from `@manifesto-ai/governance` and `@manifesto-ai/lineage` unless you intentionally want only one protocol layer. Concrete store adapters are imported from dedicated `@manifesto-ai/world/*` subpaths.

## Main Runtime Factories

- `createWorld()`

## Core Facade-Owned Types

```typescript
type GovernedWorldStore
type WorldStoreTransaction
type GovernanceEventDispatcher
type WorldExecutor
type WorldExecutionOptions
type WorldExecutionResult
type WorldRuntime
type WorldRuntimeCompletion
type WorldCoordinator
type WorldConfig
type WorldInstance
```

## Canonical Node-Local Composition

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createLineageService,
  createWorld,
} from "@manifesto-ai/world";
import { createSqliteWorldStore } from "@manifesto-ai/world/sqlite";

const store = createSqliteWorldStore({ filename: "./.manifesto/world.sqlite" });
const lineage = createLineageService(store);
const governance = createGovernanceService(store, {
  lineageService: lineage,
});

const world = createWorld({
  store,
  lineage,
  governance,
  eventDispatcher: createGovernanceEventDispatcher({ service: governance }),
  executor,
});
```

The consumer-facing happy path is `world.runtime.executeApprovedProposal(...)`, not manual sealing orchestration.

## Store Guidance

- `@manifesto-ai/world/sqlite` for Node-local durable apps
- `@manifesto-ai/world/in-memory` for tests and ephemeral flows
- `@manifesto-ai/world/indexeddb` for browser durable apps

All of them satisfy the same `GovernedWorldStore` contract.

## Split-Native Re-exports

Top-level `@manifesto-ai/world` also re-exports:

- lineage types and services
- governance types and services
- intent-instance helpers such as `createIntentInstance()`

That is why `@manifesto-ai/world` is the canonical governed import path.

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/sdk](./sdk.md) | Direct-dispatch entry point |
| [@manifesto-ai/governance](./governance.md) | Governance protocol by itself |
| [@manifesto-ai/lineage](./lineage.md) | Lineage protocol by itself |

## Learn The Runtime

- [Governed Composition Guide](/guides/governed-composition)
- `packages/world/docs/GUIDE.md`
- [Concepts: World](/concepts/world)
