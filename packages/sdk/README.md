# @manifesto-ai/sdk

> Activation-first entry point for Manifesto applications.

`@manifesto-ai/sdk` is the default package for applications that start with `createManifesto()`.

> **Current Contract Note:** The current SDK contract is the living v3.6.0 activation-first model documented in [docs/sdk-SPEC.md](docs/sdk-SPEC.md). It includes typed `createIntent()` object binding, intent explanation reads, `@manifesto-ai/sdk/extensions`, and `createSimulationSession(instance)`.

## When to Use It

Use the SDK when you want:

- the shortest path to a running base runtime
- typed intent creation through `MEL.actions.*`
- `dispatchAsync`, subscriptions, legality queries, explanation reads, dry-run simulation, and snapshot reads in one package
- projected Snapshot reads by default, with canonical inspection available explicitly
- safe post-activation arbitrary-snapshot tooling through `@manifesto-ai/sdk/extensions`

## Smallest Example

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(counterSchema, {});
const instance = manifesto.activate();

const intent = instance.createIntent(instance.MEL.actions.increment);
await instance.dispatchAsync(intent);
console.log(instance.getSnapshot().data.count);
```

Base runtime reads cover availability, dispatchability, intent explanation, dry-run simulation, subscriptions, events, and both projected and canonical snapshot access.

If you need review, approval, or sealed history later, compose `@manifesto-ai/lineage` and `@manifesto-ai/governance` before `activate()`. If you need arbitrary-snapshot tooling after activation, use `@manifesto-ai/sdk/extensions`.

## Docs

- [Public API Reference](../../docs/api/sdk.md)
- [SDK Guide](docs/GUIDE.md)
- [SDK Specification](docs/sdk-SPEC.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
