# @manifesto-ai/sdk

> Activation-first entry point for Manifesto applications.

`@manifesto-ai/sdk` is the default package for applications that start with `createManifesto()`.

> **Current Contract Note:** The truthful current SDK contract is the ADR-017 activation model documented in [docs/sdk-SPEC-v3.0.0-draft.md](docs/sdk-SPEC-v3.0.0-draft.md). The filename still says `draft`, but the activation-first decorator runtime is the current landed contract.

## What This Package Owns

- `createManifesto()`
- the activation boundary via `activate()`
- the present-only base runtime returned after activation
- SDK error types
- selected Core pass-through types used by SDK signatures

## When to Use It

Use the SDK when you want:

- the shortest path to a running base world
- typed intent creation through `MEL.actions.*`
- `dispatchAsync`, subscriptions, availability queries, and snapshot reads in one package
- a clear boundary between law composition and runtime execution

## Activation Lifecycle

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(counterSchema, {});
const world = manifesto.activate();

const intent = world.createIntent(world.MEL.actions.increment);
await world.dispatchAsync(intent);

world.isActionAvailable("increment");
world.getAvailableActions();
world.getSnapshot();
```

The canonical SDK lifecycle is:

1. build a composable manifesto with `createManifesto(schema, effects)`
2. open it once with `activate()`
3. create typed intents from `world.MEL.actions.*`
4. execute with instance-owned `dispatchAsync()`
5. observe through `subscribe()` / `on()` and read through `getSnapshot()`

## Base Runtime Surface

The activated base runtime exposes:

- `createIntent`
- `dispatchAsync`
- `subscribe`
- `on`
- `getSnapshot`
- `getAvailableActions`
- `isActionAvailable`
- `MEL`
- `dispose`

## Governed Composition Direction

SDK no longer re-exports the old World facade or its bootstrap helpers.

The public direction under ADR-017 is:

`createManifesto() -> withLineage() -> withGovernance() -> activate()`

Those governed runtime contracts land in the owning `@manifesto-ai/lineage` and `@manifesto-ai/governance` packages. Older world-facade docs are historical tombstones rather than current guidance.

## Docs

- [SDK Guide](docs/GUIDE.md)
- [SDK Specification v3](docs/sdk-SPEC-v3.0.0-draft.md)
- [SDK Specification v2](docs/sdk-SPEC-v2.0.0.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
