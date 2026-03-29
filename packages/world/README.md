# @manifesto-ai/world

> Canonical governed composition package for Manifesto.

`@manifesto-ai/world` is the exact facade for governed composition. It combines lineage, governance, and the facade-owned coordinator/store types behind a single top-level package.

## What This Package Owns

- governed composition through `createWorld()`
- in-memory composite storage through `createInMemoryWorldStore()`
- lineage services and public lineage types
- governance services, authority handlers, proposal lifecycle types, and intent-instance helpers
- coordinator-based sealing and post-commit event dispatch

## When to Use It

Use `@manifesto-ai/world` when you want:

- explicit legitimacy and lineage semantics
- a canonical package for proposal evaluation and sealing
- direct access to split-native governance and lineage APIs
- the facade-owned `CommitCapableWorldStore` / `WorldCoordinator` surface

## Quick Start

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

## Main Exports

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

## Docs

- [Docs Landing](docs/README.md)
- [World Guide](docs/GUIDE.md)
- [World Facade Spec](docs/world-facade-spec-v1.0.0.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
