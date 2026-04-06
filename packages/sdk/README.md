# @manifesto-ai/sdk

> Activation-first entry point for Manifesto applications.

`@manifesto-ai/sdk` is the default package for applications that start with `createManifesto()`.

> **Current Contract Note:** The current SDK contract is the living v3.1.0 activation-and-introspection model documented in [docs/sdk-SPEC.md](docs/sdk-SPEC.md).

## What This Package Owns

- `createManifesto()`
- the activation boundary via `activate()`
- the direct-dispatch base runtime returned after activation
- SDK error types
- selected Core pass-through types used by SDK signatures

## When to Use It

Use the SDK when you want:

- the shortest path to a running base runtime
- typed intent creation through `MEL.actions.*`
- `dispatchAsync`, subscriptions, availability queries, action metadata inspection, static graph inspection, dry-run simulation, and snapshot reads in one package
- projected Snapshot reads by default, with canonical inspection available explicitly
- a clear boundary between law composition and runtime execution

## Activation Lifecycle

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(counterSchema, {});
const instance = manifesto.activate();

const intent = instance.createIntent(instance.MEL.actions.increment);
await instance.dispatchAsync(intent);

instance.isActionAvailable("increment");
instance.getAvailableActions();
instance.getSnapshot();
instance.getCanonicalSnapshot();
instance.getSchemaGraph();
instance.simulate(instance.MEL.actions.increment);
```

The canonical SDK lifecycle is:

1. build a composable manifesto with `createManifesto(schema, effects)`
2. open it once with `activate()`
3. create typed intents from `instance.MEL.actions.*`
4. execute with instance-owned `dispatchAsync()`
5. observe through `subscribe()` / `on()` and read through `getSnapshot()`

`getSnapshot()` is the projected application-facing read surface. `getCanonicalSnapshot()` is the explicit escape hatch for full substrate inspection.

## Base Runtime Surface

The activated base runtime exposes:

- `createIntent`
- `dispatchAsync`
- `subscribe`
- `on`
- `getSnapshot`
- `getCanonicalSnapshot`
- `getAvailableActions`
- `getActionMetadata`
- `isActionAvailable`
- `getSchemaGraph`
- `simulate`
- `MEL`
- `schema`
- `dispose`

`getSchemaGraph()` exposes the projected static dependency graph for the activated schema. `simulate()` is a non-committing dry-run convenience that returns the projected next snapshot, effect requirements, new availability, and sorted `changedPaths`. `changedPaths` is inspection/debug output, not the canonical branching API.

## Governed Composition Direction

SDK no longer re-exports the old World facade or its bootstrap helpers.

The public direction under ADR-017 is:

`createManifesto() -> withLineage() -> withGovernance() -> activate()`

Those governed runtime contracts land in the owning `@manifesto-ai/lineage` and `@manifesto-ai/governance` packages. Older world-facade docs are historical tombstones rather than current guidance.

## Docs

- [SDK Guide](docs/GUIDE.md)
- [SDK Specification](docs/sdk-SPEC.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
