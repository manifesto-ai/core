# @manifesto-ai/sdk

> Activation-first entry point for Manifesto applications.

`@manifesto-ai/sdk` is the default package for applications that start with `createManifesto()`.

> **Current Contract Note:** The current SDK contract is the activation-first v5 model documented in [docs/sdk-SPEC.md](docs/sdk-SPEC.md). It includes typed action candidates through `actions.*`, projected `snapshot()` reads, `observe`, `inspect`, `@manifesto-ai/sdk/extensions`, and `createSimulationSession(app)`.

## When to Use It

Use the SDK when you want:

- the shortest path to a running base runtime
- typed action submission through `actions.*`
- optional typed effect authoring through `@manifesto-ai/sdk/effects`
- action-candidate check/preview/submit, observers, legality queries, optional trace diagnostics, and snapshot reads in one package
- projected Snapshot reads by default, with canonical inspection available explicitly
- safe post-activation arbitrary-snapshot tooling through `@manifesto-ai/sdk/extensions`

## Smallest Example

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const manifesto = createManifesto<CounterDomain>(counterSchema, {});
const app = manifesto.activate();

await app.actions.increment.submit();
console.log(app.snapshot().state.count);
```

Base runtime reads cover availability, dispatchability, intent explanation, dry-run simulation, optional debug-grade trace diagnostics, subscriptions, events, and both projected and canonical snapshot access.

Effect authoring helpers live on the dedicated `@manifesto-ai/sdk/effects` subpath. The root package stays centered on `createManifesto()`.

If you need review, approval, or sealed history later, compose `@manifesto-ai/lineage` and `@manifesto-ai/governance` before `activate()`. If you need arbitrary-snapshot tooling after activation, use `@manifesto-ai/sdk/extensions`.

## Docs

- [Public API Reference](../../docs/api/sdk.md)
- [SDK Guide](docs/GUIDE.md)
- [SDK Specification](docs/sdk-SPEC.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
