# @manifesto-ai/world

> Governance, authority, and lineage layer for Manifesto

---

## Overview

`@manifesto-ai/world` now has two surfaces:

- the legacy top-level orchestrator, kept for compatibility
- the additive governed composition surface, centered on `createWorld()` and `createInMemoryWorldStore()`

The full split-native facade remains available at `@manifesto-ai/world/facade`.

- Actor registration + authority policy binding
- Proposal evaluation + decision recording
- World creation + lineage edges
- Branch/head query and resume support

---

## ADR-009 Persistence Notes

World-integrated stores handling deltas must enforce serialized patch versioning.

```typescript
type PersistedPatchDeltaV2 = {
  _patchFormat: 2;
  patches: readonly Patch[];
};
```

Rules:
- Accept only `_patchFormat: 2` at restore boundary.
- Reject `_patchFormat: 1` or missing tag.
- On rejection, runtime/app must re-initialize from genesis (epoch reset policy).

---

## Main Exports

### Legacy Orchestrator: createManifestoWorld()

```typescript
import { createManifestoWorld } from "@manifesto-ai/world";

const world = createManifestoWorld({
  schemaHash: "schema-hash-v1",
  executor,
  store,
});
```

`createManifestoWorld()` remains supported, but it is deprecated for new integrations. Use the additive facade path for new governed composition.

### Canonical Governed Composition: createWorld()

```typescript
import {
  createInMemoryWorldStore,
  createWorld,
} from "@manifesto-ai/world";

const store = createInMemoryWorldStore();
const world = createWorld({
  store,
  lineage,
  governance,
  eventDispatcher,
});
```

Use this path when you want the world facade to compose governance and lineage explicitly.

### Key Types

```typescript
interface World {
  worldId: WorldId;
  schemaHash: string;
  snapshotHash: string;
  createdAt: number;
  createdBy: string | null;
}

type WorldHead = {
  worldId: WorldId;
  branchId: string;
  branchName: string;
  createdAt: number;
  schemaHash: string;
};
```

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/core](./core) | Pure computation |
| [@manifesto-ai/host](./host) | Executes approved intents |
| [@manifesto-ai/sdk](./sdk) | Public facade that re-exports additive world integration points |
