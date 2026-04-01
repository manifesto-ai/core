# @manifesto-ai/sdk

> Activation-first base runtime entry point for Manifesto.

## Overview

`@manifesto-ai/sdk` owns one concept: `createManifesto()`.

Use SDK when you want:

- the shortest path to a running base world
- a clear activation boundary before runtime execution
- typed intent creation through `MEL.actions.*`
- subscriptions, availability queries, and snapshot reads in one package

The current SDK contract is:

`createManifesto(schema, effects) -> activate() -> base runtime instance`

## SDK-Owned Surface

- `createManifesto()`
- `activate()`
- activated base runtime:
  - `createIntent`
  - `dispatchAsync`
  - `subscribe`
  - `on`
  - `getSnapshot`
  - `getAvailableActions`
  - `isActionAvailable`
  - `MEL`
  - `dispose`
- SDK error types

## Base Runtime Example

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(domainSchema, {});
const world = manifesto.activate();

const intent = world.createIntent(world.MEL.actions.increment);
await world.dispatchAsync(intent);

world.isActionAvailable("increment");
world.getAvailableActions();
world.getSnapshot();
```

## Governed Composition Direction

The forward public direction under ADR-017 is:

`createManifesto() -> withLineage() -> withGovernance() -> activate()`

Those governed runtime contracts belong to the owning `@manifesto-ai/lineage` and `@manifesto-ai/governance` packages. Legacy world-facade docs are transitional, not the SDK's canonical current story.

## Related Docs

- [Lineage API](./lineage.md)
- [Governance API](./governance.md)
- [World API](./world.md)
- [Quickstart](/quickstart)
- [Governed Composition Guide](/guides/governed-composition)
