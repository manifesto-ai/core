# @manifesto-ai/world

> Governance, authority, and lineage layer for Manifesto

---

## Overview

`@manifesto-ai/world` governs proposal legitimacy and records immutable lineage.

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

### createManifestoWorld()

```typescript
import { createManifestoWorld } from "@manifesto-ai/world";

const world = createManifestoWorld({
  schemaHash: "schema-hash-v1",
  executor,
  store,
});
```

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
| [@manifesto-ai/sdk](./sdk) | Public facade using World |
