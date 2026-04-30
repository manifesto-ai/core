# @manifesto-ai/lineage

> Seal-aware continuity for the ADR-017 decorator runtime.

`@manifesto-ai/lineage` is the package that adds time, history, and restore to a composable manifesto.

> **Current Contract Note:** The current package contract is [docs/lineage-SPEC.md](docs/lineage-SPEC.md). The v2 lineage spec remains as the historical service-first baseline.

## What This Package Owns

- `withLineage(createManifesto(...), config).activate()`
- lineage-mode `actions.<name>.submit(...)` that seals before publication
- restore, head, branch, and world queries on the activated runtime
- `getWorldSnapshot(worldId)` for stored sealed canonical snapshot lookup
- `getLineage()` for DAG inspection on the activated runtime
- sealing substrate and the provider surface
- deterministic world identity, branch semantics, and restore normalization

## Canonical Path

```ts
import { createManifesto } from "@manifesto-ai/sdk";
import { withLineage, createInMemoryLineageStore } from "@manifesto-ai/lineage";

const manifesto = createManifesto<CounterDomain>(schema, effects);
const lineage = withLineage(manifesto, {
  store: createInMemoryLineageStore(),
}).activate();

await lineage.actions.increment.submit();

const head = await lineage.getLatestHead();
if (head) {
  await lineage.restore(head.worldId);
}
```

## Low-Level Usage

Use `@manifesto-ai/lineage/provider` when you need `LineageService`, `LineageStore`, prepared commits, or custom persistence without the activated runtime wrapper.

## Docs

- [Docs Landing](docs/README.md)
- [Lineage Guide](docs/GUIDE.md)
- [Lineage Specification](docs/lineage-SPEC.md)
- [Historical v2 Service-First SPEC](docs/lineage-SPEC-2.0.0v.md)
- [VERSION-INDEX](docs/VERSION-INDEX.md)
