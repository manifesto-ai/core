# @manifesto-ai/world

> Historical facade package removed from the active workspace in ADR-017 Phase 4.

## Status

`@manifesto-ai/world` is no longer part of the active package graph, build matrix, or public runtime story.

It used to provide:

- `createWorld`
- facade-owned store adapters
- one-package governed runtime assembly
- top-level re-exports for lineage and governance helpers

That facade path was hard-cut removed. There is no compatibility shell.

## Current Replacement

Use the decorator chain directly:

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { withLineage } from "@manifesto-ai/lineage";
import { withGovernance } from "@manifesto-ai/governance";

const governed = withGovernance(
  withLineage(createManifesto(schema, effects), lineageConfig),
  governanceConfig,
).activate();
```

Ownership is now split explicitly:

- `@manifesto-ai/sdk` owns `createManifesto()` and `activate()`
- `@manifesto-ai/lineage` owns continuity, seal-aware publication, restore, and branch/head queries
- `@manifesto-ai/governance` owns proposal flow, bindings, approval, rejection, and decision visibility

No direct replacement for the old `world/sqlite`, `world/in-memory`, or `world/indexeddb` adapter story landed in this phase.

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/sdk](./sdk.md) | Base activation-first runtime |
| [@manifesto-ai/lineage](./lineage.md) | Governed continuity package |
| [@manifesto-ai/governance](./governance.md) | Governed legitimacy package |
