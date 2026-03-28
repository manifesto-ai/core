# @manifesto-ai/sdk

> Thin public API layer for the Manifesto protocol stack.

`@manifesto-ai/sdk` remains the canonical entry point for direct-dispatch applications through `createManifesto()`.

## What SDK Owns

- `createManifesto()`
- `dispatchAsync()`
- `defineOps()`
- selected Core, Host, and World re-exports

## Governed World Re-exports

SDK now exposes only the thin governed World surface:

```typescript
import {
  createInMemoryWorldStore,
  createManifesto,
  createWorld,
} from "@manifesto-ai/sdk";
```

These are pass-through re-exports from top-level `@manifesto-ai/world`.

SDK does not re-export the full governance or lineage API. If you need split-native services such as `createGovernanceService()` or `createLineageService()`, import them from `@manifesto-ai/world`.

## Direct Dispatch Example

```typescript
import { createManifesto, createIntent } from "@manifesto-ai/sdk";

const manifesto = createManifesto({
  schema: counterSchema,
  effects: {},
});

manifesto.dispatch(createIntent("increment", "intent-1"));
```

## Governed Composition Example

```typescript
import {
  createInMemoryWorldStore,
  createWorld,
} from "@manifesto-ai/sdk";
```

Use the SDK re-exports when you only need the facade-owned world assembly types and factories. Use `@manifesto-ai/world` directly for the full governed surface.

## Documentation

- [SDK SPEC v2.0.0](docs/sdk-SPEC-v2.0.0.md)
- [VERSION-INDEX.md](docs/VERSION-INDEX.md)
- [World API](../../docs/api/world.md)
