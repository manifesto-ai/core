# @manifesto-ai/world

> Canonical governed composition package for Manifesto.

`@manifesto-ai/world` is the exact facade for governed composition. It combines lineage, governance, and the facade-owned coordinator/runtime types behind a single top-level package.

> **Current Contract Note:** The current public package contract is documented in [docs/world-facade-spec-v2.0.0.md](docs/world-facade-spec-v2.0.0.md). The v1 facade spec remains available as the superseded pre-hard-cut baseline.

## What This Package Owns

- governed composition through `createWorld()`
- adapter subpaths for storage implementations:
  - `@manifesto-ai/world/in-memory`
  - `@manifesto-ai/world/indexeddb`
  - `@manifesto-ai/world/sqlite`
- lineage services and public lineage types
- governance services, authority handlers, proposal lifecycle types, and intent-instance helpers
- coordinator/runtime-based sealing and post-commit event dispatch
- the world-owned execution seam used by governed runtimes

## When to Use It

Use `@manifesto-ai/world` when you want:

- explicit legitimacy and lineage semantics
- a canonical package for proposal evaluation, execution, and sealing
- direct access to split-native governance and lineage APIs
- the facade-owned `GovernedWorldStore` / `WorldRuntime` / `WorldCoordinator` surface

## Quick Start

```typescript
import {
  createIntentInstance,
  createGovernanceEventDispatcher,
  createGovernanceService,
  createLineageService,
  createWorld,
} from "@manifesto-ai/world";
import { createSqliteWorldStore } from "@manifesto-ai/world/sqlite";

const executor = {
  async execute(key, snapshot, intent) {
    return {
      outcome: "completed",
      terminalSnapshot: snapshot,
    };
  },
};

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

const intent = await createIntentInstance({
  body: { type: "counter.increment", input: { amount: 1 } },
  schemaHash: "counter-v1",
  projectionId: "counter-cli",
  source: { kind: "script", eventId: "evt-1" },
  actor: { actorId: "local-user", kind: "human" },
  intentId: "intent-1",
});
```

For the smallest runnable governed bootstrap, see [examples/governed-minimal-node](../../examples/governed-minimal-node/README.md).

`createSqliteWorldStore()` is the default Node-local durable path from `@manifesto-ai/world/sqlite`. `createInMemoryWorldStore()` lives in `@manifesto-ai/world/in-memory` for tests and local composition. `createIndexedDbWorldStore()` lives in `@manifesto-ai/world/indexeddb` for browser durability.

## Main Exports

- `createWorld()`
- `createLineageService()`
- `createGovernanceService()`
- `createGovernanceEventDispatcher()`
- `createIntentInstance()`
- `createIntentInstanceSync()`
- `computeIntentKey()`
- `GovernedWorldStore`
- `WorldRuntime`
- `WorldExecutor`
- `WorldCoordinator`
- `WorldInstance`

## Adapter Subpaths

- `@manifesto-ai/world/in-memory`
- `@manifesto-ai/world/indexeddb`
- `@manifesto-ai/world/sqlite`

## Docs

- [Docs Landing](docs/README.md)
- [World Guide](docs/GUIDE.md)
- [World Facade Spec](docs/world-facade-spec-v2.0.0.md)
- [Historical Facade v1 Baseline](docs/world-facade-spec-v1.0.0.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
