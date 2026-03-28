# @manifesto-ai/world

> Canonical governed composition surface for Manifesto.

`@manifesto-ai/world` is now the exact facade surface for governed composition. It re-exports split-native governance and lineage APIs plus the facade-owned store and coordinator used to seal worlds.

`@manifesto-ai/world/facade` remains available as a temporary alias, but the canonical import path is the top-level package.

## What This Package Owns

- governed composition through `createWorld()`
- in-memory composite storage through `createInMemoryWorldStore()`
- lineage services and types
- governance services, authority handlers, proposal lifecycle types, and intent-instance helpers
- coordinator-based sealing and post-commit event dispatch

## Quick Start

```typescript
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryWorldStore,
  createIntentInstance,
  createLineageService,
  createWorld,
} from "@manifesto-ai/world";

const store = createInMemoryWorldStore();
const lineage = createLineageService(store);
const governance = createGovernanceService(store, {
  lineageService: lineage,
});
const eventDispatcher = createGovernanceEventDispatcher({
  service: governance,
});

const world = createWorld({
  store,
  lineage,
  governance,
  eventDispatcher,
});

const intent = await createIntentInstance({
  body: {
    type: "todo.add",
    input: { title: "Ship the hard cut" },
  },
  schemaHash: "todo-v1",
  projectionId: "todo-ui",
  source: { kind: "ui", eventId: "evt-1" },
  actor: { actorId: "user-1", kind: "human" },
});
```

## Composition Model

```text
participant -> @manifesto-ai/world -> Governance + Lineage -> Host -> Core
```

`createWorld()` is a thin assembler. Proposal creation, authority evaluation, lineage preparation, and sealing remain explicit protocol steps.

## Main Facade Exports

- `createWorld()`
- `createInMemoryWorldStore()`
- `createLineageService()`
- `createGovernanceService()`
- `createGovernanceEventDispatcher()`
- `createIntentInstance()`
- `createIntentInstanceSync()`
- `computeIntentKey()`
- `CommitCapableWorldStore`
- `WorldCoordinator`
- `WorldInstance`
- full governance and lineage type surface

## Documentation

- [World Guide](docs/GUIDE.md)
- [World Package Docs](docs/README.md)
- [World API](../../docs/api/world.md)
- [World Concept](../../docs/concepts/world.md)
- [World Facade Spec](docs/world-facade-spec-v1.0.0.md)
