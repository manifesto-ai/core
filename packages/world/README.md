# @manifesto-ai/world

> Canonical governed composition package for Manifesto.

`@manifesto-ai/world` is the exact facade for governed composition. It combines lineage, governance, and the facade-owned coordinator/store types behind a single top-level package.

> **Current Contract Note:** The current public package contract is documented in [docs/world-facade-spec-v1.0.0.md](docs/world-facade-spec-v1.0.0.md). The projected ADR-015 + ADR-016 rewrite lives in [docs/world-facade-spec-v2.0.0.md](docs/world-facade-spec-v2.0.0.md) as draft only.

## What This Package Owns

- governed composition through `createWorld()`
- composite storage through `createInMemoryWorldStore()`, `createIndexedDbWorldStore()`, and `createSqliteWorldStore()`
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
  createSqliteWorldStore,
  createWorld,
} from "@manifesto-ai/world";

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

`createSqliteWorldStore()` is the default Node-local durable path. `createInMemoryWorldStore()` is the driver-backed reference adapter used for tests and local composition. `createIndexedDbWorldStore()` remains the browser durable option on the same async `GovernedWorldStore` seam.

## Main Exports

- `createWorld()`
- `createInMemoryWorldStore()`
- `createIndexedDbWorldStore()`
- `createSqliteWorldStore()`
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

## Docs

- [Docs Landing](docs/README.md)
- [World Guide](docs/GUIDE.md)
- [World Facade Spec](docs/world-facade-spec-v1.0.0.md)
- [World Facade Spec v2 Draft](docs/world-facade-spec-v2.0.0.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
