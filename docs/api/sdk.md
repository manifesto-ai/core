# @manifesto-ai/sdk

> Thin public API layer for the Manifesto protocol stack.

## Overview

`@manifesto-ai/sdk` owns one concept: `createManifesto()`.

Everything else is either:

- SDK utility (`defineOps`, `dispatchAsync`)
- pass-through protocol re-export from Core, Host, or World

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

## Related Docs

- [SDK README](../../packages/sdk/README.md)
- [SDK SPEC v2.0.0](../../packages/sdk/docs/sdk-SPEC-v2.0.0.md)
- [World API](./world.md)
