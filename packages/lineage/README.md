# @manifesto-ai/lineage

> Seal-aware continuity for the ADR-017 decorator runtime.

`@manifesto-ai/lineage` is the package that adds time, history, and restore to a composable manifesto.

> **Current Contract Note:** The truthful current package contract is [docs/lineage-SPEC-v3.0.0-draft.md](docs/lineage-SPEC-v3.0.0-draft.md). The v2 lineage spec remains as the historical service-first baseline.

## What This Package Owns

- `withLineage(createManifesto(...), config).activate()`
- lineage-aware `dispatchAsync` that seals before publication
- restore, head, branch, and world queries on the activated runtime
- `LineageStore`, `LineageService`, and sealing substrate
- deterministic world identity, branch semantics, and restore normalization

## Canonical Path

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { withLineage, createInMemoryLineageStore } from "@manifesto-ai/lineage";

const manifesto = createManifesto<CounterDomain>(schema, effects);
const world = withLineage(manifesto, {
  store: createInMemoryLineageStore(),
}).activate();

await world.dispatchAsync(
  world.createIntent(world.MEL.actions.increment),
);

const head = await world.getLatestHead();
if (head) {
  await world.restore(head.worldId);
}
```

## Low-Level Usage

`LineageService` and `LineageStore` remain public. Use them directly when you need hashing, prepared commits, branch inspection, or custom persistence without the activated runtime wrapper.

## Docs

- [Docs Landing](docs/README.md)
- [Lineage Guide](docs/GUIDE.md)
- [Lineage Specification](docs/lineage-SPEC-v3.0.0-draft.md)
- [Historical v2 Service-First SPEC](docs/lineage-SPEC-2.0.0v.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
