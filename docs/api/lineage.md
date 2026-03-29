# @manifesto-ai/lineage

> Continuity protocol for immutable world history.

## Overview

`@manifesto-ai/lineage` owns deterministic world identity, branch/head state, seal preparation, replay, and continuity queries.

> **Current Contract Note:** This page describes the current Lineage v1.0.1 surface. The projected v2.0.0 rewrite is draft-only in [packages/lineage/docs/lineage-SPEC-2.0.0v.md](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC-2.0.0v.md).

Use this package directly when you want:

- lineage-only tests or tooling
- direct access to branch/head/query APIs
- explicit control over lineage stores and services
- continuity logic without the rest of governed world assembly

If you are assembling a full governed runtime, top-level `@manifesto-ai/world` remains the canonical package because it re-exports lineage together with governance and the facade-owned coordinator/store surface.

## Main Runtime Surface

```typescript
import {
  createLineageService,
  InMemoryLineageStore,
  computeSnapshotHash,
  computeWorldId,
} from "@manifesto-ai/lineage";
```

## What This Package Owns

- `LineageStore` and `InMemoryLineageStore`
- `LineageService` and `createLineageService()`
- immutable world, branch, and head types
- seal preparation and commit helpers
- deterministic identity helpers such as `computeSnapshotHash()` and `computeWorldId()`
- lineage queries such as replay, world lookup, branch lookup, and head selection

## Relationship to World

```text
@manifesto-ai/world
  -> re-exports @manifesto-ai/lineage
  -> adds governance composition and sealing coordination
```

Use `@manifesto-ai/lineage` directly when continuity is your concern. Use `@manifesto-ai/world` when you need governed composition.

## Related Docs

- [World API](./world.md)
- [Governance API](./governance.md)
- [Specifications](/internals/spec/)
- [Lineage v2 Draft SPEC](https://github.com/manifesto-ai/core/blob/main/packages/lineage/docs/lineage-SPEC-2.0.0v.md)
