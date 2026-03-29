# @manifesto-ai/sdk

> Thin public API layer for the Manifesto protocol stack.

## Overview

`@manifesto-ai/sdk` owns one concept: `createManifesto()`.

Everything else is either:

- SDK utility (`defineOps`, `dispatchAsync`)
- pass-through protocol re-export from Core, Host, or the thin world facade surface

After the hard cut, SDK re-exports only the thin governed World surface:

- `createWorld()`
- `createInMemoryWorldStore()`
- `CommitCapableWorldStore`
- `GovernanceEventDispatcher`
- `WorldCoordinator`
- `WorldConfig`
- `WorldInstance`
- `CoordinatorSealNextParams`
- `CoordinatorSealGenesisParams`
- `SealResult`
- `WriteSet`

SDK does not re-export the full split-native governance or lineage API. Use `@manifesto-ai/world` directly when you need the complete governed surface.

## Main Factory

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto({
  schema: domainSchema,
  effects: {},
});
```

`createManifesto()` remains a direct-dispatch runtime and does not implicitly assemble governed World composition.

## Governed Composition

```typescript
import {
  createWorld,
  createInMemoryWorldStore,
} from "@manifesto-ai/sdk";
```

These are thin pass-through re-exports from `@manifesto-ai/world`.

If you need `createGovernanceService()`, `createLineageService()`, proposal lifecycle types, authority handlers, or lineage query APIs, import from top-level `@manifesto-ai/world`, `@manifesto-ai/governance`, or `@manifesto-ai/lineage` directly.

## Related Docs

- [Quickstart](/quickstart)
- [Tutorial](/tutorial/)
- [World API](./world.md)
- [Specifications](/internals/spec/)
