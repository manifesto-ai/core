# Governed Composition

> Assemble a local governed runtime with top-level `@manifesto-ai/world`.

Use governed composition when you need explicit proposal approval, lineage continuity, sealed worlds, or auditable runtime events. If you only need direct dispatch, stay on `@manifesto-ai/sdk` and `createManifesto()`.

## The Node-Local Path

For the first governed consumer path, use:

- `createSqliteWorldStore()` from `@manifesto-ai/world/sqlite` for local durability
- `createLineageService()` for continuity
- `createGovernanceService()` for proposal lifecycle
- `createWorld()` for the assembled runtime
- `world.runtime.executeApprovedProposal()` for the canonical happy path

## Minimal Assembly

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

## Canonical Flow

1. Bootstrap the first sealed world with `world.coordinator.sealGenesis(...)`.
2. Build an `IntentInstance` with actor/source metadata.
3. Create a proposal and prepare an approval result.
4. Persist the `executing` proposal and decision record.
5. Call `world.runtime.executeApprovedProposal(...)`.
6. Read the sealed result through `world.lineage.restore(...)`.

## Store Choices

- `@manifesto-ai/world/sqlite` is the default Node-local durable path.
- `@manifesto-ai/world/in-memory` is the fast ephemeral path for tests.
- `@manifesto-ai/world/indexeddb` is the browser durable option.

The runtime assembly stays the same; only the store factory changes.

## Runnable Reference

See `examples/governed-minimal-node` in the repository for the smallest end-to-end governed bootstrap in this repo.

## See Also

- [World API](/api/world)
- [SDK API](/api/sdk)
- `packages/world/docs/GUIDE.md`
